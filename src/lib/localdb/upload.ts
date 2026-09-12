"use client";

const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Converte um arquivo de imagem em uma data URI (base64) para ser
 * armazenada diretamente no banco local. Substitui o antigo endpoint
 * /api/upload, que gravava o arquivo em disco no servidor.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("Formato não permitido");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Arquivo muito grande (máx 5MB)");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro no upload"));
    reader.readAsDataURL(file);
  });
}
