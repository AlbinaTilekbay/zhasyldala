from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """Gate for the admin training/retraining endpoints — only Django staff
    accounts (django admin's `is_staff`) may manage the dataset or trigger
    training jobs."""

    message = "Бұл әрекет тек әкімшілерге қолжетімді."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
