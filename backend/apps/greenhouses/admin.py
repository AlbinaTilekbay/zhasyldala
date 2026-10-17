from django.contrib import admin

from .models import Crop, Greenhouse, Sector


class SectorInline(admin.TabularInline):
    model = Sector
    extra = 0
    fields = ["label", "row", "col", "plant_count", "qr_token"]
    readonly_fields = ["qr_token"]


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "order"]
    list_editable = ["order"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Greenhouse)
class GreenhouseAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "crop", "preset_label", "sector_count", "sector_area_m2", "created_at"]
    list_filter = ["crop"]
    search_fields = ["name", "owner__phone", "owner__full_name"]
    autocomplete_fields = ["owner", "crop"]
    inlines = [SectorInline]

    @admin.display(description="Секторлар")
    def sector_count(self, obj):
        return obj.sectors.count()


@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ["label", "greenhouse", "plant_count", "qr_token"]
    list_editable = ["plant_count"]
    list_filter = ["greenhouse"]
    search_fields = ["label", "greenhouse__name"]
