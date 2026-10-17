"""Creates (or updates the password of) the superuser named by the
DJANGO_SUPERUSER_PHONE / DJANGO_SUPERUSER_PASSWORD env vars. Runs on every
container start (see Dockerfile.railway) so the admin login on a PaaS
host is managed through its environment variables — no shell access
needed. Does nothing when the variables aren't set.

    python manage.py ensure_superuser
"""
import os

from django.core.management.base import BaseCommand

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create/update the superuser from DJANGO_SUPERUSER_PHONE / DJANGO_SUPERUSER_PASSWORD."

    def handle(self, *args, **options):
        phone = os.environ.get("DJANGO_SUPERUSER_PHONE", "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        if not phone or not password:
            self.stdout.write("ensure_superuser: DJANGO_SUPERUSER_PHONE/PASSWORD not set — skipped.")
            return
        name = os.environ.get("DJANGO_SUPERUSER_NAME", "Әкімші")
        phone = User.objects.normalize_phone(phone)
        user = User.objects.filter(phone=phone).first()
        if user is None:
            User.objects.create_superuser(phone=phone, password=password, full_name=name)
            self.stdout.write(self.style.SUCCESS(f"ensure_superuser: created {phone}"))
            return
        changed = []
        if not (user.is_staff and user.is_superuser and user.is_active):
            user.is_staff = user.is_superuser = user.is_active = True
            changed.append("flags")
        if not user.check_password(password):
            user.set_password(password)
            changed.append("password")
        if changed:
            user.save()
        self.stdout.write(f"ensure_superuser: {phone} ok{' (updated ' + ', '.join(changed) + ')' if changed else ''}")
