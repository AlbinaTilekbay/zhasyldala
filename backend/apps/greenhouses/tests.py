from django.test import TestCase

from apps.accounts.models import User

from .models import Greenhouse


class SectorGenerationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(phone="+77011234567", password="x", full_name="A")
        self.greenhouse = Greenhouse.objects.create(owner=self.owner, name="GH", rows=3, cols=4)

    def test_generate_sectors_labels_match_mockup_pattern(self):
        sectors = self.greenhouse.generate_sectors()
        labels = sorted(s.label for s in sectors)
        expected = sorted(f"{r}{c}" for r in "ABC" for c in range(1, 5))
        self.assertEqual(labels, expected)
        self.assertEqual(len(sectors), 12)

    def test_regenerate_replaces_previous_sectors(self):
        self.greenhouse.generate_sectors()
        self.greenhouse.rows, self.greenhouse.cols = 2, 3
        self.greenhouse.save()
        sectors = self.greenhouse.generate_sectors()
        self.assertEqual(self.greenhouse.sectors.count(), 6)
        self.assertEqual(len(sectors), 6)

    def test_qr_tokens_are_unique(self):
        sectors = self.greenhouse.generate_sectors()
        tokens = {s.qr_token for s in sectors}
        self.assertEqual(len(tokens), len(sectors))
