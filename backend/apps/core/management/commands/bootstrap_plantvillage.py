"""One-command cold start: downloads a small labeled sample from the
public PlantVillage dataset (github.com/spMohanty/PlantVillage-Dataset,
research use — check the dataset's license before any commercial use) for
every crop ZhasylDala has a matching class for, saves them as verified
TrainingImage rows, then trains and activates a first ModelVersion — so
diagnosis works with zero manual photo uploads.

PlantVillage only covers 14 plant species, and only 3 of them overlap with
ZhasylDala's crop list — Қызанақ (tomato), Бұрыш (pepper), Құлпынай
(strawberry). Қияр (cucumber), Баялды (eggplant), and Көкөніс көктері
(greens) aren't in PlantVillage at all — there's no free public dataset
this script can pull for them, so recognizing those still needs real
photos added through the admin training page (or a paid multi-crop API —
ask if you want that wired in). "Ақұнтақ" (powdery mildew) also has no
matching tomato class in PlantVillage for the same reason.

Requires requirements-ml.txt installed (torch/torchvision) for the
training step, and internet access to github.com / raw.githubusercontent.com.

    python manage.py bootstrap_plantvillage
    python manage.py bootstrap_plantvillage --per-class 60
    python manage.py bootstrap_plantvillage --no-train   # only download+label
"""
from urllib.parse import quote

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.diagnosis.models import Disease
from apps.greenhouses.models import Crop
from apps.ml_training.models import ModelVersion, TrainingImage, TrainingJob

GITHUB_API = "https://api.github.com/repos/spMohanty/PlantVillage-Dataset/contents/raw/color/{folder}"
REQUEST_HEADERS = {"User-Agent": "zhasyldala-bootstrap-script"}

# (Crop.slug, PlantVillage folder name, Disease.slug on that crop —
# None means the folder's images are healthy/no-disease examples).
# Folder names are exactly as they appear in the dataset (some contain a
# comma or a space — quote() below handles that when building the URL).
CLASS_MAP = [
    ("tomato", "Tomato___healthy", None),
    ("tomato", "Tomato___Late_blight", "fitoftoroz"),
    ("tomato", "Tomato___Spider_mites Two-spotted_spider_mite", "ormekshi-kene"),
    ("pepper", "Pepper,_bell___healthy", None),
    ("pepper", "Pepper,_bell___Bacterial_spot", "bakterialdyk-dak"),
    ("strawberry", "Strawberry___healthy", None),
    ("strawberry", "Strawberry___Leaf_scorch", "zhapyraq-kuygi"),
]


class Command(BaseCommand):
    help = "Downloads a PlantVillage sample and trains+activates a cold-start ModelVersion."

    def add_arguments(self, parser):
        parser.add_argument("--per-class", type=int, default=40, help="Images to download per class (default 40).")
        parser.add_argument("--no-train", action="store_true", help="Only download+label images, skip training.")
        parser.add_argument(
            "--no-activate", action="store_true",
            help="Train but leave the result in 'ready' status instead of activating it immediately.",
        )

    def handle(self, *args, **options):
        needed_slugs = {crop_slug for crop_slug, _, _ in CLASS_MAP}
        crops = {c.slug: c for c in Crop.objects.filter(slug__in=needed_slugs)}
        missing = needed_slugs - set(crops)
        if missing:
            raise CommandError(
                f"Crop(s) {sorted(missing)} табылмады — алдымен `python manage.py seed_data` іске қосыңыз."
            )

        total = 0
        for crop_slug, folder, disease_slug in CLASS_MAP:
            crop = crops[crop_slug]
            disease = None
            if disease_slug:
                disease = Disease.objects.filter(crop=crop, slug=disease_slug).first()
                if disease is None:
                    self.stdout.write(self.style.WARNING(
                        f"Disease slug '{disease_slug}' ({crop.name}) табылмады, өткізіп жіберемін."
                    ))
                    continue
            count = self._download_class(folder, crop, disease, options["per_class"])
            total += count
            self.stdout.write(f"{crop.name} / {folder}: {count} сурет жүктелді")

        self.stdout.write(self.style.WARNING(
            "Қияр, Баялды, Көкөніс көктері және Ақұнтақ (мучнистая роса) үшін "
            "PlantVillage-те сәйкес класс жоқ — оларды /admin бетінде өз "
            "фотоларыңызбен қолмен қосыңыз."
        ))
        self.stdout.write(self.style.SUCCESS(f"Барлығы: {total} расталған сурет жүктелді."))

        if options["no_train"]:
            self.stdout.write("Оқыту өткізіп жіберілді (--no-train). Оқыту үшін: python manage.py bootstrap_plantvillage")
            return
        if total == 0:
            self.stdout.write(self.style.ERROR("Ешбір сурет жүктелмеді — интернет байланысын тексеріңіз."))
            return

        self.stdout.write("Оқыту басталды (бірнеше минут алуы мүмкін)...")
        from apps.ml.tasks import retrain_model  # imported lazily: only needed for this branch

        job = TrainingJob.objects.create()
        retrain_model(job.id)  # runs synchronously (this is a plain function call, not .delay())
        job.refresh_from_db()

        if job.status != TrainingJob.Status.DONE or job.model_version is None:
            self.stdout.write(self.style.ERROR(f"Оқыту сәтсіз аяқталды:\n{job.log}"))
            return

        version = job.model_version
        accuracy_text = f"{version.accuracy:.1%}" if version.accuracy is not None else "—"
        self.stdout.write(self.style.SUCCESS(f"Модель дайын: {version.name}, тексеру дәлдігі {accuracy_text}"))

        if options["no_activate"]:
            self.stdout.write(f"Іске қосу үшін: /admin бетінде немесе "
                               f"POST /api/admin/model-versions/{version.id}/activate/")
            return

        ModelVersion.objects.filter(status=ModelVersion.Status.ACTIVE).update(status=ModelVersion.Status.ARCHIVED)
        version.status = ModelVersion.Status.ACTIVE
        version.activated_at = timezone.now()
        version.save(update_fields=["status", "activated_at"])
        self.stdout.write(self.style.SUCCESS("Модель іске қосылды — диагностика енді осы модельмен жұмыс істейді."))

    def _download_class(self, folder, crop, disease, per_class):
        # PlantVillage folder names contain a comma ("Pepper,_bell___...")
        # and, for one tomato class, a literal space — encode explicitly
        # rather than relying on the HTTP client to do it implicitly.
        url = GITHUB_API.format(folder=quote(folder, safe=""))
        try:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            self.stdout.write(self.style.ERROR(
                f"{folder}: тізімдеу сәтсіз ({exc}) — GitHub API лимитіне тап болған болуыңыз мүмкін, кейінірек қайталаңыз."
            ))
            return 0

        entries = [e for e in response.json() if e.get("type") == "file"][:per_class]
        count = 0
        for entry in entries:
            try:
                image_response = requests.get(entry["download_url"], headers=REQUEST_HEADERS, timeout=30)
                image_response.raise_for_status()
            except requests.RequestException:
                continue

            training_image = TrainingImage(
                crop=crop, disease=disease, verified=True, source=TrainingImage.Source.SEED_DATASET,
            )
            training_image.image.save(entry["name"], ContentFile(image_response.content), save=False)
            training_image.save()
            count += 1
        return count
