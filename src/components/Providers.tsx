"use client";

import { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { NotificationInit } from "./NotificationInit";
import { ImportListener } from "./ImportListener";
import { PrintBridge } from "./PrintBridge";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationInit />
      <ImportListener />
      <PrintBridge />
      {children}
    </AuthProvider>
  );
}
