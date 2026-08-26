"""Thin Pl@ntNet client. Pl@ntNet identifies *species*, not diseases, so
it is only ever used as a secondary "is this really a tomato leaf?" signal
— never the primary disease call (see apps/ml/services.py). No-ops until
PLANTNET_API_KEY is set."""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class PlantNetUnavailable(Exception):
    pass


def identify_species(image_path: str) -> dict | None:
    """Returns {"species": str, "confidence": float} or None if the API
    key isn't configured, the request fails, or nothing was matched.
    Never raises — a Pl@ntNet outage must not block a diagnosis."""
    if not settings.PLANTNET_API_KEY:
        return None

    url = f"{settings.PLANTNET_BASE_URL}/identify/{settings.PLANTNET_PROJECT}"
    try:
        with open(image_path, "rb") as fh:
            response = requests.post(
                url,
                params={"api-key": settings.PLANTNET_API_KEY},
                files={"images": fh},
                data={"organs": "leaf"},
                timeout=10,
            )
        response.raise_for_status()
        data = response.json()
        results = data.get("results") or []
        if not results:
            return None
        top = results[0]
        species = (top.get("species") or {}).get("scientificNameWithoutAuthor")
        return {"species": species, "confidence": float(top.get("score", 0))}
    except Exception:  # noqa: BLE001 - a flaky external API must degrade gracefully
        logger.warning("Pl@ntNet call failed", exc_info=True)
        return None
