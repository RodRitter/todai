import { Suspense } from "react";
import { PersistentWorkspace } from "@/components/tasks/persistent-workspace";

export default function SettingsPage() {
  return (
    <Suspense fallback={<main className="p-8" aria-busy="true" />}>
      <PersistentWorkspace screen="settings" />
    </Suspense>
  );
}
