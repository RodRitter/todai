import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { Runner } from './execution-service.ts';

export function createCodexRunner(executable = 'codex'): Runner {
  return async ({ run, task, workspace, onStart, signal }) => {
    const directory = await mkdtemp(join(tmpdir(), 'todai-handover-'));
    const output = join(directory, 'handover.txt');
    const prompt = [
      run.profile.instructions,
      `Task: ${task.title}\n\n${task.description}`,
      'Previous task comments (chronological):',
      ...(task.comments ?? []).map(comment => `${comment.createdAt}\n${comment.body}`),
      'Work in this project workspace. Finish with a handover summarizing changes, verification, and any unfinished work.',
    ].join('\n\n');
    let runnerPid: number | undefined;
    let stopped = false;
    const stop = () => {
      if (!runnerPid) return;
      // Kill the entire group, including commands launched by Codex. Never touch workspace files.
      try { process.kill(-runnerPid, 'SIGKILL'); stopped = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    };
    try {
      signal.throwIfAborted();
      await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, ['exec', '--cd', workspace, '--model', run.profile.model,
          '--config', `model_reasoning_effort=${JSON.stringify(run.profile.effort)}`,
          '--config', 'approval_policy="never"', '--sandbox', run.profile.permissions,
          '--skip-git-repo-check', '--ephemeral', '--color', 'never', '--output-last-message', output, '-'],
        { cwd: workspace, detached: true, stdio: ['pipe', 'ignore', 'pipe'] });
        runnerPid = child.pid;
        let startError: unknown;
        signal.addEventListener('abort', stop, { once: true });
        if (signal.aborted) stop();
        let diagnostic = '';
        child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
        child.on('error', error => reject(new Error(`Could not launch Codex CLI: ${error.message}`)));
        child.stdin.on('error', () => { /* Exit/error events report a closed input pipe. */ });
        child.on('close', (code, exitSignal) => {
          if (startError) reject(startError);
          else if (signal.aborted) reject(new Error('Codex CLI was interrupted.'));
          else if (code === 0) resolve();
          else reject(new Error(`Codex CLI exited ${exitSignal ? `with signal ${exitSignal}` : `with code ${code}`}.${diagnostic ? `\n${diagnostic.trim()}` : ''}`));
        });
        if (child.pid) {
          try { onStart(child.pid); }
          catch (error) { startError = error; stop(); }
        }
        child.stdin.end(prompt);
      });
      const summary = (await readFile(output, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
      })).trim();
      if (!summary) throw new Error('Codex CLI finished without a handover. Check the task before retrying.');
      return summary;
    } finally {
      signal.removeEventListener('abort', stop);
      // The CLI's close event alone does not guarantee its subprocesses have exited.
      while (stopped && runnerPid && processGroupExists(runnerPid)) await setTimeout(20);
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function processGroupExists(pid: number) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}
