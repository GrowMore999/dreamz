# Dreamz — Startup Platform MVP

A working v1 prototype of your idea: two login types (Idea Owner / Collaborator),
one AI agent per idea, Indian patent guidance with a prior-art pass, and manual
founder-approved collaboration requests.

This is a **review build** — functional end-to-end, deliberately simple underneath
(SQLite, no file storage, no email notifications) so you can poke at the actual
product logic before investing in infrastructure.

## What's actually built

**Idea Owner**
- Signup/login, create exactly one idea per account (title, problem statement,
  category, industry, a public "brief," and a private full description)
- Toggle the idea private ↔ public
- Chat with a personal AI agent (Gemini) that's system-prompted with *your* idea's
  context only — it doesn't know about anyone else's idea
- Run patent guidance requests: patentability angle under Indian law (Patents Act
  1970, Section 3(k) software exclusion nuance), a prior-art pass (Gemini with
  Google Search grounding when available), links to IP India / Google Patents /
  WIPO PATENTSCOPE, and a pointer to the SIPP subsidy scheme for DPIIT-recognized
  startups
- See applications inbox, manually approve/reject — resume + contact info only
  unlock to you after you approve

**Collaborator**
- Signup/login, browse public ideas (title, problem statement, category, industry,
  brief teaser only — no private detail)
- Filter by category/industry
- Apply with a short message, resume text/links, and contact info
- Track the status of your own applications

**Deliberately not built yet** (flag these before you build further):
- File upload for resumes (currently pasted text/links)
- Email/push notifications on application status change
- Real patent-database integration (InPASS/Google Patents API) — right now Gemini
  does the prior-art pass itself with search grounding, which is a good v1 signal
  but not a substitute for an actual patent database query
- Payments, admin moderation, password reset, rate limiting

## Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite (swap the one line in `database.py`
  for Postgres later — nothing else changes)
- **Auth**: JWT (email + password, bcrypt-hashed)
- **AI**: Google Gemini (`google-generativeai` SDK) — you said Google API, so this
  uses Gemini for both the founder agent and patent guidance. Swapping to Claude
  later is a matter of replacing `ai_agent.py` / `patent_guidance.py` internals;
  the rest of the app doesn't care which model answers.
- **Frontend**: plain HTML/CSS/JS (no build step) so you can open it straight in
  VS Code and see everything without a bundler in the way

## Running it locally (VS Code)

1. Open the `startup-platform` folder in VS Code.
2. Backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # edit .env and paste your Gemini key (https://aistudio.google.com/apikey)
   uvicorn main:app --reload
   ```
   This starts the API at `http://127.0.0.1:8000`. Visit `http://127.0.0.1:8000/docs`
   for the interactive API explorer — useful for testing routes directly.
3. Frontend: just open `frontend/index.html` in a browser (or use VS Code's
   "Live Server" extension for auto-reload). It's already pointed at
   `http://127.0.0.1:8000` in `frontend/config.js`.
4. Try it: sign up as an Idea Owner, create an idea, mark it public, chat with the
   agent, run a patent analysis. Then sign up as a Collaborator (different email,
   incognito tab or different browser) and apply to it. Switch back to the owner
   account and approve/reject.

If you don't set `GEMINI_API_KEY`, the agent and patent tools still respond —
with a clear placeholder message — so you can test the rest of the flow without
a key.

## Why these tech choices, for your review

- **SQLite first**: zero setup, one file, good enough to validate the product
  before you pay for a database. Moving to Postgres later is one line.
- **1 account = 1 idea = 1 agent thread** is enforced at the API level (an owner
  account gets a 400 error if it tries to create a second idea), matching your
  spec exactly rather than leaving it as a UI-only rule.
- **Manual approval only** — there's no matching algorithm anywhere; the owner
  is the only one who moves an application from pending to approved/rejected,
  as you specified.
- **Resume/contact stay hidden until approval** on the backend response itself
  (not just hidden in the UI), so there's no way to peek at an applicant's PII
  by inspecting network traffic before you've approved them.

## Suggested next review cycle

1. Sanity-check the patentability/prior-art prompt in `patent_guidance.py` against
   a real idea you know well — does the analysis actually feel useful, or too
   generic? That prompt is the highest-leverage thing to iterate on.
2. Decide file storage for real resumes (S3/Cloudinary) before this goes beyond
   your own testing.
3. Decide whether "collaborator" should also be able to apply to *multiple*
   ideas across owners, or if you want to cap that too.
4. Once the flows feel right, swap SQLite → Postgres and deploy backend
   (Render/Railway) + frontend (Vercel/Netlify) separately.


cd backend 
venv\Scripts\activate
python -m uvicorn main:app --reload