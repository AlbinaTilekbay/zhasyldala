import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


def tiny_jpeg():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color=(60, 140, 60)).save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile("leaf.jpg", buf.read(), content_type="image/jpeg")


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class AnonymousDiagnoseTests(TestCase):
    """Exercises the full anonymous "Үй өсімдігі" pipeline end-to-end. No
    trained model exists in tests, so this also verifies the fallback
    path in apps.ml.services never crashes the request — see the plan's
    'bootstrap/fallback' design note."""

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_diagnose_returns_a_result(self):
        response = self.client.post(
            "/api/diagnose/anonymous/", {"image": tiny_jpeg()}, format="multipart"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["status"], "done")
        self.assertIn("result", response.data)
        self.assertEqual(response.data["result"]["source"], "rule")

    def test_diagnose_detail_is_pollable(self):
        created = self.client.post(
            "/api/diagnose/anonymous/", {"image": tiny_jpeg()}, format="multipart"
        ).data
        response = self.client.get(f"/api/diagnose/{created['id']}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "done")
