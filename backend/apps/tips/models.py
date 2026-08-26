from django.db import models


class Tip(models.Model):
    """Crop-tagged agronomy advice cards — admin-editable version of the
    mockup's hard-coded `TIPS` object."""

    crop = models.ForeignKey("greenhouses.Crop", on_delete=models.CASCADE, related_name="tips")
    tag = models.CharField(max_length=100, help_text='e.g. "Алдын алу", "Микроклимат", "Өнім", "Қоректену"')
    title = models.CharField(max_length=255)
    body = models.TextField()
    image_caption = models.CharField(max_length=100, blank=True, help_text="Placeholder label until real photos exist.")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["crop_id", "order"]

    def __str__(self):
        return f"{self.title} ({self.crop})"
