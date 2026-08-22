import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureInside, safeSlug } from './utils.mjs';

export function execFile(command, args, { cwd, env = process.env, timeoutMs = 120000, allowCodes = [0] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (!allowCodes.includes(code)) return reject(new Error(`${command} ${args.join(' ')} failed (${code ?? signal}): ${stderr.trim()}`));
      resolve({ code, signal, stdout, stderr });
    });
  });
}

export async function assertGitRepo(cwd) {
  const r = await execFile('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  if (r.stdout.trim() !== 'true') throw new Error(`Workspace is not a Git work tree: ${cwd}`);
}

export async function gitStatus(cwd) {
  return (await execFile('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd })).stdout;
}

export async function gitDiff(cwd) {
  const unstaged = (await execFile('git', ['diff', '--binary', '--no-ext-diff', '--', '.'], { cwd })).stdout;
  const staged = (await execFile('git', ['diff', '--cached', '--binary', '--no-ext-diff', '--', '.'], { cwd })).stdout;
  return `${staged}${unstaged}`;
}

export async function untrackedFiles(cwd) {
  const out = (await execFile('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd })).stdout;
  return out.split('\0').filter(Boolean);
}

export async function collectWorkspacePatch(cwd, maxUntrackedBytes = 2_000_000) {
  let patch = await gitDiff(cwd);
  for (const rel of await untrackedFiles(cwd)) {
    const abs = ensureInside(cwd, rel, 'untracked file');
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > maxUntrackedBytes) continue;
    const r = await execFile('git', ['diff', '--no-index', '--binary', '--', '/dev/null', rel], { cwd, allowCodes: [0, 1] });
    patch += r.stdout;
  }
  return patch;
}

export function extractPatch(text) {
  const value = String(text || '');
  const begin = value.indexOf('BEGIN_GAUNTLET_PATCH');
  const end = value.indexOf('END_GAUNTLET_PATCH');
  if (begin >= 0 && end > begin) return value.slice(begin + 'BEGIN_GAUNTLET_PATCH'.length, end).trim();
  const fenced = value.match(/```(?:diff|patch)\s*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const idx = value.indexOf('diff --git ');
  if (idx >= 0) return value.slice(idx).trim();
  return '';
}

export function patchPaths(patch) {
  const paths = new Set();
  for (const line of String(patch).split(/\r?\n/)) {
    const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (m) { paths.add(m[1]); paths.add(m[2]); }
    const h = line.match(/^(?:---|\+\+\+) (?:a\/|b\/)?(.+)$/);
    if (h && h[1] !== '/dev/null') paths.add(h[1].split('\t')[0]);
  }
  return [...paths];
}

function blocked(rel, security = {}) {
  const norm = rel.replaceAll('\\', '/').replace(/^\.\//, '');
  const defaults = ['.git/', 'node_modules/', '.env', '.env.', '.pem', '.key', '.p12', '.pfx'];
  const blockedPatterns = [...defaults, ...(security.blockedPaths || [])];
  if (blockedPatterns.some((p) => p.endsWith('/') ? norm.startsWith(p) : norm === p || norm.includes(p))) return true;
  if (security.allowedPaths?.length && !security.allowedPaths.some((p) => norm === p || norm.startsWith(p.endsWith('/') ? p : `${p}/`))) return true;
  return false;
}

export function validatePatch(patch, security = {}) {
  if (!patch || !patch.includes('diff --git ')) throw new Error('No unified diff found in patch response');
  const paths = patchPaths(patch);
  if (!paths.length) throw new Error('Patch contains no file paths');
  for (const rel of paths) {
    if (path.isAbsolute(rel) || rel.includes('..')) throw new Error(`Unsafe patch path: ${rel}`);
    if (blocked(rel, security)) throw new Error(`Patch path blocked by security policy: ${rel}`);
  }
  return paths;
}

export async function applyPatch(cwd, patch, security = {}) {
  const paths = validatePatch(patch, security);
  const dir = path.join(cwd, '.gauntlet', 'patches');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${Date.now()}-${safeSlug(paths[0])}.patch`);
  fs.writeFileSync(filePath, patch.endsWith('\n') ? patch : `${patch}\n`);
  try {
    await execFile('git', ['apply', '--check', '--whitespace=nowarn', filePath], { cwd });
    await execFile('git', ['apply', '--whitespace=nowarn', filePath], { cwd });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
  return paths;
}

export async function currentHead(cwd) {
  return (await execFile('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim();
}

export async function createDetachedWorktree(cwd, name) {
  const tempRoot = path.join(os.tmpdir(), 'universal-gauntlet-worktrees');
  fs.mkdirSync(tempRoot, { recursive: true });
  const target = path.join(tempRoot, `${safeSlug(name)}-${Date.now()}`);
  await execFile('git', ['worktree', 'add', '--detach', target, 'HEAD'], { cwd });
  return target;
}

export async function removeWorktree(cwd, target) {
  await execFile('git', ['worktree', 'remove', '--force', target], { cwd, allowCodes: [0, 128] });
}
