from rest_framework import serializers

from .models import TreatmentPlan, TreatmentPlanItem


class TreatmentPlanItemSerializer(serializers.ModelSerializer):
    where_label = serializers.ReadOnlyField()

    class Meta:
        model = TreatmentPlanItem
        fields = ["id", "title", "description", "when_label", "sector_labels", "where_label", "done", "order"]
        read_only_fields = ["id", "title", "description", "when_label", "sector_labels", "order"]


class TreatmentPlanSerializer(serializers.ModelSerializer):
    items = TreatmentPlanItemSerializer(many=True, read_only=True)
    done_count = serializers.ReadOnlyField()
    total_count = serializers.ReadOnlyField()

    class Meta:
        model = TreatmentPlan
        fields = ["id", "greenhouse", "scan_session", "week_no", "items", "done_count", "total_count", "created_at"]
