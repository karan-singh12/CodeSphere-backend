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

  app.listen(PORT, () => {
    log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();