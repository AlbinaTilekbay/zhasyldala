from django.contrib import admin

from .models import Diagnosis, DiagnosisRequest, Disease


@admin.register(Disease)
class DiseaseAdmin(admin.ModelAdmin):
    list_display = ["name", "crop", "severity", "is_active"]
    list_filter = ["severity", "is_active", "crop"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(DiagnosisRequest)
class DiagnosisRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "crop", "status", "created_at"]
    list_filter = ["status"]
    readonly_fields = ["created_at"]


@admin.register(Diagnosis)
class DiagnosisAdmin(admin.ModelAdmin):
    list_display = ["id", "disease", "severity", "confidence", "source", "created_at"]
    list_filter = ["severity", "source"]
