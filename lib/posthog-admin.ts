import "server-only";

type Row = Array<string | number | null>;

export type UsageSummary = {
  configured: boolean;
  error?: string;
  periodDays: number;
  eventCounts: Record<string, number>;
  topTopics: Array<{ topic: string; count: number }>;
  sourceTypes: Array<{ sourceType: string; count: number }>;
  durations: Array<{ duration: string; count: number }>;
  ratings: Array<{ rating: string; count: number }>;
  daily: Array<{ date: string; asks: number; explorerViews: number; sourceOpens: number }>;
};

const SAFE_EVENTS = [
  "evidence_asked",
  "tab_viewed",
  "topic_selected",
  "source_filter_selected",
  "evidence_inspected",
  "source_opened",
  "ask_record_opened_in_explorer",
  "ask_record_inspected_in_explorer",
  "teacher_interpretation_viewed",
  "answer_feedback",
  "feedback_opened",
  "feedback_submitted",
  "record_problem_reported",
  "session_duration",
] as const;

function apiHost() {
  if (process.env.POSTHOG_API_HOST) return process.env.POSTHOG_API_HOST.replace(/\/$/, "");
  const ingest = (process.env.POSTHOG_INGEST_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  return ingest.replace("://us.i.", "://us.").replace("://eu.i.", "://eu.");
}

async function hogql(query: string): Promise<Row[]> {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!projectId || !token) throw new Error("PostHog admin API credentials are not configured.");

  const response = await fetch(`${apiHost()}/api/projects/${encodeURIComponent(projectId)}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`PostHog API returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = await response.json();
  return Array.isArray(data?.results) ? data.results : [];
}

const n = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);
const text = (value: unknown) => (typeof value === "string" ? value : String(value ?? ""));

export async function getUsageSummary(periodDays = 30): Promise<UsageSummary> {
  const days = Math.max(1, Math.min(90, Math.round(periodDays)));
  const configured = Boolean(process.env.POSTHOG_PROJECT_ID && process.env.POSTHOG_PERSONAL_API_KEY);
  const blank: UsageSummary = {
    configured,
    periodDays: days,
    eventCounts: {},
    topTopics: [],
    sourceTypes: [],
    durations: [],
    ratings: [],
    daily: [],
  };
  if (!configured) return blank;

  try {
    const eventList = SAFE_EVENTS.map((event) => `'${event}'`).join(",");
    const [events, topics, sources, durations, ratings, daily] = await Promise.all([
      hogql(`SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event IN (${eventList}) GROUP BY event ORDER BY count() DESC`),
      hogql(`SELECT toString(properties.topic), count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event = 'topic_selected' AND properties.topic IS NOT NULL GROUP BY properties.topic ORDER BY count() DESC LIMIT 10`),
      hogql(`SELECT toString(properties.source_type), count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event = 'source_opened' AND properties.source_type IS NOT NULL GROUP BY properties.source_type ORDER BY count() DESC`),
      hogql(`SELECT toString(properties.duration), count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event = 'session_duration' AND properties.duration IS NOT NULL GROUP BY properties.duration ORDER BY count() DESC`),
      hogql(`SELECT toString(properties.rating), count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event = 'answer_feedback' AND properties.rating IS NOT NULL GROUP BY properties.rating ORDER BY count() DESC`),
      hogql(`SELECT toString(toDate(timestamp)), countIf(event = 'evidence_asked'), countIf(event = 'tab_viewed' AND properties.tab = 'browse'), countIf(event = 'source_opened') FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event IN ('evidence_asked','tab_viewed','source_opened') GROUP BY toDate(timestamp) ORDER BY toDate(timestamp) ASC`),
    ]);

    return {
      configured: true,
      periodDays: days,
      eventCounts: Object.fromEntries(events.map((row) => [text(row[0]), n(row[1])])),
      topTopics: topics.map((row) => ({ topic: text(row[0]), count: n(row[1]) })),
      sourceTypes: sources.map((row) => ({ sourceType: text(row[0]), count: n(row[1]) })),
      durations: durations.map((row) => ({ duration: text(row[0]), count: n(row[1]) })),
      ratings: ratings.map((row) => ({ rating: text(row[0]), count: n(row[1]) })),
      daily: daily.map((row) => ({ date: text(row[0]), asks: n(row[1]), explorerViews: n(row[2]), sourceOpens: n(row[3]) })),
    };
  } catch (error) {
    return { ...blank, configured: true, error: error instanceof Error ? error.message : "Could not load PostHog usage data." };
  }
}
