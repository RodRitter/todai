import { WorkspaceSelection } from "@/components/workspace-selection";
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
  let workspaces;
  try { workspaces = store.listWorkspaces().map((workspace) => ({ ...workspace })); } finally { store.close(); }
  return (
    <html lang="en" data-workspace-id={workspaces[0]?.id}>
      <body className="font-sans antialiased">
        <WorkspaceSelection workspaces={workspaces}>{children}</WorkspaceSelection>
        <Toaster />
      </body>
    </html>
  );
}
