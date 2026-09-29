# Demo Tracker — Ditch Witch of Arkansas, Little Rock Branch

A private web app for tracking demo and loaner equipment: who has what, when it is due back, and who needs a follow-up. Built for phones — your crew can use it in the yard.

**What it does**
- **Demos** — check units out to customers with dates, customer info, condition, hours, photos, and a signed responsibility record. Search, filter (Scheduled / Out on demo / Due back / Completed), and stat cards (Active, Due Today, Overdue, Completed).
- **Equipment** — every unit with its live status, who has it, and when it's due back. Add/edit units, mark in-service, and print QR tags to stick on each machine. Scanning a tag in the New Demo form selects that unit.
- **Calendar** — month view of what's out on any day. A unit can't be double-booked for overlapping dates (the app blocks it).
- **Weekly Review** — overdue demos and sold-not-invoiced records in one list.
- **Sold** — track sold units that still need an invoice.
- **Team** (admins only) — add employees with a name, role, and PIN; deactivate people; reset PINs.
- Everything important is written to a history log showing who did what and when.

**Tech (boring on purpose):** Next.js + TypeScript + Tailwind, Prisma + PostgreSQL, cookie sessions with bcrypt-hashed PINs (no outside login service), photos stored in the database (no file-storage setup).

---

## Deploying on Railway — one click at a time

### Current database: Supabase FindIT

This app uses only the `demo_tracker` schema inside the existing FindIT project.
All Prisma models, enums, and initial migration objects explicitly target that schema.
The Docker startup script sets `schema=demo_tracker` on `DATABASE_URL` before running
migrations, seeding, or starting the server. It preserves other connection options.

Set `DATABASE_URL` on the app service to FindIT's PostgreSQL **session pooler**
connection string (port 5432), with `schema=demo_tracker&sslmode=require` in its query
parameters. Use a database login restricted to the app schema where possible.
Keep the actual password in environment variables; never commit it to this repository.
The existing `SESSION_SECRET`, `ADMIN_NAME`, and `ADMIN_PIN` settings are still needed.
A GitHub push deploys code but does not create or populate these environment variables.

The initial migration is for a fresh `demo_tracker` schema. Do not run `db push`,
`migrate reset`, or a migration that moves existing FindIT tables. This setup does not
move data from an earlier demo-tracker installation. Backups for this configuration
are managed in Supabase, not Railway.

The walkthrough below describes the alternative of creating a separate Railway
database; skip that database creation step when using the existing FindIT project.

You'll do this once. It takes about 20 minutes. You need: this code on your computer (or in a GitHub account), a Railway account, and a credit card for Railway (their free trial covers small apps; the database + app typically costs a few dollars a month).

### Part 1 — Get the code into GitHub

1. Go to [github.com](https://github.com) and sign in (create a free account if you don't have one).
2. Click the **+** in the top-right corner, then **New repository**.
3. Name it `demo-tracker-app`. Leave it **Private**. Click **Create repository**.
4. On the next page, GitHub shows commands. Open a terminal on your computer, go to this project folder, and run them:
   ```
   git init
   git add .
   git commit -m "Demo tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/demo-tracker-app.git
   git push -u origin main
   ```
   (Use your real GitHub username in place of `YOUR-USERNAME`.)

### Part 2 — Create the Railway project and database

1. Go to [railway.app](https://railway.app) and sign in (the **Login with GitHub** button is easiest).
2. Click **New Project**.
3. Click **Deploy from GitHub repo** and pick `demo-tracker-app`. (If Railway asks for permission to see your repos, approve it.)
4. Once the project opens, click **+ New** (or right-click the canvas) and choose **Database → PostgreSQL**. Railway spins up your database. Wait until it says Active.

### Part 3 — Add the settings (environment variables)

1. In your Railway project, click on the **app service** (the box for `demo-tracker-app`, not the database).
2. Open the **Variables** tab.
3. Add each of these (click **+ New Variable** for each one):

   | Name | What to put | Example |
   |---|---|---|
   | `DATABASE_URL` | Copy this from your Postgres service: click the **Postgres** box → **Variables** tab → copy the value of `DATABASE_URL`, then paste it here. | `postgresql://postgres:xxxx@...` |
   | `SESSION_SECRET` | A long random string. Make one by running `openssl rand -base64 32` in a terminal and pasting the result. | `aB3...` (32+ random characters) |
   | `ADMIN_NAME` | Your full name — this becomes the first admin login. | `John Truett` |
   | `ADMIN_PIN` | A PIN you'll type to sign in (at least 4 characters). | `4821` |

4. **Important:** `ADMIN_NAME` and `ADMIN_PIN` are only used the very first time the app starts (to create your admin account). After that, changing them does nothing — you'd change your PIN under Team in the app.

### Part 4 — Deploy

1. Railway deploys automatically from your GitHub repo. Watch the **Deployments** tab on the app service.
2. The first deploy takes a few minutes (it builds the app, sets up the database tables, and creates your admin user).
3. When it says **Active**, click the URL Railway generated (under **Settings → Networking**, or the service's domain). It looks like `demo-tracker-app-production.up.railway.app`.
4. Sign in with your **name** (`ADMIN_NAME`) and **PIN** (`ADMIN_PIN`).
5. Optional but recommended: under **Settings → Networking**, click **Generate Domain** if you want a stable address, and bookmark it on everyone's phone home screen.

### Part 5 — Set up your team and equipment

1. Sign in as the admin. Open the **Team** tab.
2. Click **+ Add employee** for each person. Give them a name, a role (Rep for most people, Admin for anyone who should manage the team), and a PIN. Tell each person their name + PIN in person or by text.
3. Open the **Equipment** tab. Click **+ Add unit** for each machine: name (e.g. `UTG T5`), category (e.g. `Subsite / Electronics`), and serial number.
4. Click **Print QR tags**, print the sheet, cut out the tags, and stick one on each unit. In the New Demo form, **Scan unit QR code** will then pull up the right machine instantly.

---

## Everyday use (for the crew)

- **Checking a unit out:** Demos → **+ New Demo**. Pick the rep, dates, and customer. The unit list only shows machines that are free for those dates — you can't double-book. Take check-out photos, have the customer sign on the phone screen, done.
- **Checking a unit back in:** open the demo → **Check in**. Add return hours, condition, and return photos.
- **Something due?** The Demos page shows Due Today and Overdue cards. The **Review** tab is the Monday-morning list: overdue demos + sold units awaiting invoices.
- **A unit sold?** Add it under **Sold** so the invoice doesn't slip through the cracks.

## Backing up

Your data lives in Railway's managed Postgres. Railway keeps automatic backups:

1. In Railway, click the **Postgres** service → **Backups** tab.
2. You'll see automatic daily backups with a **Restore** button if you ever need to roll back.
3. For extra safety before big changes (like re-importing equipment), click **Create Backup** to take one on demand.

If you ever leave Railway, ask and this app can export the data — it's all in standard Postgres tables.

## Running it on your own computer (optional, for testing)

1. Install Node.js 22+ and Postgres (or point `DATABASE_URL` at any Postgres).
2. Copy `.env.example` to `.env` and fill in the values.
3. Run:
   ```
   npm install
   npx prisma migrate deploy
   npm run dev
   ```
4. Open `http://localhost:3000` and sign in with `ADMIN_NAME` / `ADMIN_PIN`.

## Troubleshooting

- **"Application failed to respond" on first deploy:** give it 3–4 minutes — the first build is slow. Check the deploy logs for errors.
- **Can't sign in:** names must match exactly (check spelling), and PINs are case-sensitive where letters are used — numbers only is simplest.
- **Database connection errors:** make sure `DATABASE_URL` on the app service exactly matches the one on the Postgres service's Variables tab.
- **Camera scan doesn't work:** phone browsers require a secure (https) connection for the camera — Railway's domain is https, so this works once deployed. On a local `http://` test it may refuse.
