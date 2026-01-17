import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// 自动检测数据库类型
const isPostgres = connectionString.startsWith('postgres');

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: isPostgres ? "postgresql" : "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
