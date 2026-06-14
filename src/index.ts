import app from "./app";
import prisma from "./config/prisma";
import { log } from "./utils/logger";

const PORT = process.env.PORT || process.env.API_PORT || 3000;

async function startServer() {
  try {
    log("Connecting to the database...");
    await prisma.$connect();
    log("Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }

  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      log("HTTP server closed.");
      await prisma.$disconnect();
      log("Database disconnected. Exiting process.");
      process.exit(0);
    });

    // Force shutdown if graceful closure hangs
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();