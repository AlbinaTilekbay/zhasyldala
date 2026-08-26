from django.test import TestCase, override_settings

from . import openai_vision
from .services import diagnose_image


@override_settings(OPENAI_API_KEY="")
class NoOpWithoutApiKeyTests(TestCase):
    """openai_vision.diagnose() must be a safe no-op (never raise, never
    call out to the network) whenever OPENAI_API_KEY isn't configured —
    this is what keeps diagnose_image() working with zero external
    services wired in, falling through to the offline model (or the
    neutral "rule" placeholder when that isn't trained either)."""

    def test_openai_vision_returns_none_without_api_key(self):
        self.assertIsNone(openai_vision.diagnose("/tmp/does-not-matter.jpg"))

    def test_diagnose_image_still_falls_back_to_rule_for_greenhouse_crop(self):
        # No OpenAI key, no trained offline model in tests — diagnose_image
        # must still return the neutral fallback rather than raising.
        from apps.greenhouses.models import Crop

        crop = Crop.objects.create(name="Қияр", slug="cucumber")
        result = diagnose_image("/tmp/does-not-matter.jpg", crop=crop)
        self.assertEqual(result["source"], "rule")

    def test_diagnose_image_still_falls_back_to_rule_for_home_plant(self):
        # crop=None (anonymous home-plant flow, e.g. an orchid photo) must
        # land on the same safe fallback when nothing is configured.
        result = diagnose_image("/tmp/does-not-matter.jpg", crop=None)
        self.assertEqual(result["source"], "rule")
