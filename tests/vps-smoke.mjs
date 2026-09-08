import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

// Uses only a temporary database; Telegram credentials are deliberately empty.
const root = resolve('.next/standalone');
const temp = await mkdtemp(join(tmpdir(), 'bobar-vps-'));
await cp('public', join(root, 'public'), { recursive: true });
await mkdir(join(root, '.next/static'), { recursive: true });
await cp('.next/static', join(root, '.next/static'), { recursive: true });
await cp('drizzle', join(root, 'drizzle'), { recursive: true });
const databasePath = join(temp, 'inquiries.sqlite');
const base = 'http://127.0.0.1:3137';
let processHandle;
let output = '';
const start = async () => {
  processHandle = spawn(process.execPath, [join(root, 'server.js')], {
    cwd: root,
    env: { ...process.env, NODE_ENV:'production', PORT:'3137', HOSTNAME:'127.0.0.1',
      DATABASE_PATH:databasePath, SITE_ORIGIN:'https://bobar.by', TELEGRAM_BOT_TOKEN:'', TELEGRAM_CHAT_ID:'' },
    stdio:['ignore','pipe','pipe'],
  });
  processHandle.stdout.on('data', b => output += b);
  processHandle.stderr.on('data', b => output += b);
  for (let i=0; i<80; i++) {
    if (processHandle.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Standalone server did not start: '+output);
};
const stop = async () => {
  if (!processHandle || processHandle.exitCode !== null) return;
  await new Promise(resolve => { processHandle.once('exit',resolve); processHandle.kill('SIGTERM'); });
};
const payload = {name:'Тест',contact:'@bobar_test',message:'Тест локальной формы без отправки уведомлений.',requestId:crypto.randomUUID(),website:''};
const send = (body=payload, origin='https://bobar.by', ip='192.0.2.10') => fetch(base+'/api/inquiries',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Bobar-Client-IP':ip},body:JSON.stringify(body),
});
try {
  await start();
  const html=await (await fetch(base)).text();
  assert.match(html,/Строю сайты/);
  assert.match(html,/hero-mark/);
  for(const path of ['/favicon.svg','/projects/flowers.png','/robots.txt','/sitemap.xml']) assert.equal((await fetch(base+path)).status,200,path);
  assert.equal((await send(payload,'https://untrusted.test')).status,403);
  assert.equal((await send({...payload,contact:'invalid'})).status,400);
  assert.equal((await send({...payload,website:'spam'})).status,400);
  assert.equal((await send()).status,201);
  assert.equal((await send()).status,200);
  assert.equal((await send({...payload,message:'Другой текст той же заявки.'})).status,409);
  for(let i=0;i<4;i++) assert.equal((await send({...payload,requestId:crypto.randomUUID()})).status,201);
  assert.equal((await send({...payload,requestId:crypto.randomUUID()})).status,429);
  assert.equal((await send({...payload,requestId:crypto.randomUUID()},'https://bobar.by','192.0.2.11')).status,201);
  await stop();
  await start();
  assert.equal((await send()).status,200,'Idempotency survives restart');
  const db = new DatabaseSync(databasePath);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n,6);
  db.close();
  console.log('PASS: standalone HTML/assets, origin validation, form validation, persistence, idempotency, per-IP limit, restart. No real notifications sent.');
} finally {
  await stop();
  await rm(temp,{recursive:true,force:true});
}
