import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from '../src/core/git.mjs';
import { runGauntlet } from '../src/core/orchestrator.mjs';

async function repo(){ const d=fs.mkdtempSync(path.join(os.tmpdir(),'gauntlet-e2e-')); await execFile('git',['init','-q'],{cwd:d}); await execFile('git',['config','user.email','test@example.com'],{cwd:d}); await execFile('git',['config','user.name','Test'],{cwd:d}); fs.writeFileSync(path.join(d,'a.txt'),'one\n'); await execFile('git',['add','.'],{cwd:d}); await execFile('git',['commit','-qm','init'],{cwd:d}); return d; }

test('full loop: patch builder -> verify -> independent critic -> final critic', async () => {
  const d=await repo();
  const builder=path.join(d,'builder.mjs'), critic=path.join(d,'critic.mjs');
  fs.writeFileSync(builder,`console.log(String.raw\`BEGIN_GAUNTLET_PATCH\ndiff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-one\n+two\nEND_GAUNTLET_PATCH\`);`);
  fs.writeFileSync(critic,`console.log(JSON.stringify({verdict:'PASS',primaryGap:'',observableEvidence:['verification supplied'],prioritizedCorrections:[],regressionRisks:[],residualIssues:[]}));`);
  await execFile('git',['add','builder.mjs','critic.mjs'],{cwd:d}); await execFile('git',['commit','-qm','fixtures'],{cwd:d});
  const config={
    task:{objective:'change one to two',acceptanceCriteria:['a.txt contains two']},
    providers:{ bp:{id:'bp',type:'command',command:process.execPath,args:[builder],parser:'text'}, cp:{id:'cp',type:'command',command:process.execPath,args:[critic],parser:'text'} },
    agents:{ b:{id:'b',provider:'bp',model:'mock',mode:'patch',roles:['builder'],capabilities:[]}, c:{id:'c',provider:'cp',model:'mock',mode:'advisory',roles:['critic'],capabilities:[]} },
    workflow:{builder:'b',critics:['c'],maxRounds:2,requireIndependentCritic:true,requireCleanWorkspace:true},
    verification:{required:true,commands:[{name:'content',command:process.execPath,args:['-e',`const fs=require('fs');process.exit(fs.readFileSync('a.txt','utf8')==='two\\n'?0:1)`],required:true}],webui:{enabled:false}},
    security:{}
  };
  const result=await runGauntlet({config,workspace:d});
  assert.equal(result.verdict,'GAUNTLET PASSED'); assert.equal(fs.readFileSync(path.join(d,'a.txt'),'utf8'),'two\n');
});
