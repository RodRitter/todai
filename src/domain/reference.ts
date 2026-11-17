export type TaskReference = {
  kind: "skill" | "file" | "artifact";
  label: string;
  path: string;
  detail: string;
};
