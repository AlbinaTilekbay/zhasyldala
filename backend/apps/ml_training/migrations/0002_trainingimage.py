import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ml_training", "0001_initial"),
        ("greenhouses", "0001_initial"),
        ("diagnosis", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TrainingImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="training_images/%Y/%m/")),
                ("verified", models.BooleanField(default=False, help_text="Counted as ground truth once verified by staff.")),
                ("source", models.CharField(choices=[("seed_dataset", "Бастапқы деректер жиыны (PlantVillage және т.б.)"), ("admin_upload", "Админ жүктеген"), ("user_scan_promoted", "Пайдаланушы сканынан расталған")], default="admin_upload", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("crop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="training_images", to="greenhouses.crop")),
                ("disease", models.ForeignKey(blank=True, help_text="Leave blank for a healthy/'ok' example.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="training_images", to="diagnosis.disease")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_training_images", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
