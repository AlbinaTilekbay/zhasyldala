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
def process_sector_capture(sector_capture_id: int):
    """Sector-video pipeline: sample a frame, create the DiagnosisRequest,
    run inference. Split from run_diagnosis so a failed frame-sample
    doesn't need to duplicate inference error handling."""
    from apps.diagnosis.models import DiagnosisRequest
    from apps.scans.models import SectorCapture

    from .video import sample_best_frame_for_capture

    capture = SectorCapture.objects.select_related("sector__greenhouse__crop", "session").get(pk=sector_capture_id)
    capture.status = SectorCapture.Status.PROCESSING
    capture.save(update_fields=["status"])

    if not sample_best_frame_for_capture(capture):
        capture.status = SectorCapture.Status.FAILED
        capture.save(update_fields=["status"])
        return "no_frame"

    req, _ = DiagnosisRequest.objects.update_or_create(
        sector_capture=capture,
        defaults={
            "image": capture.frame_image,
            "crop": capture.sector.greenhouse.crop,
        },
    )
    run_diagnosis(req.id)  # run inline within this task, not another async hop
    capture.status = SectorCapture.Status.DONE
    capture.save(update_fields=["status"])
    return "done"


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
