// Prisma 7 moved the database connection (and CLI settings like migrations path)
// out of schema.prisma and into this file. .env is not auto-loaded by the CLI
// anymore either, hence the explicit dotenv import below.
//
// { override: true } matters if DATABASE_URL is ever set at the OS/system level
// (e.g. left over from another project) — without it, dotenv refuses to overwrite
// a variable that already exists in the environment, and the old value silently wins.
import { config } from "dotenv";
config({ override: true });
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
