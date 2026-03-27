# Golden Goal — Single Ticket Generator

NestJS microservice that generates **exactly one scratch ticket per request**: it validates `multiplier` and `combination` against a **canonical weight table**, builds **W/Y numbers**, **near-miss** cells (losing tickets), and a **20-cell amount layout**, then **persists** the ticket in PostgreSQL and returns it.

**Full documentation (structure, generation rules, API details):** [docs/GUIDE.md](docs/GUIDE.md)

---

## Stack

- **Runtime:** Node.js  
- **Framework:** NestJS, TypeScript (strict)  
- **Database:** PostgreSQL  
- **ORM:** TypeORM  
- **Validation:** `class-validator` + global `ValidationPipe`  

---

## Prerequisites

- Node.js 20+ (recommended; matches the `Dockerfile`)  
- PostgreSQL 16+ (or Docker — see below)  

---

## Quick start (local app + your Postgres)

1. Copy environment template and edit if needed:

   ```bash
   cp .env.example .env
   ```

2. Ensure PostgreSQL is running and matches `DATABASE_*` in `.env` (default: `localhost:5432`, database `tickets`).

3. Install and run in watch mode:

   ```bash
   npm install
   npm run start:dev
   ```

The API listens on **`PORT`** from `.env` (default **3000**).

---

## Docker

**App + database** (one command):

```bash
docker compose up --build
```

**Database only** (run Nest on the host; Compose exposes Postgres on the host port):

```bash
docker compose up db
```

Use `DATABASE_HOST=localhost` in `.env` with the same user, password, and database name as in `docker-compose.yml`.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tickets/generate` | Generate and store one ticket |

### Example: losing ticket (`NO_WIN`)

```bash
curl -s -X POST http://localhost:3000/tickets/generate \
  -H "Content-Type: application/json" \
  -d "{\"player_id\":\"demo\",\"bet_amount\":2,\"multiplier\":0,\"combination\":[]}"
```

### Example: winning ticket (must match a row in `src/tickets/data/weight-table.json`)

```bash
curl -s -X POST http://localhost:3000/tickets/generate \
  -H "Content-Type: application/json" \
  -d "{\"player_id\":\"demo\",\"bet_amount\":2,\"multiplier\":1.5,\"combination\":[1.5]}"
```

See [docs/GUIDE.md](docs/GUIDE.md) for the full request/response contract, status codes, and how generation and retries work.

---

## NPM scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Development with reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app (`node dist/main`) |
| `npm run test` | Unit tests (none required by default) |
| `npm run test:e2e` | E2E smoke (mocked service) |
| `npm run lint` | ESLint |

---

## Project layout (short)

| Path | Role |
|------|------|
| `src/tickets/` | Controller, service, DTO, entity, engines |
| `src/tickets/data/weight-table.json` | Allowed multiplier + combination pairs |
| `src/tickets/engine/` | Scratch grid, amounts, checksum, orchestration |
| `src/config/database.config.ts` | TypeORM connection from env |
| `docs/GUIDE.md` | Developer guide for beginners |

---

## Schema sync

`TYPEORM_SYNC` (see `.env.example`) controls whether TypeORM updates the database schema automatically. Use **`false`** in production when you manage schema with migrations.

---

## License

This repository started from the [Nest](https://github.com/nestjs/nest) TypeScript starter. Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
