from rest_framework.routers import DefaultRouter

from .views import TipViewSet

router = DefaultRouter()
router.register("tips", TipViewSet, basename="tip")

urlpatterns = router.urls
