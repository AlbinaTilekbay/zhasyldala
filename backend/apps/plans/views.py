from django.shortcuts import get_object_or_404
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scans.models import ScanSession

from .models import TreatmentPlan, TreatmentPlanItem
from .serializers import TreatmentPlanItemSerializer, TreatmentPlanSerializer
from .services import generate_plan_for_session


class TreatmentPlanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TreatmentPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = TreatmentPlan.objects.filter(greenhouse__owner=self.request.user).prefetch_related("items")
        scan_session = self.request.query_params.get("scan_session")
        if scan_session:
            qs = qs.filter(scan_session_id=scan_session)
        return qs

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """POST {scan_session} — the mockup's "Емдеу жоспарын құру" CTA."""
        session = get_object_or_404(
            ScanSession, pk=request.data.get("scan_session"), greenhouse__owner=request.user
        )
        plan = generate_plan_for_session(session)
        return Response(TreatmentPlanSerializer(plan).data)


class TreatmentPlanItemViewSet(viewsets.GenericViewSet):
    serializer_class = TreatmentPlanItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch", "head"]

    def get_queryset(self):
        return TreatmentPlanItem.objects.filter(plan__greenhouse__owner=self.request.user)

    def partial_update(self, request, pk=None):
        """PATCH {done} — toggling a checklist row, as in the mockup."""
        item = get_object_or_404(self.get_queryset(), pk=pk)
        item.done = bool(request.data.get("done", item.done))
        item.save(update_fields=["done"])
        return Response(TreatmentPlanItemSerializer(item).data)
