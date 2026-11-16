import { testExecutor } from "@/server/executor-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let active: Promise<{ message: string }> | undefined;

export async function POST() {
  if (active)
    return Response.json(
      { error: "An executor test is already running. Wait for it to finish, then retry." },
      { status: 409 },
    );
  try {
    active = testExecutor();
    return Response.json(await active);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Executor test failed unexpectedly. Check the app server logs and retry.",
      },
      { status: 500 },
    );
  } finally {
    active = undefined;
  }
}
