import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds check app code; `npm run typecheck` also checks Storybook.
  typescript: { tsconfigPath: "tsconfig.app.json" },
};
export default nextConfig;
