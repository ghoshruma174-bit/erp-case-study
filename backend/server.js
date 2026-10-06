require("dotenv").config();

const app = require("./src/app");
const prisma = require("./src/config/prisma");

const port = Number(process.env.PORT || 5050);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

async function startServer() {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be configured with at least 32 characters");
    }

    await prisma.$connect();

    app.listen(port, () => {
      console.log(`ERP Backend is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error.message);
    process.exitCode = 1;
  }
}

startServer();
