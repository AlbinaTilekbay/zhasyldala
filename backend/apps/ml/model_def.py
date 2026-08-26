"""Model architecture for the disease classifier.

CPU-friendly on purpose (the plan targets a generic self-hosted box, not a
GPU): MobileNetV3-Small pretrained on ImageNet, transfer-learned by
replacing the classifier head with one output per (crop, disease, "healthy")
class. torch/torchvision are optional dependencies — everything importing
this module must go through `apps.ml.registry` and check `ML_AVAILABLE`
first, so the rest of the app runs even before they're installed.
"""
try:
    import torch
    import torch.nn as nn
    from torchvision import models as tv_models
    from torchvision import transforms

    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised when torch isn't installed
    TORCH_AVAILABLE = False


IMAGE_SIZE = 224


def build_model(num_classes: int):
    """Returns a fresh MobileNetV3-Small with a `num_classes`-wide head,
    ImageNet-pretrained backbone. Used both for a first bootstrap training
    run and for every subsequent fine-tune."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch/torchvision are not installed — see requirements-ml.txt")

    net = tv_models.mobilenet_v3_small(weights=tv_models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    in_features = net.classifier[-1].in_features
    net.classifier[-1] = nn.Linear(in_features, num_classes)
    return net


def eval_transform():
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch/torchvision are not installed")
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def train_transform():
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch/torchvision are not installed")
    return transforms.Compose(
        [
            transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.7, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
