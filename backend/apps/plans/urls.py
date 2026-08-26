from rest_framework.routers import DefaultRouter

from .views import TreatmentPlanItemViewSet, TreatmentPlanViewSet

router = DefaultRouter()
router.register("plans", TreatmentPlanViewSet, basename="plan")
router.register("plan-items", TreatmentPlanItemViewSet, basename="plan-item")

urlpatterns = router.urls
