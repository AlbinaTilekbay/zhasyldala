from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("diagnosis", "0001_initial"),
    ]

    operations = [
        # The Source choices gained "kindwise_api"/"plant_health_api" in
        # models.py earlier without a matching migration (choices aren't
        # DB-enforced for a plain CharField, so nothing broke at runtime —
        # but this keeps migration state in sync so `makemigrations` never
        # produces a surprise no-op migration for it later).
        migrations.AlterField(
            model_name="diagnosis",
            name="source",
            field=models.CharField(
                choices=[
                    ("custom_model", "Меншікті модель"),
                    ("plantnet", "Pl@ntNet"),
                    ("kindwise_api", "crop.health (Kindwise)"),
                    ("plant_health_api", "plant.health (Kindwise)"),
                    ("rule", "Ереже (fallback)"),
                ],
                default="custom_model",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="diagnosis",
            name="ai_narrative",
            field=models.JSONField(
                blank=True,
                null=True,
                help_text=(
                    "Optional OpenAI-generated {cause, treatment_steps, prevention_tips, "
                    "encouragement} — see apps/ml/narrator.py. Null when OPENAI_API_KEY "
                    "isn't set or the call failed; the result screen falls back to the "
                    "plain recommendations list in that case."
                ),
            ),
        ),
    ]
