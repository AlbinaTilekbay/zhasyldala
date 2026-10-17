import { useEffect, useState } from "react";
import { subscribe } from "./uploadQueue";

export function useQueueState() {
  const [state, setState] = useState({ pending: 0, photos: 0, offline: false });
  useEffect(() => subscribe(setState), []);
  return state;
}
