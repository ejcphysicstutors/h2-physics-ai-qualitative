# PostHog setup for the Evidence Hub

The Evidence Hub sends only explicit allow-listed custom events. It does **not** load the PostHog browser SDK.

Privacy design:
- no PostHog autocapture
- no PostHog page-view capture (Vercel remains responsible for basic page traffic)
- no session recording
- no persistent PostHog browser identifier
- each forwarded event uses a fresh random distinct ID and disables person profiles
- event names and properties are validated on both the browser helper and the server route
- full Ask questions, free-text searches, names, emails and free-text feedback are never sent

## Vercel environment variables

For event capture:
- `POSTHOG_PROJECT_KEY` — PostHog Project API Key
- `POSTHOG_INGEST_HOST` — ingest host shown by PostHog, e.g. `https://us.i.posthog.com` or `https://eu.i.posthog.com`

For the aggregate `/admin/usage` dashboard:
- `POSTHOG_PROJECT_ID` — numeric PostHog project ID
- `POSTHOG_PERSONAL_API_KEY` — personal API key with read/query access to this project
- `POSTHOG_API_HOST` — optional API host, normally `https://us.posthog.com` or `https://eu.posthog.com`

Never expose `POSTHOG_PERSONAL_API_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.
