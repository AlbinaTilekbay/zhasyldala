from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AnonymousDiagnoseView, DiagnosisRequestDetailView, DiseaseViewSet

router = DefaultRouter()
router.register("diseases", DiseaseViewSet, basename="disease")

urlpatterns = router.urls + [
    path("diagnose/anonymous/", AnonymousDiagnoseView.as_view(), name="diagnose-anonymous"),
    path("diagnose/<int:pk>/", DiagnosisRequestDetailView.as_view(), name="diagnose-detail"),
]
