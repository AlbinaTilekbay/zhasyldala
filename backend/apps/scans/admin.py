from django.contrib import admin
from django.utils.html import format_html

from apps.core.admin_utils import thumb

from .models import ScanSession, SectorCapture, SectorPhoto


class SectorPhotoInline(admin.TabularInline):
    model = SectorPhoto
    extra = 0
    fields = ["preview", "image", "order", "client_id", "created_at"]
    readonly_fields = ["preview", "client_id", "created_at"]

    @admin.display(description="Фото")
    def preview(self, obj):
        return thumb(obj.image, 72)


class SectorCaptureInline(admin.TabularInline):
    model = SectorCapture
    extra = 0
    fields = ["sector", "status", "created_at"]
    readonly_fields = ["created_at"]
    show_change_link = True


@admin.register(ScanSession)
class ScanSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "greenhouse", "status", "started_at", "finished_at", "scanned", "shared_link"]
    list_filter = ["status"]
    search_fields = ["greenhouse__name", "greenhouse__owner__phone"]
    date_hierarchy = "started_at"
    readonly_fields = ["share_token", "started_at"]
    inlines = [SectorCaptureInline]

    @admin.display(description="Тексерілді")
    def scanned(self, obj):
        return f"{obj.scanned_count}/{obj.greenhouse.sectors.count()}"

    @admin.display(description="Сілтеме")
    def shared_link(self, obj):
        if not obj.share_token:
            return "—"
        return format_html('<a href="/s/{}" target="_blank">ашу</a>', obj.share_token)


@admin.register(SectorCapture)
class SectorCaptureAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "sector", "status", "photos", "created_at"]
    list_filter = ["status"]
    search_fields = ["sector__label", "session__greenhouse__name"]
    inlines = [SectorPhotoInline]

    @admin.display(description="Фото саны")
    def photos(self, obj):
        return obj.photo_count
