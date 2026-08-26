from django.db import models


class ScanSession(models.Model):
    """One "шолу" (walkthrough) of a greenhouse: scan each sector's QR,
    record ~12s of video, repeat. Mirrors the mockup's scan_qr -> ... ->
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
        return self.captures.count()


class SectorCapture(models.Model):
    """One sector's video for one scan session, plus the still frame(s)
    sampled from it for inference."""

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Жүктелді"
        PROCESSING = "processing", "Өңделуде"
        DONE = "done", "Дайын"
        FAILED = "failed", "Қате"

    session = models.ForeignKey(ScanSession, on_delete=models.CASCADE, related_name="captures")
    sector = models.ForeignKey("greenhouses.Sector", on_delete=models.CASCADE, related_name="captures")
    video = models.FileField(upload_to="sector_videos/%Y/%m/", null=True, blank=True)
    frame_image = models.ImageField(upload_to="sector_frames/%Y/%m/", null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.UPLOADED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sector__row", "sector__col"]
        unique_together = [("session", "sector")]

    def __str__(self):
        return f"{self.session} · {self.sector.label}"
