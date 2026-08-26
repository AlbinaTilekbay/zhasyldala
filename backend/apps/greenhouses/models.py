import uuid

from django.conf import settings
from django.db import models

ROW_LETTERS = "ABCDE"

#: Sector grid presets shown on the mockup's "Жылыжайды бөлу" screen.
GRID_PRESETS = [
    {"label": "2×3", "sub": "6 сектор", "rows": 2, "cols": 3},
    {"label": "3×4", "sub": "12 сектор", "rows": 3, "cols": 4},
    {"label": "4×5", "sub": "20 сектор", "rows": 4, "cols": 5},
]


class Crop(models.Model):
    """The mockup's fixed CROPS list; kept as a table (not an enum) so an
    admin can add crops without a code change."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Greenhouse(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="greenhouses")
    name = models.CharField(max_length=255)
    crop = models.ForeignKey(Crop, on_delete=models.SET_NULL, null=True, blank=True, related_name="greenhouses")
    rows = models.PositiveSmallIntegerField(default=3)
    # `cols` is the grid's *widest* row once row_counts is set (real
    # greenhouses aren't always a clean rectangle — a row can end early
    # against a wall, a path, or a support post). Kept for the handful of
    # places that just want "how wide is this, roughly" (the QR-sheet PDF
    # layout, mostly) — the real per-row shape lives in row_counts.
    cols = models.PositiveSmallIntegerField(default=4)
    # One entry per row, e.g. [6, 6, 4] — a 3-row greenhouse whose first
    # two rows hold 6 sectors and whose third holds only 4. A plain
    # rectangular preset/rows×cols choice just fills this with `cols`
    # repeated `rows` times. Empty only for greenhouses created before
    # this field existed and never regenerated.
    row_counts = models.JSONField(default=list, blank=True)
    preset_label = models.CharField(max_length=40, default="3×4")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def generate_sectors(self, plants_base=40, row_counts=None):
        """(Re)creates the sector grid for this greenhouse, matching the
        mockup's `sectors()` labeling: row letters A, B, C… x sector
        numbers 1..N *within that row*. `row_counts` (one sector count per
        row) lets a row be shorter than the others — pass it explicitly
        for an irregular/jagged layout; omitted, it falls back to `cols`
        repeated `rows` times (a plain rectangle, the old behavior)."""
        counts = list(row_counts) if row_counts else [self.cols] * self.rows
        self.sectors.all().delete()
        sectors = []
        seq = 0
        for i, count in enumerate(counts):
            for j in range(count):
                label = f"{ROW_LETTERS[i]}{j + 1}"
                sectors.append(
                    Sector(
                        greenhouse=self,
                        row=i,
                        col=j,
                        label=label,
                        plant_count=plants_base + (seq % 5) * 6,
                    )
                )
                seq += 1
        Sector.objects.bulk_create(sectors)
        return list(self.sectors.order_by("row", "col"))


class Sector(models.Model):
    greenhouse = models.ForeignKey(Greenhouse, on_delete=models.CASCADE, related_name="sectors")
    row = models.PositiveSmallIntegerField()
    col = models.PositiveSmallIntegerField()
    label = models.CharField(max_length=10)
    plant_count = models.PositiveSmallIntegerField(default=40)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        ordering = ["row", "col"]
        unique_together = [("greenhouse", "row", "col")]

    def __str__(self):
        return f"{self.greenhouse.name} · {self.label}"
