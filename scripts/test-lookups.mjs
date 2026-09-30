// Requires DATABASE_URL; reads only. Uses a short-lived local session, never a production login.
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
const require = createRequire(import.meta.url);
const secret = randomBytes(32).toString('hex');
const db = new PrismaClient();
let server;
try {
  const user = await db.user.findFirst({ where: { active: true }, select: { id: true } });
  assert(user, 'An active app user is needed');
  const payload = Buffer.from(JSON.stringify({ uid: user.id, exp: Math.floor(Date.now()/1000)+120 })).toString('base64url');
  const cookie = `dt_session=${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
  server = spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3210','-H','127.0.0.1'], { env: {...process.env, SESSION_SECRET:secret}, stdio:'ignore' });
  const base = 'http://127.0.0.1:3210';
  let ready=false;
  for(let i=0;i<60;i++) { try { await fetch(base+'/login'); ready=true; break; } catch { await new Promise(r=>setTimeout(r,500)); } }
  assert(ready, 'Local server did not start');
  assert.equal((await fetch(base+'/api/lookups?kind=customers&q=ab')).status,401);
  const get = path => fetch(base+path,{headers:{cookie}});
  assert.equal((await get('/api/lookups?kind=invalid&q=ab')).status,400);
  assert.deepEqual((await (await get('/api/lookups?kind=customers&q=a')).json()).results,[]);
  for (const kind of ['customers','equipment']) {
    const r = await get(`/api/lookups?kind=${kind}&q=di`);
    assert.equal(r.status,200);
    assert.match(r.headers.get('cache-control'),/no-store/);
    const {results}=await r.json();
    assert(results.length>0 && results.length<=20);
    assert(!JSON.stringify(results).includes('credit_limit'));
    assert(!JSON.stringify(results).includes('total_ar'));
    if(kind==='equipment') assert(results.every(r=>r.stock_number && 'branch' in r && 'serial_number' in r));
    const literal=await get(`/api/lookups?kind=${kind}&q=${encodeURIComponent("%' OR 1=1 --")}`);
    assert.equal(literal.status,200);
    assert.deepEqual((await literal.json()).results,[]);
  }
  console.log('PASS: authenticated lookups, unauthorized denial, validation, bounded results, no-cache, field isolation, literal SQL input. No records written.');
} finally { server?.kill(); await db.$disconnect(); }
