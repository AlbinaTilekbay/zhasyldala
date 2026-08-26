"""Single entry point both diagnosis flows (anonymous home-plant photo and
greenhouse sector video frame) call: `diagnose_image`. Keeps the "which
model, which fallback, whether to also call Pl@ntNet / Kindwise" decision
in one place per the plan's `ml` app design.
"""
import logging
import random

from . import kindwise, plant_health
from .model_def import TORCH_AVAILABLE
from .plantnet import identify_species
from .registry import get_active_model

logger = logging.getLogger(__name__)

# Below this, a forced top-1 guess is more likely noise than signal —
# especially for the anonymous home-plant flow (crop=None), which scores
# across every crop the model knows at once, so a photo of a plant it was
# never trained on (a rose, a succulent, ...) would otherwise still get
# confidently matched to whichever trained class happens to score highest.
# Treat anything under this as "no real answer" and fall through to
# Kindwise/the neutral fallback instead of asserting a wrong diagnosis.
MIN_CONFIDENCE = 0.35


def _fallback_result(crop=None):
    """No trained model yet (fresh install, or torch not installed) — still
    returns *something* so the whole pipeline (upload -> result screen)
    works, instead of the app being unusable until day-one training
    finishes. Clearly marked source="rule" so it's never confused with a
    real prediction, and stays 'ok' rather than guessing a disease."""
    from apps.diagnosis.models import Severity

    return {
        "disease": None,
        "severity": Severity.OK,
        "confidence": 0.0,
        "symptoms_seen": [],
        "recommendations": [
            "Модель әлі оқытылмаған — нәтиже алдын ала белгіленген. "
            "Admin/Оқыту бетінен алғашқы модельді іске қосыңыз.",
        ],
        "source": "rule",
        "model_version": None,
    }


def _resolve_disease(crop, disease_slug):
    from apps.diagnosis.models import Disease

    if not disease_slug:
        return None
    return Disease.objects.filter(crop=crop, slug=disease_slug, is_active=True).first()


def _predict_with_model(image_path, crop):
    labels, model, transform = get_active_model()
    if not labels or model is None:
        return None

    # A single global model may know several crops (e.g. tomato + pepper +
    # strawberry from bootstrap_plantvillage). Score only the classes that
    # belong to the requested crop — otherwise a crop the model was never
    # trained on (cucumber, eggplant, ...) would silently get scored
    # against unrelated classes and return a meaningless top guess instead
    # of falling through to Kindwise/the fallback below, where it belongs.
    if crop is not None:
        candidate_idx = [i for i, l in enumerate(labels) if l.get("crop_slug") == crop.slug]
        if not candidate_idx:
            return None
    else:
        candidate_idx = list(range(len(labels)))

    import torch
    from PIL import Image

    image = Image.open(image_path).convert("RGB")
    tensor = transform(image).unsqueeze(0)
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
    top_idx = max(candidate_idx, key=lambda i: probs[i].item())
    confidence = float(probs[top_idx].item())
    if confidence < MIN_CONFIDENCE:
        return None
    label = labels[top_idx]

    from apps.diagnosis.models import Severity
    from apps.ml_training.models import ModelVersion

    disease = _resolve_disease(crop, label.get("disease_slug"))
    severity = disease.severity if disease else Severity.OK
    active_version = ModelVersion.objects.filter(status=ModelVersion.Status.ACTIVE).order_by("-activated_at").first()

    return {
        "disease": disease,
        "severity": severity,
        "confidence": confidence,
        "symptoms_seen": disease.symptoms if disease else [],
        "recommendations": disease.recommendations if disease else [],
        "source": "custom_model",
        "model_version": active_version,
    }


def diagnose_image(image_path: str, crop=None) -> dict:
    """Runs the active custom model (if any); if it has nothing for this
    crop (untrained, or a crop it was never trained on — see
    _predict_with_model), falls through to a paid API when one is
    configured — plant.id's health_assessment for the anonymous
    home-plant flow (crop=None: houseplants/ornamentals, e.g. an orchid —
    see apps/ml/plant_health.py), or Kindwise's crop.health for a
    greenhouse crop (see apps/ml/kindwise.py) — and only then to the
    neutral "not trained yet" placeholder. Also makes a Pl@ntNet
    species-confirmation call when configured. Always returns a usable
    dict — never raises, so a Celery task calling this can safely mark
    its DiagnosisRequest 'done' either way."""
    result = None
    if TORCH_AVAILABLE:
        try:
            result = _predict_with_model(image_path, crop)
        except Exception:  # noqa: BLE001
            logger.exception("Custom-model inference failed, falling back")
            result = None

    if result is None:
        try:
            result = plant_health.diagnose(image_path) if crop is None else kindwise.diagnose(image_path)
        except Exception:  # noqa: BLE001
            logger.exception("External diagnosis API call failed, falling back")
            result = None

    if result is None:
        result = _fallback_result(crop)

    species = identify_species(image_path)
    if species and species.get("species"):
        result["species_guess"] = species["species"]
    else:
        result.setdefault("species_guess", "")

    return result


def random_bootstrap_result(crop=None):
    """Used only by tests/demos when neither a trained model nor Pl@ntNet
    are available, to exercise the full UI without either."""
    return _fallback_result(crop)
