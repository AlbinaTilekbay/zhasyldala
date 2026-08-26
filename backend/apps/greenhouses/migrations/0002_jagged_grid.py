from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("greenhouses", "0001_initial"),
    ]

    operations = [
        # Lets a greenhouse's sector grid have a different number of
        # sectors per row (e.g. [6, 6, 4]) instead of always being a
        # strict rows×cols rectangle — see Greenhouse.generate_sectors().
        migrations.AddField(
            model_name="greenhouse",
            name="row_counts",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name="greenhouse",
            name="preset_label",
            field=models.CharField(default="3×4", max_length=40),
        ),
    ]
