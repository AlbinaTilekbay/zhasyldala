from django.contrib import admin

from .models import ScanSession, SectorCapture, SectorPhoto


class SectorPhotoInline(admin.TabularInline):
    model = SectorPhoto
    extra = 0
    readonly_fields = ["created_at"]


class SectorCaptureInline(admin.TabularInline):
    model = SectorCapture
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(ScanSession)
class ScanSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "greenhouse", "status", "started_at", "finished_at"]
    list_filter = ["status"]
    inlines = [SectorCaptureInline]


@admin.register(SectorCapture)
class SectorCaptureAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "sector", "status", "created_at"]
    list_filter = ["status"]
    inlines = [SectorPhotoInline]
