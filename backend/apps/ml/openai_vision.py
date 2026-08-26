"""Primary diagnosis engine: sends the plant/leaf photo directly to an
OpenAI vision-capable chat model and asks it to both identify the plant
and its condition AND produce the full, warm, human-readable explanation
shown on the result screen — species, disease type, severity, confidence,
symptoms, cause, treatment steps, prevention tips, a health/humidity/sun-
stress status readout, and a short encouragement — all in one call. The
prompt's structure and tone (masterful, literary Kazakh; a warm closing
line either praising a healthy plant or encouraging treatment) are ported
from a prompt the project's author had already proven out in a separate
OpenAI-powered Telegram bot (via make.com) and confirmed gave good
results there. No emoji in the text itself — the frontend renders this as
its own set of clean cards instead (see apps/ml/services.py and
frontend/src/components/ui.jsx's `AiNarrative`).

This is the *primary* diagnosis path (see apps/ml/services.py:
diagnose_image). The locally trained PlantVillage model
(apps/ml/model_def.py, apps/ml/registry.py) only takes over when this
fails or OPENAI_API_KEY isn't set — most commonly because there's no
internet connection: works fully online via OpenAI, and still gives a
real (if narrower — currently tomato/pepper/strawberry) answer offline.

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
# gpt-4o-mini's vision recognition proved too weak in practice — it kept
# answering "species unclear" even on ordinary, clearly-lit houseplant
# photos. gpt-4o is noticeably better at fine-grained visual ID (exactly
# what this app needs) for a modest cost increase — still well under a
# cent's worth of tokens per diagnosis, since each call sends one photo
# plus a short prompt.
MODEL = "gpt-4o"

SEVERITY_VALUES = {"ok", "warn", "bad"}
DISEASE_TYPE_VALUES = {"бактериялық", "вирустық", "саңырауқұлақтық", "физиологиялық"}
LEVEL_VALUES = {"төмен", "орташа", "жоғары"}

SYSTEM_PROMPT = (
    "Сен — қазақша сөйлейтін өсімдік-дәрігер ботсың. Қазақша шебер, көркем "
    "сөйлейсің — тап бір қазақ көркем әдебиетін оқитындай. Бірақ жауабыңда "
    "эмодзи қолданба — оны қосымшаның өзі көрсетеді. Саған өсімдіктің "
    "немесе оның жапырағының фотосы беріледі. Фотоны мұқият қарап, "
    "өсімдік түрін және ауру/зиянкес/қоректік зат тапшылығы белгілерін "
    "өзің анықта. Ауру болса, оның түрін дәл мына төрт санаттың бірімен "
    "белгіле: \"бактериялық\", \"вирустық\", \"саңырауқұлақтық\", "
    "\"физиологиялық\". Өсімдік сау болса disease_type өрісін бос жол "
    "етіп қалдыр.\n"
    "Тек қазақ тілінде, тек мына JSON пішімінде жауап бер, басқа мәтін "
    "қоспа:\n"
    '{"species": "өсімдіктің қысқаша, нақты атауы", '
    '"disease_type": "бактериялық/вирустық/саңырауқұлақтық/физиологиялық '
    'немесе бос жол (сау болса)", '
    '"condition_name": "ауру/жағдай атауы (дені сау болса — \\"Дені сау\\")", '
    '"description": "жағдай туралы 1-2 қысқа сөйлем", '
    '"severity": "ok" немесе "warn" немесе "bad", '
    '"confidence_percent": 0 мен 100 аралығындағы сан, '
    '"symptoms_seen": ["фотодан көрінген белгі 1", "белгі 2", ...], '
    '"cause": "нақты, дәл осы фотоға қатысты түсініктеме — жалпы сөйлеммен '
    'шектелме. Ауру болса — нақты себеп пен белгісін нақты сипатта '
    '(мысалы, \'жапырақтың ұшындағы қоңыр дақтар саңырауқұлақ '
    'зақымынан\'). Өсімдік сау болса да, health_percent неге 100% емес '
    'екенін дәл осы фотодан көрінетін нақты белгілерге сүйеніп түсіндір '
    '(мысалы, \'жапырақ түсі сәл бозарған — жарық жеткіліксіз болуы '
    'мүмкін\' немесе \'топырақ беті құрғақ көрінеді\'); \'жақсы '
    'күтімде\', \'жағдайы қалыпты\' сияқты мазмұнсыз жалпы сөйлемдерді '
    'қолданба", '
    '"treatment_steps": ['
    '"қадам 1 — дәл осы фотодан көрінген жағдайға қатысты нақты әрекет '
    '(жалпы \'қажет болса тексеру\' емес — не істеу керектігін тікелей айт)", '
    '"қадам 2 — қандай ерітінді, тыңайтқыш немесе дәрі қолдану керек, '
    'немесе (сау өсімдік үшін) күтімді қалай жақсартуға болады", '
    '"қадам 3 — суару, жарық, температура және ауа айналымын нақты қалай '
    'реттеу керек"], '
    '"prevention_tips": ["алдын алу кеңесі 1", ...], '
    '"health_percent": 0 мен 100 аралығындағы жалпы денсаулық бағасы, '
    '"humidity_level": "төмен" немесе "орташа" немесе "жоғары", '
    '"sun_stress_level": "төмен" немесе "орташа" немесе "жоғары", '
    '"encouragement": "қысқа қорытынды сөйлем. Дәл осы өсімдіктің дәл осы '
    'фотодағы жай-күйіне (health_percent, symptoms_seen) сай, ӨЗІҢ '
    'ойлап тап — әр фотоға басқаша, қайталанбайтын сөйлем болсын. '
    'health_percent жоғары (90-100%) болса — жылы мақтау айт, әрі '
    'health_percent неге дәл 100% емес соны еске сал; орташа болса — '
    'нақты немен көмектесе алатыныңды айт; төмен болса — қолдау көрсетіп, '
    'емдеуге ынталандыр. Дайын үлгі сөйлемдерді сөзбе-сөз қайталама"}\n'
    "Фотода өсімдік/жапырақ анық көрінбесе немесе таны алмасаң, "
    'condition_name-де осыны айт (мысалы, "Фото анық емес"), '
    'severity="ok" және confidence_percent төмен (0-20) қой — бірақ '
    "condition_name мен description өрістерін ешқашан бос қалдырма, тіпті "
    "түр (species) белгісіз болса да, кем дегенде жалпы сипаттама жаз "
    '(мысалы, "жасыл жапырақты өсімдік, түрі анық емес"). Нақты '
    "көрмеген белгілерің мен дәл сандарды, мерзімдерді немесе препарат "
    "атауларын өз бетінше ойлап таппа — тек фотодан шынымен көрінетін "
    "нәрсеге және жалпы агрономиялық білімге сүйен. Әр жауап — жаңа, "
    "дербес мәтін болуы керек: cause, treatment_steps және encouragement "
    "өрістерінде осы промпттағы мысал сөйлемдерді немесе бұрын "
    "жазғаныңды сөзбе-сөз қайталама, әр фотоға өзінше жаз. Жауабың "
    "жалпы 3000 таңбадан аспасын."
)


def _encode_image(image_path: str) -> str:
    with open(image_path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    ext = image_path.rsplit(".", 1)[-1].lower() if "." in image_path else ""
    mime = "image/png" if ext == "png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def _clean_level(value, allowed):
    value = str(value or "").strip().lower()
    return value if value in allowed else ""


def diagnose(image_path: str, crop_name: str | None = None) -> dict | None:
    """`crop_name` is the greenhouse crop's Kazakh name when known (e.g.
    "Қызанақ"), or None for the anonymous home-plant flow (any houseplant).
    Returns a dict shaped like the other diagnose_image() sources
    (disease=None — this never maps onto the local Kazakh knowledge base —
    severity, confidence, species_guess, symptoms_seen, recommendations,
    source="openai_vision", model_version=None) plus "ai_narrative" with
    the full card content (condition_name, disease_type, description,
    cause, treatment_steps, prevention_tips, health_percent,
    humidity_level, sun_stress_level, encouragement), or None if the key
    isn't set, the request fails, or nothing usable came back — so the
    caller falls through to the offline custom model."""
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
                            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                        ],
                    },
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 1000,
            },
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        # Visible in Railway's Logs tab — the fastest way to see exactly
        # what the model answered for a given photo without needing to
        # reproduce the issue locally.
        logger.info("OpenAI vision raw response: %s", json.dumps(data, ensure_ascii=False)[:2000])

        severity = str(data.get("severity") or "ok").strip().lower()
        if severity not in SEVERITY_VALUES:
            severity = "ok"
        try:
            confidence_percent = max(0, min(100, int(float(data.get("confidence_percent") or 0))))
        except (TypeError, ValueError):
            confidence_percent = 0
        try:
            health_percent = max(0, min(100, int(float(data.get("health_percent") or 0))))
        except (TypeError, ValueError):
            health_percent = 0

        disease_type = str(data.get("disease_type") or "").strip().lower()
        if disease_type not in DISEASE_TYPE_VALUES:
            disease_type = ""

        treatment_steps = [str(s).strip() for s in (data.get("treatment_steps") or []) if str(s).strip()]
        species_guess = str(data.get("species") or "").strip()
        symptoms_seen = [str(s).strip() for s in (data.get("symptoms_seen") or []) if str(s).strip()]
        narrative = {
            "condition_name": str(data.get("condition_name") or "").strip(),
            "disease_type": disease_type,
            "description": str(data.get("description") or "").strip(),
            "cause": str(data.get("cause") or "").strip(),
            "treatment_steps": treatment_steps,
            "prevention_tips": [str(s).strip() for s in (data.get("prevention_tips") or []) if str(s).strip()],
            "health_percent": health_percent,
            "humidity_level": _clean_level(data.get("humidity_level"), LEVEL_VALUES),
            "sun_stress_level": _clean_level(data.get("sun_stress_level"), LEVEL_VALUES),
            "encouragement": str(data.get("encouragement") or "").strip(),
        }
        # Discard only if the model gave back essentially nothing at all —
        # a response that at least names the species/symptoms but left the
        # narrative fields blank (the model not following instructions
        # perfectly) is still more useful to show than throwing it away
        # after a real, paid API call.
        if not any([species_guess, symptoms_seen, narrative["condition_name"], narrative["description"],
                    narrative["cause"], treatment_steps, narrative["prevention_tips"], narrative["encouragement"]]):
            return None

        return {
            "disease": None,
            "severity": severity,
            "confidence": confidence_percent / 100,
            "species_guess": species_guess,
            "symptoms_seen": symptoms_seen,
            "recommendations": treatment_steps,
            "source": "openai_vision",
            "model_version": None,
            "ai_narrative": narrative,
        }
    except Exception:  # noqa: BLE001 - an OpenAI outage must fall through, never break a diagnosis
        logger.warning("OpenAI vision diagnosis call failed", exc_info=True)
        return None
