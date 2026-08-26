from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CropViewSet,
    GreenhouseViewSet,
    GridPresetListView,
    SectorLookupByTokenView,
    SectorQrPngView,
)

router = DefaultRouter()
router.register("crops", CropViewSet, basename="crop")
router.register("greenhouses", GreenhouseViewSet, basename="greenhouse")

urlpatterns = router.urls + [
    path("sector-grid-presets/", GridPresetListView.as_view({"get": "list"}), name="grid-presets"),
    path("sectors/<int:pk>/qr.png", SectorQrPngView.as_view({"get": "retrieve"}), name="sector-qr-png"),
    path("sectors/by-token/<uuid:pk>/", SectorLookupByTokenView.as_view({"get": "retrieve"}), name="sector-by-token"),
]
