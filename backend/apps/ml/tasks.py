import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def run_diagnosis(diagnosis_request_id: int):
    """Runs inference for one DiagnosisRequest (anonymous home-plant photo
    or a greenhouse sector's sampled frame) and writes the Diagnosis row.
    Never leaves a request stuck 'processing' — always ends 'done' or
    'failed'."""
    from apps.diagnosis.models import Diagnosis, DiagnosisRequest

    from .services import diagnose_image

    req = DiagnosisRequest.objects.select_related("crop").get(pk=diagnosis_request_id)
    req.status = DiagnosisRequest.Status.PROCESSING
    req.save(update_fields=["status"])

    try:
        result = diagnose_image(req.image.path, crop=req.crop)
        Diagnosis.objects.update_or_create(
            request=req,
            defaults={
                "disease": result["disease"],
                "severity": result["severity"],
                "confidence": result["confidence"],
                "species_guess": result.get("species_guess", ""),
                "symptoms_seen": result["symptoms_seen"],
                "recommendations": result["recommendations"],
                "source": result["source"],
                "model_version": result.get("model_version"),
                "ai_narrative": result.get("ai_narrative"),
            },
        )
        req.status = DiagnosisRequest.Status.DONE
    except Exception:  # noqa: BLE001
        logger.exception("Diagnosis failed for request %s", diagnosis_request_id)
        req.status = DiagnosisRequest.Status.FAILED
    req.save(update_fields=["status"])
    return req.status


@shared_task
def analyze_sector_capture(sector_capture_id: int):
    """Sector photo-group pipeline: once a sector's 3-10 captured photos
    are finished (apps/scans/views.py's finish_sector), this runs one
    grouped diagnosis over all of them together via
    apps.ml.services.diagnose_images — a single combined verdict for the
    whole sector, not one per photo. Replaces the old video-frame-sampling
    pipeline (apps/ml/video.py, removed): a handful of farmer-chosen
    still photos turned out to give OpenAI vision much more reliable
    material to work with than one frame auto-picked out of a 12s clip."""
    from apps.diagnosis.models import Diagnosis, DiagnosisRequest
    from apps.scans.models import SectorCapture

    from .services import diagnose_images

    capture = SectorCapture.objects.select_related("sector__greenhouse__crop", "session").prefetch_related(
        "photos"
    ).get(pk=sector_capture_id)
    capture.status = SectorCapture.Status.PROCESSING
    capture.save(update_fields=["status"])

    photos = list(capture.photos.all())
    if not photos:
        capture.status = SectorCapture.Status.FAILED
        capture.save(update_fields=["status"])
        return "no_photos"

    try:
        crop = capture.sector.greenhouse.crop
        result = diagnose_images([p.image.path for p in photos], crop=crop)

        req, _ = DiagnosisRequest.objects.update_or_create(
            sector_capture=capture,
            # The first captured photo doubles as the DiagnosisRequest's
            # own "image" — used for the result screen / report thumbnail,
            # same role a sampled video frame used to play.
            defaults={"image": photos[0].image, "crop": crop},
        )
        Diagnosis.objects.update_or_create(
            request=req,
            defaults={
                "disease": result["disease"],
                "severity": result["severity"],
                "confidence": result["confidence"],
                "species_guess": result.get("species_guess", ""),
                "symptoms_seen": result["symptoms_seen"],
                "recommendations": result["recommendations"],
                "source": result["source"],
                "model_version": result.get("model_version"),
                "ai_narrative": result.get("ai_narrative"),
            },
        )
        req.status = DiagnosisRequest.Status.DONE
        req.save(update_fields=["status"])
        capture.status = SectorCapture.Status.DONE
    except Exception:  # noqa: BLE001
        logger.exception("Sector analysis failed for capture %s", sector_capture_id)
        capture.status = SectorCapture.Status.FAILED
    capture.save(update_fields=["status"])
    return capture.status


@shared_task
def retrain_model(training_job_id: int):
    """Fine-tunes the classifier on every verified TrainingImage and saves
    a new ModelVersion in 'ready' status (an admin still has to Activate
    it — see apps/ml_training/views.py). This is the loop that lets the
    admin page "teach" the model new leaves/diseases over time."""
    from apps.ml_training.models import ModelVersion, TrainingImage, TrainingJob

    job = TrainingJob.objects.get(pk=training_job_id)
    job.status = TrainingJob.Status.RUNNING
    job.save(update_fields=["status"])
    job.append_log("Оқыту басталды...")

    from .model_def import TORCH_AVAILABLE

    if not TORCH_AVAILABLE:
        job.status = TrainingJob.Status.FAILED
        job.finished_at = timezone.now()
        job.append_log("torch/torchvision орнатылмаған — requirements-ml.txt қараңыз.")
        job.save(update_fields=["status", "finished_at"])
        return "torch_missing"

    try:
        from .training import run_training

        version = run_training(job)
        job.model_version = version
        job.status = TrainingJob.Status.DONE
    except Exception as exc:  # noqa: BLE001
        logger.exception("Training job %s failed", training_job_id)
        job.status = TrainingJob.Status.FAILED
        job.append_log(f"Қате: {exc}")
    finally:
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "model_version", "finished_at"])

    return job.status
