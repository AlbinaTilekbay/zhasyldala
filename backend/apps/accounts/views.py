from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, TokenObtainPairPhoneSerializer, UserSerializer


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class LoginView(TokenObtainPairView):
    """POST {phone, password} -> {access, refresh}. Matches the mockup: no
    registration is needed for the anonymous home-plant flow, only farmers
    log in here."""

    serializer_class = TokenObtainPairPhoneSerializer


class RegisterView(generics.CreateAPIView):
    """Registers a farmer account *and* their first greenhouse in one call,
    mirroring the mockup's single registration screen (which already shows
    a greenhouse name field) followed immediately by crop/sector setup."""

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        from apps.greenhouses.models import Greenhouse

        greenhouse = Greenhouse.objects.create(
            owner=user,
            name=serializer.validated_data.get("greenhouse_name") or f"{user.full_name} жылыжайы",
        )

        return Response(
            {
                "user": UserSerializer(user).data,
                "greenhouse_id": greenhouse.id,
                **tokens_for(user),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
