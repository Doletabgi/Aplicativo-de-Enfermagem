const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@prontuario.com";
  const password = process.env.ADMIN_PASSWORD || "admin123456";
  const name = process.env.ADMIN_NAME || "Administrador";

  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Usuário(s) já existente(s), seed de admin ignorado.");
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, password: hashed },
  });
  console.log(`Usuário admin criado: ${email}`);
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
