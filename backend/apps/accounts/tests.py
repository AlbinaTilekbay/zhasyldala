from django.test import TestCase
from rest_framework.test import APIClient

from apps.greenhouses.models import Greenhouse

from .models import User


class RegisterEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user_and_greenhouse(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "phone": "+7 701 123 45 67",
                "full_name": "Азамат Серікұлы",
                "password": "super-secret-1",
                "greenhouse_name": "№1 жылыжай, Қаскелең",
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = User.objects.get(phone="+77011234567")
        self.assertEqual(user.role, User.Role.FARMER)

        greenhouse = Greenhouse.objects.get(pk=response.data["greenhouse_id"])
        self.assertEqual(greenhouse.owner, user)
        self.assertEqual(greenhouse.name, "№1 жылыжай, Қаскелең")

    def test_register_rejects_duplicate_phone(self):
        User.objects.create_user(phone="+77011234567", password="x", full_name="A")
        response = self.client.post(
            "/api/auth/register/",
            {"phone": "+77011234567", "full_name": "B", "password": "super-secret-1", "greenhouse_name": "GH"},
        )
        self.assertEqual(response.status_code, 400)

    def test_login_returns_tokens(self):
        User.objects.create_user(phone="+77011234567", password="super-secret-1", full_name="A")
        response = self.client.post("/api/auth/login/", {"phone": "+77011234567", "password": "super-secret-1"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access", response.data)
