from django.core.files.base import ContentFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.diagnosis.models import Diagnosis, DiagnosisRequest
from apps.greenhouses.models import Greenhouse

from .models import ScanSession, SectorCapture


class ReportTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(phone="+77011112233", password="x", full_name="C")
        self.greenhouse = Greenhouse.objects.create(owner=self.owner, name="GH", rows=1, cols=2)
        self.a1, self.a2 = self.greenhouse.generate_sectors()
        self.session = ScanSession.objects.create(greenhouse=self.greenhouse, status="done")
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _diagnose(self, sector, source, severity="ok"):
        capture = SectorCapture.objects.create(session=self.session, sector=sector, status="done")
        req = DiagnosisRequest.objects.create(sector_capture=capture, status="done", image=ContentFile(b"x", "x.jpg"))
        Diagnosis.objects.create(request=req, severity=severity, source=source)

    def test_unanalysed_rule_result_is_unknown_not_healthy(self):
        # A "rule" fallback means nothing looked at the photos — it must
        # not be counted as a healthy sector.
        self._diagnose(self.a1, "rule")
        self._diagnose(self.a2, "openai_vision")
        report = self.client.get(f"/api/scan-sessions/{self.session.id}/report/").json()
        self.assertEqual(report["counts"]["unknown"], 1)
        self.assertEqual(report["counts"]["ok"], 1)
        detail = self.client.get(f"/api/scan-sessions/{self.session.id}/sectors/{self.a1.id}/").json()
        self.assertEqual(detail["tag"], "unknown")


class ShareHistoryCompareTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(phone="+77011112244", password="x", full_name="D")
        self.greenhouse = Greenhouse.objects.create(owner=self.owner, name="Жылыжай", rows=1, cols=2)
        self.a1, self.a2 = self.greenhouse.generate_sectors()
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _session(self, severity):
        session = ScanSession.objects.create(greenhouse=self.greenhouse, status="done")
        capture = SectorCapture.objects.create(session=session, sector=self.a1, status="done")
        req = DiagnosisRequest.objects.create(sector_capture=capture, status="done", image=ContentFile(b"x", "x.jpg"))
        Diagnosis.objects.create(request=req, severity=severity, source="openai_vision")
        return session

    def test_history_is_oldest_first_with_tags(self):
        self._session("ok")
        self._session("bad")
        data = self.client.get(f"/api/scan-sessions/history/?greenhouse={self.greenhouse.id}").json()
        self.assertEqual([s["tags"][str(self.a1.id)] for s in data["sessions"]], ["ok", "bad"])
        self.assertEqual(len(data["sectors"]), 2)

    def test_sector_detail_includes_previous_walkthrough(self):
        first = self._session("ok")
        second = self._session("bad")
        detail = self.client.get(f"/api/scan-sessions/{second.id}/sectors/{self.a1.id}/").json()
        self.assertEqual(detail["previous"]["session_id"], first.id)
        self.assertEqual(detail["previous"]["tag"], "ok")
        first_detail = self.client.get(f"/api/scan-sessions/{first.id}/sectors/{self.a1.id}/").json()
        self.assertIsNone(first_detail["previous"])

    def test_shared_link_is_public_and_read_only(self):
        session = self._session("bad")
        token = self.client.post(f"/api/scan-sessions/{session.id}/share/").json()["token"]
        # same token on a second share
        self.assertEqual(self.client.post(f"/api/scan-sessions/{session.id}/share/").json()["token"], token)
        anon = APIClient()
        report = anon.get(f"/api/shared/{token}/").json()
        self.assertEqual(report["counts"]["bad"], 1)
        pdf = anon.get(f"/api/shared/{token}/pdf/")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertEqual(anon.get("/api/shared/00000000-0000-0000-0000-000000000000/").status_code, 404)

    def test_owner_report_pdf(self):
        session = self._session("warn")
        self.assertEqual(self.client.get(f"/api/scan-sessions/{session.id}/pdf/").status_code, 200)

    def test_offline_retry_does_not_duplicate_photo_or_rerun_finish(self):
        session = ScanSession.objects.create(greenhouse=self.greenhouse)
        url = f"/api/scan-sessions/{session.id}/sectors/{self.a2.id}/photos/"
        img = lambda: ContentFile(_tiny_jpeg(), "p.jpg")  # noqa: E731
        self.client.post(url, {"image": img(), "client_id": "abc"}, format="multipart")
        again = self.client.post(url, {"image": img(), "client_id": "abc"}, format="multipart")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["photo_count"], 1)
        capture = SectorCapture.objects.get(session=session, sector=self.a2)
        capture.status = "done"
        capture.save()
        res = self.client.post(f"/api/scan-sessions/{session.id}/sectors/{self.a2.id}/finish/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "done")


def _tiny_jpeg():
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (40, 120, 60)).save(buf, "JPEG")
    return buf.getvalue()
