"""Sample a handful of representative frames from an uploaded sector video.

Uses OpenCV if it's installed (opencv-python-headless, in
requirements-ml.txt); otherwise sector videos are stored but can't be
turned into stills automatically and the caller should surface that to
the admin/user instead of silently failing.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import cv2

    CV2_AVAILABLE = True
except ImportError:  # pragma: no cover
    CV2_AVAILABLE = False


def sample_frame(video_path: str, out_path: str, at_fraction: float = 0.5) -> bool:
    """Writes one JPEG frame (taken at `at_fraction` through the clip) to
    `out_path`. Returns whether it succeeded."""
    if not CV2_AVAILABLE:
        logger.warning("opencv not installed — cannot sample frames from %s", video_path)
        return False
    try:
        cap = cv2.VideoCapture(video_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        target = max(0, min(total - 1, int(total * at_fraction)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            return False
        cv2.imwrite(out_path, frame)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Frame sampling failed for %s", video_path)
        return False


def sample_best_frame_for_capture(capture) -> bool:
    """Samples the middle frame of a SectorCapture's video into its
    frame_image field. `settings.ML_VIDEO_SAMPLE_FRAMES` documents intent
    to eventually pick the sharpest of several frames; middle-frame is the
    simple, reliable default for now."""
    import os
    import tempfile

    from django.core.files import File

    if not capture.video:
        return False

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        success = sample_frame(capture.video.path, tmp_path)
        if not success:
            return False
        with open(tmp_path, "rb") as fh:
            capture.frame_image.save(f"sector_{capture.sector_id}_frame.jpg", File(fh), save=True)
        return True
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
