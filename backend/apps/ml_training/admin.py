from django.contrib import admin

from .models import ModelVersion, TrainingImage, TrainingJob


@admin.register(TrainingImage)
class TrainingImageAdmin(admin.ModelAdmin):
    list_display = ["id", "crop", "disease", "verified", "source", "uploaded_by", "created_at"]
    list_filter = ["verified", "source", "crop"]
    actions = ["mark_verified"]

    @admin.action(description="Расталған деп белгілеу (mark verified)")
    def mark_verified(self, request, queryset):
        queryset.update(verified=True)


@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):
    list_display = ["name", "status", "accuracy", "trained_from_count", "created_at", "activated_at"]
    list_filter = ["status"]
    readonly_fields = ["created_at", "activated_at"]


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ["id", "model_version", "status", "triggered_by", "created_at", "finished_at"]
    list_filter = ["status"]
    readonly_fields = ["created_at", "finished_at", "log"]
