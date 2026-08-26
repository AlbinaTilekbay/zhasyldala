from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.greenhouses.models import Greenhouse, Sector

from .models import ScanSession, SectorCapture
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

    @action(detail=True, methods=["post"])
    def captures(self, request, pk=None):
        """multipart: {sector, video} — one sector's 12s walkthrough clip.
        Kicks off async frame-sampling + diagnosis (apps.ml.tasks)."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=request.data.get("sector"), greenhouse=session.greenhouse)
        capture, _ = SectorCapture.objects.update_or_create(
            session=session, sector=sector,
            defaults={"video": request.data.get("video"), "status": SectorCapture.Status.UPLOADED},
        )

        from apps.ml.tasks import process_sector_capture

        process_sector_capture.delay(capture.id)
        capture.refresh_from_db()
        return Response(SectorCaptureSerializer(capture).data, status=status.HTTP_201_CREATED)

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
        session = self.get_object()
        captures_by_sector = {c.sector_id: c for c in session.captures.select_related("sector")}
        rows = []
        counts = {"ok": 0, "warn": 0, "bad": 0, "unscanned": 0}
        greenhouse = session.greenhouse
        current_row, row_cells = None, []
        for sector in greenhouse.sectors.order_by("row", "col"):
            capture = captures_by_sector.get(sector.id)
            diagnosis = None
            if capture:
                request_obj = getattr(capture, "diagnosis_request", None)
                diagnosis = getattr(request_obj, "result", None) if request_obj else None
            severity = diagnosis.severity if diagnosis else None
            tag = severity or "unscanned"
            counts[tag] = counts.get(tag, 0) + 1

            narrative_name = (diagnosis.ai_narrative or {}).get("condition_name") if diagnosis else None
            cell = {
                "sector_id": sector.id, "label": sector.label, "plants": sector.plant_count,
                "tag": tag,
                "diagnosis_disease": (diagnosis.disease.name if diagnosis and diagnosis.disease else narrative_name),
                "confidence": diagnosis.confidence if diagnosis else None,
            }
            if sector.row != current_row:
                if row_cells:
                    rows.append(row_cells)
                row_cells, current_row = [], sector.row
            row_cells.append(cell)
        if row_cells:
            rows.append(row_cells)

        return Response({
            "session_id": session.id,
            "status": session.status,
            "total_sectors": greenhouse.sectors.count(),
            "scanned_count": session.scanned_count,
            "counts": counts,
            "rows": rows,
        })

    @action(detail=True, methods=["get"], url_path="sectors/(?P<sector_id>[^/.]+)")
    def sector_detail(self, request, pk=None, sector_id=None):
        """Full detail for one sector within this session — the mockup's
        "Жүйе не көрді" / "Кеңестер" sector-detail screen."""
        session = self.get_object()
        sector = get_object_or_404(Sector, pk=sector_id, greenhouse=session.greenhouse)
        capture = SectorCapture.objects.filter(session=session, sector=sector).first()
        diagnosis = None
        if capture:
            request_obj = getattr(capture, "diagnosis_request", None)
            diagnosis = getattr(request_obj, "result", None) if request_obj else None

        if diagnosis is None:
            return Response({
                "sector": {"id": sector.id, "label": sector.label, "plants": sector.plant_count},
                "scanned": capture is not None,
                "tag": "unscanned" if capture is None else "ok",
                "status_text": "Түсірілмеген" if capture is None else "Қалыпты",
                "diagnosis_name": None if capture is None else "Ауру белгісі табылмады",
                "meta": None,
                "symptoms": [],
                "recommendations": ["Қазіргі күтімді жалғастырыңыз."] if capture else [],
                "ai_narrative": None,
                "frame_image": capture.frame_image.url if capture and capture.frame_image else None,
            })

        tag_text = {"ok": "Қалыпты", "warn": "Қауіп бар", "bad": "Ауру"}[diagnosis.severity]
        narrative_name = (diagnosis.ai_narrative or {}).get("condition_name")
        return Response({
            "sector": {"id": sector.id, "label": sector.label, "plants": sector.plant_count},
            "scanned": True,
            "tag": diagnosis.severity,
            "status_text": tag_text,
            "diagnosis_name": diagnosis.disease.name if diagnosis.disease else (narrative_name or "Ауру белгісі табылмады"),
            "meta": f"Сенімділік {round(diagnosis.confidence * 100)}%",
            "symptoms": diagnosis.symptoms_seen,
            "recommendations": diagnosis.recommendations,
            "ai_narrative": diagnosis.ai_narrative,
            "frame_image": capture.frame_image.url if capture.frame_image else None,
        })
