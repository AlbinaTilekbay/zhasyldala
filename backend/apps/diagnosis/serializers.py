from rest_framework import serializers

from .models import Diagnosis, DiagnosisRequest, Disease


class DiseaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disease
        fields = ["id", "name", "slug", "severity", "description", "symptoms", "recommendations", "home_care_advice"]


class DiagnosisSerializer(serializers.ModelSerializer):
    disease = DiseaseSerializer(read_only=True)

    class Meta:
        model = Diagnosis
        fields = [
            "id", "disease", "severity", "confidence", "species_guess",
            "symptoms_seen", "recommendations", "source", "created_at",
        ]


class DiagnosisRequestSerializer(serializers.ModelSerializer):
    result = DiagnosisSerializer(read_only=True)

    class Meta:
        model = DiagnosisRequest
        fields = ["id", "image", "crop", "status", "result", "created_at"]
        read_only_fields = ["id", "status", "result", "created_at"]


class AnonymousDiagnoseSerializer(serializers.Serializer):
    """POST /api/diagnose/anonymous/ — the mockup's Үй өсімдігі flow: one
    photo in, a diagnosis + home-care advice out, no account required."""

    image = serializers.ImageField()
