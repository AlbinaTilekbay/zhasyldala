from rest_framework import serializers

from .models import SECTOR_PHOTOS_MAX, SECTOR_PHOTOS_MIN, ScanSession, SectorCapture, SectorPhoto


class SectorPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectorPhoto
        fields = ["id", "image", "order"]


class SectorCaptureSerializer(serializers.ModelSerializer):
    sector_label = serializers.CharField(source="sector.label", read_only=True)
    photos = SectorPhotoSerializer(many=True, read_only=True)
    photo_count = serializers.IntegerField(read_only=True)
    min_photos = serializers.SerializerMethodField()
    max_photos = serializers.SerializerMethodField()
    diagnosis = serializers.SerializerMethodField()

    class Meta:
        model = SectorCapture
        fields = [
            "id", "session", "sector", "sector_label", "photos", "photo_count",
            "min_photos", "max_photos", "status", "diagnosis", "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def get_min_photos(self, obj):
        return SECTOR_PHOTOS_MIN

    def get_max_photos(self, obj):
        return SECTOR_PHOTOS_MAX

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
