"use client";

import { useEffect, useState } from "react";
import { workspaceApi } from "@/lib/workspace-api";

export function useDirectorySuggestions(path: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [directoryError, setDirectoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        workspaceApi
          .directories(path, controller.signal)
          .then((data) => {
            if (!controller.signal.aborted) {
              setSuggestions(data);
              setDirectoryError("");
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted) {
              setSuggestions([]);
              setDirectoryError(error.message);
            }
          });
      },
      path.endsWith("/") ? 0 : 180,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path]);

  function clearSuggestions() {
    setSuggestions([]);
    setDirectoryError("");
  }

  return { suggestions, directoryError, clearSuggestions };
}
