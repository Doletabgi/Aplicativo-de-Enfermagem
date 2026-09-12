"use client";

let pendingImportContent: string | null = null;
const listeners = new Set<(content: string) => void>();

/**
 * Armazena o JSON pendente de importação na memória e notifica qualquer ouvinte ativo.
 */
export function setPendingImportContent(content: string | null): void {
  pendingImportContent = content;
  if (content) {
    listeners.forEach((fn) => {
      try {
        fn(content);
      } catch (err) {
        console.error("Erro no ouvinte de pendingImport:", err);
      }
    });
  }
}

/**
 * Retorna o conteúdo atual armazenado em memória (sem remover).
 */
export function getPendingImportContent(): string | null {
  return pendingImportContent;
}

/**
 * Consome o conteúdo pendente (retorna e limpa da memória), garantindo entrega única e confiável.
 */
export function consumePendingImportContent(): string | null {
  const content = pendingImportContent;
  pendingImportContent = null;
  return content;
}

/**
 * Permite que a tela /import escute novos imports recebidos enquanto a página já está montada.
 */
export function subscribePendingImport(fn: (content: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
