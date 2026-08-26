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

    def test_row_counts_supports_a_jagged_grid(self):
        # Real greenhouses aren't always a clean rectangle — a row can end
        # early against a wall, a path, a support post, etc.
        sectors = self.greenhouse.generate_sectors(row_counts=[6, 6, 4])
        self.assertEqual(len(sectors), 16)
        by_row = {}
        for s in sectors:
            by_row.setdefault(s.row, []).append(s)
        self.assertEqual(sorted(len(v) for v in by_row.values()), [4, 6, 6])
        # Row C (index 2) only has 4 sectors — labels C1..C4, no C5/C6.
        row_c_labels = sorted(s.label for s in by_row[2])
        self.assertEqual(row_c_labels, ["C1", "C2", "C3", "C4"])
