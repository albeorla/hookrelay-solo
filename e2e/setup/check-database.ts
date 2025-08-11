import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

async function checkDatabase(maxRetries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const prisma = new PrismaClient();

    try {
      // Try to connect to the database
      await prisma.$connect();
      logger.dbOperation("Database connection successful");

      // Check if database is seeded (has roles)
      const roleCount = await prisma.role.count();
      if (roleCount === 0) {
        logger.info("⚠️  Database is not seeded. Running seed...");
        // Run seed command
        const { execSync } = await import("child_process");
        execSync("yarn prisma db seed", { stdio: "inherit" });
        logger.dbOperation("Database seeded successfully");
      } else {
        logger.debug("✅ Database is properly seeded");
      }

      await prisma.$disconnect();
      return true;
    } catch (error: unknown) {
      logger.warn(
        `❌ Database connection attempt ${attempt}/${maxRetries} failed`,
      );

      if (attempt === maxRetries) {
        logger.error("❌ Database connection failed after all retries!");

        if (
          error instanceof Error &&
          error.message?.includes("Can't reach database server")
        ) {
          logger.error("The database server is not running.");
          logger.error("To start the database, run one of these commands:");
          logger.error("  1. Using Docker: ./scripts/start-database.sh");
          logger.error(
            "  2. Using local PostgreSQL: ensure it's running on port 5432",
          );
          logger.error(
            "For CI environments, ensure DATABASE_URL is properly configured.",
          );
        } else {
          logger.error(
            "Error details:",
            error instanceof Error ? error.message : String(error),
          );
        }

        await prisma.$disconnect();
        return false;
      }

      await prisma.$disconnect();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return false;
}

export { checkDatabase };
