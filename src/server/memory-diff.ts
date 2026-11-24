// Find unchanged lines with linear storage, including repeated entries.
function matchLines(before: string[], after: string[], oldOffset = 0, newOffset = 0): [number, number][] {
  if (!before.length || !after.length) return [];
  if (before.length === 1) {
    const index = after.indexOf(before[0]);
    return index < 0 ? [] : [[oldOffset, newOffset + index]];
  }
  const middle = Math.floor(before.length / 2);
  const left = before.slice(0, middle);
  const right = before.slice(middle);
  const forward = matchLengths(left, after);
  const backward = matchLengths([...right].reverse(), [...after].reverse());
  let split = 0;
  for (let index = 1; index <= after.length; index++) {
    if (forward[index] + backward[after.length - index] > forward[split] + backward[after.length - split]) split = index;
  }
  return [
    ...matchLines(left, after.slice(0, split), oldOffset, newOffset),
    ...matchLines(right, after.slice(split), oldOffset + middle, newOffset + split),
  ];
}

function matchLengths(before: string[], after: string[]): Uint16Array {
  const lengths = new Uint16Array(after.length + 1);
  for (const line of before) {
    let diagonal = 0;
    for (let index = 1; index <= after.length; index++) {
      const previous = lengths[index];
      lengths[index] = line === after[index - 1] ? diagonal + 1 : Math.max(lengths[index], lengths[index - 1]);
      diagonal = previous;
    }
  }
  return lengths;
}

export function memoryChangeRecommendation(base: string, document: string): string {
  const before = base.split("\n");
  const after = document.split("\n");
  const changes: string[] = [];
  let oldStart = 0;
  let newStart = 0;
  for (const [oldEnd, newEnd] of [...matchLines(before, after), [before.length, after.length]]) {
    const removed = oldEnd - oldStart;
    const added = newEnd - newStart;
    if (removed || added) {
      changes.push(`@@ -${removed ? oldStart + 1 : oldStart},${removed} +${added ? newStart + 1 : newStart},${added} @@`);
      changes.push(...before.slice(oldStart, oldEnd).map((line) => `-${line}`));
      changes.push(...after.slice(newStart, newEnd).map((line) => `+${line}`));
    }
    oldStart = oldEnd + 1;
    newStart = newEnd + 1;
  }
  // Memory can contain Markdown fences. Keep the complete difference inside one block.
  const fence = "`".repeat(Math.max(3, ...[...changes.join("\n").matchAll(/`+/g)].map(([run]) => run.length + 1)));
  return `### Proposed workspace memory changes\n\nLines with \`-\` are removed. Lines with \`+\` are added. Changes show the old line followed by the new line. Unchanged lines are omitted.\n\n${fence}diff\n${changes.join("\n")}\n${fence}`;
}
