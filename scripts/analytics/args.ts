/** CLI parsing and the local-database safety check for `seed-analytics.ts`. */

export interface SeedArgs {
  days: number;
  visitorsPerDay: number;
  seed: number;
  clean: boolean;
  orders: boolean;
  force: boolean;
  help: boolean;
}

export const DEFAULT_ARGS: SeedArgs = {
  days: 120,
  visitorsPerDay: 400,
  seed: 42,
  clean: false,
  orders: true,
  force: false,
  help: false,
};

export const USAGE = `Seeds realistic analytics data (events, orders, rollups) into the LOCAL database.

  yarn seed:analytics-dev [options]

  --days N               days of history ending today (default ${DEFAULT_ARGS.days})
  --visitors-per-day N   average visitors per day; traffic grows around it (default ${DEFAULT_ARGS.visitorsPerDay})
  --seed N               PRNG seed: the same seed and catalog give the same data (default ${DEFAULT_ARGS.seed})
  --no-orders            no checkouts: no order_placed events and no seed orders
  --clean                remove all seed data, recompute the affected rollups, and exit
  --force                skip the local-database check (never point this at production)
  --help                 show this help

Re-running replaces earlier seed data instead of adding to it.`;

const INT_OPTIONS: Record<string, 'days' | 'visitorsPerDay' | 'seed'> = {
  '--days': 'days',
  '--visitors-per-day': 'visitorsPerDay',
  '--seed': 'seed',
};

const LIMITS: Record<'days' | 'visitorsPerDay' | 'seed', [number, number]> = {
  days: [1, 3650],
  visitorsPerDay: [1, 100_000],
  seed: [0, 2 ** 32 - 1],
};

/** Parses argv (without node and the script path). Throws on bad input. */
export function parseArgs(argv: string[]): SeedArgs {
  const args = { ...DEFAULT_ARGS };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2);
    if (flag in INT_OPTIONS) {
      const key = INT_OPTIONS[flag];
      const raw = inline ?? argv[(i += 1)];
      const value = Number(raw);
      const [min, max] = LIMITS[key];
      if (
        raw == null ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      ) {
        throw new Error(
          `${flag} expects an integer between ${min} and ${max}, got ${raw ?? 'nothing'}.`,
        );
      }
      args[key] = value;
    } else if (flag === '--clean') args.clean = true;
    else if (flag === '--no-orders') args.orders = false;
    else if (flag === '--force') args.force = true;
    else if (flag === '--help' || flag === '-h') args.help = true;
    else throw new Error(`Unknown option ${argv[i]}. Run with --help.`);
  }
  return args;
}

/**
 * Host names a local or docker-compose Postgres is reached by. Anything else
 * (an IP on a network, a cloud host name) might be production.
 */
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'host.docker.internal',
  'docker.for.mac.localhost',
  'postgres',
  'postgresql',
  'db',
  'database',
]);

export interface DatabaseCheck {
  ok: boolean;
  host: string | null;
  /** Why it was refused; null when ok. */
  reason: string | null;
}

/** Whether DATABASE_URL points at a local / docker database. */
export function checkDatabaseUrl(url: string | undefined): DatabaseCheck {
  if (!url) {
    return {
      ok: false,
      host: null,
      reason:
        'DATABASE_URL is not set (run through yarn seed:analytics-dev, which loads .env.local).',
    };
  }
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return {
      ok: false,
      host: null,
      reason: 'DATABASE_URL is not a valid URL.',
    };
  }
  if (
    LOCAL_HOSTS.has(host) ||
    /^127\.\d+\.\d+\.\d+$/.test(host) ||
    host.endsWith('.localhost')
  ) {
    return { ok: true, host, reason: null };
  }
  return {
    ok: false,
    host,
    reason: `DATABASE_URL host "${host || '(empty)'}" is not localhost, 127.0.0.1 or a docker host name, so this may be a shared or production database. Pass --force if you are sure it is a throwaway one.`,
  };
}
