import { withTaskStore } from "@/server/database";
import { ConfigurationValidationError } from "@/domain/configuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    return Response.json(withTaskStore(request, (store) => store.exportConfiguration(new URL(request.url).searchParams.get("scope") === "workspace")));
  } catch {
    return Response.json({ error: "Could not load configuration. Try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Choose a valid JSON file." }, { status: 400 }); }
  try {
    return Response.json(withTaskStore(request, (store) => store.importConfiguration(input, new URL(request.url).searchParams.get("columns") ?? "add", new URL(request.url).searchParams.get("conflicts") ?? "copy")));
  } catch (error) {
    return Response.json({ error: error instanceof ConfigurationValidationError ? error.message : "Could not import configuration. No changes were saved." }, { status: error instanceof ConfigurationValidationError ? 400 : 500 });
  }
}
