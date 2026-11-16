export type TaskReference = {
  kind: "skill" | "file";
  label: string;
  path: string;
  detail: string;
};
