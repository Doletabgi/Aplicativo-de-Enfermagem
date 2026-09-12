#!/bin/sh
set -e

echo "Aguardando o PostgreSQL..."
node /app/prisma/wait-for-db.js
echo "PostgreSQL acessível."

echo "Aplicando migrations Prisma..."
npx prisma migrate deploy
echo "Schema Prisma aplicado."

echo "Garantindo usuário admin padrão..."
node /app/prisma/seed.js
echo "Migrations concluídas."
