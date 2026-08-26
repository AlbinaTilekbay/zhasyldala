import io

import qrcode
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import GRID_PRESETS, Crop, Greenhouse, Sector
from .serializers import (
    ApplyPresetSerializer,
    CropSerializer,
    GreenhouseSerializer,
    GridPresetSerializer,
    SectorSerializer,
)


class CropViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Crop.objects.all()
    serializer_class = CropSerializer
    permission_classes = [permissions.AllowAny]


class GridPresetListView(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        return Response(GridPresetSerializer(GRID_PRESETS, many=True).data)


class GreenhouseViewSet(viewsets.ModelViewSet):
    serializer_class = GreenhouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Greenhouse.objects.filter(owner=self.request.user).prefetch_related("sectors", "crop")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="sectors/generate")
    def generate_sectors(self, request, pk=None):
        """Body: {preset_label}, {rows, cols} or {row_counts: [6, 6, 4]}.
        Mirrors the mockup's 3rd registration step ("Жылыжайды бөлу") —
        row_counts additionally supports a greenhouse whose rows aren't
        all the same length."""
        greenhouse = self.get_object()
        serializer = ApplyPresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "row_counts" in data:
            row_counts = data["row_counts"]
            rows, cols = len(row_counts), max(row_counts)
            label = f"{rows}×{cols}" if len(set(row_counts)) == 1 else "+".join(str(c) for c in row_counts)
        elif "preset_label" in data:
            preset = next(p for p in GRID_PRESETS if p["label"] == data["preset_label"])
            rows, cols, label = preset["rows"], preset["cols"], preset["label"]
            row_counts = [cols] * rows
        else:
            rows, cols = data["rows"], data["cols"]
            label = f"{rows}×{cols}"
            row_counts = [cols] * rows

        greenhouse.rows, greenhouse.cols, greenhouse.row_counts, greenhouse.preset_label = rows, cols, row_counts, label
        greenhouse.save(update_fields=["rows", "cols", "row_counts", "preset_label"])
        sectors = greenhouse.generate_sectors(row_counts=row_counts)
        return Response(SectorSerializer(sectors, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="sectors/qr-sheet.pdf")
    def qr_sheet_pdf(self, request, pk=None):
        """Printable A4 sheet, one QR + label per sector — the mockup's
        "PDF жүктеу" button on the QR screen."""
        greenhouse = self.get_object()
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        margin = 15 * mm
        cell = 45 * mm
        cols_per_row = int((width - 2 * margin) // cell)

        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, height - margin, greenhouse.name)
        c.setFont("Helvetica", 9)
        c.drawString(margin, height - margin - 14, "ZhasylDala — сектор QR белгілері")

        x0 = margin
        top_of_first_page = height - margin - 30 * mm
        top_of_later_pages = height - margin - 10 * mm
        rows_per_page = max(1, int((top_of_first_page - margin) // cell))

        page_row_start = 0  # absolute row index where the current page began
        y0 = top_of_first_page
        for i, sector in enumerate(greenhouse.sectors.order_by("row", "col")):
            col_i, row_i = i % cols_per_row, i // cols_per_row
            row_on_page = row_i - page_row_start
            if row_on_page >= rows_per_page:
                c.showPage()
                page_row_start = row_i
                y0 = top_of_later_pages
                row_on_page = 0

            x = x0 + col_i * cell
            y = y0 - row_on_page * cell

            qr_img = qrcode.make(f"zhasyldala://sector/{sector.qr_token}")
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            from reportlab.lib.utils import ImageReader

            c.drawImage(ImageReader(qr_buf), x, y - 32 * mm, width=32 * mm, height=32 * mm)
            c.setFont("Helvetica-Bold", 11)
            c.drawCentredString(x + 16 * mm, y - 36 * mm, sector.label)

        c.save()
        buf.seek(0)
        response = HttpResponse(buf.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{greenhouse.name}-qr.pdf"'
        return response


class SectorQrPngView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, pk=None):
        sector = get_object_or_404(Sector, pk=pk, greenhouse__owner=request.user)
        img = qrcode.make(f"zhasyldala://sector/{sector.qr_token}")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return HttpResponse(buf.getvalue(), content_type="image/png")


class SectorLookupByTokenView(viewsets.ViewSet):
    """GET /sectors/by-token/{qr_token}/ — resolves a scanned QR code to its
    sector, used by the walkthrough's "scan QR" screen."""

    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, pk=None):
        sector = get_object_or_404(Sector, qr_token=pk, greenhouse__owner=request.user)
        return Response(SectorSerializer(sector).data)
