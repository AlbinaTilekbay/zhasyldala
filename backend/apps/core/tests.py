from django.contrib import admin
from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.accounts.models import User


@override_settings(STORAGES={**settings.STORAGES, "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}})
class DjangoAdminSmokeTests(TestCase):
    """Every registered model's list, add and (first row's) change page
    renders for a superuser — catches broken list_display / fieldsets."""

    def test_all_admin_pages_render(self):
        from django.core.management import call_command

        call_command("seed_data", verbosity=0)
        su = User.objects.create_superuser(phone="+77019990000", password="x", full_name="SU")
        self.client.force_login(su)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 200)
        for model, model_admin in admin.site._registry.items():
            info = (model._meta.app_label, model._meta.model_name)
            with self.subTest(model=info):
                self.assertEqual(self.client.get(reverse("admin:%s_%s_changelist" % info)).status_code, 200)
                self.assertEqual(self.client.get(reverse("admin:%s_%s_add" % info)).status_code, 200)
                obj = model.objects.first()
                if obj:
                    self.assertEqual(self.client.get(reverse("admin:%s_%s_change" % info, args=[obj.pk])).status_code, 200)
