import { openTaskStore } from "@/server/database";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Todai",
  description: "Local task management for agent work.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = openTaskStore();
  let workspaceId: string;
  try { workspaceId = store.workspaceId; } finally { store.close(); }
  return (
    <html lang="en" data-workspace-id={workspaceId}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
