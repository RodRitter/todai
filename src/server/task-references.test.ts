import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileReferences, skillReferences } from "./task-references.ts";

test("file references search workspace paths without following symlinks or generated directories", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "todai-references-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ["src", "node_modules", ".git"]) mkdirSync(join(root, directory));
  writeFileSync(join(root, "src", "My file.ts"), "example");
  writeFileSync(join(root, "node_modules", "hidden.ts"), "example");
  writeFileSync(join(root, ".env"), "secret");
  symlinkSync(tmpdir(), join(root, "outside"));
  assert.deepEqual(await fileReferences(root, "MY FILE"), [{
    kind: "file", label: "/src/My file.ts", path: join(root, "src", "My file.ts"), detail: "src/My file.ts",
  }]);
  assert.equal((await fileReferences(root, "")).length, 1);
});

test("skill references retain exact paths and deduplicate overlapping scopes", (t) => {
  const root = mkdtempSync(join(tmpdir(), "todai-references-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, ".agents", "skills", "unique-reference-test");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "SKILL.md"), "# Test skill");
  const references = skillReferences(root, "unique-reference-test", root);
  assert.equal(references.length, 1);
  assert.equal(references[0].label, "$unique-reference-test");
  assert.equal(references[0].path, realpathSync(join(directory, "SKILL.md")));
});
