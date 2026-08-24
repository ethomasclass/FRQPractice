# Deploying to Vercel + Turso

Roughly fifteen minutes, start to finish. Both free at this scale.

**GitHub cannot host this app.** GitHub Pages serves static files only — no
server, no database, and no way to keep a secret, since everything it serves is
readable in the browser. Your API key and teacher password would be public.
GitHub holds the code; Vercel runs it and gives you the web address.

## Import the repository into Vercel

Do **not** use a "Deploy to Vercel" template button. That flow clones the
repository as a public template and fails on a private repo with *"The
repository used by this template is private or does not exist."* Import the
repo instead — Vercel reads it through the GitHub app, private or not.

1. Create the Turso database first (step 1 below) so the URL and token are ready.
2. Go to **[vercel.com/new](https://vercel.com/new)**.
3. Under **Import Git Repository**, connect GitHub if you haven't, then pick
   **ethomasclass/FRQPractice**. If it isn't listed, use *Adjust GitHub App
   Permissions* and grant access to it.
4. Leave the framework preset alone — Vercel detects Next.js.
5. Expand **Environment Variables** and add the five from step 4 below.
6. **Deploy.**

Vercel builds whatever branch the repository treats as default, which for this
repo is `claude/ap-geo-frq-platform-siyhkv` — the branch with all the code, so
there is nothing to merge first. To change it later:
**Project → Settings → Git → Production Branch**.

When the build finishes you get an address like
`https://frq-practice.vercel.app`. That is the link you give students.

## 1. Create the database

```bash
npm install -g @tursodatabase/cli   # or: brew install tursodatabase/tap/turso
turso auth login
turso db create frq-practice
turso db show frq-practice --url          # -> libsql://frq-practice-you.turso.io
turso db tokens create frq-practice       # -> the auth token
```

Keep both values; they're the next two environment variables.

## 2. Create the tables

Run the migrations against Turso once, from your machine:

```bash
DATABASE_URL="libsql://frq-practice-you.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
npm run db:migrate
```

Re-run this any time migrations change. It is safe to run twice — applied
migrations are skipped.

## 3. Generate secrets

```bash
openssl rand -base64 32     # SESSION_SECRET
```

Pick a teacher password you'll actually remember. It is the only thing between
the internet and your gradebook, so make it long.

## 4. Deploy

Push the repo to GitHub, import it at vercel.com, and set these environment
variables for **Production** before the first deploy:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `libsql://frq-practice-you.turso.io` |
| `DATABASE_AUTH_TOKEN` | the token from step 1 |
| `SESSION_SECRET` | the 32+ character string from step 3 |
| `TEACHER_PASSWORD` | your password |
| `ANTHROPIC_API_KEY` | from console.anthropic.com — optional, see below |

Vercel detects Next.js and needs no other configuration.

## 5. First run

1. Go to `/teacher/signin` and sign in.
2. **Classes → add your class**, then paste your roster (one student per line,
   `Name` or `Name, email`).
3. Write the class code on the board. Students go to the site root, type it,
   and pick their name. Nothing to install, no accounts, no IT ticket.

## Notes for this setup

**The `ANTHROPIC_API_KEY` is optional.** Without it, writing, peer review,
peer-majority scoring, the grading dashboard, and CSV export all work; the
buttons that need it are disabled. Add it when you're ready — and measure the
scorer with `npm run ai:calibrate` before you trust it with grades. API usage is
billed separately from any claude.ai subscription.

**Scoring runs one response per request**, driven from the grading page with a
progress bar. That is what keeps each request inside Vercel's 60-second Hobby
ceiling — a loop over the whole class would time out. If a run stops partway,
press the button again; it resumes rather than restarting.

**Vercel's Hobby plan is for non-commercial use** and has hard caps with no
overage billing. At 50 students and ten FRQs a year you will use well under 1%
of the monthly allowance, so the caps are not a practical concern.

**Back up before each semester.** One command, and it costs nothing:

```bash
turso db shell frq-practice .dump > frq-backup-$(date +%F).sql
```

Student work only exists in this database. Do this at least at the end of each
term.
