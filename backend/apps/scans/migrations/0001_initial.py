import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("greenhouses", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ScanSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("in_progress", "Жүріп жатыр"), ("analyzing", "Талдануда"), ("done", "Аяқталды")], default="in_progress", max_length=12)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("greenhouse", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="scan_sessions", to="greenhouses.greenhouse")),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="SectorCapture",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("video", models.FileField(blank=True, null=True, upload_to="sector_videos/%Y/%m/")),
                ("frame_image", models.ImageField(blank=True, null=True, upload_to="sector_frames/%Y/%m/")),
                ("status", models.CharField(choices=[("uploaded", "Жүктелді"), ("processing", "Өңделуде"), ("done", "Дайын"), ("failed", "Қате")], default="uploaded", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sector", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="captures", to="greenhouses.sector")),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="captures", to="scans.scansession")),
            ],
            options={"ordering": ["sector__row", "sector__col"]},
        ),
        migrations.AlterUniqueTogether(
            name="sectorcapture",
            unique_together={("session", "sector")},
        ),
    ]
