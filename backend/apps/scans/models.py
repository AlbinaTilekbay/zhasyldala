from django.conf import settings
from django.db import models

# A sector is diagnosed from a handful of still photos instead of a video
# clip (see apps/ml/video.py's removal + apps/ml/openai_vision.py): the
# farmer takes SECTOR_PHOTOS_MIN..SECTOR_PHOTOS_MAX photos of the sector
# from different angles/plants, and OpenAI vision looks at all of them
# together as one group to give a single combined verdict for the sector.
SECTOR_PHOTOS_MIN = getattr(settings, "SECTOR_PHOTOS_MIN", 3)
SECTOR_PHOTOS_MAX = getattr(settings, "SECTOR_PHOTOS_MAX", 10)


class ScanSession(models.Model):
    """One "шолу" (walkthrough) of a greenhouse: scan each sector's QR,
    take a few photos, repeat. Mirrors the mockup's scan_qr -> ... ->
    scan_done -> analyzing -> report screen sequence."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "Жүріп жатыр"
        ANALYZING = "analyzing", "Талдануда"
        DONE = "done", "Аяқталды"

    greenhouse = models.ForeignKey("greenhouses.Greenhouse", on_delete=models.CASCADE, related_name="scan_sessions")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.greenhouse.name} · {self.started_at:%Y-%m-%d}"

    @property
    def scanned_count(self):
        return self.captures.filter(status__in=[SectorCapture.Status.PROCESSING, SectorCapture.Status.DONE]).count()


class SectorCapture(models.Model):
    """One sector's set of photos for one scan session — SECTOR_PHOTOS_MIN
    to SECTOR_PHOTOS_MAX still photos, analyzed together as one group by
    apps/ml/services.diagnose_images() once the farmer finishes this
    sector."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "Түсіріп жатыр"  # capturing photos, not finished yet
        PROCESSING = "processing", "Өңделуде"  # finished capturing, diagnosis running
        DONE = "done", "Дайын"
        FAILED = "failed", "Қате"

    session = models.ForeignKey(ScanSession, on_delete=models.CASCADE, related_name="captures")
    sector = models.ForeignKey("greenhouses.Sector", on_delete=models.CASCADE, related_name="captures")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sector__row", "sector__col"]
        unique_together = [("session", "sector")]

    def __str__(self):
        return f"{self.session} · {self.sector.label}"

    @property
    def photo_count(self):
        return self.photos.count()

    @property
    def cover_image(self):
        """The first captured photo — used as the sector's thumbnail on the
        report/sector-detail screens, same role `frame_image` used to
        play when photos came from a sampled video frame."""
        first = self.photos.first()
        return first.image if first else None


class SectorPhoto(models.Model):
    """One still photo of a sector, taken during a walkthrough. Ordered by
    capture order (`order`) so the diagnosis group and the frontend's
    thumbnail strip agree on the sequence."""

    capture = models.ForeignKey(SectorCapture, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="sector_photos/%Y/%m/")
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.capture} · #{self.order + 1}"
