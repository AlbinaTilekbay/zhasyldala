from django.conf import settings
from django.db import models


class TrainingImage(models.Model):
    """A labeled leaf photo used to (re)train the disease classifier. This
    is the dataset the admin page manages, per the "чтобы потом проект
    обновился и учел в следующих распознавании" requirement."""

    class Source(models.TextChoices):
        SEED_DATASET = "seed_dataset", "Бастапқы деректер жиыны (PlantVillage және т.б.)"
        ADMIN_UPLOAD = "admin_upload", "Админ жүктеген"
        USER_SCAN_PROMOTED = "user_scan_promoted", "Пайдаланушы сканынан расталған"

    image = models.ImageField(upload_to="training_images/%Y/%m/")
    crop = models.ForeignKey("greenhouses.Crop", on_delete=models.SET_NULL, null=True, blank=True, related_name="training_images")
    disease = models.ForeignKey(
        "diagnosis.Disease", on_delete=models.SET_NULL, null=True, blank=True, related_name="training_images",
        help_text="Leave blank for a healthy/'ok' example.",
    )
    verified = models.BooleanField(default=False, help_text="Counted as ground truth once verified by staff.")
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.ADMIN_UPLOAD)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="uploaded_training_images"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.disease.name if self.disease_id else "дені сау"
        return f"{label} · {self.crop or '—'} (#{self.pk})"


class ModelVersion(models.Model):
    class Status(models.TextChoices):
        TRAINING = "training", "Оқытылуда"
        READY = "ready", "Дайын"
        ACTIVE = "active", "Іске қосулы"
        FAILED = "failed", "Сәтсіз"
        ARCHIVED = "archived", "Мұрағатталған"

    name = models.CharField(max_length=100, help_text='e.g. "v3-2026-08-25"')
    file = models.FileField(upload_to="model_versions/", null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.TRAINING)
    accuracy = models.FloatField(null=True, blank=True)
    metrics = models.JSONField(null=True, blank=True, help_text="Per-class precision/recall/F1 etc.")
    trained_from_count = models.PositiveIntegerField(default=0, help_text="TrainingImage rows used.")
    base_version = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="fine_tunes")
    created_at = models.DateTimeField(auto_now_add=True)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.status})"


class TrainingJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Кезекте"
        RUNNING = "running", "Орындалуда"
        DONE = "done", "Дайын"
        FAILED = "failed", "Қате"

    model_version = models.ForeignKey(ModelVersion, on_delete=models.CASCADE, related_name="jobs", null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    log = models.TextField(blank=True)
    triggered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TrainingJob#{self.pk} ({self.status})"

    def append_log(self, line):
        self.log = (self.log + "\n" + line).strip()
        self.save(update_fields=["log"])
