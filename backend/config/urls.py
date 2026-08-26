from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Django's own built-in admin lives at /django-admin/, not /admin/ —
    # the React SPA's own admin/training dashboard (AdminLayout.jsx) is a
    # client-side route at /admin, and Django's URL resolver would swallow
    # that prefix first on any direct page load or refresh if both used
    # /admin/, silently showing the wrong admin panel. Keeping them on
    # separate prefixes is what makes /admin reliably load the training UI.
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("apps.greenhouses.urls")),
    path("api/", include("apps.scans.urls")),
    path("api/", include("apps.diagnosis.urls")),
    path("api/", include("apps.plans.urls")),
    path("api/", include("apps.tips.urls")),
    path("api/admin/", include("apps.ml_training.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


def frontend_index(request, *args, **kwargs):
    """Single-service deploys (see Dockerfile.railway) serve the built React
    app from here: any URL that isn't /api/, /django-admin/, /media/ or a
    static asset falls through to index.html, so React Router can handle
    client-side routes like /app/scan or /admin on a direct load or page
    refresh."""
    index_path = settings.BASE_DIR / "frontend_dist" / "index.html"
    if not index_path.exists():
        return HttpResponse(
            "Frontend build not found (frontend_dist/index.html missing) — "
            "this URL is only meaningful in the single-service Railway build; "
            "in local dev use the Vite server (npm run dev) instead.",
            status=501,
        )
    return FileResponse(open(index_path, "rb"), content_type="text/html")


# Must stay last: matches anything not already routed above.
urlpatterns += [
    re_path(r"^(?!api/|django-admin/|media/|static/).*$", frontend_index),
]
