export type LocalSkill = {
  id: string;
  path: string;
  content: string;
  revision: string;
};

export type SkillsSnapshot = { directory: string; skills: LocalSkill[] };
export type SkillScope = "workspace" | "todai" | "root";

