from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    initials = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "id", "phone", "full_name", "role", "language",
            "scan_reminder_days", "initials", "date_joined", "is_staff",
        ]
        read_only_fields = ["id", "role", "date_joined", "is_staff"]


class RegisterSerializer(serializers.ModelSerializer):
    """Matches the mockup's 3-field registration screen; greenhouse name is
    accepted here and consumed by the caller to create the Greenhouse."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    greenhouse_name = serializers.CharField(write_only=True, max_length=255)

    class Meta:
        model = User
        fields = ["phone", "full_name", "password", "greenhouse_name"]

    def validate_phone(self, value):
        phone = User.objects.normalize_phone(value)
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("Бұл телефон нөмірі тіркелген.")
        return phone

    def create(self, validated_data):
        validated_data.pop("greenhouse_name", None)
        password = validated_data.pop("password")
        user = User(role=User.Role.FARMER, **validated_data)
        user.set_password(password)
        user.save()
        return user


class TokenObtainPairPhoneSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD
