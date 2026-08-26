from django.conf import settings
from django.db import models


class Severity(models.TextChoices):
    OK = "ok", "Қалыпты"
    WARN = "warn", "Қауіп бар"
    BAD = "bad", "Ауру"


class Disease(models.Model):
    """The admin-editable knowledge base behind the mockup's hard-coded
    `ISSUES` object — one row per diagnosable condition. `crop=None` means
    the condition applies to any crop (used by the anonymous home-plant
    flow, which doesn't collect a crop)."""

    crop = models.ForeignKey(
        "greenhouses.Crop", on_delete=models.CASCADE, related_name="diseases", null=True, blank=True
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    severity = models.CharField(max_length=4, choices=Severity.choices, default=Severity.BAD)
    description = models.TextField(blank=True)
    symptoms = models.JSONField(default=list, blank=True, help_text="List of short symptom strings (Kazakh).")
    recommendations = models.JSONField(default=list, blank=True, help_text="List of short recommendation strings.")
    home_care_advice = models.JSONField(
        default=list, blank=True, help_text="Used only for the anonymous home-plant result screen."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("crop", "slug")]
        ordering = ["crop_id", "name"]

    def __str__(self):
        crop_name = self.crop.name if self.crop_id else "кез келген дақыл"
        return f"{self.name} ({crop_name})"


class DiagnosisRequest(models.Model):
    """One image submitted for diagnosis — either a stand-alone home-plant
    photo (anonymous, `user`/`sector_capture` null) or the frame(s) sampled
    from a greenhouse sector's walkthrough video."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Кезекте"
        PROCESSING = "processing", "Талдануда"
        DONE = "done", "Дайын"
        FAILED = "failed", "Қате"

    image = models.ImageField(upload_to="diagnosis_requests/%Y/%m/")
    crop = models.ForeignKey("greenhouses.Crop", on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="diagnosis_requests"
    )
    sector_capture = models.OneToOneField(
        "scans.SectorCapture", on_delete=models.CASCADE, null=True, blank=True, related_name="diagnosis_request"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"DiagnosisRequest#{self.pk} ({self.status})"

    @property
    def is_anonymous(self):
        return self.user_id is None


class Diagnosis(models.Model):
    class Source(models.TextChoices):
        CUSTOM_MODEL = "custom_model", "Меншікті модель"
        PLANTNET = "plantnet", "Pl@ntNet"
        KINDWISE = "kindwise_api", "crop.health (Kindwise)"
        PLANT_HEALTH = "plant_health_api", "plant.health (Kindwise)"
        RULE = "rule", "Ереже (fallback)"

    request = models.OneToOneField(DiagnosisRequest, on_delete=models.CASCADE, related_name="result")
    disease = models.ForeignKey(Disease, on_delete=models.SET_NULL, null=True, blank=True, related_name="diagnoses")
    severity = models.CharField(max_length=4, choices=Severity.choices, default=Severity.OK)
    confidence = models.FloatField(default=0.0, help_text="0..1")
    species_guess = models.CharField(max_length=255, blank=True, help_text="From Pl@ntNet, if called.")
    symptoms_seen = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.CUSTOM_MODEL)
    model_version = models.ForeignKey(
        "ml_training.ModelVersion", on_delete=models.SET_NULL, null=True, blank=True, related_name="diagnoses"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.disease.name if self.disease_id else "Ауру белгісі табылмады"
        return f"{label} ({self.confidence:.0%})"
