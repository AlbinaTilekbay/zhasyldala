from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Diagnosis, DiagnosisRequest, Disease
from .serializers import AnonymousDiagnoseSerializer, DiagnosisRequestSerializer, DiseaseSerializer


class DiseaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only for the app; full CRUD happens through /api/admin/ or the
    Django admin so staff can grow the knowledge base."""

    queryset = Disease.objects.filter(is_active=True)
    serializer_class = DiseaseSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        crop_id = self.request.query_params.get("crop")
        if crop_id:
            qs = qs.filter(crop_id=crop_id)
        return qs


class AnonymousDiagnoseView(APIView):
    """POST image -> runs inference inline (Celery task, eager in dev) and
    returns the finished DiagnosisRequest+result in one round trip, since
    the mockup's "Сурет талданып жатыр" screen is just a short spinner."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AnonymousDiagnoseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        diagnosis_request = DiagnosisRequest.objects.create(
            image=serializer.validated_data["image"],
            user=request.user if request.user.is_authenticated else None,
        )

        from apps.ml.tasks import run_diagnosis

        run_diagnosis.delay(diagnosis_request.id)
        diagnosis_request.refresh_from_db()
        return Response(
            DiagnosisRequestSerializer(diagnosis_request, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class DiagnosisRequestDetailView(APIView):
    """GET /api/diagnose/{id}/ — for polling when Celery isn't eager (a real
    worker is running the task asynchronously)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        diagnosis_request = DiagnosisRequest.objects.select_related("result", "result__disease").get(pk=pk)
        return Response(DiagnosisRequestSerializer(diagnosis_request, context={"request": request}).data)
