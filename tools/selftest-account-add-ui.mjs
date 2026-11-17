import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('../src/account-add-ui.js', import.meta.url), 'utf8');
let passed = 0;

async function test(name, run) {
  await run();
  passed++;
  console.log('通过：' + name);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

function fixture() {
  const nodes = new Map();
  const env = { cleanup: [], deviceReads: 0, captureReads: 0, focus: null, closed: 0 };
  env.node = id => {
    if (!nodes.has(id)) {
      const attributes = new Map();
      nodes.set(id, {
        id, open: false, hidden: false, disabled: false, textContent: '', className: '', dataset: {},
        setAttribute(key, value) { attributes.set(key, String(value)); },
        getAttribute(key) { return attributes.get(key); },
        showModal() { this.open = true; },
        close() { this.open = false; env.closed++; },
        focus() { env.focus = id; },
      });
    }
    return nodes.get(id);
  };
  const buttons = ['alipay', 'phone', 'wechat', 'douyin'].map(channel => {
    const button = env.node('choose-' + channel);
    button.dataset.loginChannel = channel;
    return button;
  });
  env.document = {
    querySelectorAll(selector) {
      assert.equal(selector, '#account-add-channels [data-login-channel]');
      return buttons;
    },
    querySelector(selector) {
      assert.equal(selector, '#account-add-channels [data-login-channel]');
      return buttons[0];
    },
  };
  env.clean = async channel => {
    env.cleanup.push(channel);
    return env.onClean ? env.onClean(channel) : true;
  };
  new Function('env', `
    const $ = env.node, document = env.document;
    const resetAlipayLogin = () => env.clean('alipay');
    const resetPhoneLogin = () => env.clean('phone');
    const resetAccountAddCapture = () => env.clean('capture');
    const refreshPhoneDevice = async () => { env.deviceReads++; };
    const pollCapture = async () => { env.captureReads++; };
    // 真实页面的支付宝首次渲染早于wizard初始化。
    accountAddChanged('alipay', 'idle');
    ${script}
    env.changed = accountAddChanged;
    env.channel = accountAddChannel;
  `)(env);
  env.open = () => env.node('account-add').onclick();
  env.choose = channel => env.node('choose-' + channel).onclick();
  env.click = name => env.node('account-add-' + name).onclick();
  return env;
}

await test('打开弹窗只显示渠道选择，首次渲染钩子不触发请求', async () => {
  const env = fixture();
  assert.equal(env.channel(), null);
  assert.equal(env.node('account-add-dialog').open, false);
  env.open();
  assert.equal(env.node('account-add-dialog').open, true);
  assert.equal(env.node('account-add-channels').hidden, false);
  assert.equal(env.node('account-add-back').hidden, true);
  assert.equal(env.node('account-add-done').hidden, true);
  assert.equal(env.node('account-add-step').textContent, '选择登录渠道');
  assert.deepEqual(env.cleanup, []);
  assert.equal(env.deviceReads, 0);
  assert.equal(env.captureReads, 0);
});

await test('选中各渠道只显示对应入口，采集按钮按渠道呈现', async () => {
  for (const channel of ['alipay', 'phone', 'wechat', 'douyin']) {
    const env = fixture();
    env.open();
    env.choose(channel);
    assert.equal(env.channel(), channel);
    assert.equal(env.node('account-add-channels').hidden, true);
    assert.equal(env.node('account-add-alipay').hidden, channel !== 'alipay');
    assert.equal(env.node('account-add-phone').hidden, channel !== 'phone');
    assert.equal(env.node('account-add-capture').hidden, !['wechat', 'douyin'].includes(channel));
    assert.equal(env.node('cap-start').hidden, channel !== 'wechat');
    assert.equal(env.node('cap-douyin').hidden, channel !== 'douyin');
    assert.deepEqual(env.cleanup, []);
    assert.equal(env.deviceReads, channel === 'phone' ? 1 : 0);
    assert.equal(env.captureReads, ['wechat', 'douyin'].includes(channel) ? 1 : 0);
    env.choose(channel === 'phone' ? 'alipay' : 'phone');
    assert.equal(env.channel(), channel, '完成当前渠道清理后才可重新选择');
  }
});

await test('微信和抖音采集后显示验证清理步骤，清理成功后显示完成', async () => {
  for (const channel of ['wechat', 'douyin']) {
    const env = fixture();
    env.open();
    env.choose(channel);
    env.changed(channel, 'captured', { busy: true });
    assert.equal(env.node('account-add-step').textContent, '验证账号并完成清理');
    assert.equal(env.node('account-add-done').hidden, true);
    assert.equal(env.node('account-add-close').disabled, true);
    env.changed(channel, 'saved');
    assert.equal(env.node('account-add-step').textContent, '添加完成');
    assert.equal(env.node('account-add-done').hidden, false);
    assert.equal(env.node('account-add-close').disabled, false);
  }
});

await test('角色选择和成功状态显示明确步骤，完成后由用户关闭', async () => {
  for (const [channel, phase] of [['alipay', 'captured'], ['phone', 'selecting']]) {
    const env = fixture();
    env.open();
    env.choose(channel);
    env.changed(channel, phase);
    assert.equal(env.node('account-add-step').textContent, '选择区服和角色');
    env.changed(channel, 'saved', { account: { title: '海风船长 · 海港1服' } });
    assert.equal(env.node('account-add-dialog').open, true);
    assert.equal(env.node('account-add-step').textContent, '添加完成');
    assert.equal(env.node('account-add-done').hidden, false);
    assert.equal(env.node('account-add-back').textContent, '继续添加账号');
    assert.equal(await env.click('done'), true);
    assert.deepEqual(env.cleanup, [channel]);
    assert.equal(env.node('account-add-dialog').open, false);
    assert.equal(env.focus, 'account-add');
  }
});

await test('请求在途阻止关闭和返回，结束后恢复操作并提示原因', async () => {
  const env = fixture();
  env.open();
  env.choose('phone');
  env.changed('phone', 'entry', { busy: true });
  assert.equal(env.node('account-add-close').disabled, true);
  assert.equal(env.node('account-add-back').disabled, true);
  assert.match(env.node('account-add-feedback').textContent, /请求正在处理/);
  assert.equal(await env.click('close'), false);
  assert.equal(await env.click('back'), false);
  assert.deepEqual(env.cleanup, []);
  env.changed('phone', 'selecting', { busy: false });
  assert.equal(env.node('account-add-close').disabled, false);
  assert.equal(await env.click('close'), true);
});

await test('关闭等待清理完成，重复关闭不会重复停止会话', async () => {
  const env = fixture();
  env.open();
  env.choose('alipay');
  const gate = deferred();
  env.onClean = () => gate.promise;
  const closing = env.click('close');
  assert.equal(env.node('account-add-dialog').open, true);
  assert.equal(env.node('account-add-close').disabled, true);
  assert.match(env.node('account-add-feedback').textContent, /清理临时会话/);
  env.changed('alipay', 'cancelled', { busy: false });
  assert.equal(env.node('account-add-close').disabled, true, '渠道回调不会提前解锁收尾');
  assert.equal(await env.click('close'), false);
  assert.deepEqual(env.cleanup, ['alipay']);
  gate.resolve(true);
  assert.equal(await closing, true);
  assert.equal(env.node('account-add-dialog').open, false);
  env.changed('alipay', 'captured');
  assert.equal(env.channel(), null);
  assert.equal(env.node('account-add-dialog').open, false);
});

await test('清理失败保留当前渠道和重试入口，清理成功后返回渠道列表', async () => {
  const env = fixture();
  env.open();
  env.choose('wechat');
  env.onClean = async () => { throw new Error('采集代理尚未恢复，请重试'); };
  assert.equal(await env.click('back'), false);
  assert.equal(env.channel(), 'wechat');
  assert.equal(env.node('account-add-dialog').open, true);
  assert.match(env.node('account-add-feedback').textContent, /代理尚未恢复/);
  assert.equal(env.node('account-add-back').disabled, false);
  env.onClean = async () => true;
  assert.equal(await env.click('back'), true);
  assert.equal(env.channel(), null);
  assert.equal(env.node('account-add-channels').hidden, false);
  assert.equal(env.node('account-add-dialog').open, true);
  assert.deepEqual(env.cleanup, ['capture', 'capture']);
  env.choose('phone');
  env.changed('wechat', 'saved');
  assert.equal(env.node('account-add-step').textContent, '登录验证');
});

await test('清理函数返回忙碌时不关闭弹窗且保留说明', async () => {
  const env = fixture();
  env.open();
  env.choose('douyin');
  env.onClean = async () => false;
  assert.equal(await env.click('close'), false);
  assert.equal(env.channel(), 'douyin');
  assert.equal(env.node('account-add-dialog').open, true);
  assert.match(env.node('account-add-feedback').textContent, /请稍候/);
});

await test('Escape沿用清理路径，继续添加也先清理上一渠道', async () => {
  const env = fixture();
  env.open();
  env.choose('alipay');
  let prevented = false;
  env.node('account-add-dialog').oncancel({ preventDefault() { prevented = true; } });
  await settle();
  assert.equal(prevented, true);
  assert.deepEqual(env.cleanup, ['alipay']);
  assert.equal(env.node('account-add-dialog').open, false);
  env.open();
  env.choose('phone');
  env.changed('phone', 'saved');
  assert.equal(await env.click('back'), true);
  assert.equal(env.channel(), null);
  assert.deepEqual(env.cleanup, ['alipay', 'phone']);
  env.choose('douyin');
  assert.equal(env.channel(), 'douyin');
});

await test('页面快捷入口进入指定渠道，支付宝只在首次打开生成二维码', async () => {
  for (const channel of ['alipay', 'phone', 'wechat']) {
    const env = fixture();
    let starts = 0;
    env.node('alipay-start').onclick = async () => { starts++; };
    env.click(channel + '-shortcut');
    assert.equal(env.channel(), channel);
    assert.equal(starts, channel === 'alipay' ? 1 : 0);
    env.click('alipay-shortcut');
    assert.equal(env.channel(), channel);
    assert.equal(starts, channel === 'alipay' ? 1 : 0);
  }
});

console.log(`添加账号弹窗自检通过 ${passed} 项`);
