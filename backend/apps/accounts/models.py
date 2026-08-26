from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Users authenticate with a phone number, matching the mockup's
    registration screen (Аты-жөні / Телефон / Жылыжай атауы / Құпиясөз)."""

    use_in_migrations = True

    def _create_user(self, phone, password, **extra_fields):
        if not phone:
            raise ValueError("Телефон нөмірі міндетті (phone is required)")
        phone = self.normalize_phone(phone)
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.FARMER)
        return self._create_user(phone, password, **extra_fields)

    @staticmethod
    def normalize_phone(phone):
        return "".join(ch for ch in phone if ch.isdigit() or ch == "+")


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        HOME = "home", "Үй пайдаланушысы"
        FARMER = "farmer", "Жылыжай / фермер"

    phone = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.HOME)
    language = models.CharField(max_length=5, default="kk")
    scan_reminder_days = models.PositiveSmallIntegerField(default=7)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.full_name or self.phone

    @property
    def initials(self):
        parts = self.full_name.split()
        letters = "".join(p[0] for p in parts[:2] if p)
        return (letters or self.phone[-2:]).upper()
