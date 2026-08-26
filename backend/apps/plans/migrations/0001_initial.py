import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("greenhouses", "0001_initial"),
        ("scans", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TreatmentPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("week_no", models.PositiveSmallIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("greenhouse", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="treatment_plans", to="greenhouses.greenhouse")),
                ("scan_session", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="treatment_plan", to="scans.scansession")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="TreatmentPlanItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("when_label", models.CharField(help_text='e.g. "Бүгін", "Күн сайын", "7-күн"', max_length=50)),
                ("sector_labels", models.JSONField(blank=True, default=list)),
                ("done", models.BooleanField(default=False)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="plans.treatmentplan")),
            ],
            options={"ordering": ["order"]},
        ),
    ]
