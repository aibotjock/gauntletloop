import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { renderWebUI } from '../src/browser/render.mjs';
import { verifyBrowserEvidence } from '../src/browser/verify.mjs';

const html=fs.readFileSync(new URL('./fixtures/webui/index.html',import.meta.url));
test('real Chromium WebUI evidence passes required desktop+mobile captures', async () => {
  const s=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html)}); s.listen(0,'127.0.0.1'); await once(s,'listening');
  const runDir=fs.mkdtempSync(path.join(os.tmpdir(),'gauntlet-browser-'));
  const config={verification:{webui:{enabled:true,routes:[{name:'home',path:'/'}],viewports:[{name:'desktop',width:1440,height:900,required:true},{name:'mobile',width:390,height:844,required:true}],interactions:[{name:'use',route:'home',steps:[{action:'fill',selector:'#q',value:'x'},{action:'click',selector:'#go'}]}],policy:{settleMs:10,keyboardTabs:2,failOnConsoleErrors:true,failOnRequestFailures:true,failOnHorizontalOverflow:true,failOnA11yHeuristics:true}}}};
  try { const r=await renderWebUI({workspace:runDir,config,runDir,targetUrl:`http://127.0.0.1:${s.address().port}`}); const v=verifyBrowserEvidence(r.manifestPath); assert.equal(v.passed,true,v.failures.join('\n')); assert.equal(v.recordCount,4); } finally { s.close(); }
});
