from rest_framework import serializers

from .models import ModelVersion, TrainingImage, TrainingJob


class TrainingImageSerializer(serializers.ModelSerializer):
    disease_name = serializers.CharField(source="disease.name", read_only=True, default=None)
    crop_name = serializers.CharField(source="crop.name", read_only=True, default=None)

    class Meta:
        model = TrainingImage
        fields = [
            "id", "image", "crop", "crop_name", "disease", "disease_name",
            "verified", "source", "uploaded_by", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]


class ModelVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelVersion
        fields = [
            "id", "name", "file", "status", "accuracy", "metrics",
            "trained_from_count", "base_version", "created_at", "activated_at",
        ]
        read_only_fields = ["id", "file", "status", "accuracy", "metrics", "trained_from_count", "created_at", "activated_at"]


class TrainingJobSerializer(serializers.ModelSerializer):
    model_version = ModelVersionSerializer(read_only=True)

    class Meta:
        model = TrainingJob
        fields = ["id", "model_version", "status", "log", "triggered_by", "created_at", "finished_at"]
        read_only_fields = fields


class DatasetSummarySerializer(serializers.Serializer):
    """Per-class image counts, so the admin page can flag gaps like
    "Баялды: only 12 images" mentioned in the plan."""

    crop = serializers.CharField(allow_null=True)
    disease = serializers.CharField(allow_null=True)
    verified_count = serializers.IntegerField()
    unverified_count = serializers.IntegerField()
