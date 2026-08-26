from django.db import models


class TreatmentPlan(models.Model):
    """One weekly checklist per scan that found something — mirrors the
    mockup's design note: "один недельный чек-лист... а не план на каждый
    сектор: обработка идёт по теплице целиком"."""

    greenhouse = models.ForeignKey("greenhouses.Greenhouse", on_delete=models.CASCADE, related_name="treatment_plans")
    scan_session = models.OneToOneField("scans.ScanSession", on_delete=models.CASCADE, related_name="treatment_plan")
    week_no = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.greenhouse.name} · {self.week_no}-апта жоспары"

    @property
    def done_count(self):
        return self.items.filter(done=True).count()

    @property
    def total_count(self):
        return self.items.count()


class TreatmentPlanItem(models.Model):
    plan = models.ForeignKey(TreatmentPlan, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    when_label = models.CharField(max_length=50, help_text='e.g. "Бүгін", "Күн сайын", "7-күн"')
    sector_labels = models.JSONField(default=list, blank=True, help_text="Affected sector labels, or [] for the whole greenhouse.")
    done = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.title

    @property
    def where_label(self):
        return ", ".join(self.sector_labels) + " секторы" if self.sector_labels else "бүкіл жылыжай"
