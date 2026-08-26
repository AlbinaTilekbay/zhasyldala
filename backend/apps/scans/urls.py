from rest_framework.routers import DefaultRouter

from .views import ScanSessionViewSet

router = DefaultRouter()
router.register("scan-sessions", ScanSessionViewSet, basename="scan-session")

urlpatterns = router.urls
