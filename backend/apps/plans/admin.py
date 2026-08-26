from django.contrib import admin

from .models import TreatmentPlan, TreatmentPlanItem


class TreatmentPlanItemInline(admin.TabularInline):
    model = TreatmentPlanItem
    extra = 0


@admin.register(TreatmentPlan)
class TreatmentPlanAdmin(admin.ModelAdmin):
    list_display = ["id", "greenhouse", "week_no", "done_count", "total_count", "created_at"]
    inlines = [TreatmentPlanItemInline]
