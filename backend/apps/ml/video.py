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


def _sharpness(frame) -> float:
    """Variance of the Laplacian — a standard, cheap focus/blur measure.
    A blurry frame (camera still panning, out of focus) has little
    high-frequency detail, so its Laplacian variance is low; a sharp,
    in-focus frame scores much higher."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _brightness(frame) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(gray.mean())


def sample_best_frame(video_path: str, out_path: str, num_candidates: int | None = None) -> bool:
    """Picks the sharpest, reasonably-lit frame from the middle portion of
    the clip and writes it to `out_path` as a JPEG. Returns whether it
    succeeded.

    A single middle-frame grab (the previous approach) turned out to be
    unreliable for exactly the footage this app expects — a handheld
    ~12s pan across a sector's plants: whatever frame happens to sit at
    the 50% mark is just as likely to be mid-motion-blur, aimed at a gap
    between plants, or (OpenCV's frame-index seeking on compressed video
    is itself known to be imprecise) not even really the frame it asked
    for. That produced a real, unclear photo, which is exactly why
    OpenAI vision kept answering "Фото анық емес" for every sector even
    on carefully, slowly filmed video — the bug was in which single
    frame got extracted, not in how the video was recorded. Sampling
    several candidates spread across the middle of the clip (skipping
    the first/last ~15%, where the farmer is usually still lining the
    shot up or has already started moving to the next sector) and
    scoring each for sharpness fixes this without needing the user to
    change how they film."""
    if not CV2_AVAILABLE:
        logger.warning("opencv not installed — cannot sample frames from %s", video_path)
        return False

    n = num_candidates or getattr(settings, "ML_VIDEO_SAMPLE_FRAMES", 5)
    n = max(1, n)

    try:
        cap = cv2.VideoCapture(video_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        duration_ms = (total / fps * 1000) if (total and fps) else None

        # Spread candidates across the middle 70% of the clip (15%-85%),
        # never right at the very start or end.
        if n == 1:
            fractions = [0.5]
        else:
            span_start, span_end = 0.15, 0.85
            step = (span_end - span_start) / (n - 1)
            fractions = [span_start + i * step for i in range(n)]

        best_frame = None
        best_score = -1.0
        best_fraction = None
        for frac in fractions:
            if duration_ms is not None:
                cap.set(cv2.CAP_PROP_POS_MSEC, duration_ms * frac)
            elif total:
                cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(total - 1, int(total * frac))))
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            brightness = _brightness(frame)
            if brightness < 15 or brightness > 245:
                # Too dark or blown-out to be a usable diagnosis photo —
                # skip it even if it happens to look "sharp".
                continue
            score = _sharpness(frame)
            if score > best_score:
                best_score = score
                best_frame = frame
                best_fraction = frac
        cap.release()

        if best_frame is None:
            logger.warning("No usable frame found in %s (all candidates too dark/blurry/unreadable)", video_path)
            return False

        logger.info(
            "Sampled frame at %.0f%% through %s (sharpness=%.1f)", (best_fraction or 0) * 100, video_path, best_score
        )
        cv2.imwrite(out_path, best_frame)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Frame sampling failed for %s", video_path)
        return False


def sample_best_frame_for_capture(capture) -> bool:
    """Samples the best frame of a SectorCapture's video into its
    frame_image field (see sample_best_frame for how "best" is chosen)."""
    import os
    import tempfile

    from django.core.files import File

    if not capture.video:
        return False

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        success = sample_best_frame(capture.video.path, tmp_path)
        if not success:
            return False
        with open(tmp_path, "rb") as fh:
            capture.frame_image.save(f"sector_{capture.sector_id}_frame.jpg", File(fh), save=True)
        return True
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
