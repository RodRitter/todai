import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkills, parseSkillScope, saveSkill, saveScopedSkill, scopeDirectory, skillsDirectory } from "./skill-store.ts";

function fixture(context: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "todai-skills-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "example"));
  writeFileSync(join(root, "example", "SKILL.md"), "---\nname: example\ndescription: An example.\n---\n\n# Example\n");
  return root;
}

test("skills read directly from disk and save the complete source", (context) => {
  const root = fixture(context);
  mkdirSync(join(root, "no-skill"));
  const { skills } = listSkills(root);
  assert.equal(skills.length, 1);
  const content = skills[0].content + "\nUpdated instructions.\n";
  const saved = saveSkill({ ...skills[0], content }, root);
  assert.equal(readFileSync(join(root, "example", "SKILL.md"), "utf8"), content);
  assert.notEqual(saved.revision, skills[0].revision);
  assert.deepEqual(listSkills(root).skills, [saved]);
});

test("external edits are preserved when a stale editor saves", (context) => {
  const root = fixture(context);
  const skill = listSkills(root).skills[0];
  writeFileSync(skill.path, "External edit");
  assert.throws(() => saveSkill({ ...skill, content: "Editor edit" }, root), /changed on disk/);
  assert.equal(readFileSync(skill.path, "utf8"), "External edit");
});

test("skill paths cannot traverse or follow links outside the root", (context) => {
  const root = fixture(context);
  const skill = listSkills(root).skills[0];
  for (const id of ["../example", "..", "/tmp/example", "example/SKILL.md", "example\\other"]) {
    assert.throws(() => saveSkill({ ...skill, id }, root), /valid skill folder/);
  }
  const outside = mkdtempSync(join(tmpdir(), "todai-outside-"));
  context.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, "SKILL.md"), "Outside");
  symlinkSync(outside, join(root, "linked"));
  assert.throws(() => saveSkill({ ...skill, id: "linked" }, root), /outside the skills directory/);
  assert.equal(readFileSync(join(outside, "SKILL.md"), "utf8"), "Outside");
});

test("missing directory returns an empty library", (context) => {
  const root = fixture(context);
  assert.deepEqual(listSkills(join(root, "missing")).skills, []);
});

test("Workspace and Todai scopes save independently, including matching skill names", (context) => {
  const root = fixture(context);
  const workspace = join(root, "workspace");
  const todai = join(root, "todai");
  for (const location of [workspace, todai]) {
    const directory = join(location, ".agents", "skills", "example");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), "Original");
  }
  for (const scope of ["workspace", "todai"] as const) {
    const directory = scopeDirectory(scope, workspace, todai);
    const skill = listSkills(directory).skills[0];
    saveScopedSkill(scope, { ...skill, content: scope, directory }, workspace, todai);
  }
  assert.equal(listSkills(scopeDirectory("workspace", workspace, todai)).skills[0].content, "workspace");
  assert.equal(listSkills(scopeDirectory("todai", workspace, todai)).skills[0].content, "todai");
  assert.equal(scopeDirectory("root", workspace, todai), skillsDirectory());
});

test("scope validation protects root skills and rejects stale directory selection", (context) => {
  const root = fixture(context);
  assert.equal(parseSkillScope(null), "todai");
  assert.throws(() => parseSkillScope("local"), /Choose Workspace, Todai, or Root/);
  assert.throws(() => saveScopedSkill("root", {}, root, root), /read-only/);
  assert.throws(() => saveScopedSkill("workspace", { directory: "old-workspace" }, root, root), /directory changed/);
  assert.throws(() => saveScopedSkill("todai", { directory: "another-directory" }, root, root), /directory changed/);
});
