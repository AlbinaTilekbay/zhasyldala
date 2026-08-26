"""Optional secondary diagnosis source: Kindwise's crop.health API
(https://www.kindwise.com/crop-health) actually classifies *diseases*
across ~23 crops — unlike Pl@ntNet, which only identifies species (see
apps/ml/plantnet.py) — so this is used specifically to cover crops the
custom model has no training data for, e.g. Қияр (cucumber), Баялды
(eggplant), Көкөніс көктері (greens): none of those exist in the free
PlantVillage dataset `bootstrap_plantvillage` uses, so the custom model
never learns them.

Deliberately only ever called as a *fallback*, when the custom model
either isn't trained yet or wasn't trained on the requested crop — never
when the custom model already produced a real prediction, so paid credits
are spent only on requests the free local model can't answer (see
apps/ml/services.py:diagnose_image). No-ops until KINDWISE_API_KEY is
set — the app works fully without it, just without this extra coverage.

Paid, no free tier as of writing (https://www.kindwise.com/pricing) —
that's why it's opt-in via an env var rather than wired in by default.

Kindwise's disease taxonomy is its own (English/Latin names), and doesn't
map onto ZhasylDala's Kazakh, crop-scoped `Disease` knowledge base — so a
result from here always has `disease=None` and carries the raw label as
plain text inside `recommendations` instead, clearly marked as an
external-API result rather than a local diagnosis. Response shape is
parsed defensively throughout: this is a beta API "which might not be
compatible with the current version" (their own docs' wording), and a
schema change here must degrade to None, never raise.
"""
import base64
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

KINDWISE_URL = "https://crop.kindwise.com/api/v1/identification"
# Below this, treat it as "nothing useful found" rather than showing the
# farmer a low-confidence guess from an API we don't fully control.
MIN_CONFIDENCE = 0.2


def diagnose(image_path: str) -> dict | None:
    """Returns the same result-dict shape apps.ml.services expects
    (disease/severity/confidence/symptoms_seen/recommendations/source/
    model_version), or None if the key isn't configured, the call fails,
    or nothing was matched with useful confidence. Never raises — a
    Kindwise outage must not block a diagnosis."""
    if not settings.KINDWISE_API_KEY:
        return None

    try:
        with open(image_path, "rb") as fh:
            encoded = base64.b64encode(fh.read()).decode("ascii")

        response = requests.post(
            KINDWISE_URL,
            headers={"Api-Key": settings.KINDWISE_API_KEY, "Content-Type": "application/json"},
            json={"images": [encoded]},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()

        suggestions = (data.get("result") or {}).get("disease", {}).get("suggestions") or []
        if not suggestions:
            return None
        top = max(suggestions, key=lambda s: s.get("probability", 0))
        confidence = float(top.get("probability", 0) or 0)
        if confidence < MIN_CONFIDENCE:
            return None

        name = str(top.get("name", "")).strip()
        if not name:
            return None
        is_healthy = "healthy" in name.lower()

        from apps.diagnosis.models import Severity

        return {
            "disease": None,
            "severity": Severity.OK if is_healthy else Severity.WARN,
            "confidence": confidence,
            "symptoms_seen": [],
            "recommendations": [] if is_healthy else [
                f"Сыртқы API (crop.health) нәтижесі: {name}. Бұл ауру жергілікті "
                "дерекқорда әлі жоқ, сондықтан толық кеңес бере алмаймыз — "
                "растау үшін маманмен кеңесіңіз немесе admin бетінен осы "
                "дақыл үшін фото қосып, меншікті модельді оқытыңыз."
            ],
            "source": "kindwise_api",
            "model_version": None,
        }
    except Exception:  # noqa: BLE001 - a flaky/paid external API must degrade gracefully
        logger.warning("Kindwise crop.health call failed", exc_info=True)
        return None
