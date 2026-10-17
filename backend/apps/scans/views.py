from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.greenhouses.models import Greenhouse, Sector

from .models import SECTOR_PHOTOS_MAX, SECTOR_PHOTOS_MIN, ScanSession, SectorCapture, SectorPhoto
from .reporting import capture_diagnosis, diagnosis_name, diagnosis_tag, greenhouse_history, previous_capture, report_pdf, session_report
from .serializers import ScanSessionSerializer, SectorCaptureSerializer


class ScanSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ScanSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head"]

    def get_queryset(self):
        return ScanSession.objects.filter(greenhouse__owner=self.request.user).select_related("greenhouse")

    def create(self, request, *args, **kwargs):
        greenhouse = get_object_or_404(Greenhouse, pk=request.data.get("greenhouse"), owner=request.user)
        session = ScanSession.objects.create(greenhouse=greenhouse)
        return Response(ScanSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"sectors/(?P<sector_id>[^/.]+)/photos")
    def sector_photos(self, request, pk=None, sector_id=None):
        """multipart {image} — adds one photo (of up to SECTOR_PHOTOS_MAX)
        to this sector's in-progress capture for this session, creating it
        on the first photo. Mirrors the mockup's step-by-step capture
        screen, one photo at a time, instead of the old single 12s video
        upload."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=sector_id, greenhouse=session.greenhouse)
        capture, _ = SectorCapture.objects.get_or_create(session=session, sector=sector)

        # Offline queue retry of a photo the server already has: answer as
        # if it were just added, without storing it twice.
        client_id = (request.data.get("client_id") or "")[:64]
        if client_id and capture.photos.filter(client_id=client_id).exists():
            return Response(SectorCaptureSerializer(capture).data, status=status.HTTP_200_OK)

        if capture.status != SectorCapture.Status.IN_PROGRESS:
            return Response(
                {"detail": "Бұл сектор түсіру аяқталды — жаңа фото қосу мүмкін емес."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if capture.photo_count >= SECTOR_PHOTOS_MAX:
            return Response(
                {"detail": f"Бір секторға ең көбі {SECTOR_PHOTOS_MAX} фото түсіруге болады."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        image = request.data.get("image")
        if not image:
            return Response({"detail": "Фото жіберілмеді."}, status=status.HTTP_400_BAD_REQUEST)

        SectorPhoto.objects.create(capture=capture, image=image, order=capture.photo_count, client_id=client_id)
        capture.refresh_from_db()
        return Response(SectorCaptureSerializer(capture).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"sectors/(?P<sector_id>[^/.]+)/photos/undo")
    def sector_photos_undo(self, request, pk=None, sector_id=None):
        """Removes the most recently added photo for this sector — lets the
        farmer discard an obviously bad shot (glare, thumb in frame, wrong
        plant) before finishing, without starting the whole sector over."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=sector_id, greenhouse=session.greenhouse)
        capture = get_object_or_404(SectorCapture, session=session, sector=sector)
        if capture.status != SectorCapture.Status.IN_PROGRESS:
            return Response(
                {"detail": "Бұл сектор түсіру аяқталды."}, status=status.HTTP_400_BAD_REQUEST
            )
        last = capture.photos.order_by("-order", "-id").first()
        if last:
            last.delete()
        capture.refresh_from_db()
        return Response(SectorCaptureSerializer(capture).data)

    @action(detail=True, methods=["post"], url_path=r"sectors/(?P<sector_id>[^/.]+)/finish")
    def finish_sector(self, request, pk=None, sector_id=None):
        """"Сектор дайын" — closes photo capture for this sector (requires
        at least SECTOR_PHOTOS_MIN photos already uploaded) and runs one
        grouped diagnosis over all of them together (apps.ml.tasks.
        analyze_sector_capture -> apps.ml.services.diagnose_images)."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=sector_id, greenhouse=session.greenhouse)
        capture = get_object_or_404(SectorCapture, session=session, sector=sector)

        # Already finished (e.g. the offline queue resending) — don't run
        # and bill the diagnosis a second time.
        if capture.status != SectorCapture.Status.IN_PROGRESS:
            return Response(SectorCaptureSerializer(capture).data)

        if capture.photo_count < SECTOR_PHOTOS_MIN:
            return Response(
                {"detail": f"Кемінде {SECTOR_PHOTOS_MIN} фото түсіру керек (қазір {capture.photo_count})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.ml.tasks import analyze_sector_capture

        capture.status = SectorCapture.Status.PROCESSING
        capture.save(update_fields=["status"])
        analyze_sector_capture.delay(capture.id)
        capture.refresh_from_db()
        return Response(SectorCaptureSerializer(capture).data)

    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None):
        """"Дайын — есеп құру" — closes the walkthrough (any unscanned
        sectors just stay grey in the report, per the mockup's design
        note: an incomplete walkthrough is normal, not an error)."""
        session = self.get_object()
        session.status = ScanSession.Status.DONE
        session.finished_at = timezone.now()
        session.save(update_fields=["status", "finished_at"])
        return Response(ScanSessionSerializer(session).data)

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        """Sector-grid report: every sector in the greenhouse, colored by
        its latest diagnosis for this session (or grey if unscanned) —
        mirrors the mockup's `cellStyle()` logic."""
        return Response(session_report(self.get_object()))

    @action(detail=False, methods=["get"])
    def history(self, request):
        """?greenhouse=<id> — finished walkthroughs oldest-first with each
        sector's tag, for the "how the disease spread" timeline."""
        greenhouse = get_object_or_404(Greenhouse, pk=request.query_params.get("greenhouse"), owner=request.user)
        return Response({
            "sectors": [{"id": s.id, "label": s.label, "row": s.row, "col": s.col} for s in greenhouse.sectors.order_by("row", "col")],
            "sessions": greenhouse_history(greenhouse),
        })

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        """Returns (creating once) a read-only public link token for this
        report — for sending to an agronomist."""
        session = self.get_object()
        return Response({"token": str(session.ensure_share_token())})

    @action(detail=True, methods=["get"], url_path="pdf")
    def report_pdf(self, request, pk=None):
        return pdf_response(self.get_object())

    @action(detail=True, methods=["get"], url_path="sectors/(?P<sector_id>[^/.]+)")
    def sector_detail(self, request, pk=None, sector_id=None):
        """Full detail for one sector within this session — the mockup's
        "Жүйе не көрді" / "Кеңестер" sector-detail screen."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=sector_id, greenhouse=session.greenhouse)
        capture = SectorCapture.objects.filter(session=session, sector=sector).prefetch_related("photos").first()
        diagnosis = None
        if capture:
            request_obj = getattr(capture, "diagnosis_request", None)
            diagnosis = getattr(request_obj, "result", None) if request_obj else None
        cover = capture.cover_image if capture else None
        # Full photo list (in the same 1-based order they were sent to
        # OpenAI) so the screen can show every photo of the sector, not
        # just the cover — needed to highlight exactly which one(s) the
        # model saw the problem in (diagnosis.ai_narrative.affected_photos,
        # see apps/ml/openai_vision.py).
        photos = (
            [{"id": p.id, "url": p.image.url, "position": p.order + 1} for p in capture.photos.all()]
            if capture else []
        )

        prev = previous_capture(session, sector)
        prev_diag = capture_diagnosis(prev)
        previous = (
            {
                "session_id": prev.session_id,
                "started_at": prev.session.started_at,
                "tag": diagnosis_tag(prev_diag) or "unknown",
                "diagnosis_name": diagnosis_name(prev_diag),
                "photos": [{"id": p.id, "url": p.image.url, "position": p.order + 1} for p in prev.photos.all()],
            }
            if prev else None
        )

        if diagnosis is None:
            return Response({
                "previous": previous,
                "sector": {"id": sector.id, "label": sector.label, "plants": sector.plant_count},
                "scanned": capture is not None,
                "tag": "unscanned" if capture is None else "ok",
                "status_text": "Түсірілмеген" if capture is None else "Қалыпты",
                "diagnosis_name": None if capture is None else "Ауру белгісі табылмады",
                "meta": None,
                "symptoms": [],
                "recommendations": ["Қазіргі күтімді жалғастырыңыз."] if capture else [],
                "ai_narrative": None,
                "frame_image": cover.url if cover else None,
                "photos": photos,
            })

        if diagnosis.source == "rule":
            return Response({
                "previous": previous,
                "sector": {"id": sector.id, "label": sector.label, "plants": sector.plant_count},
                "scanned": True,
                "tag": "unknown",
                "status_text": "Анықталмады",
                "diagnosis_name": "Фотолар талданбады",
                "meta": None,
                "symptoms": [],
                "recommendations": [
                    "Талдау қызметіне қосылу мүмкін болмады — көбіне интернет әлсіз болғанда болады.",
                    "Келесі шолуда осы секторды қайта түсіріңіз.",
                ],
                "ai_narrative": None,
                "frame_image": cover.url if cover else None,
                "photos": photos,
            })

        tag_text = {"ok": "Қалыпты", "warn": "Қауіп бар", "bad": "Ауру"}[diagnosis.severity]
        narrative_name = (diagnosis.ai_narrative or {}).get("condition_name")
        return Response({
            "previous": previous,
            "sector": {"id": sector.id, "label": sector.label, "plants": sector.plant_count},
            "scanned": True,
            "tag": diagnosis.severity,
            "status_text": tag_text,
            "diagnosis_name": diagnosis.disease.name if diagnosis.disease else (narrative_name or "Ауру белгісі табылмады"),
            "meta": f"Сенімділік {round(diagnosis.confidence * 100)}%",
            "symptoms": diagnosis.symptoms_seen,
            "recommendations": diagnosis.recommendations,
            "ai_narrative": diagnosis.ai_narrative,
            "frame_image": cover.url if cover else None,
            "photos": photos,
        })


def pdf_response(session):
    response = HttpResponse(report_pdf(session), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="zhasyldala-esep-{session.started_at:%Y-%m-%d}.pdf"'
    return response


class SharedReportViewSet(viewsets.ViewSet):
    """Public, read-only view of one shared report (no account needed) —
    GET /api/shared/<token>/ and /api/shared/<token>/pdf."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def retrieve(self, request, pk=None):
        session = get_object_or_404(ScanSession, share_token=pk, status=ScanSession.Status.DONE)
        return Response(session_report(session))

    @action(detail=True, methods=["get"], url_path="pdf")
    def report_pdf(self, request, pk=None):
        session = get_object_or_404(ScanSession, share_token=pk, status=ScanSession.Status.DONE)
        return pdf_response(session)
