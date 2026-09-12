const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("PostgreSQL acessível.");
      return;
    } catch (e) {
      console.log(`Tentativa ${i}/${maxAttempts}: banco ainda não pronto (${e.message.split("\n")[0]})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error("Não foi possível conectar ao PostgreSQL.");
  process.exit(1);
}

main()
  .finally(() => prisma.$disconnect());
