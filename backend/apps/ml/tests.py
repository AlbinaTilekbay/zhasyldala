from django.test import TestCase, override_settings

from . import kindwise, plant_health
from .services import diagnose_image


@override_settings(KINDWISE_API_KEY="", KINDWISE_HEALTH_API_KEY="")
class ExternalApiNoOpTests(TestCase):
    """kindwise.diagnose() / plant_health.diagnose() must be safe no-ops
    (never raise, never call out to the network) whenever their API keys
    aren't configured — this is what keeps diagnose_image() working with
    zero external services wired in, same guarantee apps/ml/plantnet.py
    already gives."""

    def test_kindwise_returns_none_without_api_key(self):
        self.assertIsNone(kindwise.diagnose("/tmp/does-not-matter.jpg"))

    def test_plant_health_returns_none_without_api_key(self):
        self.assertIsNone(plant_health.diagnose("/tmp/does-not-matter.jpg"))

    def test_diagnose_image_still_falls_back_to_rule_for_greenhouse_crop(self):
        # A real crop (routes to kindwise.diagnose internally) — no
        # trained model in tests, no Kindwise key — diagnose_image must
        # still return the neutral fallback rather than raising, exactly
        # like it did before Kindwise existed (see apps/diagnosis/tests.py
        # for the equivalent end-to-end check through the API).
        from apps.greenhouses.models import Crop

        crop = Crop.objects.create(name="Қияр", slug="cucumber")
        result = diagnose_image("/tmp/does-not-matter.jpg", crop=crop)
        self.assertEqual(result["source"], "rule")

    def test_diagnose_image_still_falls_back_to_rule_for_home_plant(self):
        # crop=None (anonymous home-plant flow, e.g. an orchid photo) must
        # route to plant_health rather than kindwise, and still land on
        # the same safe fallback when no key is configured either way.
        result = diagnose_image("/tmp/does-not-matter.jpg", crop=None)
        self.assertEqual(result["source"], "rule")
