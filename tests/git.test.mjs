import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, applyPatch, collectWorkspacePatch, validatePatch } from '../src/core/git.mjs';

async function repo(){ const d=fs.mkdtempSync(path.join(os.tmpdir(),'gauntlet-git-')); await execFile('git',['init','-q'],{cwd:d}); await execFile('git',['config','user.email','test@example.com'],{cwd:d}); await execFile('git',['config','user.name','Test'],{cwd:d}); fs.writeFileSync(path.join(d,'a.txt'),'one\n'); await execFile('git',['add','.'],{cwd:d}); await execFile('git',['commit','-qm','init'],{cwd:d}); return d; }

test('patch mode applies checked safe diff', async () => { const d=await repo(); const patch='diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-one\n+two\n'; const paths=await applyPatch(d,patch,{}); assert.ok(paths.includes('a.txt')); assert.equal(fs.readFileSync(path.join(d,'a.txt'),'utf8'),'two\n'); });
test('patch blocks credential-like paths', () => assert.throws(()=>validatePatch('diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n@@ -0,0 +1 @@\n+x=y\n',{}),/blocked/));
test('workspace patch includes staged and unstaged changes', async () => { const d=await repo(); fs.writeFileSync(path.join(d,'a.txt'),'two\n'); await execFile('git',['add','a.txt'],{cwd:d}); fs.writeFileSync(path.join(d,'b.txt'),'new\n'); const diff=await collectWorkspacePatch(d); assert.match(diff,/a.txt/); assert.match(diff,/b.txt/); });
