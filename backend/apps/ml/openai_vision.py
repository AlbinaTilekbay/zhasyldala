"""Primary diagnosis engine: sends the plant/leaf photo directly to an
OpenAI vision-capable chat model and asks it to both identify the plant
and its condition AND produce the full, warm, human-readable explanation
shown on the result screen — species, severity, confidence, symptoms,
cause, treatment steps, prevention tips, and a short encouragement — all
in one call. No emoji; the frontend renders this as its own set of clean
cards (see apps/ml/services.py and frontend/src/components/ui.jsx's
`AiNarrative`).

This is now the *primary* diagnosis path (see apps/ml/services.py:
diagnose_image) — it replaces the old two-step "local model / Kindwise
fact -> separate OpenAI narration pass" design with a single call that
does both the recognition and the explanation. The locally trained
PlantVillage model (apps/ml/model_def.py, apps/ml/registry.py) only takes
over when this fails or OPENAI_API_KEY isn't set — most commonly because
there's no internet connection, per how this project is meant to run at
the competition: works fully online via OpenAI, and still gives a real
(if narrower — currently tomato/pepper/strawberry) answer offline.

No-ops (returns None) until OPENAI_API_KEY is set; never raises, so a
network hiccup, rate limit, or a response that doesn't parse just falls
through to the offline model instead of breaking a diagnosis.
"""
import base64
import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

CHAT_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

SEVERITY_VALUES = {"ok", "warn", "bad"}

SYSTEM_PROMPT = (
    "Сен — қазақстандық жылыжай фермерлері мен үй өсімдігі иелеріне арналған "
    "тәжірибелі агроном-консультантсың. Саған өсімдіктің немесе оның "
    "жапырағының фотосы беріледі. Фотоны мұқият қарап, өсімдік түрін және "
    "ауру/зиянкес/қоректік зат тапшылығы белгілерін өзің анықта. Эмодзи "
    "қолданба. Тек қазақ тілінде, тек мына JSON пішімінде жауап бер, басқа "
    "мәтін қоспа:\n"
    '{"species": "өсімдік түрі (болжам болса да жаз)", '
    '"condition_name": "ауру/жағдай атауы (дені сау болса — \\"Дені сау\\")", '
    '"severity": "ok" немесе "warn" немесе "bad", '
    '"confidence_percent": 0 мен 100 аралығындағы сан, '
    '"description": "жағдай туралы 1-2 қысқа сөйлем", '
    '"symptoms_seen": ["фотодан көрінген белгі 1", "белгі 2", ...], '
    '"cause": "неге бұлай болғаны туралы 1-2 қысқа сөйлем", '
    '"treatment_steps": ["нақты қадам 1", "нақты қадам 2", ...], '
    '"prevention_tips": ["алдын алу кеңесі 1", ...], '
    '"encouragement": "қысқа, жылы қорытынды сөйлем"}\n'
    "Фотода өсімдік/жапырақ анық көрінбесе немесе таны алмасаң, "
    "condition_name-де осыны айт, severity=\"ok\" және confidence_percent "
    "төмен (0-20) қой. Нақты көрмеген белгілерің мен дәл сандарды, "
    "мерзімдерді немесе препарат атауларын өз бетінше ойлап таппа — тек "
    "фотодан шынымен көрінетін нәрсеге және жалпы агрономиялық білімге "
    "сүйен."
)


def _encode_image(image_path: str) -> str:
    with open(image_path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    ext = image_path.rsplit(".", 1)[-1].lower() if "." in image_path else ""
    mime = "image/png" if ext == "png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def diagnose(image_path: str, crop_name: str | None = None) -> dict | None:
    """`crop_name` is the greenhouse crop's Kazakh name when known (e.g.
    "Қызанақ"), or None for the anonymous home-plant flow (any houseplant).
    Returns a dict shaped like the other diagnose_image() sources
    (disease=None — this never maps onto the local Kazakh knowledge base —
    severity, confidence, species_guess, symptoms_seen, recommendations,
    source="openai_vision", model_version=None) plus "ai_narrative" with
    the full card content, or None if the key isn't set, the request
    fails, or nothing usable came back — so the caller falls through to
    the offline custom model."""
    if not settings.OPENAI_API_KEY:
        return None

    user_text = (
        f"Бұл жылыжайдағы {crop_name} дақылының фотосы."
        if crop_name
        else "Бұл үй өсімдігінің фотосы (нақты дақыл көрсетілмеген)."
    )

    try:
        data_url = _encode_image(image_path)
        response = requests.post(
            CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 700,
            },
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)

        severity = str(data.get("severity") or "ok").strip().lower()
        if severity not in SEVERITY_VALUES:
            severity = "ok"
        try:
            confidence_percent = max(0, min(100, int(float(data.get("confidence_percent") or 0))))
        except (TypeError, ValueError):
            confidence_percent = 0

        treatment_steps = [str(s).strip() for s in (data.get("treatment_steps") or []) if str(s).strip()]
        narrative = {
            "condition_name": str(data.get("condition_name") or "").strip(),
            "description": str(data.get("description") or "").strip(),
            "cause": str(data.get("cause") or "").strip(),
            "treatment_steps": treatment_steps,
            "prevention_tips": [str(s).strip() for s in (data.get("prevention_tips") or []) if str(s).strip()],
            "encouragement": str(data.get("encouragement") or "").strip(),
        }
        # Nothing usable came back — treat like a failed call so the caller
        # falls through to the offline model instead of showing an empty
        # result screen.
        if not narrative["condition_name"] and not narrative["description"]:
            return None

        return {
            "disease": None,
            "severity": severity,
            "confidence": confidence_percent / 100,
            "species_guess": str(data.get("species") or "").strip(),
            "symptoms_seen": [str(s).strip() for s in (data.get("symptoms_seen") or []) if str(s).strip()],
            "recommendations": treatment_steps,
            "source": "openai_vision",
            "model_version": None,
            "ai_narrative": narrative,
        }
    except Exception:  # noqa: BLE001 - an OpenAI outage must fall through, never break a diagnosis
        logger.warning("OpenAI vision diagnosis call failed", exc_info=True)
        return None
