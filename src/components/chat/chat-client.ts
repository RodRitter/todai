import { workspaceFetch } from "../../lib/workspace-fetch.ts";

class ChatResponseError extends Error {}

export async function chatRequest<T>(query = "", input?: unknown, signal?: AbortSignal, method: "POST" | "DELETE" = "POST"): Promise<T> {
  const reading = input === undefined;
  const options: RequestInit = reading ? { signal, cache: "no-store" } : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal,
  };
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await workspaceFetch(`/api/chats${query}`, options);
      const body = await response.text();
      let data: unknown;
      try { data = JSON.parse(body); }
      catch { throw new ChatResponseError("The chat server returned an incomplete or invalid response."); }
      if (!data || typeof data !== "object")
        throw new ChatResponseError("The chat server returned an invalid response.");
      if (!response.ok) {
        const message = "error" in data && typeof data.error === "string" ? data.error : "Could not load the chat.";
        throw new Error(message);
      }
      return data as T;
    } catch (error) {
      signal?.throwIfAborted();
      if (!(error instanceof ChatResponseError)) throw error;
      // Retry reads only. A write can succeed even when its response is lost.
      if (reading && attempt === 0) continue;
      throw new Error(reading
        ? "Could not load chat messages. The server returned an incomplete response. Try again."
        : "Could not confirm the chat request. Check this task's Chat tab before trying again.");
    }
  }
}
