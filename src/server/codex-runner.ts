import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Runner } from './execution-service.ts';

export function createCodexRunner(executable = 'codex'): Runner {
  return async ({ run, task, workspace, onStart }) => {
    const directory = await mkdtemp(join(tmpdir(), 'todai-handover-'));
    const output = join(directory, 'handover.txt');
    const prompt = [
      run.profile.instructions,
      `Task: ${task.title}\n\n${task.description}`,
      'Previous task comments (chronological):',
      ...(task.comments ?? []).map(comment => `${comment.createdAt}\n${comment.body}`),
      'Work in this project workspace. Finish with a handover summarizing changes, verification, and any unfinished work.',
    ].join('\n\n');
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, ['exec', '--cd', workspace, '--model', run.profile.model,
          '--config', `model_reasoning_effort=${JSON.stringify(run.profile.effort)}`,
          '--config', 'approval_policy="never"', '--sandbox', run.profile.permissions,
          '--skip-git-repo-check', '--ephemeral', '--color', 'never', '--output-last-message', output, '-'],
        { cwd: workspace, detached: true, stdio: ['pipe', 'ignore', 'pipe'] });
        let diagnostic = '';
        child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
        child.on('error', error => reject(new Error(`Could not launch Codex CLI: ${error.message}`)));
        child.stdin.on('error', () => { /* Exit/error events report a closed input pipe. */ });
        child.on('close', (code, signal) => {
          if (code === 0) resolve();
          else reject(new Error(`Codex CLI exited ${signal ? `with signal ${signal}` : `with code ${code}`}.${diagnostic ? `\n${diagnostic.trim()}` : ''}`));
        });
        if (child.pid) {
          try { onStart(child.pid); }
          catch (error) { process.kill(-child.pid, 'SIGKILL'); reject(error); }
        }
        child.stdin.end(prompt);
      });
      const summary = (await readFile(output, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
      })).trim();
      if (!summary) throw new Error('Codex CLI finished without a handover. Check the task before retrying.');
      return summary;
    } finally { await rm(directory, { recursive: true, force: true }); }
  };
}
