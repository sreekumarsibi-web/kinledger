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
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function run() {
  const root = path.resolve(__dirname, "..", "..");
  const backend = path.resolve(__dirname, "..");
  const env = readEnv(path.join(backend, ".env"));
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  const schema = fs.readFileSync(path.join(root, "backend-schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(backend, "seed-plans.sql"), "utf8");

  try {
    await pool.query(schema);
    await pool.query(seed);
    console.log("Database schema and seed applied.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
