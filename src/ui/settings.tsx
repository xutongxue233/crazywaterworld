import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./button"
import { HelpTip } from "./help-tip"
import { Input } from "./input"
import { Switch } from "./switch"

export function settingsPage() {
  return renderToStaticMarkup(<div id="config-root">
    <div className="config-toolbar">
      <div className="config-owner"><div className="title-with-help"><strong id="config-account-name">当前账号的游戏配置</strong><HelpTip title="游戏配置">保存只更新当前账号的配置，不会启动挂机。已有挂机在下次检查时使用新设置；运行轮数在下次开始挂机时生效。</HelpTip></div><span id="config-state" role="status" aria-live="polite">尚未载入</span></div>
      <div className="config-actions">
        <Button id="config-import" type="button" size="sm" variant="outline" disabled>导入</Button>
        <Button id="config-export" type="button" size="sm" variant="outline" disabled>导出</Button>
        <Button id="config-save" type="submit" size="sm" form="config-form" aria-label="保存配置" disabled>保存</Button>
        <input id="config-file" type="file" accept=".json,application/json" hidden />
      </div>
    </div>
    <div className="config-message" id="config-message" role="alert" hidden />
    <div className="config-tabs" role="tablist" aria-label="配置分类">
      {[["base", "基地"], ["world", "世界"], ["heroes", "英雄"], ["daily", "日常与活动"]].map(([key, title], index) =>
        <button key={key} type="button" role="tab" id={"config-tab-" + key} data-config-tab={key} aria-controls={"config-panel-" + key} aria-selected={index === 0} tabIndex={index === 0 ? 0 : -1}>{title}</button>
      )}
    </div>
    <form id="config-form" noValidate>
      <div id="config-fields" className="config-sheet"><p className="config-empty">载入当前账号后即可设置。</p></div>
    </form>
    <div className="config-foot">
      <Button id="config-reload" type="button" size="sm" variant="ghost" aria-label="重新载入已保存配置" disabled>重新载入</Button>
      <span id="config-saved-time" />
    </div>
    <section className="config-preview" aria-labelledby="config-preview-title">
      <div className="config-preview-head"><div className="title-with-help"><h3 id="config-preview-title">执行预览</h3><HelpTip title="只读预览">按当前草稿读取真实状态，只计算计划，不消耗资源。计划是当前快照，执行前仍会重新检查条件。基地、万吨、英雄、日常、联盟/城战与锻造都可选择；活动只展示开放状态，运行安排不需要连接。</HelpTip></div><div className="config-preview-controls"><label htmlFor="config-preview-scope">范围</label><select id="config-preview-scope" aria-label="预览范围" className="config-select" defaultValue="current"><option value="current">当前分类</option><option value="base">基地全部项目</option><option value="world">万吨巨轮</option><option value="radar">联盟情报</option><option value="pirateHunt">海盗首杀</option><option value="pirateSweep">海盗日常扫荡</option><option value="worldBoss">世界Boss首战</option><option value="cityWar">联盟/城战</option><option value="forge">装备锻造</option><option value="heroes">英雄养成</option><option value="daily">日常任务与领奖</option><option value="activity">活动状态（只读）</option><option value="fleetDispatch">舰队调度（只读）</option><option value="runtime">运行安排（只读）</option></select><Button id="config-preview" type="button" size="sm" variant="outline" aria-label="只读预览计划" disabled>只读预览</Button></div></div>
      <div id="config-usage" />
      <div id="config-preview-result" aria-live="polite" />
    </section>
    <section className="config-compat-settings" aria-label="连接与通知设置">
      <h3>连接与通知</h3>
      <form id="reconnect-form" className="settings-form">
        <div className="task-setting"><label htmlFor="reconnect-enabled">掉线后自动重连</label><Switch id="reconnect-enabled" className="p-0" /></div>
        <div className="bar"><label htmlFor="reconnect-base">首次间隔（秒）</label><Input id="reconnect-base" type="number" min="1" max="3600" step="1" required className="w-24" />
          <label htmlFor="reconnect-max">最长间隔（秒）</label><Input id="reconnect-max" type="number" min="1" max="86400" step="1" required className="w-24" />
          <label htmlFor="reconnect-attempts">最多次数（0不限）</label><Input id="reconnect-attempts" type="number" min="0" max="100000" step="1" required className="w-24" /></div>
        <div className="bar"><label htmlFor="reconnect-kicked">被顶号后</label><select id="reconnect-kicked" className="settings-select"><option value="stop">停止挂机并通知</option><option value="retry">等待后自动重连</option></select>
          <label htmlFor="reconnect-kicked-minutes">等待（分钟）</label><Input id="reconnect-kicked-minutes" type="number" min="1" max="1440" step="1" required className="w-24" /><Button id="reconnect-save" type="submit" variant="outline">保存</Button></div>
        <p className="dim" id="reconnect-hint" role="status" />
      </form>
      <form id="notify-form" className="settings-form">
        <div className="bar"><label htmlFor="notify-webhook">Webhook 地址</label><Input id="notify-webhook" type="url" placeholder="留空表示不发送" className="settings-url" />
          <label htmlFor="notify-format">格式</label><select id="notify-format" className="settings-select"><option value="generic">通用 JSON</option><option value="wecom">企业微信、钉钉</option><option value="feishu">飞书</option></select></div>
        <div id="notify-events" className="task-grid" />
        <div className="bar"><Button id="notify-save" type="submit" variant="outline">保存</Button><Button id="notify-test" type="button" variant="outline">发送测试通知</Button></div>
        <p className="dim" id="notify-hint" role="status" />
      </form>
    </section>
    <template id="config-switch-template"><button type="button" role="switch" aria-checked="false" data-state="unchecked" className="config-switch"><span className="config-switch-track" aria-hidden="true"><span className="config-switch-thumb" /></span></button></template>
  </div>)
}
