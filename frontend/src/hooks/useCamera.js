import { useCallback, useEffect, useRef, useState } from "react";

// Wraps getUserMedia + MediaRecorder for the capture/scan screens. Keeps
// browser-camera plumbing out of the screen components.
export function useCamera({ facingMode = "environment" } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    // Idempotent: a caller that starts the camera again while it's already
    // running (e.g. a step-change effect re-firing) reuses the existing
    // stream instead of tearing it down and re-acquiring. But ScanFlow's
    // steps each render their OWN <video> element — scan_qr and scan_video
    // are separate JSX branches (scan_confirm renders none at all), so
    // going scan_qr -> scan_confirm -> scan_video mounts a brand new,
    // blank <video> DOM node whose srcObject was never set, even though
    // the underlying stream (and any in-progress recording) never stopped.
    // That produced exactly the reported bug: a solid black preview during
    // "Жазылып жатыр" while the timer/progress bar kept advancing normally,
    // because recording itself uses the stream directly and doesn't care
    // about the <video> element at all. Re-attaching here on every start()
    // call — not just the first — fixes that without re-prompting for
    // camera permission or restarting the recording.
    if (streamRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay can reject harmlessly (e.g. the element unmounts again
          // right away on a fast step change) — the stream itself is fine.
        }
      }
      setReady(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (err) {
      setError(err.message || "Камераға қол жеткізу мүмкін болмады");
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9));
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.start();
    recorderRef.current = recorder;
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });
  }, []);

  return { videoRef, ready, error, start, stop, capturePhoto, startRecording, stopRecording };
}
