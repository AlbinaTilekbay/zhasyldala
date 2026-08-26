from rest_framework import permissions, viewsets

from .models import Tip
from .serializers import TipSerializer


class TipViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tip.objects.filter(is_active=True)
    serializer_class = TipSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        crop_id = self.request.query_params.get("crop")
        if crop_id:
            qs = qs.filter(crop_id=crop_id)
        return qs
