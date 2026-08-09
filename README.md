# Aura backend

Express + Prisma (Postgres on AWS RDS) + a Gemini proxy. Handles signup/login (JWT sessions,
bcrypt-hashed passwords), stores chat history per user, and is the only place your Gemini
API key ever lives.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — from your RDS instance's Connectivity & security tab (endpoint + port),
  plus the master username/password and DB name from the Configuration tab. Format:
  `postgresql://USER:PASSWORD@ENDPOINT:5432/DBNAME?sslmode=require`
- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
- `JWT_SECRET` — any long random string

Your RDS instance also needs an inbound security-group rule allowing your machine's IP on
port 5432 (Connectivity & security → VPC security group → Inbound rules → Add rule → type
PostgreSQL, source My IP), or Prisma will time out trying to reach it.

Then create the database and start the server:

```bash
npx prisma migrate dev --name init
npm run dev
```

You should see `Aura backend listening on http://localhost:3001`.

## Endpoints

| Method | Path              | Auth | Body                                | Notes                              |
|--------|-------------------|------|--------------------------------------|-------------------------------------|
| POST   | /api/auth/signup  | no   | `{name, email, password, gender}`    | gender: `female` \| `male` \| `other` |
| POST   | /api/auth/login   | no   | `{email, password}`                  |                                      |
| GET    | /api/me           | yes  | —                                    | current user profile                |
| GET    | /api/chat/history | yes  | —                                    | past messages, oldest first         |
| POST   | /api/chat         | yes  | `{message}`                          | returns `{reply}`, saves both turns |

Auth is a `Bearer <token>` header, using the token returned by signup/login.

**If signup/login fails with a 500 and the server log shows `P1011` /
`self-signed certificate in certificate chain` / `TlsConnectionError`:** RDS's TLS certificate
is signed by Amazon's own CA (`rds-ca-...`), which isn't in Node's default trusted root store.
Newer versions of the `pg` driver also started treating `sslmode=require` as strict full
verification rather than the old "encrypt but don't verify" behavior, which is what actually
surfaces this. Fix: add `uselibpqcompat=true` to `DATABASE_URL`'s query string (already in
`.env.example`) — this restores the older, more permissive behavior appropriate for connecting
to your own known RDS instance in development. For a more rigorous setup later, download
Amazon's RDS CA bundle and pass it as the `ca` option to the `PrismaPg` adapter in `src/db.js`
instead.

## About the Prisma 7 setup

Prisma 7's new default generator (`prisma-client`) turned out to have real, currently-open bugs
around its `moduleFormat`/CommonJS output — even with every documented option set correctly, it
kept emitting `import` statements that plain `require()` can't load. Rather than keep chasing
that, this project uses the older `prisma-client-js` generator instead. It's marked
"deprecated" in Prisma's v7 docs, but it's still fully functional and generates plain
CommonJS into `node_modules/@prisma/client` the same way Prisma has for years — no custom
output path, no module-format flags, no TypeScript-by-default surprises.

Two things still carry over from Prisma 7 itself (these aren't generator-specific):

1. **The connection URL lives in `prisma.config.mjs`**, not `schema.prisma`.
2. **`PrismaClient` still requires a driver adapter.** `src/db.js` builds a `PrismaPg` adapter
   from `DATABASE_URL` and passes it to `new PrismaClient({ adapter })`. Every route imports
   the single shared client from `src/db.js` rather than creating its own.

**If you see `P1013: The provided database string is invalid` / `scheme is not recognized`:**
`schema.prisma`'s `provider` and your `DATABASE_URL`'s scheme have to agree — `postgresql://`
needs `provider = "postgresql"`, a bare file path needs `provider = "sqlite"`. Mixing them
throws exactly this error.

**If `npx prisma generate` or `migrate dev` complains it can't find `dotenv/config`:** that
almost always means an earlier `npm install` failed partway through (check the very first
error in the log, above any "cleanup" warnings) and `dotenv` never got installed. Delete
`node_modules` and `package-lock.json`, then re-run `npm install` — on Windows, close any
editor/terminal with the project open first, since a locked file mid-install is what causes
those `EPERM: operation not permitted` cleanup warnings.

**Remember to run `npx prisma generate` after every `migrate dev`.** Unlike Prisma 6 and
earlier, v7's `migrate dev` no longer regenerates the client automatically — it only applies
the migration to the database. Skipping this step is what causes `Cannot find module
'@prisma/client'`-style errors right after a migration that otherwise looked successful.

**If `migrate dev` tries to connect to some *other* unfamiliar Postgres host than the one in
your `.env`:** you likely have `DATABASE_URL` set as a system/user environment variable
already (left over from another project), and `dotenv` refuses to overwrite an existing env
var by default — so the old value wins over `.env`. Both `prisma.config.mjs` and
`src/index.js` load dotenv with `{ override: true }` specifically to prevent this, but if
you're still seeing it, check `echo $env:DATABASE_URL` (PowerShell) or
`[System.Environment]::GetEnvironmentVariable("DATABASE_URL","User")` to confirm, and clear it
for this shell with `Remove-Item Env:DATABASE_URL` if needed.

**If `migrate dev` hangs then times out reaching your RDS endpoint:** check that the RDS
instance's own security group (not your EC2 instance's security group — they're different)
has an inbound rule for port 5432 from your machine's actual public IP. If you're running the
backend from an EC2 instance, that's the EC2 instance's public IP, not your laptop's.

## Using SQLite instead (local, zero AWS cost)

If you'd rather develop against a local file and only point at RDS for staging/production:

1. `prisma/schema.prisma`: `datasource db { provider = "sqlite" }`
2. `.env`: `DATABASE_URL="file:./dev.db"`
3. `src/db.js`: swap the adapter —
   ```js
   const { PrismaLibSQL } = require("@prisma/adapter-libsql"); // npm i @prisma/adapter-libsql @libsql/client
   const { PrismaClient } = require("@prisma/client");
   const adapter = new PrismaLibSQL({ url: process.env.DATABASE_URL });
   ```
   (libsql ships prebuilt binaries for Windows/Mac/Linux — no C++ compiler needed, unlike
   `@prisma/adapter-better-sqlite3`.)

Then `npx prisma generate` and `npx prisma migrate dev`. Nothing in `auth.js` or `chat.js`
changes — they only ever talk to the shared `prisma` export.

## CORS

`CORS_ORIGIN` in `.env` is a comma-separated allow-list. It already includes `null`, which is
what browsers send as the Origin header when you open `frontend/aura.html` directly as a local
file — so the default config works with no changes for local testing. If you serve the frontend
from a dev server (Vite, `npx serve`, etc.), add that origin too.
