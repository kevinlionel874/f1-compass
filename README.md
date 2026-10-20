# F1 Compass

**Know before you work.** F1 Compass helps international students on F-1 visas check whether something they want to do (freelancing, a campus job, selling a book, accepting a hackathon prize) is likely allowed under U.S. work-authorization rules. Every answer is grounded in official government sources and comes with an email you can send to your school's international office.

> F1 Compass gives general information, not legal advice. Always confirm with your school's Designated School Official (DSO) before acting.

- **Live demo:** _TODO: add Vercel URL_
- **Demo video:** _TODO: add YouTube URL_
- **Track:** Best Apps and Agents

## The problem

More than a million international students study in the U.S. on F-1 visas. Unauthorized work can end a student's status, yet the rules are scattered across USCIS pages, SEVP guidance and the Code of Federal Regulations. Students often turn to forums and group chats, where a common misconception is that freelance work is fine as long as the client or the bank account is abroad. It usually isn't: what matters is where the work is physically done.

## How it works

```
Student question
   │
   ▼
1. Plan      NVIDIA Nemotron 3 Nano (fast model) on Nebius Token Factory
             restates the situation, lists assumptions, writes search queries
   │
   ▼
2. Search    Tavily, restricted to official domains
             uscis.gov · ice.gov · studyinthestates.dhs.gov · ecfr.gov · irs.gov · …
             (+ the student's own school international office site, optional)
   │
   ▼
3. Analyze   NVIDIA Nemotron 3 Ultra (reasoning model) on Nebius Token Factory
             reads the sources and returns a verdict, cited explanation,
             legal paths (CPT/OPT), questions for the DSO and a ready-to-send email
```

Progress streams to the browser as each step finishes, so the student sees what is happening.

The verdict is one of: **Likely allowed**, **Needs authorization first**, **Likely not allowed**, or **Unclear: ask your DSO**. The prompts tell the model to stay conservative, to cite only the sources it was given, and to answer in the student's own language.

## How we use NVIDIA and Nebius

- **Nebius Token Factory** hosts both models. Every check makes runtime calls to the Token Factory inference API (`lib/nebius.ts`).
- **Two Nemotron models, each sized to its job.** Nemotron 3 Nano handles the quick planning call in about 3 seconds. Nemotron 3 Ultra handles the reasoning-heavy legal analysis. This keeps answers responsive and stretches credits further.
- **Tavily** provides the search step (`lib/tavily.ts`), limited to official sources so the reasoning model works from authoritative text instead of forum posts.

## Run it locally

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run models               # lists the NVIDIA model IDs your Nebius key can use
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEBIUS_API_KEY` | yes | API key from Nebius Token Factory |
| `TAVILY_API_KEY` | yes | API key from [Tavily](https://app.tavily.com) |
| `NEBIUS_FAST_MODEL` | no | Planner model ID (default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`) |
| `NEBIUS_REASONING_MODEL` | no | Analysis model ID (default `nvidia/Nemotron-3-Ultra-550b-a55b`) |
| `NEBIUS_BASE_URL` | no | Defaults to `https://api.tokenfactory.nebius.com/v1` |
| `MOCK_MODE` | no | `1` streams canned sample data with no API calls, for UI work |

Model IDs vary by account. If a check fails with a "model not found" error, run `npm run models` and copy the exact IDs into `.env.local`.

## Deploy

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add `NEBIUS_API_KEY`, `TAVILY_API_KEY` and any model overrides as environment variables.
4. Deploy.

## Project structure

```
app/page.tsx            page entry
app/api/check/route.ts  POST endpoint that streams progress as NDJSON
components/Compass.tsx  the whole UI: form, progress, result, sources
lib/pipeline.ts         plan → search → analyze
lib/prompts.ts          system prompts for both models
lib/nebius.ts           Token Factory client (OpenAI-compatible)
lib/tavily.ts           official-source search
lib/mock.ts             sample data for MOCK_MODE
scripts/list-models.mjs lists NVIDIA models available to your key
```

## License

[MIT](LICENSE)
