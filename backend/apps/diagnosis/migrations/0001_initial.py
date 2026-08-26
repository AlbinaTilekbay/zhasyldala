import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("greenhouses", "0001_initial"),
        ("scans", "0001_initial"),
        ("ml_training", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Disease",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("slug", models.SlugField(max_length=255)),
                ("severity", models.CharField(choices=[("ok", "Қалыпты"), ("warn", "Қауіп бар"), ("bad", "Ауру")], default="bad", max_length=4)),
                ("description", models.TextField(blank=True)),
                ("symptoms", models.JSONField(blank=True, default=list)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("home_care_advice", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("crop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="diseases", to="greenhouses.crop")),
            ],
            options={"ordering": ["crop_id", "name"]},
        ),
        migrations.CreateModel(
            name="DiagnosisRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="diagnosis_requests/%Y/%m/")),
                ("status", models.CharField(choices=[("queued", "Кезекте"), ("processing", "Талдануда"), ("done", "Дайын"), ("failed", "Қате")], default="queued", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("crop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="greenhouses.crop")),
                ("sector_capture", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="diagnosis_request", to="scans.sectorcapture")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="diagnosis_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Diagnosis",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("severity", models.CharField(choices=[("ok", "Қалыпты"), ("warn", "Қауіп бар"), ("bad", "Ауру")], default="ok", max_length=4)),
                ("confidence", models.FloatField(default=0.0, help_text="0..1")),
                ("species_guess", models.CharField(blank=True, max_length=255)),
                ("symptoms_seen", models.JSONField(blank=True, default=list)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("source", models.CharField(choices=[("custom_model", "Меншікті модель"), ("plantnet", "Pl@ntNet"), ("rule", "Ереже (fallback)")], default="custom_model", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("disease", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="diagnoses", to="diagnosis.disease")),
                ("model_version", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="diagnoses", to="ml_training.modelversion")),
                ("request", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="result", to="diagnosis.diagnosisrequest")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AlterUniqueTogether(
            name="disease",
            unique_together={("crop", "slug")},
        ),
    ]
