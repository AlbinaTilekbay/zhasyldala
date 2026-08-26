from rest_framework import serializers

from .models import GRID_PRESETS, ROW_LETTERS, Crop, Greenhouse, Sector


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ["id", "name", "slug"]


class SectorSerializer(serializers.ModelSerializer):
    qr_token = serializers.UUIDField(read_only=True)

    class Meta:
        model = Sector
        fields = ["id", "label", "row", "col", "plant_count", "qr_token"]


class GreenhouseSerializer(serializers.ModelSerializer):
    crop = CropSerializer(read_only=True)
    crop_id = serializers.PrimaryKeyRelatedField(queryset=Crop.objects.all(), source="crop", write_only=True, required=False)
    sectors = SectorSerializer(many=True, read_only=True)

    class Meta:
        model = Greenhouse
        fields = ["id", "name", "crop", "crop_id", "rows", "cols", "row_counts", "preset_label", "sectors", "created_at"]
        read_only_fields = ["id", "created_at"]


class GridPresetSerializer(serializers.Serializer):
    label = serializers.CharField()
    sub = serializers.CharField()
    rows = serializers.IntegerField()
    cols = serializers.IntegerField()


class ApplyPresetSerializer(serializers.Serializer):
    """Body for POST /greenhouses/{id}/sectors/generate/ — one of three
    shapes:
    - {preset_label}: one of the 3 built-in rectangular presets.
    - {rows, cols}: a custom rectangle.
    - {row_counts: [6, 6, 4]}: a custom, possibly irregular grid — a
      different sector count per row (a row can end early against a
      wall, a path, a support post, etc.), which the two rectangle-only
      options above can't express."""

    preset_label = serializers.ChoiceField(choices=[p["label"] for p in GRID_PRESETS], required=False)
    rows = serializers.IntegerField(min_value=1, max_value=20, required=False)
    cols = serializers.IntegerField(min_value=1, max_value=20, required=False)
    row_counts = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=30),
        required=False, allow_empty=False,
    )

    def validate(self, attrs):
        if "row_counts" not in attrs and "preset_label" not in attrs and ("rows" not in attrs or "cols" not in attrs):
            raise serializers.ValidationError("Беріңіз: preset_label, немесе rows+cols, немесе row_counts.")
        # Row labels are letters (A, B, C, ...) — generate_sectors() would
        # raise IndexError past this, so reject it here with a clear
        # message instead of a 500. The 3 built-in presets never get near
        # this limit; it only matters for a custom rows/cols or row_counts
        # call.
        rows = attrs.get("rows") or len(attrs.get("row_counts") or [])
        if rows > len(ROW_LETTERS):
            raise serializers.ValidationError(f"Қатар саны ≤ {len(ROW_LETTERS)} болуы керек.")
        return attrs
