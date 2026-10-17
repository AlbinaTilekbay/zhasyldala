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


# Every crop gets the same four tip themes as tomato (one per illustration
# in the frontend's TipArt) so the "Кеңестер" tab is never empty.
OTHER_TIPS = {
    "Қияр": [
        {"tag": "Алдын алу", "title": "Жылы сумен, тек тамырға суарыңыз",
         "body": "Ақұнтақ суық сумен суарғанда және температура күрт ауытқығанда тез таралады. Суды 22–25°C-қа дейін жылытып, жапыраққа тигізбей беріңіз.",
         "image_caption": "тамшылатып суару"},
        {"tag": "Микроклимат", "title": "Түнде 18°C-тан суық болмасын",
         "body": "Қияр суыққа сезімтал: түнгі температура 18°C-тан төмен түссе, өсу тоқтап, жемісі қисық байланады. Кешке терезелерді жабыңыз.",
         "image_caption": "жылыжай терезесі"},
        {"tag": "Өнім", "title": "Жемісті күн сайын жинаңыз",
         "body": "Үлкейіп кеткен қияр өсімдіктің күшін алады. Күн сайын жинасаңыз, жаңа түйін көбірек байланады.",
         "image_caption": "қияр жинау"},
        {"tag": "Қоректену", "title": "Жас жапырақ ағарса — магний",
         "body": "Жапырақтың тамыр арасы ағарып, тамырлары жасыл қалса, магний жетіспейді. Магний сульфатын (10 г / 10 л су) жапыраққа бүркіңіз.",
         "image_caption": "ағарған жапырақ"},
    ],
    "Бұрыш": [
        {"tag": "Алдын алу", "title": "Бактериялық дақтың алдын алыңыз",
         "body": "Көшетті тек сау түптен алыңыз, қайшы мен қолды спиртпен сүртіңіз — бактерия құрал арқылы түптен түпке оңай жұғады.",
         "image_caption": "таза құрал"},
        {"tag": "Микроклимат", "title": "Гүлдегенде 30°C-тан ыстық болмасын",
         "body": "Ыстықта бұрыш гүлін тастайды. Күндіз желдетіп, қажет болса жылыжай шатырын көлеңкелеңіз.",
         "image_caption": "желдету"},
        {"tag": "Өнім", "title": "Алғашқы «тәж» гүлін алып тастаңыз",
         "body": "Бірінші бұтақ айырындағы гүлді жұлсаңыз, өсімдік алдымен тамыр мен жапырақ жинап, кейін молырақ өнім береді.",
         "image_caption": "тәж гүлі"},
        {"tag": "Қоректену", "title": "Жемістің ұшы қарайса — кальций",
         "body": "Жемістің төменгі ұшындағы қара, батыңқы дақ — кальций тапшылығы мен тұрақсыз суарудың белгісі. Суаруды біркелкі етіңіз.",
         "image_caption": "ұшы шіріген жеміс"},
    ],
    "Құлпынай": [
        {"tag": "Алдын алу", "title": "Жидекті топыраққа тигізбеңіз",
         "body": "Түп астына сабан немесе агроталшық төсеңіз: жидек жерге тимесе, сұр шірік әлдеқайда сирек шығады.",
         "image_caption": "мульча"},
        {"tag": "Микроклимат", "title": "Гүлдегенде ылғалдылық 70%-дан аспасын",
         "body": "Ылғал жоғары болса, тозаң жабысып, жидек қисық байланады. Таңертең желдетіңіз.",
         "image_caption": "желдету"},
        {"tag": "Өнім", "title": "Мұртшаларды уақытында кесіңіз",
         "body": "Көбейту керек болмаса, мұртшаларды кесіп тастаңыз — қуат жидекке кетеді.",
         "image_caption": "мұртша"},
        {"tag": "Қоректену", "title": "Жапырақ жиегі қураса — калий",
         "body": "Калий жетіспесе, жапырақ жиегі қоңырланып, жидек ұсақ әрі қышқыл болады. Гүлдеу алдында калий беріңіз.",
         "image_caption": "қураған жиек"},
    ],
    "Баялды": [
        {"tag": "Алдын алу", "title": "Өрмекші кенені апта сайын тексеріңіз",
         "body": "Жапырақтың астыңғы бетінде ұсақ ақ нүктелер мен жұқа өрмек көрсеңіз, сол түпті бірден оқшаулап, өңдеңіз.",
         "image_caption": "жапырақ асты"},
        {"tag": "Микроклимат", "title": "Баялдыға жылу керек: 25–28°C",
         "body": "15°C-тан төмен болса, гүл байланбайды. Суық түндері жылыжайды жабық ұстаңыз.",
         "image_caption": "жылу"},
        {"tag": "Өнім", "title": "Бір түпте 5–6 жемістен артық қалдырмаңыз",
         "body": "Артық түйіндерді алып тастасаңыз, қалған жемістер ірі әрі біркелкі болады.",
         "image_caption": "түйін алу"},
        {"tag": "Қоректену", "title": "Жапырақ күлгін тартса — фосфор",
         "body": "Жапырақтың астыңғы беті күлгінденсе, фосфор жетіспейді. Суперфосфат сығындысымен қоректендіріңіз.",
         "image_caption": "күлгін жапырақ"},
    ],
    "Көкөніс көктері": [
        {"tag": "Алдын алу", "title": "Суды тұрғызбаңыз",
         "body": "Көктердің тамыры батпақ топырақта тез шіриді. Жәшік түбінде су ағатын тесік болсын, суаруды сәл азайтыңыз.",
         "image_caption": "дренаж"},
        {"tag": "Микроклимат", "title": "Көктерге салқын ұнайды: 16–20°C",
         "body": "Ыстықта аскөк пен салат тез гүлдеп, жапырағы ащы болады. Ыстық күндері көлеңкелеңіз.",
         "image_caption": "көлеңке"},
        {"tag": "Өнім", "title": "Әр 2 апта сайын қайта себіңіз",
         "body": "Аз-аздан, бірақ жиі себу — жыл бойы балғын көк алудың ең оңай жолы.",
         "image_caption": "себу"},
        {"tag": "Қоректену", "title": "Жапырақ бозарса — азот",
         "body": "Ақшыл, ұсақ жапырақ азот жетіспейтінін білдіреді. Сұйық органикалық тыңайтқышпен аптасына бір рет суарыңыз.",
         "image_caption": "бозарған жапырақ"},
    ],
}


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

        all_tips = [(tomato, TOMATO_TIPS)] + [(crop_objs[name], tips) for name, tips in OTHER_TIPS.items()]
        for crop, tips in all_tips:
            self._seed_tips(crop, tips)

        self.stdout.write(self.style.SUCCESS("Seed data ready."))

    def _seed_tips(self, crop, tips):
        for i, tip in enumerate(tips):
            _, created = Tip.objects.get_or_create(
                crop=crop, title=tip["title"],
                defaults={
                    "tag": tip["tag"], "body": tip["body"],
                    "image_caption": tip["image_caption"], "order": i,
                },
            )
            self.stdout.write(("+" if created else "=") + f" tip ({crop.name}): {tip['title']}")
