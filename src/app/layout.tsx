import { WorkspaceSelection } from "@/components/workspace-selection";
import { openTaskStore } from "@/server/database";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

import { ThemeProvider } from "@/components/theme-provider";
import { themeScript } from "@/lib/theme";

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
    <html suppressHydrationWarning lang="en" data-workspace-id={workspaces[0]?.id}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <WorkspaceSelection workspaces={workspaces}>{children}</WorkspaceSelection>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
