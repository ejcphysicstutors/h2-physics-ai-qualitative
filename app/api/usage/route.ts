import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedProperties: Record<string, ReadonlySet<string>> = {
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
  "Quantities and Measurement", "Motion and Forces", "Forces and Moments", "Energy and Fields",
  "Circular Motion", "Gravitational Fields", "Temperature and Ideal Gases", "Thermodynamic Systems",
  "Oscillations", "Wave Motion", "Superposition", "Electric Fields", "Currents", "Circuits",
  "Electromagnetic Forces", "Electromagnetic Induction", "Quantum Physics", "Nuclear Physics",
  "Projectile Motion", "Collisions", "Data-Based Questions (DAQ)",
]);

const controlledValues: Record<string, Record<string, ReadonlySet<string>>> = {
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
  const parts = value.split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  if (parts.length === 1 && parts[0] === "Unmapped") return "Unmapped";
  if (parts.some((part) => !canonicalTopics.has(part))) return undefined;
  return parts.join(" | ").slice(0, 160);
}

function sanitise(event: string, raw: unknown) {
  const allowed = allowedProperties[event];
  if (!allowed || !raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "boolean") { result[key] = value; continue; }
    if (typeof value === "number" && Number.isFinite(value)) { result[key] = value; continue; }
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (key === "topic") {
      const topic = safeTopic(trimmed);
      if (topic) result[key] = topic;
      continue;
    }
    const values = controlledValues[event]?.[key];
    if (values?.has(trimmed)) result[key] = trimmed.slice(0, 160);
  }
  return result;
}

export async function POST(request: Request) {
  const projectKey = process.env.POSTHOG_PROJECT_KEY;
  const ingestHost = (process.env.POSTHOG_INGEST_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  if (!projectKey) return NextResponse.json({ ok: false, configured: false }, { status: 503 });

  let body: { event?: unknown; properties?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (typeof body.event !== "string" || !allowedProperties[body.event]) return NextResponse.json({ ok: false }, { status: 400 });

  const properties = sanitise(body.event, body.properties);
  const payload = {
    api_key: projectKey,
    event: body.event,
    properties: {
      ...properties,
      distinct_id: crypto.randomUUID(),
      $process_person_profile: false,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${ingestHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ ok: false }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
