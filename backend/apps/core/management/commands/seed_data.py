"""Seeds the crop list, disease knowledge base, and tips straight from the
ZhasylDala mockup's copy (CROPS / ISSUES / TIPS constants + the
plant_result screen's static text), so the app has real Kazakh content to
demo from day one. Idempotent — safe to re-run.

    python manage.py seed_data
"""
from django.core.management.base import BaseCommand

from apps.diagnosis.models import Disease, Severity
from apps.greenhouses.models import Crop
from apps.tips.models import Tip

CROPS = ["Қызанақ", "Қияр", "Бұрыш", "Көкөніс көктері", "Құлпынай", "Баялды"]

CROP_SLUGS = {
    "Қызанақ": "tomato", "Қияр": "cucumber", "Бұрыш": "pepper",
    "Көкөніс көктері": "greens", "Құлпынай": "strawberry", "Баялды": "eggplant",
}

# From the mockup's `ISSUES` constant (greenhouse sector-detail flow),
# scoped to Қызанақ since that's the crop the demo data walked through.
TOMATO_DISEASES = [
    {
        "slug": "fitoftoroz", "name": "Фитофтороз", "severity": Severity.BAD,
        "symptoms": [
            "Астыңғы жапырақтарда сұрғылт жиекті қоңыр дақтар",
            "6 түптің жапырағының сыртқы бетінде көгілдір-ақ түк",
            "Сектордағы ауа ылғалдылығы жылыжай орташасынан жоғары",
        ],
        "recommendations": [
            "Зақымдалған жапырақтарды жинап, жылыжайдан тыс жерге шығарыңыз (компостқа салмаңыз)",
            "Мыс негізіндегі препаратпен өңдеу: 7 күн аралықпен 2 рет",
            "Ылғалдылықты түсіріңіз: таңертең желдету, суаруды тек тамырға беру",
            "7 күннен кейін қайта шолу — «дейін/кейін» салыстырылады",
        ],
    },
    {
        "slug": "aquntaq", "name": "Ақұнтақ (мучнистая роса)", "severity": Severity.BAD,
        "symptoms": [
            "Жапырақтың үстіңгі бетінде ұннан себілгендей ақ жабын",
            "Жас жапырақтар бүрісе бастаған",
            "Түптер тығыз отырғызылған, ауа жүрмейді",
        ],
        "recommendations": [
            "Қатты зақымдалған жапырақтарды кесіп алыңыз",
            "Bacillus subtilis негізіндегі биофунгицидпен бүрку",
            "Түптерді сирету — арасын кеңейту",
            "Жапырақтың үстінен суармау",
        ],
    },
    {
        "slug": "ormekshi-kene", "name": "Өрмекші кене — бастапқы кезең", "severity": Severity.WARN,
        "symptoms": [
            "2 түптің жапырағында ұсақ ашық нүктелер",
            "Жапырақ қолтығында жұқа өрмек",
            "Ауа температурасы жоғары, құрғақ",
        ],
        "recommendations": [
            "Бүгін көрші секторларды қолмен қарап шығыңыз",
            "Ылғалдылықты 60%-ға дейін көтеріп, жапырақты сумен бүркіңіз",
            "Ошақ өссе — акарицид немесе Phytoseiulus жыртқыш кенесі",
            "Секторды келесі шолуда бақылауға белгілеңіз",
        ],
    },
]

# Not from the mockup (it only ever showed tomato) — added so
# `bootstrap_plantvillage` has something to attach PlantVillage's pepper
# and strawberry photos to. Written in the same style/format as the
# tomato entries above; general accepted agronomy practice, not
# copied from any source.
PEPPER_DISEASES = [
    {
        "slug": "bakterialdyk-dak", "name": "Бактериялық дақ ауруы", "severity": Severity.BAD,
        "symptoms": [
            "Жапырақ бетінде ұсақ, суланған қара-жасыл дақтар, кейін некрозданып сарғыш жиек пайда болады",
            "Жемісте де ұқсас қоңыр-қара дақтар байқалады",
            "Ылғал, жаңбырлы немесе жиі бүрку кезінде тез таралады",
        ],
        "recommendations": [
            "Зақымдалған жапырақтар мен өсімдік қалдықтарын жинап, жылыжайдан тыс жерге шығарыңыз (компостқа салмаңыз)",
            "Суаруды тек тамырға беріңіз, жапырақты су тигізбеңіз",
            "Мыс негізіндегі бактерицидпен өңдеу: 7–10 күн аралықпен",
            "Құралдарды өңдеп, түптер арасын кеңейтіп ауа алмасуын жақсартыңыз",
        ],
    },
]

STRAWBERRY_DISEASES = [
    {
        "slug": "zhapyraq-kuygi", "name": "Жапырақ күйігі", "severity": Severity.WARN,
        "symptoms": [
            "Жапырақтың үстіңгі бетінде ұсақ күлгін-қоңыр дақтар, кейін бірігіп күйгендей жолақ түзеді",
            "Қатты зақымдалған жапырақтар мезгілінен бұрын қурап қалады",
            "Ылғалды, тығыз отырғызылған алқаптарда жиі кездеседі",
        ],
        "recommendations": [
            "Жиналған соң зақымдалған жапырақтарды кесіп алып, алаңнан шығарыңыз",
            "Суаруды тамырға беріңіз, жоғарыдан бүркуден аулақ болыңыз",
            "Түптер арасын сиретіп, ауа алмасуын жақсартыңыз",
            "Ошақ өссе — мыс негізіндегі фунгицидпен өңдеу",
        ],
    },
]

# From the mockup's anonymous "Үй өсімдігі" result screen — crop=None so it
# can match a home-plant photo of anything.
HOME_DISEASES = [
    {
        "slug": "azot-tapshylygy", "name": "Азот тапшылығынан хлороз", "severity": Severity.WARN,
        "description": "Астыңғы жапырақтардың тамыр арасы сарғайған, өсу тежелген. Жұқпалы ауру белгісі жоқ.",
        "symptoms": [], "recommendations": [],
        "home_care_advice": [
            "Азотты тыңайтқыш беріңіз (мочевина 1 г/л), суаруды тамырға",
            "Ең сарғайған 2–3 астыңғы жапырақты алып тастаңыз — өсімдік оларға қуат жұмсамайды",
            "10 күннен кейін қайта суретке түсіріңіз — өзгерісті салыстырамыз",
        ],
    },
]

TOMATO_TIPS = [
    {
        "tag": "Алдын алу", "title": "Суаруды тек тамырға беріңіз",
        "body": "Жапырақтағы су — фитофтороздың басты жолы. Тамшылатып суару қауіпті 3 есе азайтады.",
        "image_caption": "тамшылатып суару",
    },
    {
        "tag": "Микроклимат", "title": "Ылғалдылық 60–70%, аспасын",
        "body": "Желдетуді кешке емес, таңертең жасаңыз: түнгі дым жапырақ үшін күндізгі ыстықтан қауіптірек.",
        "image_caption": "жылыжай терезесі",
    },
    {
        "tag": "Өнім", "title": "Аптасына бір рет қосалқы бүршік алу",
        "body": "Бұтақшаларды 4 см-ге жетпей алыңыз — қуат жапыраққа емес, жеміске кетеді.",
        "image_caption": "бүршік алу",
    },
    {
        "tag": "Қоректену", "title": "Калий тапшылығының белгісі",
        "body": "Жапырақ жиегінің күйгендей болуы және жемістің біркелкі қызармауы — қоректендіруге калий қосыңыз.",
        "image_caption": "жиегі күйген жапырақ",
    },
]


class Command(BaseCommand):
    help = "Seeds crops, the disease knowledge base, and tips from the ZhasylDala mockup content."

    def handle(self, *args, **options):
        crop_objs = {}
        for i, name in enumerate(CROPS):
            crop, created = Crop.objects.get_or_create(
                name=name, defaults={"slug": CROP_SLUGS[name], "order": i}
            )
            crop_objs[name] = crop
            self.stdout.write(("+" if created else "=") + f" crop: {name}")

        tomato = crop_objs["Қызанақ"]
        CROP_DISEASES = {
            "Қызанақ": TOMATO_DISEASES,
            "Бұрыш": PEPPER_DISEASES,
            "Құлпынай": STRAWBERRY_DISEASES,
        }
        for crop_name, entries in CROP_DISEASES.items():
            crop = crop_objs[crop_name]
            for entry in entries:
                _, created = Disease.objects.get_or_create(
                    crop=crop, slug=entry["slug"],
                    defaults={
                        "name": entry["name"], "severity": entry["severity"],
                        "symptoms": entry["symptoms"], "recommendations": entry["recommendations"],
                    },
                )
                self.stdout.write(("+" if created else "=") + f" disease ({crop_name}): {entry['name']}")

        for entry in HOME_DISEASES:
            _, created = Disease.objects.get_or_create(
                crop=None, slug=entry["slug"],
                defaults={
                    "name": entry["name"], "severity": entry["severity"],
                    "description": entry.get("description", ""),
                    "symptoms": entry["symptoms"], "recommendations": entry["recommendations"],
                    "home_care_advice": entry["home_care_advice"],
                },
            )
            self.stdout.write(("+" if created else "=") + f" home disease: {entry['name']}")

        for i, tip in enumerate(TOMATO_TIPS):
            _, created = Tip.objects.get_or_create(
                crop=tomato, title=tip["title"],
                defaults={
                    "tag": tip["tag"], "body": tip["body"],
                    "image_caption": tip["image_caption"], "order": i,
                },
            )
            self.stdout.write(("+" if created else "=") + f" tip: {tip['title']}")

        self.stdout.write(self.style.SUCCESS("Seed data ready."))
