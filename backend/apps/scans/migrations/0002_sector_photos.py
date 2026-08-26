import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scans", "0001_initial"),
    ]

    operations = [
        # Sector diagnosis moved from "sample a frame out of a 12s video" to
        # "the farmer takes 3-10 still photos, OpenAI vision looks at all of
        # them together" — see apps/ml/openai_vision.py and
        # apps/ml/services.diagnose_images(). SectorCapture no longer holds
        # a single video/frame_image itself; each photo is now its own
        # SectorPhoto row so a sector can hold more than one.
        migrations.CreateModel(
            name="SectorPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="sector_photos/%Y/%m/")),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "capture",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="scans.sectorcapture"
                    ),
                ),
            ],
            options={"ordering": ["order", "id"]},
        ),
        migrations.RemoveField(model_name="sectorcapture", name="video"),
        migrations.RemoveField(model_name="sectorcapture", name="frame_image"),
        migrations.AlterField(
            model_name="sectorcapture",
            name="status",
            field=models.CharField(
                choices=[
                    ("in_progress", "Түсіріп жатыр"),
                    ("processing", "Өңделуде"),
                    ("done", "Дайын"),
                    ("failed", "Қате"),
                ],
                default="in_progress",
                max_length=12,
            ),
        ),
    ]
