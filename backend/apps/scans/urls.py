from rest_framework.routers import DefaultRouter

from .views import ScanSessionViewSet, SharedReportViewSet

router = DefaultRouter()
router.register("scan-sessions", ScanSessionViewSet, basename="scan-session")
router.register("shared", SharedReportViewSet, basename="shared-report")

urlpatterns = router.urls
