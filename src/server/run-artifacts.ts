import { parseFeedback, type FeedbackRequest } from "./feedback.ts";
import { artifactPublicationPolicy } from "./artifact-policy.ts";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { ArtifactStore, type ChatArtifactScope } from "./artifact-store.ts";
import type { AgentRun, TaskStore } from "./task-store.ts";
import { MAX_ARTIFACT_BYTES, type ArtifactInput, type ArtifactReference, type TaskArtifact } from "../domain/artifact.ts";

export type RunArtifactConnection = { url: string; token: string; context: TaskArtifact[] };
const string = { type: "string" };
const tools: { name: string; description: string; properties: Record<string, { type: string; enum?: string[] }>; required: string[] }[] = [
  { name: "publish_artifact", description: artifactPublicationPolicy + " Publish text, Markdown, a file (base64 bytes), or an HTTP/HTTPS link immediately. Supply artifactId to publish a new revision. Ownership and creator come from this run. Returns stable id and revisionId; cite as [title](#artifact/ID/REVISION_ID).", properties: { title: string, description: string, type: { type: "string", enum: ["text", "markdown", "file", "link"] }, content: string, base64: string, filename: string, mediaType: string, url: string, artifactId: string }, required: ["title", "type"] },
  { name: "search_artifacts", description: "Search this workspace's artifact metadata. Content is read separately. Use archived to discover archived artifacts.", properties: { search: string, archived: { type: "boolean" } }, required: [] },
  { name: "read_artifact", description: "Read an artifact's metadata and stored content (base64 for files), optionally at an exact revision. External links return their URL without fetching it.", properties: { artifactId: string, revisionId: string }, required: ["artifactId"] },
  { name: "link_artifact", description: "Link an artifact to the current task, following its latest revision.", properties: { artifactId: string }, required: ["artifactId"] },
  { name: "unlink_artifact", description: "Remove the current task's explicit link; comment citations remain intact.", properties: { artifactId: string }, required: ["artifactId"] },
  { name: "nominate_artifact", description: "Pin an exact revision to your final handover or feedback comment. Failed or interrupted runs do not attach nominations to system notices.", properties: { artifactId: string, revisionId: string }, required: ["artifactId", "revisionId"] },
];

// A short-lived, stateless Streamable HTTP MCP server. No caller controls ownership.
export async function openRunArtifacts(store: TaskStore, run: AgentRun, signal: AbortSignal, chat?: ChatArtifactScope) {
  const library = new ArtifactStore(store.databasePath, run.workspaceId, chat ? undefined : run.id, chat);
  const pending: ArtifactReference[] = [];
  let feedback: FeedbackRequest | undefined;
  const availableTools: typeof tools = chat ? tools : [...tools, { name: "request_feedback", description: "Request Human feedback, then stop work and end your run. Use approval for Approve/Reject buttons or text for an open question. Both question and recommendation must be nonempty Markdown. This does not grant approval.", properties: { question: string, recommendation: string, responseType: { type: "string", enum: ["text", "approval"] } }, required: ["question", "recommendation", "responseType"] }];
  const token = randomBytes(32).toString("hex");
  let closed = false;
  function assertActive() {
    const current = store.history(run.taskId).find((item) => item.id === run.id);
    if (closed || signal.aborted || (!chat && (current?.status !== "Running" || current.stopRequested || current.interruptionColumn)))
      throw new Error("Artifact access has expired.");
  }
  function call(name: string, args: Record<string, unknown>) {
    assertActive();
    const tool = availableTools.find((tool) => tool.name === name);
    if (!tool) throw new Error("Unknown artifact tool.");
    for (const key of tool.required) if (!(key in args)) throw new Error(`Missing ${key}.`);
    for (const [key, value] of Object.entries(args)) {
      const property = tool.properties[key];
      if (!property || typeof value !== property.type) throw new Error(`Invalid argument: ${key}.`);
    }
    if (feedback) throw new Error("Feedback is already requested. Stop work and end your run.");
    const artifactId = args.artifactId as string;
    const revisionId = args.revisionId as string | undefined;
    switch (name) {
      case "request_feedback":
        feedback = parseFeedback(JSON.stringify({ type: "feedback_request", ...args }));
        return { requested: true, message: "Stop work and end your run. Wait for the Human answer before continuing." };
      case "publish_artifact": {
        const { base64, artifactId: previous, ...fields } = args;
        const bytes = typeof base64 === "string" ? Buffer.from(base64, "base64") : undefined;
        if (base64 !== undefined && bytes?.toString("base64") !== base64) throw new Error("File bytes must be valid base64.");
        const input = { ...fields, creator: run.profile.name, ...(bytes ? { bytes } : {}) } as ArtifactInput;
        return previous ? library.revise(previous as string, input) : library.create(input);
      }
      case "search_artifacts": return library.list(args);
      case "read_artifact": {
        const artifact = library.read(artifactId, revisionId);
        if (artifact.type === "link") return artifact;
        const { bytes } = library.download(artifactId, artifact.revisionId);
        return { ...artifact, ...(artifact.type === "file" ? { base64: bytes.toString("base64") } : { content: bytes.toString("utf8") }) };
      }
      case "link_artifact": library.linkTask(run.taskId, artifactId); return { linked: true };
      case "unlink_artifact": library.unlinkTask(run.taskId, artifactId); return { linked: false };
      case "nominate_artifact": {
        library.read(artifactId, revisionId);
        if (chat) { library.linkTask(run.taskId, artifactId); return { nominated: true, linked: true }; }
        if (!pending.some((ref) => ref.artifactId === artifactId && ref.revisionId === revisionId)) pending.push({ artifactId, revisionId: revisionId! });
        return { nominated: true };
      }
    }
  }
  const server = createServer(async (request, response) => {
    if (request.url !== "/mcp" || request.headers.authorization !== `Bearer ${token}` || request.headers.origin) {
      response.writeHead(403).end(); return;
    }
    if (request.method !== "POST") { response.writeHead(405).end(); return; }
    let id: unknown = null;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_ARTIFACT_BYTES * 4 / 3 + 65536) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      assertActive();
      const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      id = message.id;
      if (message.jsonrpc !== "2.0" || typeof message.method !== "string") throw new Error("Invalid JSON-RPC request.");
      if (id === undefined) { response.writeHead(202).end(); return; }
      let result;
      if (message.method === "initialize") result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "todai-artifacts", version: "1.0.0" } };
      else if (message.method === "ping") result = {};
      else if (message.method === "tools/list") result = { tools: availableTools.map(({ properties, required, ...tool }) => ({ ...tool, inputSchema: { type: "object", properties, required, additionalProperties: false } })) };
      else if (message.method === "tools/call") {
        try { result = { content: [{ type: "text", text: JSON.stringify(call(message.params?.name, message.params?.arguments ?? {})) }] }; }
        catch (error) { result = { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Artifact operation failed." }] }; }
      } else { response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found." } })); return; }
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message: "Invalid request or expired run." } }));
    }
  });
  function close() {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", close);
    server.close();
    server.closeAllConnections();
    library.close();
  }
  try {
    const context = library.forTask(run.taskId);
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    signal.addEventListener("abort", close, { once: true });
    signal.throwIfAborted();
    return { connection: { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`, token, context }, pending, get feedback() { return feedback; }, close };
  } catch (error) { close(); throw error; }
}
