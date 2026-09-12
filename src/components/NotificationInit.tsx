"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocalNotifications } from "@capacitor/local-notifications";
import { initNotifications } from "@/lib/notifications";
import { resyncAllNotifications } from "@/lib/localdb";

export function NotificationInit() {
  const router = useRouter();

  useEffect(() => {
    // Solicita permissões de notificação silenciosamente na inicialização
    LocalNotifications.requestPermissions().catch(() => {});

    // Inicializa os canais de notificação e ouvintes de ação
    initNotifications((url) => {
      router.push(url);
    });

    // Re-sincroniza todas as notificações (tarefas e medicações) da área ativa atual no cold start
    resyncAllNotifications().catch((err) => {
      console.warn("Erro ao sincronizar notificações no cold start:", err);
    });
  }, [router]);

  return null;
}
