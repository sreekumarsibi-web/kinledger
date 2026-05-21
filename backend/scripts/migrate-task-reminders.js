const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

async function main() {
  await pool.query("alter table tasks add column if not exists reminder_at timestamptz");
  await pool.query("alter table tasks add column if not exists reminder_sent_at timestamptz");
  console.log("Task reminder migration complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
