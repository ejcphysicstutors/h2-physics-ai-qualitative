# H2 Physics AI Qualitative Tutor

React/Vite pilot for H2 Physics qualitative practice. It uses the updated 2026 question bank, includes extracted question diagrams, keeps student progress across devices using school Google sign-in through Supabase, sends Claude requests through a server-side Vercel function, and provides a password-protected teacher analytics dashboard.

## What is already included

- 207 questions across H201-H220 imported from `Qualitative Questions (2026 Syllabus) edit superposition.docx`.
- 45 question/diagram images extracted from the document and linked to their questions.
- Private `data/questions.json` with mark schemes, plus generated browser-safe `src/data/questions.public.json` without mark schemes.
- Google OAuth via Supabase.
- Cross-device progress by pseudonymous Supabase user ID; the analytics tables do not store student names or emails.
- Automatic Correct / Partial / Incorrect assessment by Claude with Socratic feedback.
- Student-controlled mark-scheme checkpoint; the mark scheme is fetched only after sign-in and is not bundled into the browser app.
- Claude token/cost event logging.
- Shared-password teacher dashboard.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your Supabase browser keys. Vercel server functions need the server-only variables in the Vercel project settings.
4. Run `npm run dev`.

Without Supabase variables the UI opens in preview mode, but AI and persistent progress are intentionally unavailable.

## Supabase setup

1. Create a free Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication > Providers, enable Google and configure the Google OAuth client.
4. Add the deployed Vercel URL (and localhost while developing) to the allowed redirect URLs.
5. Set `SCHOOL_GOOGLE_DOMAIN` on Vercel to your school's Google Workspace domain. The server rejects AI/answer requests from accounts outside that domain.

## Vercel setup

1. Push this folder to the GitHub repository.
2. Import the repository into Vercel.
3. Add every variable from `.env.example` in Project Settings > Environment Variables.
4. Deploy. Vercel will run `npm run build` and host both the React app and `/api/*` server functions.
5. Embed the resulting Vercel URL in Google Sites.

## Updating questions

The master app data is `data/questions.json`. It is intentionally ordinary JSON so it is easy to add or edit questions. Each item has:

```json
{
  "id": "H212-002",
  "topicCode": "H212",
  "topic": "Superposition",
  "sourceNumber": "2",
  "question": "...",
  "markScheme": "...",
  "images": [],
  "syllabusVersion": "2026"
}
```

After editing, run `npm run sync-questions`. The normal Vercel build also runs this automatically. Do not put mark schemes directly into `src/data/questions.public.json`; it is generated from the master file with the answer removed.

The helper `tools/import_docx.py` shows how this initial bank was imported from the Word document. Future edited source files can be re-imported or merged by ChatGPT, while preserving stable IDs where appropriate.

## Privacy note

Supabase Authentication necessarily knows the student's Google identity so it can authenticate them across devices. The learning analytics tables in this project store only the authentication UUID (`user_id`), question IDs and usage/progress data. The teacher dashboard does not expose names or email addresses.

## Before a real student pilot

- Confirm your school's policy for Google OAuth / third-party processors.
- Use a strong teacher dashboard password.
- Keep `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in Vercel server environment variables.
- Confirm the school Google Workspace domain and OAuth consent configuration.
- Review several diagram-heavy questions after deployment to confirm extracted images are placed appropriately.
