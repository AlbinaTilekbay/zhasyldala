from django.test import TestCase

from apps.accounts.models import User
from apps.greenhouses.models import Greenhouse
from apps.scans.models import ScanSession

from .models import TreatmentPlan
from .services import generate_plan_for_session


class PlanGenerationTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(phone="+77011234567", password="x", full_name="A")
        self.greenhouse = Greenhouse.objects.create(owner=owner, name="GH")
        self.greenhouse.generate_sectors()
        self.session = ScanSession.objects.create(greenhouse=self.greenhouse)

    def test_generate_creates_five_default_steps(self):
        plan = generate_plan_for_session(self.session)
        self.assertEqual(plan.items.count(), 5)

    def test_regenerate_does_not_wipe_progress(self):
        plan = generate_plan_for_session(self.session)
        item = plan.items.first()
        item.done = True
        item.save(update_fields=["done"])

        plan_again = generate_plan_for_session(self.session)
        self.assertEqual(plan.id, plan_again.id)
        self.assertTrue(plan_again.items.get(pk=item.pk).done)

    def test_one_plan_per_session(self):
        generate_plan_for_session(self.session)
        generate_plan_for_session(self.session)
        self.assertEqual(TreatmentPlan.objects.filter(scan_session=self.session).count(), 1)
