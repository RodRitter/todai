import { listSkills, parseSkillScope, scopeDirectory, saveScopedSkill, SkillError } from "@/server/skill-store";
import { withTaskStore } from "@/server/database";
import { workspacePath } from "@/server/workspace-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  return Response.json({ error: error instanceof SkillError ? error.message : "Could not access local skills. Check the directory and file permissions, then retry." }, { status: error instanceof SkillError ? error.status : 500 });
}

export function GET(request: Request) {
  try {
    const scope = parseSkillScope(new URL(request.url).searchParams.get("scope"));
    return Response.json(listSkills(scopeDirectory(scope, withTaskStore(request, workspacePath))));
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Send skill changes as valid JSON." }, { status: 400 }); }
  try {
    const scope = parseSkillScope(new URL(request.url).searchParams.get("scope"));
    return Response.json(saveScopedSkill(scope, input, withTaskStore(request, workspacePath)));
  } catch (error) { return failure(error); }
}
