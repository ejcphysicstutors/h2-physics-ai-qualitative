"use client";

import { track } from "@vercel/analytics";

type SafeValue = string | number | boolean;

export function recordUsage(event: string, properties: Record<string, SafeValue> = {}) {
  // Never pass questions, search strings, feedback text, names or email addresses here.
  track(event, properties);
}

export function durationBand(seconds: number) {
  if (seconds < 30) return "under_30s";
  if (seconds < 120) return "30s_to_2m";
  if (seconds < 300) return "2m_to_5m";
  if (seconds < 900) return "5m_to_15m";
  return "15m_plus";
}
