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
      create table if not exists device_tokens (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        provider text not null check (provider in ('expo', 'fcm', 'apns')),
        token text not null unique,
        platform text,
        device_name text,
        is_active boolean not null default true,
        last_seen_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
    `);
    await pool.query("create index if not exists device_tokens_user_idx on device_tokens (user_id, is_active);");
    console.log("Device token migration applied.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
