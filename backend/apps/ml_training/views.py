from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsStaff

from .models import ModelVersion, TrainingImage, TrainingJob
from .serializers import (
    DatasetSummarySerializer,
    ModelVersionSerializer,
    TrainingImageSerializer,
    TrainingJobSerializer,
)


class TrainingImageViewSet(viewsets.ModelViewSet):
    """The admin page's "upload + label a leaf photo" surface. Staff can
    also promote a real diagnosed capture into the dataset by POSTing here
    with source=user_scan_promoted and the capture's frame image."""

    queryset = TrainingImage.objects.select_related("crop", "disease")
    serializer_class = TrainingImageSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["crop", "disease", "verified", "source"]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        image = self.get_object()
        image.verified = True
        image.save(update_fields=["verified"])
        return Response(TrainingImageSerializer(image).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Per crop+disease counts, verified vs not — surfaces dataset gaps
        before a retrain is triggered."""
        rows = (
            TrainingImage.objects.values("crop__name", "disease__name")
            .annotate(
                verified_count=Count("id", filter=Q(verified=True)),
                unverified_count=Count("id", filter=Q(verified=False)),
            )
            .order_by("crop__name", "disease__name")
        )
        data = [
            {
                "crop": row["crop__name"],
                "disease": row["disease__name"],
                "verified_count": row["verified_count"],
                "unverified_count": row["unverified_count"],
            }
            for row in rows
        ]
        return Response(DatasetSummarySerializer(data, many=True).data)


class ModelVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ModelVersion.objects.all()
    serializer_class = ModelVersionSerializer
    permission_classes = [IsStaff]

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Promotes this version to production inference and archives the
        previously-active one. Rolling back is just activating an older
        version again."""
        version = self.get_object()
        if version.status != ModelVersion.Status.READY:
            return Response(
                {"detail": "Тек 'ready' статусындағы нұсқаны іске қосуға болады."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone

        ModelVersion.objects.filter(status=ModelVersion.Status.ACTIVE).update(status=ModelVersion.Status.ARCHIVED)
        version.status = ModelVersion.Status.ACTIVE
        version.activated_at = timezone.now()
        version.save(update_fields=["status", "activated_at"])
        return Response(ModelVersionSerializer(version).data)


class TrainingJobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TrainingJob.objects.select_related("model_version")
    serializer_class = TrainingJobSerializer
    permission_classes = [IsStaff]
    http_method_names = ["get", "post", "head"]

    def create(self, request, *args, **kwargs):
        """Kicks off a Celery retraining job over all verified TrainingImage
        rows. Returns immediately with a job the admin page can poll."""
        verified_count = TrainingImage.objects.filter(verified=True).count()
        if verified_count < 10:
            return Response(
                {"detail": f"Оқыту үшін кемінде 10 расталған сурет керек (қазір {verified_count})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = TrainingJob.objects.create(triggered_by=request.user)

        from apps.ml.tasks import retrain_model

        retrain_model.delay(job.id)
        job.refresh_from_db()
        return Response(TrainingJobSerializer(job).data, status=status.HTTP_201_CREATED)
