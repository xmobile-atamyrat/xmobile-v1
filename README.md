# Xmobile

Open-source e-commerce platform (Turkmenistan): online payment and delivery. Web: [xmobile.com.tm](https://xmobile.com.tm).

**Contributing:** Fork the repo, open a PR. Issues are enabled.

---

## Prerequisites

- **Node.js** ≥ 20
- **Yarn**
- **PostgreSQL**
- **Git**

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd xmobile-v1
yarn install
```

**Pre-commit hook:** The `prepare` script installs [Husky](https://typicode.github.io/husky/) so each commit runs [lint-staged](https://github.com/okonet/lint-staged) (ESLint, Prettier, and `tsc --noEmit` on staged files). No extra step—just run `yarn install`. If hooks didn’t install (e.g. you had dependencies before adding Husky), run `yarn run prepare`.

### 2. PostgreSQL

Install and start PostgreSQL, then create a database for the app.

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb xmobile
```

Default connection (no password):  
`postgresql://$(whoami)@localhost:5432/xmobile`

**Windows:**

1. Install from [postgresql.org/download/windows](https://www.postgresql.org/download/windows) (or `winget install PostgreSQL.PostgreSQL`).
2. Start the service (Services app or `pg_ctl`).
3. Create a database, e.g. in psql or pgAdmin:
   ```sql
   CREATE DATABASE xmobile;
   ```
4. Use a URL like: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/xmobile`

### 3. Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at least:

| Variable               | Example / note                |
| ---------------------- | ----------------------------- |
| `DATABASE_URL`         | Your Postgres URL (see above) |
| `ACCESS_TOKEN_SECRET`  | Any long random string        |
| `REFRESH_TOKEN_SECRET` | Any long random string        |

Other vars are optional for local run; see [docs/environment.md](docs/environment.md).

### 4. Database migrations

```bash
yarn db:generate-dev
yarn db:migrate-dev
```

### 5. Run the app

```bash
yarn dev
```

App: **http://localhost:3003**

---

For architecture, API, database, and features, see the **[docs](docs/)** folder.
