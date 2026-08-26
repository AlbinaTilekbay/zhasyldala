import uuid

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
            name="Crop",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
                ("slug", models.SlugField(max_length=100, unique=True)),
                ("order", models.PositiveSmallIntegerField(default=0)),
            ],
            options={"ordering": ["order", "name"]},
        ),
        migrations.CreateModel(
            name="Greenhouse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("rows", models.PositiveSmallIntegerField(default=3)),
                ("cols", models.PositiveSmallIntegerField(default=4)),
                ("preset_label", models.CharField(default="3×4", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("crop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="greenhouses", to="greenhouses.crop")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="greenhouses", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Sector",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("row", models.PositiveSmallIntegerField()),
                ("col", models.PositiveSmallIntegerField()),
                ("label", models.CharField(max_length=10)),
                ("plant_count", models.PositiveSmallIntegerField(default=40)),
                ("qr_token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("greenhouse", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sectors", to="greenhouses.greenhouse")),
            ],
            options={"ordering": ["row", "col"]},
        ),
        migrations.AlterUniqueTogether(
            name="sector",
            unique_together={("greenhouse", "row", "col")},
        ),
    ]
