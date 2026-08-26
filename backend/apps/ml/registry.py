"""Loads (and caches) the currently *active* ModelVersion so inference
doesn't re-read weights from disk on every request. Falls back to a
deterministic heuristic when torch isn't installed or no model has been
trained yet, so the rest of the app (uploads, sectors, reports, plans)
works end-to-end from day one — see the plan's "bootstrap/fallback" note.
"""
import json
import threading

from django.conf import settings

from .model_def import TORCH_AVAILABLE, build_model, eval_transform

_lock = threading.Lock()
_cache = {"version_id": None, "model": None, "labels": None, "transform": None}


def _load_active_version():
    from apps.ml_training.models import ModelVersion

    return ModelVersion.objects.filter(status=ModelVersion.Status.ACTIVE).order_by("-activated_at").first()


def get_active_model():
    """Returns (labels, model, transform) or (None, None, None) if no
    trained+active model is available yet (caller should fall back)."""
    if not TORCH_AVAILABLE:
        return None, None, None

    version = _load_active_version()
    if version is None or not version.file:
        return None, None, None

    with _lock:
        if _cache["version_id"] == version.id:
            return _cache["labels"], _cache["model"], _cache["transform"]

        import torch

        labels_path = settings.ML_MODELS_DIR / f"{version.id}.labels.json"
        if not labels_path.exists():
            return None, None, None
        labels = json.loads(labels_path.read_text())

        model = build_model(num_classes=len(labels))
        state = torch.load(version.file.path, map_location="cpu")
        model.load_state_dict(state)
        model.eval()

        _cache.update({
            "version_id": version.id, "model": model, "labels": labels, "transform": eval_transform(),
        })
        return labels, model, eval_transform()


def invalidate_cache():
    with _lock:
        _cache.update({"version_id": None, "model": None, "labels": None, "transform": None})
