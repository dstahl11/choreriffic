# ChoreBoard

ChoreBoard is a self-hosted family chore system with a wall-tablet Sticker Board, persistent check-offs, a protected admin area, authenticated reporting/API access, and calendar subscription feeds.

## Included

- Today and Week kiosk views with large touch targets
- Optimistic check-off and undo backed by Postgres
- RFC 5545 recurrence through `rrule`
- Deterministic rotating assignments
- Protected people, chore, and occurrence administration
- Completion reports grouped by person and chore
- Bearer-authenticated REST API
- Combined and per-person ICS feeds
- Daily 60-day materialization sidecar
- Docker Compose deployment

## Local development

Copy `.env.example` to `.env`, replace every secret, then start Postgres:

```bash
docker compose up -d db
npx prisma migrate dev
npx tsx scripts/seed.ts
npm run dev
```

The demo seed is clearly prefixed with `Demo` and is never run automatically in production.

## Production

Create a protected `.env` containing the variables from `.env.example`, then:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3010/health
```

The app applies committed Prisma migrations before starting. The `cron` service calls the internal materialization endpoint every 24 hours.

`ADMIN_COOKIE_SECURE` must remain `false` for direct LAN HTTP access. Set it to `true` only after the app is served through an HTTPS reverse proxy.

## iPad kiosk mode

ChoreBoard is installable as a standalone home-screen web app, which removes Safari's address bar and tabs:

1. Open `http://192.168.1.18:3010` in Safari on the iPad.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch ChoreBoard from its new home-screen icon and rotate the iPad to landscape.

For a dedicated family kiosk, set **Settings → Display & Brightness → Auto-Lock → Never**. To keep children inside ChoreBoard, enable **Settings → Accessibility → Guided Access**, then triple-click the iPad's top button after launching the app.

## Reporting

All `/api/*` routes require the API bearer token:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "http://localhost:3010/api/reports/completions?from=2026-08-01&to=2026-08-31"
```

The response includes `totalCompleted`, per-person totals, per-chore totals, and the underlying completion rows.

## Calendar feeds

- `/calendar/$FEED_TOKEN/all.ics`
- `/calendar/$FEED_TOKEN/person/$PERSON_ID.ics`

Calendar URLs use the secret feed token because calendar clients cannot send authorization headers.

## API surface

- `GET /api/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD&person=&status=`
- `POST /api/occurrences/:id/complete`
- `POST /api/occurrences/:id/uncomplete`
- `POST /api/occurrences/:id/skip`
- `GET|POST /api/chores`
- `GET|PATCH|DELETE /api/chores/:id`
- `GET|POST /api/people`
- `GET|PATCH|DELETE /api/people/:id`
- `GET /api/reports/completions?from=YYYY-MM-DD&to=YYYY-MM-DD&person=`
- `POST /api/internal/materialize?days=60`

## OpenClaw sync contract

OpenClaw should pull the next 14 days of pending occurrences and key Todoist tasks by occurrence `id`. A second run updates the existing task rather than creating another. Completed, skipped, or regenerated occurrences disappear from the pending pull and should close their corresponding Todoist task.

Todoist project/label mapping remains intentionally external because it depends on the household’s final naming convention.
