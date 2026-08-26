from rest_framework import serializers

from .models import ScanSession, SectorCapture


class SectorCaptureSerializer(serializers.ModelSerializer):
    sector_label = serializers.CharField(source="sector.label", read_only=True)
    diagnosis = serializers.SerializerMethodField()

    class Meta:
        model = SectorCapture
        fields = ["id", "session", "sector", "sector_label", "video", "frame_image", "status", "diagnosis", "created_at"]
        read_only_fields = ["id", "frame_image", "status", "created_at"]

    def get_diagnosis(self, obj):
        from apps.diagnosis.serializers import DiagnosisSerializer

        request = getattr(obj, "diagnosis_request", None)
        result = getattr(request, "result", None) if request else None
        return DiagnosisSerializer(result).data if result else None


class ScanSessionSerializer(serializers.ModelSerializer):
    captures = SectorCaptureSerializer(many=True, read_only=True)
    total_sectors = serializers.IntegerField(source="greenhouse.sectors.count", read_only=True)

    class Meta:
        model = ScanSession
        fields = ["id", "greenhouse", "status", "started_at", "finished_at", "captures", "total_sectors"]
        read_only_fields = ["id", "status", "started_at", "finished_at"]
