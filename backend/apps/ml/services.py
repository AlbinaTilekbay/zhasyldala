"""Single entry point both diagnosis flows call: diagnose_images() (photo
group — a greenhouse sector's 3-10 captured photos analyzed together) and
its diagnose_image() single-photo wrapper (the anonymous home-plant flow).
Keeps the "OpenAI vision first, offline model as fallback" decision in one
place per the plan's `ml` app design.
"""
import logging

from . import openai_vision
from .model_def import TORCH_AVAILABLE
from .registry import get_active_model

logger = logging.getLogger(__name__)

# Below this, a forced top-1 guess from the offline model is more likely
# noise than signal — especially for the anonymous home-plant flow
# (crop=None), which scores across every crop the model knows at once, so
# a photo of a plant it was never trained on (a rose, a succulent, ...)
# would otherwise still get confidently matched to whichever trained class
# happens to score highest. Treat anything under this as "no real answer"
# and fall through to the neutral fallback instead of asserting a wrong
# diagnosis.
MIN_CONFIDENCE = 0.35


def _fallback_result(crop=None):
    """Neither OpenAI (no key / no internet / call failed) nor a trained
    offline model has an answer — still returns *something* so the whole
    pipeline (upload -> result screen) works. Clearly marked source="rule"
    so it's never confused with a real prediction, and stays 'ok' rather
    than guessing a disease."""
    from apps.diagnosis.models import Severity

    return {
        "disease": None,
        "severity": Severity.OK,
        "confidence": 0.0,
        "symptoms_seen": [],
        "recommendations": [
            "Интернет байланысы жоқ немесе OpenAI кілті орнатылмаған, ал "
            "меншікті модель әлі оқытылмаған — нәтиже алдын ала белгіленген. "
            "Admin/Оқыту бетінен алғашқы модельді іске қосыңыз немесе "
            "интернетті тексеріп қайталаңыз.",
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
    # of falling through to the fallback below, where it belongs.
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


def diagnose_images(image_paths: list, crop=None) -> dict:
    """Primary: OpenAI vision, given one OR SEVERAL photos of the same
    subject at once (a greenhouse sector's 3-10 captured photos, or a
    single home-plant photo) — it recognizes the plant/condition directly
    and produces the cause/treatment/prevention/encouragement cards in the
    same call, synthesizing one combined verdict when given several photos
    instead of judging each separately (see apps/ml/openai_vision.py).
    Falls through to the locally trained PlantVillage model (offline,
    free, but only knows tomato/pepper/strawberry plus whatever's added
    via the admin training page — and only ever looks at the FIRST photo,
    since it isn't a multi-image model) when OPENAI_API_KEY isn't set or
    the call fails — most commonly no internet connection — and only then
    to the neutral "no answer" placeholder. Always returns a usable dict —
    never raises, so a Celery task calling this can safely mark its
    DiagnosisRequest 'done' either way."""
    image_paths = [p for p in (image_paths or []) if p]
    result = None
    try:
        crop_name = crop.name if crop is not None else None
        result = openai_vision.diagnose(image_paths, crop_name=crop_name)
    except Exception:  # noqa: BLE001
        logger.exception("OpenAI vision diagnosis failed, falling back")
        result = None

    if result is None and TORCH_AVAILABLE and image_paths:
        try:
            result = _predict_with_model(image_paths[0], crop)
        except Exception:  # noqa: BLE001
            logger.exception("Offline model inference failed, falling back")
            result = None

    if result is None:
        result = _fallback_result(crop)

    result.setdefault("species_guess", "")
    result.setdefault("ai_narrative", None)

    return result


def diagnose_image(image_path: str, crop=None) -> dict:
    """Single-photo convenience wrapper around diagnose_images() — used by
    the anonymous home-plant flow, which only ever collects one photo."""
    return diagnose_images([image_path], crop=crop)


def random_bootstrap_result(crop=None):
    """Used only by tests/demos when neither OpenAI nor a trained offline
    model are available, to exercise the full UI without either."""
    return _fallback_result(crop)
