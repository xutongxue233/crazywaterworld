import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTraceLog, emitDiagnostic, traceJson } from '../src/trace-log.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-trace-log-'));
const file = path.join(dir, 'protocol.log');
const log = createTraceLog(file, { maxBytes: 1024 });
log.write('a'.repeat(700) + '\n');
log.write('b'.repeat(700) + '\n');
log.write('c'.repeat(700) + '\n');
await log.close();
const files = [file, file + '.1'];
assert.deepEqual(log.files, files);
for (const target of files) {
  const stat = fs.statSync(target);
  assert(stat.size > 0 && stat.size <= 1024, target + ' must stay within the size limit');
}
assert.match(fs.readFileSync(file, 'utf8'), /^c+$/m);
assert.match(fs.readFileSync(file + '.1', 'utf8'), /^b+$/m);

const oversized = path.join(dir, 'oversized.log');
fs.writeFileSync(oversized, 'o'.repeat(4096));
const trimmed = createTraceLog(oversized, { maxBytes: 1024 });
trimmed.write('z\n');
await trimmed.close();
assert(fs.statSync(oversized).size <= 1024);
assert.equal(fs.statSync(oversized).size, 2);

const empty = createTraceLog(path.join(dir, 'empty.log'), { maxBytes: 1024 });
assert.equal(fs.existsSync(path.join(dir, 'empty.log')), false, 'lazy: no file before the first write');
await empty.close();

const largeFile = path.join(dir, 'large-record.log');
const large = createTraceLog(largeFile, { maxBytes: 1024 });
large.write('舰队状态'.repeat(1024));
await large.close();
assert(fs.statSync(largeFile).size <= 1024, '单条超大回包也不能突破大小上限');
assert.match(fs.readFileSync(largeFile, 'utf8'), /日志过长，已截断/);
assert.doesNotMatch(fs.readFileSync(largeFile, 'utf8'), /\ufffd/);

const resumedFile = path.join(dir, 'resumed.log');
fs.writeFileSync(resumedFile, '旧文件\n');
fs.writeFileSync(resumedFile + '.1', '最新文件\n');
fs.utimesSync(resumedFile, 1000, 1000);
fs.utimesSync(resumedFile + '.1', 2000, 2000);
const resumed = createTraceLog(resumedFile, { maxBytes: 1024 });
resumed.write('重启后\n');
await resumed.close();
assert.equal(fs.readFileSync(resumedFile, 'utf8'), '旧文件\n');
assert.equal(fs.readFileSync(resumedFile + '.1', 'utf8'), '最新文件\n重启后\n');

const cyclic = { uid: 9007199254740993n, access_token: 'secret-token', nested: { password: 'secret-password' } };
cyclic.self = cyclic;
const redacted = traceJson({ cyclic, login: { data: 'secret-login' }, error: new Error('token=secret-error'),
  url: 'https://name:secret-url@example.test/path?openId=secret-open&sign=secret-sign',
  text: 'Authorization: Bearer secret-bearer' });
assert.doesNotMatch(redacted, /secret-/);
assert.match(redacted, /9007199254740993/);
assert.match(redacted, /循环引用/);
assert.doesNotThrow(() => emitDiagnostic({ emit() { throw new Error('observer failed'); } }, 'fleet-settlement', {}));
const blocked = path.join(dir, 'blocked');
fs.writeFileSync(blocked, '普通文件');
const failed = createTraceLog(path.join(blocked, 'protocol.log'));
assert.doesNotThrow(() => failed.write('日志目录不可写'));
await failed.close();

// 从真实控制台接线验证日志完整性，所有游戏通信均由假客户端处理。
const dataDir = path.join(dir, 'console');
fs.mkdirSync(dataDir);
process.env.CW_DATA_DIR = dataDir;
process.env.CW_CONFIG_PACK = path.join(dataDir, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');
const { GameClient } = await import('../src/client.mjs');
const { saveStore } = await import('../src/accounts.mjs');
const { createConsole } = await import('../src/server.mjs');
Object.defineProperty(GameClient.prototype, 'connected', { get() { return this.state === 'READY'; } });
GameClient.prototype.connect = async function () {
  this.state = 'READY';
  return { playerInfo: { playerId: 9001, worldId: 1001, nickname: '日志测试', level: 1 } };
};
GameClient.prototype.send = () => {};
GameClient.prototype.request = async () => ({ fleets: [], items: [], records: [] });
GameClient.prototype.stop = function () { this.state = 'STOPPED'; this.emit('close', {}); };
saveStore({ activeId: 'trace-test', accounts: [{ id: 'trace-test', url: 'ws://invalid.invalid', login: {}, automation: { enabled: false } }] });
const webEntries = [];
const app = createConsole({ port: 0, onLog: entry => webEntries.push(entry) });
try {
  const root = await app.listen();
  const response = await fetch(root + '/api/connect?account=trace-test', { method: 'POST', body: '{}' });
  assert.equal(response.status, 200, await response.text());
  const session = app.sessions.get('trace-test');
  const fleets = Array.from({ length: 20 }, (_, index) => ({ buildingId: (index + 1) + '远征船', state: 0, curGridIdx: 123456 + index }));
  const webBefore = webEntries.length;
  session.client.emit('message', { name: 'MyFleetsResponse', seq: 7, body: { fleets } });
  session.client.emit('frame', { dir: 'out', name: 'TreasureLootSendFleetsRequest', seq: 8, bytes: Buffer.alloc(32), body: { uid: 5001, fleetBuildingIds: ['20远征船'] } });
  emitDiagnostic(session.client, 'treasure-plan', { notes: ['首杀占用待核对'], fleets, accessToken: 'secret-plan' });
  assert.equal(webEntries.length, webBefore, '完整协议与诊断事件只写文件');
  const business = app.emit(session, 'warn', '舰队暂不派遣', { diagnostic: 'token=secret-detail', request: 'TreasureLootSendFleetsRequest' });
  assert.equal(webEntries.at(-1), business, '网页和终端仍接收原业务日志对象');
  assert.equal(business.detail, 'token=secret-detail');
  const trace = fs.readFileSync(path.join(dataDir, 'protocol.log'), 'utf8');
  assert.match(trace, /\[MyFleetsResponse\] seq=7 .*20远征船/);
  assert.match(trace, /-> \[TreasureLootSendFleetsRequest\] seq=8 32B .*5001.*20远征船/);
  assert.match(trace, /diagnostic .*treasure-plan/);
  assert.match(trace, /business .*舰队暂不派遣/);
  assert.doesNotMatch(trace, /secret-/);
  const writeSync = fs.writeSync;
  try {
    fs.writeSync = () => { throw new Error('模拟磁盘写入失败'); };
    assert.doesNotThrow(() => app.emit(session, 'info', '磁盘失败后网页仍输出'));
    assert.equal(webEntries.at(-1).message, '磁盘失败后网页仍输出');
  } finally { fs.writeSync = writeSync; }
} finally {
  await app.close();
}
console.log('protocol log selftest ok: bounded files, restart rotation, credential redaction, complete fleet packets, diagnostic isolation and disk failures');
