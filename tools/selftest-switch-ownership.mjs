// 挂机只管理自动执行入口，细项、策略、权限与参数保留在游戏配置。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-switch-ownership-'));
process.env.CW_DATA_DIR = directory;
process.env.CW_CONFIG_PACK = path.join(directory, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, JSON.stringify([
  [1, 'FarmlandPlantCfg', { data: [{ id: '小麦', material: ['小麦种子', 1], time: 60, produceNum: 5 }] }],
]));
const { automationControls, idleAutomationControls, automationControlView, setAutomationControl } = await import('../src/automation-controls.mjs');
const { defaultSettings, validateSettings, saveAutomationSettings, loadAutomationSettings, settingsUiRules } = await import('../src/automation-settings.mjs');
const { automationTasks } = await import('../src/automation.mjs');
const { idlePanel } = await import('../src/ui/dist/console.mjs');
const script = fs.readFileSync(new URL('../src/settings-ui.js', import.meta.url), 'utf8');
const definitions = script.slice(0, script.indexOf('function configGet('));
const staticGroups = new Function(definitions + '\nreturn configGroups;')();
const renderStart = script.indexOf('function configRender()');
const modelStart = script.indexOf('  const groups =', renderStart), modelEnd = script.indexOf('  const scopeSelect=', modelStart);
assert(modelStart > renderStart && modelEnd > modelStart);
const configGroups = new Function('data', definitions + '\nconfigEditor.data=data;\n' + script.slice(modelStart, modelEnd) + '\nreturn groups;')({ tasks: automationTasks, rules: settingsUiRules() });
const configFields = configGroups.flatMap(group => group.fields), configKeys = new Set(configFields.map(field => field.key));
const read = (value, key) => key.split('.').reduce((object, part) => object?.[part], value);
const write = (value, key, enabled) => {
  const parts = key.split('.'), field = parts.pop();
  parts.reduce((object, part) => object[part], value)[field] = enabled;
};
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log('通过：' + name); };

try {
  await check('挂机只显示34个自动执行入口，详细开关与参数在配置且两页没有重复字段', () => {
    const html = idlePanel(automationControls), rendered = [...html.matchAll(/data-auto-task="([^"]+)"/g)].map(match => match[1]);
    const idleKeys = idleAutomationControls.map(control => control.key), movedFields = idleAutomationControls.flatMap(control => control.fields);
    assert.equal(idleKeys.length, 34, '保留原有紧凑模块和独立任务入口');
    assert.equal(rendered.length, new Set(rendered).size, '每个入口只显示一次');
    assert.deepEqual(new Set(rendered), new Set(idleKeys));
    assert.deepEqual(new Set(settingsUiRules().controlFields), new Set(movedFields));
    for (const field of movedFields) assert(!configKeys.has(field), field + ' 主控不重复出现在配置');
    for (const control of idleAutomationControls) {
      assert(['基地', '世界', '英雄', '日常与活动'].includes(control.idleGroup), control.key);
      assert(configGroups.some(group => group.id === control.configTarget), control.key + ' 配置入口存在');
    }
    const scheduledInIdle = new Set(['loop.rounds', 'loop.everySeconds']);
    for (const group of staticGroups) for (const field of group.fields) {
      const locations = Number(movedFields.includes(field.key)) + Number(configKeys.has(field.key)) + Number(scheduledInIdle.has(field.key));
      assert.equal(locations, 1, field.key + ' 应有且仅有一个编辑位置');
    }
    assert(html.includes('id="loop-rounds"') && html.includes('id="loop-every"'));
  });

  await check('执行细项、资源权限、策略与预算没有被搬到挂机', () => {
    const details = ['building.collect', 'building.upgrade', 'factory.produce', 'factory.demandFirst',
      'farm.harvest', 'farm.autoPlant', 'farm.customPlant', 'gather.fishing', 'gather.keyOpen',
      'museum.enabled', 'museum.upgrade', 'schedule.museumCollect', 'radar.enabled', 'schedule.radarRepair',
      'heroes.level', 'heroes.star', 'heroes.skill', 'heroes.universal', 'resources.allowDiamonds',
      'alliance.autoHelp', 'silicon.fleets.0.enabled', 'silicon.fleets.1.huntEnabled',
      'merchant.autoSpeedUp', 'merchant.autoBuyPointers', 'merchant.autoUpgrade'];
    const idleFields = new Set(idleAutomationControls.flatMap(control => control.fields));
    for (const key of details) {
      assert(!idleFields.has(key), key + ' 不属于挂机主控');
      assert.equal(configFields.find(field => field.key === key)?.kind, 'switch', key + ' 仍能在配置中编辑');
    }
    for (const key of ['building.maxUpgrades', 'factory.keepStock', 'farm.crops', 'gather.targetLevel',
      'treasure.fleetIds', 'merchant.pointerDailyDiamondLimit', 'resources.diamondDailyLimit', 'heroes.heroIds']) {
      assert(configKeys.has(key), key + ' 参数应保留'); assert(!idleFields.has(key));
    }
  });

  await check('关闭基地模块只暂停主控，混合细项和参数往返不变', () => {
    const original = defaultSettings();
    original.building.collect = false; original.building.upgrade = true; original.building.maxUpgrades = 7;
    original.factory.produce = false; original.factory.keepStock = 321;
    original.farm.harvest = false; original.farm.autoPlant = false; original.farm.customPlant = true;
    original.farm.crops = [{ id: '小麦', target: 73 }];
    original.gather.fishing = true; original.gather.diving = false; original.gather.targetLevel = 5;
    original.museum.enabled = true; original.museum.upgrade = false; original.museum.factor = 3;
    original.schedule.museumCollect = false; original.schedule.museumExplore = true;
    for (const key of ['building.enabled', 'factory.enabled', 'farm.enabled', 'gather.enabled', 'museum.runEnabled']) {
      const before = structuredClone(original); write(before, key, true);
      const frozen = structuredClone(before), expected = structuredClone(before); write(expected, key, false);
      const off = setAutomationControl(before, key, false);
      assert.deepEqual(off, expected, key + ' 不能改变细项或参数');
      assert.deepEqual(setAutomationControl(off, key, true), frozen, key + ' 重新开启恢复原执行选择');
      assert.deepEqual(before, frozen, '不得修改传入对象');
    }
  });

  await check('英雄自动养成只用一个入口同步两层主控，保留具体养成选择', () => {
    const hero = idleAutomationControls.find(control => control.key === 'heroes.enabled');
    assert(hero); assert.deepEqual(new Set(hero.fields), new Set(['heroes.enabled', 'loop.heroes']));
    assert(!idleAutomationControls.some(control => control.key === 'loop.heroes'));
    assert(!configKeys.has('heroes.enabled') && !configKeys.has('loop.heroes'));
    for (const [enabled, auto] of [[false, false], [true, false], [false, true], [true, true]]) {
      const original = defaultSettings(); original.heroes.enabled = enabled; original.loop.heroes = auto;
      original.heroes.level = false; original.heroes.star = true; original.heroes.skill = false;
      original.heroes.heroIds = ['hero-fixture']; original.heroes.targetLevel = 23;
      const before = structuredClone(original);
      assert.equal(automationControlView(original).find(control => control.key === hero.key).enabled, enabled && auto);
      for (const next of [true, false]) {
        const expected = structuredClone(original); expected.heroes.enabled = expected.loop.heroes = next;
        assert.deepEqual(setAutomationControl(original, hero.key, next), expected);
      }
      assert.deepEqual(original, before);
    }
  });

  await check('真实挂机接口保存模块与英雄组合主控，配置细项保持独立且不启动游戏', async () => {
    const { saveStore } = await import('../src/accounts.mjs');
    saveStore({ version: 1, activeId: 'switch-a', accounts: ['switch-a', 'switch-b'].map(id => ({ id, label: '开关测试', url: 'ws://127.0.0.1:1', login: {}, automation: { paused: true } })) });
    const initial = defaultSettings();
    initial.farm.enabled = true; initial.farm.autoPlant = false; initial.farm.customPlant = true;
    initial.farm.crops = [{ id: '小麦', target: 73 }]; initial.building.maxUpgrades = 7;
    initial.museum.enabled = true; initial.museum.upgrade = false; initial.factory.keepStock = 123;
    initial.heroes.level = false; initial.heroes.star = true; initial.heroes.skill = false;
    initial.heroes.enabled = true; initial.loop.heroes = false;
    saveAutomationSettings('switch-a', validateSettings(initial), { revision: 0 });
    const { createConsole } = await import('../src/server.mjs');
    const app = createConsole({ port: 0 }); await app.listen();
    const api = async (route, body, account = 'switch-a') => {
      const response = await fetch('http://127.0.0.1:' + app.server.address().port + '/api/' + route + '?account=' + account, {
        method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    };
    try {
      const other = await api('settings', null, 'switch-b');
      let saved = (await api('settings')).data;
      const firstRevision = saved.revision;
      for (const [key, enabled] of [['building.enabled', false], ['farm.enabled', false], ['museum.runEnabled', false], ['heroes.enabled', true], ['heroes.enabled', false]]) {
        const control = idleAutomationControls.find(item => item.key === key), expected = structuredClone(saved.settings);
        for (const field of control.fields) write(expected, field, enabled);
        // 旧版 schedule.farm 是同一农田主控的兼容镜像，不是独立细项。
        if (key === 'farm.enabled') expected.schedule.farm = enabled;
        const result = await api('loop/control', { confirm: true, key, enabled, revision: saved.revision });
        assert.equal(result.status, 200, key + ': ' + JSON.stringify(result.data));
        assert.equal(result.data.running, false); assert.equal(result.data.controls.find(item => item.key === key).enabled, enabled);
        saved = (await api('settings')).data;
        assert.deepEqual(saved.settings, expected, key + ' 只更改本模块主控');
        assert.deepEqual(loadAutomationSettings('switch-a').settings, expected, key + ' 应持久保存');
      }
      const configured = structuredClone(saved.settings);
      configured.heroes.level = true; configured.building.speedUp = false; configured.building.maxUpgrades = 9;
      const result = await api('settings', { confirm: true, settings: configured, revision: saved.revision });
      assert.equal(result.status, 200); assert.deepEqual(result.data.settings, configured);
      for (const key of ['heroes.enabled', 'loop.heroes', 'building.enabled', 'farm.enabled', 'museum.runEnabled']) assert.equal(read(result.data.settings, key), false, '配置细项不能重开 ' + key);
      assert.deepEqual((await api('settings', null, 'switch-b')).data.settings, other.data.settings);
      assert(!app.sessions.get('switch-a').client, '编辑设置不能连接游戏或开始挂机');
      const stale = await api('loop/control', { confirm: true, key: 'heroes.enabled', enabled: true, revision: firstRevision });
      assert.equal(stale.status, 400);
      assert.deepEqual((await api('settings')).data.settings, configured, '过期主控请求不能覆盖最新配置');
    } finally { await app.close(); }
  });
  console.log(`开关归属专项 ${passed}/${passed} 通过`);
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
