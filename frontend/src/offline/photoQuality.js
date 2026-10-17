// Quick on-device check of a just-taken photo, before it's queued for
// diagnosis: too dark, blown out, or blurry photos give the AI little to
// work with. Measured on a 192px greyscale copy — mean brightness for
// exposure, variance of the Laplacian for sharpness (low variance = few
// edges = blur). Thresholds are deliberately lenient: this nudges the
// farmer to retake, it never blocks the photo.
const SIZE = 192;
export const DARK_BELOW = 45;
export const BRIGHT_ABOVE = 225;
export const BLUR_BELOW = 18;

export async function checkPhotoQuality(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = SIZE / Math.max(bitmap.width, bitmap.height);
    const w = Math.max(8, Math.round(bitmap.width * scale));
    const h = Math.max(8, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const grey = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      grey[i] = v;
      sum += v;
    }
    const brightness = sum / (w * h);
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
        lapSum += lap;
        lapSq += lap * lap;
        n++;
      }
    }
    const mean = lapSum / n;
    const sharpness = lapSq / n - mean * mean;
    let issue = null;
    if (brightness < DARK_BELOW) issue = "dark";
    else if (brightness > BRIGHT_ABOVE) issue = "bright";
    else if (sharpness < BLUR_BELOW) issue = "blurry";
    return { issue, brightness: Math.round(brightness), sharpness: Math.round(sharpness) };
  } catch {
    return { issue: null };
  }
}

export const QUALITY_TEXT = {
  dark: { title: "Фото тым қараңғы", body: "Жарығы жақсырақ жерден немесе жарыққа қаратып қайта түсіріңіз." },
  bright: { title: "Фото тым жарық", body: "Күн тікелей түсіп тұр — сәл бұрылып немесе көлеңкеден түсіріңіз." },
  blurry: { title: "Фото бұлыңғыр", body: "Телефонды қозғалтпай ұстап, жапыраққа фокус түскенше күтіп, қайта түсіріңіз." },
};
