import { randomUUID } from "node:crypto";
import type {
  BrowserSnapshot,
  FetchResult,
  PageIdentity,
  PagePayload,
} from "@forkpoint/agent-lighthouse-core";
import {
  DETECTION_TTL_MS,
  MAX_DETECTION_BYTES,
  MAX_DETECTIONS,
} from "./limits";

/** One detected payload, kept so a scan can reuse it without a second read. */
export interface DetectionEntry {
  detectionId: string;
  /** The URL a scan of this payload targets, credentials included. */
  target: string;
  payload: PagePayload;
  identity: PageIdentity;
  /** The server's own response, for a fetched payload. */
  response?: FetchResult;
  /** The client's capture, for a supplied payload. */
  snapshot?: BrowserSnapshot;
}

/**
 * Where detected payloads live between `POST /detect` and the scan that
 * reuses them. The in-memory store serves one process; another backend can
 * implement the same interface. Every implementation keeps three rules: an
 * entry expires DETECTION_TTL_MS after it was stored, whether or not a scan
 * read it; a full store evicts the oldest entry and never refuses a new one;
 * expiry is checked on every read.
 */
export interface PayloadStore {
  /** Stores the entry and returns its new detection id. */
  put(entry: Omit<DetectionEntry, "detectionId">): string;
  /** Undefined when the id is unknown or expired. */
  get(detectionId: string): DetectionEntry | undefined;
  /** False when the id is unknown or expired. */
  delete(detectionId: string): boolean;
}

interface Slot {
  entry: DetectionEntry;
  storedAt: number;
  bytes: number;
}

export class InMemoryPayloadStore implements PayloadStore {
  private readonly slots = new Map<string, Slot>();
  private bytes = 0;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(options: { now?: () => number; newId?: () => string } = {}) {
    this.now = options.now ?? Date.now;
    this.newId =
      options.newId ?? (() => `d_${randomUUID().replaceAll("-", "")}`);
  }

  put(entry: Omit<DetectionEntry, "detectionId">): string {
    this.sweep();
    const bytes = Buffer.byteLength(entry.payload.html, "utf8");
    // Map iteration is insertion order, so the first slot is the oldest.
    for (const id of this.slots.keys()) {
      if (
        this.slots.size < MAX_DETECTIONS &&
        this.bytes + bytes <= MAX_DETECTION_BYTES
      )
        break;
      this.remove(id);
    }
    const detectionId = this.newId();
    this.slots.set(detectionId, {
      entry: { ...entry, detectionId },
      storedAt: this.now(),
      bytes,
    });
    this.bytes += bytes;
    return detectionId;
  }

  get(detectionId: string): DetectionEntry | undefined {
    return this.slot(detectionId)?.entry;
  }

  delete(detectionId: string): boolean {
    if (!this.slot(detectionId)) return false;
    this.remove(detectionId);
    return true;
  }

  private expired(slot: Slot): boolean {
    return this.now() - slot.storedAt > DETECTION_TTL_MS;
  }

  /**
   * Every read goes through here, so an expired payload is gone the moment
   * its window closes, not when the next detection happens to be stored.
   */
  private slot(detectionId: string): Slot | undefined {
    const slot = this.slots.get(detectionId);
    if (slot && this.expired(slot)) {
      this.remove(detectionId);
      return undefined;
    }
    return slot;
  }

  private remove(detectionId: string): void {
    const slot = this.slots.get(detectionId);
    if (!slot) return;
    this.slots.delete(detectionId);
    this.bytes -= slot.bytes;
  }

  private sweep(): void {
    for (const [id, slot] of this.slots)
      if (this.expired(slot)) this.remove(id);
  }
}
