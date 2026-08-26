from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("diagnosis", "0002_diagnosis_ai_narrative"),
    ]

    operations = [
        # Kindwise (crop.health/plant.health) and Pl@ntNet were removed —
        # OpenAI vision now does both recognition and the result cards in
        # one call (see apps/ml/openai_vision.py). This only updates the
        # admin-dropdown choices; old rows already carrying "plantnet",
        # "kindwise_api", or "plant_health_api" are left as-is (choices
        # aren't DB-enforced for a plain CharField, so nothing breaks) —
        # they're kept in Source as clearly-labeled "(өшірілген)" /
        # disabled options rather than deleted outright.
        migrations.AlterField(
            model_name="diagnosis",
            name="source",
            field=models.CharField(
                choices=[
                    ("openai_vision", "OpenAI (фото бойынша)"),
                    ("custom_model", "Меншікті модель (PlantVillage, офлайн)"),
                    ("rule", "Ереже (fallback)"),
                    ("plantnet", "Pl@ntNet (өшірілген)"),
                    ("kindwise_api", "crop.health / Kindwise (өшірілген)"),
                    ("plant_health_api", "plant.health / Kindwise (өшірілген)"),
                ],
                default="custom_model",
                max_length=20,
            ),
        ),
    ]
