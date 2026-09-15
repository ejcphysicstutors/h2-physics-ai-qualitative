"use client";

type SafeValue = string | number | boolean;
type UsageEvent =
  | "record_problem_reported"
  | "source_opened"
  | "ask_record_inspected_in_explorer"
  | "topic_selected"
  | "source_filter_selected"
  | "evidence_inspected"
  | "feedback_submitted"
  | "feedback_opened"
  | "session_duration"
  | "tab_viewed"
  | "ask_record_opened_in_explorer"
  | "evidence_asked"
  | "teacher_interpretation_viewed"
  | "answer_feedback";

const allowedProperties: Record<UsageEvent, ReadonlySet<string>> = {
  record_problem_reported: new Set(["issue", "source_type", "topic"]),
  source_opened: new Set(["source_type", "topic"]),
  ask_record_inspected_in_explorer: new Set(["source_type", "topic"]),
  topic_selected: new Set(["topic"]),
  source_filter_selected: new Set(["source"]),
  evidence_inspected: new Set(["source_type", "topic"]),
  feedback_submitted: new Set(["type", "area"]),
  feedback_opened: new Set(["area"]),
  session_duration: new Set(["duration"]),
  tab_viewed: new Set(["tab"]),
  ask_record_opened_in_explorer: new Set(),
  evidence_asked: new Set(["teacher_interpretation", "constrained"]),
  teacher_interpretation_viewed: new Set(),
  answer_feedback: new Set(["rating"]),
};

const canonicalTopics = new Set([
  "Quantities and Measurement",
  "Motion and Forces",
  "Forces and Moments",
  "Energy and Fields",
  "Circular Motion",
  "Gravitational Fields",
  "Temperature and Ideal Gases",
  "Thermodynamic Systems",
  "Oscillations",
  "Wave Motion",
  "Superposition",
  "Electric Fields",
  "Currents",
  "Circuits",
  "Electromagnetic Forces",
  "Electromagnetic Induction",
  "Quantum Physics",
  "Nuclear Physics",
  "Projectile Motion",
  "Collisions",
  "Data-Based Questions (DAQ)",
]);

const controlledValues: Partial<Record<UsageEvent, Record<string, ReadonlySet<string>>>> = {
  record_problem_reported: {
    issue: new Set(["Wrong topic", "Not relevant to this search", "Wrong citation", "Question / mark-scheme mismatch", "Transcription problem", "Source link problem", "Other"]),
    source_type: new Set(["er", "ms", "syllabus", "Examiner Report", "Question Paper", "Syllabus"]),
  },
  source_opened: { source_type: new Set(["er", "ms", "syllabus", "Examiner Report", "Question Paper", "Syllabus"]) },
  ask_record_inspected_in_explorer: { source_type: new Set(["er", "ms", "syllabus"]) },
  source_filter_selected: { source: new Set(["er", "ms", "syllabus"]) },
  evidence_inspected: { source_type: new Set(["er", "ms", "syllabus"]) },
  feedback_submitted: {
    type: new Set(["Something is wrong", "I have a suggestion", "I couldn't find what I needed"]),
    area: new Set(["Ask the Evidence", "Evidence Explorer", "About & Guide"]),
  },
  feedback_opened: { area: new Set(["Ask the Evidence", "Evidence Explorer", "About & Guide"]) },
  session_duration: { duration: new Set(["under_30s", "30s_to_2m", "2m_to_5m", "5m_to_15m", "15m_plus"]) },
  tab_viewed: { tab: new Set(["ask", "browse", "about"]) },
  answer_feedback: { rating: new Set(["Yes", "Partly", "No"]) },
};

function safeTopic(value: string) {
  const parts = value.split("|").map(part => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  if (parts.length === 1 && parts[0] === "Unmapped") return "Unmapped";
  if (parts.some(part => !canonicalTopics.has(part))) return undefined;
  return parts.join(" | ").slice(0, 160);
}

function safePropertyValue(event: UsageEvent, key: string, value: SafeValue): SafeValue | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (key === "topic") return safeTopic(trimmed);

  const allowed = controlledValues[event]?.[key];
  if (allowed && !allowed.has(trimmed)) return undefined;
  // No free-text strings should reach analytics. Any future string property must be
  // added to the controlled-value table above (or handled explicitly like topic).
  if (!allowed) return undefined;
  return trimmed.slice(0, 160);
}

export function recordUsage(event: UsageEvent, properties: Record<string, SafeValue> = {}) {
  const allowed = allowedProperties[event];
  if (!allowed) return;
  const safe: Record<string, SafeValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) continue;
    const cleaned = safePropertyValue(event, key, value);
    if (cleaned !== undefined) safe[key] = cleaned;
  }
  void fetch("/api/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties: safe }),
    keepalive: true,
  }).catch(() => undefined);
}

export function durationBand(seconds: number) {
  if (seconds < 30) return "under_30s";
  if (seconds < 120) return "30s_to_2m";
  if (seconds < 300) return "2m_to_5m";
  if (seconds < 900) return "5m_to_15m";
  return "15m_plus";
}
