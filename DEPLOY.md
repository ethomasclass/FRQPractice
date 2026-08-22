# Deploying to Vercel + Turso

Roughly fifteen minutes, start to finish. Both free at this scale.

**GitHub cannot host this app.** GitHub Pages serves static files only — no
server, no database, and no way to keep a secret, since everything it serves is
readable in the browser. Your API key and teacher password would be public.
GitHub holds the code; Vercel runs it and gives you the web address.

## The one-click route

[**Deploy to Vercel**](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fethomasclass%2FFRQPractice%2Ftree%2Fclaude%2Fap-geo-frq-platform-siyhkv&env=DATABASE_URL%2CDATABASE_AUTH_TOKEN%2CSESSION_SECRET%2CTEACHER_PASSWORD%2CANTHROPIC_API_KEY&envDescription=Turso%20database%20URL%20and%20token%2C%20a%2032%2B%20character%20session%20secret%2C%20your%20teacher%20password%2C%20and%20%28optionally%29%20an%20Anthropic%20API%20key.&envLink=https%3A%2F%2Fgithub.com%2Fethomasclass%2FFRQPractice%2Fblob%2Fclaude%2Fap-geo-frq-platform-siyhkv%2FDEPLOY.md&project-name=frq-practice&repository-name=frq-practice)

That clones the repo into your own Vercel account and prompts for the five
environment variables below. Create the Turso database first (step 1) so you
have the URL and token ready to paste.

When it finishes you get a live address like `https://frq-practice.vercel.app` —
that is the link you give students. You can attach your own domain later in the
Vercel project settings if you'd rather.

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
