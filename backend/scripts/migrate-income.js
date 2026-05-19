const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

function readEnv(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

async function run() {
  const backend = path.resolve(__dirname, "..");
  const env = readEnv(path.join(backend, ".env"));
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  try {
    await pool.query(`
      create table if not exists income_entries (
        id uuid primary key default gen_random_uuid(),
        household_id uuid not null references households(id) on delete cascade,
        created_by uuid not null references users(id),
        source text not null,
        amount_cents integer not null check (amount_cents >= 0),
        currency char(3) not null default 'USD',
        received_at date not null,
        note text,
        is_recurring boolean not null default false,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query("create index if not exists income_entries_household_received_idx on income_entries (household_id, received_at desc);");
    console.log("Income migration applied.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
