from django.contrib import admin

from .models import Tip


@admin.register(Tip)
class TipAdmin(admin.ModelAdmin):
    list_display = ["title", "crop", "tag", "order", "is_active"]
    list_filter = ["crop", "tag", "is_active"]
