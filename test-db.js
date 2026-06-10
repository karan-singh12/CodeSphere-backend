const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    console.log("Connecting...");
    const users = await prisma.user.findMany();
    console.log("Success! Users count:", users.length);
    console.log("Users:", users);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
