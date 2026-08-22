import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { invokeOpenAIResponses } from '../src/adapters/openai-responses.mjs';
import { invokeOpenAIChat } from '../src/adapters/openai-chat.mjs';
import { invokeAnthropicMessages } from '../src/adapters/anthropic-messages.mjs';
import { invokeGemini } from '../src/adapters/gemini.mjs';
import { authHeaders } from '../src/adapters/http.mjs';

async function server(handler) {
  const s = http.createServer(handler); s.listen(0,'127.0.0.1'); await once(s,'listening');
  return { s, base:`http://127.0.0.1:${s.address().port}` };
}
function json(res, obj){res.setHeader('content-type','application/json');res.end(JSON.stringify(obj));}

test('OpenAI Responses normalizes text', async () => {
  const {s,base}=await server((req,res)=>json(res,{output_text:'response-ok'}));
  try { const r=await invokeOpenAIResponses({provider:{baseUrl:`${base}/v1`,retries:0},agent:{id:'a',model:'m'},prompt:'p'}); assert.equal(r.text,'response-ok'); } finally {s.close();}
});
test('OpenAI Chat normalizes text', async () => {
  const {s,base}=await server((req,res)=>json(res,{choices:[{message:{content:'chat-ok'}}]}));
  try { const r=await invokeOpenAIChat({provider:{baseUrl:`${base}/v1`,retries:0},agent:{id:'a',model:'m'},prompt:'p'}); assert.equal(r.text,'chat-ok'); } finally {s.close();}
});
test('Anthropic Messages normalizes text', async () => {
  const {s,base}=await server((req,res)=>json(res,{content:[{type:'text',text:'anthropic-ok'}]}));
  try { const r=await invokeAnthropicMessages({provider:{baseUrl:base,retries:0,authMode:'none'},agent:{id:'a',model:'m'},prompt:'p'}); assert.equal(r.text,'anthropic-ok'); } finally {s.close();}
});
test('Gemini normalizes text', async () => {
  const {s,base}=await server((req,res)=>json(res,{candidates:[{content:{parts:[{text:'gemini-ok'}]}}]}));
  try { const r=await invokeGemini({provider:{baseUrl:base,retries:0},agent:{id:'a',model:'m'},prompt:'p'}); assert.equal(r.text,'gemini-ok'); } finally {s.close();}
});
test('custom header auth supports Azure-style API key', () => {
  process.env.TEST_AZURE_KEY='abc';
  const h=authHeaders({apiKeyEnv:'TEST_AZURE_KEY',authMode:'header',authHeaderName:'api-key'});
  assert.equal(h['api-key'],'abc'); assert.equal(h.authorization,undefined);
  delete process.env.TEST_AZURE_KEY;
});
