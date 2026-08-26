import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ModelVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(help_text='e.g. "v3-2026-08-25"', max_length=100)),
                ("file", models.FileField(blank=True, null=True, upload_to="model_versions/")),
                ("status", models.CharField(choices=[("training", "Оқытылуда"), ("ready", "Дайын"), ("active", "Іске қосулы"), ("failed", "Сәтсіз"), ("archived", "Мұрағатталған")], default="training", max_length=10)),
                ("accuracy", models.FloatField(blank=True, null=True)),
                ("metrics", models.JSONField(blank=True, null=True)),
                ("trained_from_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("activated_at", models.DateTimeField(blank=True, null=True)),
                ("base_version", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="fine_tunes", to="ml_training.modelversion")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="TrainingJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("queued", "Кезекте"), ("running", "Орындалуда"), ("done", "Дайын"), ("failed", "Қате")], default="queued", max_length=10)),
                ("log", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("model_version", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="jobs", to="ml_training.modelversion")),
                ("triggered_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
