"""Optional secondary diagnosis source for the *anonymous home-plant* flow
only ("Үй өсімдігі" — no crop selected, could be any houseplant: orchid,
succulent, ficus, ...). Uses plant.id's health_assessment endpoint
(https://www.kindwise.com/plant-health — same company as crop.health,
different product): unlike crop.health, which only knows ~23 food/field
crops, plant.id's annotations are mostly houseplants and ornamentals —
the right tool for "what's wrong with my orchid", not crop.health.

Deliberately only ever called as a *fallback* for crop=None requests, and
never for a greenhouse crop (see apps/ml/kindwise.py for that flow) or
when the custom model already produced a real prediction — so paid
credits are spent only on requests neither the free local model nor a
better-suited free option (Pl@ntNet, for species only) can answer. No-ops
until KINDWISE_HEALTH_API_KEY is set. Paid, no free tier as of writing
(https://www.kindwise.com/pricing) — get a key at
https://www.kindwise.com/plant-health (a *separate* signup/key from
crop.health's, unless kindwise later unifies their billing — check there
if unsure whether one key covers both).

Like apps/ml/kindwise.py, plant.id's own taxonomy doesn't map onto
ZhasylDala's Kazakh `Disease` knowledge base, so a result from here always
has `disease=None` and carries the raw name + plant.id's own
description/treatment text as plain text inside `recommendations`,
clearly marked as an external-API result. Response shape is parsed
defensively: schema changes must degrade to None, never raise.
"""
import base64
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

HEALTH_ASSESSMENT_URL = "https://api.plant.id/v3/health_assessment"
# Below this, treat it as "nothing useful found" rather than showing the
# person a low-confidence guess from an API we don't fully control.
MIN_CONFIDENCE = 0.2


def diagnose(image_path: str) -> dict | None:
    """Returns the same result-dict shape apps.ml.services expects, or
    None if the key isn't configured, the call fails, or nothing was
    matched with useful confidence. Never raises — an outage here must
    not block a diagnosis."""
    if not settings.KINDWISE_HEALTH_API_KEY:
        return None

    try:
        with open(image_path, "rb") as fh:
            encoded = base64.b64encode(fh.read()).decode("ascii")

        response = requests.post(
            HEALTH_ASSESSMENT_URL,
            headers={"Api-Key": settings.KINDWISE_HEALTH_API_KEY, "Content-Type": "application/json"},
            params={"details": "description,treatment,local_name"},
            json={"images": [encoded]},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        result = data.get("result") or {}

        is_healthy = ((result.get("is_healthy") or {}).get("binary"))
        suggestions = (result.get("disease") or {}).get("suggestions") or []

        if is_healthy and not suggestions:
            from apps.diagnosis.models import Severity

            return {
                "disease": None,
                "severity": Severity.OK,
                "confidence": float((result.get("is_healthy") or {}).get("probability", 0.8) or 0.8),
                "symptoms_seen": [],
                "recommendations": [],
                "source": "plant_health_api",
                "model_version": None,
            }

        if not suggestions:
            return None
        top = max(suggestions, key=lambda s: s.get("probability", 0))
        confidence = float(top.get("probability", 0) or 0)
        if confidence < MIN_CONFIDENCE:
            return None

        name = str(top.get("name", "")).strip()
        if not name:
            return None

        details = top.get("details") or {}
        description = str(details.get("description") or "").strip()
        treatment = details.get("treatment") or {}
        # `treatment` is usually {"biological": [...], "chemical": [...],
        # "prevention": [...]} — flatten whatever lists are present.
        treatment_lines = []
        if isinstance(treatment, dict):
            for lines in treatment.values():
                if isinstance(lines, list):
                    treatment_lines.extend(str(line) for line in lines)

        from apps.diagnosis.models import Severity

        recommendations = [f"Сыртқы API (plant.health) нәтижесі: {name}."]
        if description:
            recommendations.append(description)
        recommendations.extend(treatment_lines[:4])
        recommendations.append(
            "Бұл өсімдік/ауру жергілікті дерекқорда әлі жоқ, сондықтан бұл — сыртқы қызметтің "
            "жалпы кеңесі. Күмән болса маманмен кеңесіңіз."
        )

        return {
            "disease": None,
            "severity": Severity.WARN,
            "confidence": confidence,
            "symptoms_seen": [],
            "recommendations": recommendations,
            "source": "plant_health_api",
            "model_version": None,
        }
    except Exception:  # noqa: BLE001 - a flaky/paid external API must degrade gracefully
        logger.warning("plant.health call failed", exc_info=True)
        return None
