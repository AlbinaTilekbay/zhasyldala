from django.contrib import admin

from apps.core.admin_utils import thumb

from .models import Diagnosis, DiagnosisRequest, Disease


@admin.register(Disease)
class DiseaseAdmin(admin.ModelAdmin):
    list_display = ["name", "crop", "severity", "is_active"]
    list_editable = ["severity", "is_active"]
    list_filter = ["severity", "is_active", "crop"]
    search_fields = ["name", "slug", "description"]
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("crop", "name", "slug", "severity", "is_active")}),
        ("Сипаттама", {"fields": ("description", "symptoms", "recommendations", "home_care_advice"),
                       "description": "Тізімдер JSON түрінде: [\"бірінші\", \"екінші\"]"}),
    )


class DiagnosisInline(admin.StackedInline):
    model = Diagnosis
    extra = 0
    fields = ["severity", "disease", "confidence", "source", "species_guess", "symptoms_seen", "recommendations", "ai_narrative"]
    readonly_fields = ["source"]


@admin.register(DiagnosisRequest)
class DiagnosisRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "preview", "user", "crop", "status", "created_at"]
    list_filter = ["status", "crop"]
    search_fields = ["user__phone", "user__full_name"]
    date_hierarchy = "created_at"
    readonly_fields = ["created_at", "preview_large"]
    inlines = [DiagnosisInline]

    @admin.display(description="Фото")
    def preview(self, obj):
        return thumb(obj.image, 48)

    @admin.display(description="Фото")
    def preview_large(self, obj):
        return thumb(obj.image, 240)


@admin.register(Diagnosis)
class DiagnosisAdmin(admin.ModelAdmin):
    list_display = ["id", "condition", "severity", "confidence_pct", "source", "created_at"]
    list_filter = ["severity", "source"]
    search_fields = ["disease__name", "species_guess"]
    date_hierarchy = "created_at"
    autocomplete_fields = ["disease"]

    @admin.display(description="Ауру")
    def condition(self, obj):
        return obj.disease.name if obj.disease else (obj.ai_narrative or {}).get("condition_name") or "—"

    @admin.display(description="Сенімділік")
    def confidence_pct(self, obj):
        return f"{round(obj.confidence * 100)}%"
