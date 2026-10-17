// Offline-first upload queue for the greenhouse walkthrough.
//
// Greenhouses often have weak or no mobile signal, so the scan screen
// never waits on the network: every photo, every "сектор дайын" and the
// final "есеп құру" is written to IndexedDB first and sent to the server
// in order by a background worker as soon as there is a connection —
// surviving a closed tab or a phone restart. Each photo carries a random
// client_id so a resend after a lost response doesn't duplicate it on the
// server (see apps/scans/views.py sector_photos).
import { api } from "../api/client";

const DB_NAME = "zhasyldala-offline";
const STORE = "uploads";
const listeners = new Set();
let dbPromise = null;
let running = false;
let lastError = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function allItems() {
  return tx("readonly", (store) => reqToPromise(store.getAll()));
}

async function add(item) {
  const id = await tx("readwrite", (store) => reqToPromise(store.add({ ...item, createdAt: Date.now() })));
  notify();
  kick();
  return id;
}

async function remove(id) {
  await tx("readwrite", (store) => reqToPromise(store.delete(id)));
  notify();
}

export function newClientId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueuePhoto({ sessionId, sectorId, blob, clientId }) {
  return add({ kind: "photo", sessionId, sectorId, blob, clientId });
}

export function enqueueFinishSector({ sessionId, sectorId }) {
  return add({ kind: "finishSector", sessionId, sectorId });
}

export function enqueueFinishSession({ sessionId }) {
  return add({ kind: "finishSession", sessionId });
}

// Drops a not-yet-sent photo (the "undo last photo" button). Returns
// false if it had already been uploaded — the caller then undoes it on
// the server instead.
export async function removeQueuedPhoto(clientId) {
  const items = await allItems();
  const hit = items.find((i) => i.kind === "photo" && i.clientId === clientId);
  if (!hit) return false;
  await remove(hit.id);
  return true;
}

export async function pendingFor(sessionId) {
  const items = await allItems();
  return items.filter((i) => i.sessionId === sessionId);
}

export function isNetworkError(err) {
  // fetch() rejects with a TypeError when there's no connection at all;
  // 5xx and timeouts are worth retrying later too.
  return err instanceof TypeError || !err?.status || err.status >= 500 || err.status === 408;
}

async function send(item) {
  if (item.kind === "photo") {
    const form = new FormData();
    form.append("image", item.blob, `sector-${item.sectorId}-${item.clientId}.jpg`);
    form.append("client_id", item.clientId);
    return api.post(`/api/scan-sessions/${item.sessionId}/sectors/${item.sectorId}/photos/`, form, { isForm: true });
  }
  if (item.kind === "finishSector") {
    return api.post(`/api/scan-sessions/${item.sessionId}/sectors/${item.sectorId}/finish/`, {});
  }
  return api.post(`/api/scan-sessions/${item.sessionId}/finish/`, {});
}

// Sends queued items oldest-first. Stops at the first network failure
// (order matters: a sector can't be finished before its photos arrive)
// and retries later; a 4xx means the server will never accept that item
// (e.g. sector already finished), so it's dropped instead of blocking
// the queue forever.
export async function processQueue() {
  if (running) return;
  running = true;
  try {
    const items = (await allItems()).sort((a, b) => a.id - b.id);
    for (const item of items) {
      try {
        await send(item);
        await remove(item.id);
        lastError = null;
      } catch (err) {
        if (isNetworkError(err)) {
          lastError = "offline";
          notify();
          return;
        }
        await remove(item.id);
      }
    }
  } finally {
    running = false;
    notify();
  }
}

function kick() {
  if (typeof navigator === "undefined" || navigator.onLine !== false) processQueue();
}

async function notify() {
  const items = await allItems().catch(() => []);
  const state = { pending: items.length, photos: items.filter((i) => i.kind === "photo").length, offline: lastError === "offline" || navigator.onLine === false };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  notify();
  return () => listeners.delete(fn);
}

// Wait until everything for this session has reached the server (or
// give up after `timeoutMs`, returning false).
export async function waitForSession(sessionId, timeoutMs = 60000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    await processQueue();
    if ((await pendingFor(sessionId)).length === 0) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

let started = false;
export function startQueueWorker() {
  if (started || typeof window === "undefined" || !("indexedDB" in window)) return;
  started = true;
  window.addEventListener("online", () => { lastError = null; processQueue(); });
  window.addEventListener("offline", () => notify());
  setInterval(() => kick(), 15000);
  kick();
}
