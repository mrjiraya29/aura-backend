// Prisma 7 requires every PrismaClient to be constructed with a driver adapter —
// there's no more built-in "just works" engine. PrismaPg wraps the standard `pg`
// driver and talks to any Postgres, including RDS.
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
