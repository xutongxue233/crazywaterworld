import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-auth-'));
process.env.CW_DATA_DIR = directory;
process.env.CW_CONFIG_PACK = path.join(directory, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');
const { createConsoleAuth } = await import('../src/console-auth.mjs');
const { createConsole } = await import('../src/server.mjs');
let time = Date.now();
const env = { CW_ADMIN_USERNAME: 'admin', CW_ADMIN_PASSWORD: 'test-password-123456' };
const authorize = createConsoleAuth({ directory, env, now: () => time });
const app = createConsole({ port: 0, protocol: {}, authorize });
try {
  const url = await app.listen();
  const request = (route, options = {}) => fetch(url + '/' + route, { redirect: 'manual', ...options });
  const login = (password = env.CW_ADMIN_PASSWORD) => request('auth/login', { method: 'POST', body: new URLSearchParams({ username: 'admin', password }) });
  assert.equal((await request('')).status, 303);
  for (const route of ['api/accounts', 'api/events', 'api/state', 'console-client.js']) {
    const response = await request(route);
    assert([401, 303].includes(response.status));
  }
  assert.equal((await request('api/accounts/alipay-login/start', { method: 'POST', body: '{"confirm":true}' })).status, 401);
  assert.equal((await request('login')).status, 200);
  assert.equal((await login('wrong')).status, 401);
  const success = await login();
  assert.equal(success.status, 303);
  const setCookie = success.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  assert.equal((await request('', { headers: { cookie } })).status, 200);
  assert.equal((await request('api/accounts', { headers: { cookie } })).status, 200);
  assert.equal((await request('api/accounts', { headers: { cookie: 'cw_console_session=fake' } })).status, 401);
  assert.equal((await request('auth/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.invalid' } })).status, 403);
  const stream = await request('api/events', { headers: { cookie, accept: 'text/event-stream' } });
  const reader = stream.body.getReader();
  await reader.read();
  assert.equal((await request('auth/logout', { method: 'POST', headers: { cookie } })).status, 303);
  await assert.rejects(async () => { while (!(await reader.read()).done) {} });
  assert.equal((await request('api/accounts', { headers: { cookie } })).status, 401);
  const nextCookie = (await login()).headers.get('set-cookie').split(';')[0];
  time += 13 * 3600000;
  assert.equal((await request('api/accounts', { headers: { cookie: nextCookie } })).status, 401);
  for (let i = 0; i < 5; i++) assert.equal((await login('wrong')).status, 401);
  assert.equal((await login()).status, 429);
  time += 16 * 60000;
  assert.equal((await login()).status, 303);
  const stored = fs.readFileSync(path.join(directory, 'console-admin.json'), 'utf8');
  assert(!stored.includes(env.CW_ADMIN_PASSWORD));
  assert.equal(fs.statSync(path.join(directory, 'console-admin.json')).mode & 0o777, 0o600);
  console.log('通过：页面、接口、资源及实时流鉴权，密码校验、Cookie、伪造会话、跨站拦截、退出撤销、会话过期、限流和密码哈希存储');
} finally {
  await app.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
