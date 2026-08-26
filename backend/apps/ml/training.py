"""The actual fine-tuning loop, split out of tasks.py so it can be unit
tested (with a tiny fake dataset) without going through Celery.

Deliberately simple: a handful of epochs over a frozen-backbone
MobileNetV3-Small, CPU-friendly, good enough to turn "10+ verified photos
per class" into a usable classifier and to keep improving as the admin
page accumulates more labeled images. Swap in a bigger backbone / more
epochs / a GPU box later without touching the calling code in tasks.py.
"""
import json
from collections import Counter

from django.conf import settings
from django.utils import timezone

EPOCHS = int(__import__("os").environ.get("ML_TRAIN_EPOCHS", "6"))
BATCH_SIZE = int(__import__("os").environ.get("ML_TRAIN_BATCH_SIZE", "16"))
VAL_FRACTION = 0.2


def _label_key(training_image):
    return (training_image.crop_id, training_image.disease_id)


def build_label_space(training_images):
    """Every distinct (crop, disease) pair seen in the verified dataset
    becomes one output class; disease=None is that crop's 'healthy'
    class."""
    seen = sorted({_label_key(t) for t in training_images}, key=lambda k: (k[0] or 0, k[1] or 0))
    labels = []
    for crop_id, disease_id in seen:
        from apps.diagnosis.models import Disease
        from apps.greenhouses.models import Crop

        crop = Crop.objects.filter(id=crop_id).first() if crop_id else None
        disease = Disease.objects.filter(id=disease_id).first() if disease_id else None
        labels.append({
            "crop_id": crop_id,
            "crop_slug": crop.slug if crop else None,
            "disease_slug": disease.slug if disease else None,
        })
    return labels


def run_training(job):
    import torch
    from torch.utils.data import DataLoader, Dataset
    from PIL import Image

    from apps.ml_training.models import ModelVersion, TrainingImage

    from .model_def import build_model, eval_transform, train_transform

    images = list(TrainingImage.objects.filter(verified=True).select_related("crop", "disease"))
    if len(images) < 10:
        raise ValueError(f"Тым аз расталған сурет бар: {len(images)} (кемінде 10 керек)")

    labels = build_label_space(images)
    key_to_index = {}
    for i, img in enumerate(sorted({_label_key(t) for t in images}, key=lambda k: (k[0] or 0, k[1] or 0))):
        key_to_index[img] = i

    class LeafDataset(Dataset):
        def __init__(self, items, transform):
            self.items = items
            self.transform = transform

        def __len__(self):
            return len(self.items)

        def __getitem__(self, idx):
            item = self.items[idx]
            image = Image.open(item.image.path).convert("RGB")
            tensor = self.transform(image)
            target = key_to_index[_label_key(item)]
            return tensor, target

    # simple deterministic split (every 5th verified image -> validation)
    train_items = [im for i, im in enumerate(images) if i % 5 != 0]
    val_items = [im for i, im in enumerate(images) if i % 5 == 0] or images[:1]

    train_loader = DataLoader(LeafDataset(train_items, train_transform()), batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(LeafDataset(val_items, eval_transform()), batch_size=BATCH_SIZE)

    model = build_model(num_classes=len(labels))
    # Freeze the backbone, fine-tune only the classifier head — fast enough
    # for CPU and appropriate for a dataset this small.
    for name, param in model.named_parameters():
        param.requires_grad = name.startswith("classifier")

    optimizer = torch.optim.Adam((p for p in model.parameters() if p.requires_grad), lr=1e-3)
    criterion = torch.nn.CrossEntropyLoss()

    model.train()
    for epoch in range(EPOCHS):
        running_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * x.size(0)
        job.append_log(f"Эпоха {epoch + 1}/{EPOCHS}: loss={running_loss / max(1, len(train_items)):.4f}")

    # Evaluate
    model.eval()
    correct, total = 0, 0
    per_class = Counter()
    per_class_correct = Counter()
    with torch.no_grad():
        for x, y in val_loader:
            out = model(x)
            preds = out.argmax(dim=1)
            for p, t in zip(preds.tolist(), y.tolist()):
                total += 1
                per_class[t] += 1
                if p == t:
                    correct += 1
                    per_class_correct[t] += 1
    accuracy = correct / total if total else 0.0
    metrics = {
        "val_accuracy": accuracy,
        "val_size": total,
        "per_class_accuracy": {
            labels[i]["disease_slug"] or f"{labels[i]['crop_slug']}-healthy": per_class_correct[i] / per_class[i]
            for i in per_class
        },
    }
    job.append_log(f"Тексеру дәлдігі: {accuracy:.1%} ({total} суретте)")

    version = ModelVersion.objects.create(
        name=f"v-{timezone.now():%Y%m%d-%H%M%S}",
        status=ModelVersion.Status.READY,
        accuracy=accuracy,
        metrics=metrics,
        trained_from_count=len(images),
    )
    settings.ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    weights_path = settings.ML_MODELS_DIR / f"{version.id}.pt"
    torch.save(model.state_dict(), weights_path)
    (settings.ML_MODELS_DIR / f"{version.id}.labels.json").write_text(json.dumps(labels, ensure_ascii=False))

    from django.core.files import File

    with open(weights_path, "rb") as fh:
        version.file.save(f"{version.id}.pt", File(fh), save=True)

    return version
