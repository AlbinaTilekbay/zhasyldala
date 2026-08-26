import { useEffect, useState } from "react";
import { api } from "../api/client";

// The QR PNG endpoint is JWT-protected (per-farmer sectors), so a plain
// <img src> can't carry the Authorization header — fetch it as a blob
// and hand the browser an object URL instead.
export default function QrImage({ sectorId, size = 64 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    api.get(`/api/sectors/${sectorId}/qr.png`).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sectorId]);

  return (
    <div
      style={{
        width: "100%", aspectRatio: 1, borderRadius: 7, background: "#14201E",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      {url && <img src={url} alt="QR" width={size} height={size} style={{ background: "#fff" }} />}
    </div>
  );
}
