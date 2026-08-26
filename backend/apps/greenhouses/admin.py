from django.contrib import admin

from .models import Crop, Greenhouse, Sector


class SectorInline(admin.TabularInline):
    model = Sector
    extra = 0
    readonly_fields = ["qr_token"]


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "order"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Greenhouse)
class GreenhouseAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "crop", "preset_label", "created_at"]
    list_filter = ["crop"]
    search_fields = ["name", "owner__phone", "owner__full_name"]
    inlines = [SectorInline]


@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ["greenhouse", "label", "plant_count", "qr_token"]
    list_filter = ["greenhouse"]
