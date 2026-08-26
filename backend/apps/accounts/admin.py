from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["phone", "full_name", "role", "is_staff", "date_joined"]
    list_filter = ["role", "is_staff", "is_active"]
    search_fields = ["phone", "full_name"]
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Тұлға", {"fields": ("full_name", "role", "language", "scan_reminder_days")}),
        ("Рұқсаттар", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("phone", "full_name", "password1", "password2", "role")}),
    )
