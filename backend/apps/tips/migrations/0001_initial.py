import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("greenhouses", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tip",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tag", models.CharField(help_text='e.g. "Алдын алу", "Микроклимат", "Өнім", "Қоректену"', max_length=100)),
                ("title", models.CharField(max_length=255)),
                ("body", models.TextField()),
                ("image_caption", models.CharField(blank=True, help_text="Placeholder label until real photos exist.", max_length=100)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("crop", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tips", to="greenhouses.crop")),
            ],
            options={"ordering": ["crop_id", "order"]},
        ),
    ]
