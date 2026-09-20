import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, FINANCE_USER: 'test-owner', FINANCE_PASSWORD: 'test-only-password-over-twenty-characters', GAS_WEB_APP_URL: 'https://invalid.example/exec', GAS_API_TOKEN: 'test-token-32-characters-never-used', OLLAMA_MODEL: '' };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3092'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try {
 let ready=false;
 for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:3092');if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready, 'authenticated server must start: '+logs);
 const origin='http://127.0.0.1:3092', authorization='Basic '+btoa(env.FINANCE_USER+':'+env.FINANCE_PASSWORD);
 const anon=await fetch(origin+'/api/finance');assert.equal(anon.status,401);assert.ok(anon.headers.get('cache-control')?.includes('no-store'));
 const bypass=await fetch(origin+'/api/finance',{headers:{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}});assert.equal(bypass.status,401);
 const authed=await fetch(origin,{headers:{authorization}});assert.equal(authed.status,200);const html=await authed.text();assert.equal(html.includes(env.GAS_API_TOKEN),false);assert.equal(html.includes(env.FINANCE_PASSWORD),false);
 const provider=await fetch(origin+'/api/finance',{headers:{authorization}});assert.equal(provider.status,503);assert.ok((await provider.json()).error.includes('HTTPS'));
 const write=await fetch(origin+'/api/finance',{method:'POST',headers:{authorization,'content-type':'application/json',origin},body:'{"action":"adjust_balance","amount":1}'});assert.equal(write.status,405);
 const cross=await fetch(origin+'/api/insights',{method:'POST',headers:{authorization,'content-type':'application/json',origin:'https://other.example'},body:'{}'});assert.equal(cross.status,403);
 const ai=await fetch(origin+'/api/insights',{method:'POST',headers:{authorization,'content-type':'application/json',origin},body:'{}'});assert.equal(ai.status,503);
 console.log('HTTP smoke: 7 checks passed (auth, bypass guard, no-store, no secret in HTML, bad provider, disabled writes, CSRF/AI unconfigured).');
} finally { const done=once(server,'exit'); server.kill('SIGTERM'); await done; }
