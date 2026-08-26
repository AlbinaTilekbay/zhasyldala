from rest_framework.routers import DefaultRouter

from .views import ModelVersionViewSet, TrainingImageViewSet, TrainingJobViewSet

router = DefaultRouter()
router.register("training-images", TrainingImageViewSet, basename="training-image")
router.register("model-versions", ModelVersionViewSet, basename="model-version")
router.register("training-jobs", TrainingJobViewSet, basename="training-job")

urlpatterns = router.urls
