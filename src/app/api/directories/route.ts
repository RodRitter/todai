import { suggestDirectories } from "@/server/workspace-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    return Response.json(
      suggestDirectories(new URL(request.url).searchParams.get("path") ?? ""),
    );
  } catch {
    return Response.json(
      {
        error: "Could not read this directory. Check the path and permissions.",
      },
      { status: 400 },
    );
  }
}
