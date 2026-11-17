import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./button"
import { Card, CardAction, CardHeader, CardTitle, CardContent } from "./card"
import { Input } from "./input"
import { Switch } from "./switch"
import { HelpTip } from "./help-tip"
import { Badge } from "./badge"
import { DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { MessageCircle, Music2, Plus, QrCode, Smartphone, X } from "lucide-react"

function Panel({title, help, titleAfter, children}: {title: string; help?: string; titleAfter?: React.ReactNode; children: React.ReactNode}) {
  return <Card><CardHeader><CardTitle className="title-with-help">{title}{help && <HelpTip title={title}>{help}</HelpTip>}</CardTitle>{titleAfter && <CardAction className="row-span-1 self-center max-md:col-span-2 max-md:col-start-1 max-md:row-start-2 max-md:justify-self-start">{titleAfter}</CardAction>}</CardHeader><CardContent>{children}</CardContent></Card>
}

function Option({id, label, checked = false}: {id: string; label: string; checked?: boolean}) {
  return <div className="bar"><Switch id={id} data-local-switch="" defaultChecked={checked} className="p-0" /><label htmlFor={id}>{label}</label></div>
}

export function giftCodesPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="礼包兑换" help="每个账号独立排队，兑换请求逐个发送。账号登录失败或结果未知只停止该账号；任一账号遇到服务器限频时，同批尚未发送的账号全部停止，之后可重新提交。"><label htmlFor="gift-code-input">礼包码（换行或逗号分隔）</label>
      <textarea id="gift-code-input" rows={3} maxLength={12000} className="w-full" placeholder="每批最多100个" />
      <div className="bar"><Button type="button" variant="outline" size="sm" id="gift-load-initial">载入初始码</Button><span id="gift-code-initial-note" className="dim" role="status" /></div>
      <fieldset className="gift-accounts"><legend>兑换账号</legend>
        <div className="bar"><Button variant="outline" size="sm" id="gift-select-all">全选</Button><Button variant="outline" size="sm" id="gift-select-none">清空</Button><span id="gift-selected-count" className="dim" /></div>
        <div id="gift-account-list" className="gift-account-list" />
        <p className="dim">未连接的账号会自动登录，可能把正在玩的游戏顶下线，兑换后保持连接。已暂停的账号不能选择。</p>
      </fieldset>
      <div className="bar"><Button id="gift-code-start">开始兑换</Button><span id="gift-code-state" role="status" /></div></Panel>
    <Panel title="兑换记录"><div className="bar"><label htmlFor="gift-record-account">查看账号</label><select id="gift-record-account" /></div><div className="overflow-auto"><table><thead><tr>{['礼包码','状态','结果','时间'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody id="gift-code-history" /></table></div>
      <div className="bar"><Button variant="outline" id="gift-prev">上一页</Button><span id="gift-page" /><Button variant="outline" id="gift-next">下一页</Button></div></Panel>
  </div>)
}

export function overviewPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="运行概览" help="按功能分别查看当前进度与当前条件。这里只读展示；开关与参数在对应挂机配置中设置。">
      <div className="bar overview-task-filter"><Input id="overview-task-search" type="search" aria-label="查找运行状态" placeholder="功能名称或状态" /><label htmlFor="overview-task-filter">显示</label><select id="overview-task-filter" defaultValue="enabled"><option value="enabled">已开启</option><option value="issues">异常 / 受总控限制</option><option value="all">全部项目</option></select></div>
      <p id="overview-task-summary" className="dim" role="status">等待读取运行状态</p>
      <div id="overview-task-groups" />
    </Panel>
    <Panel title="世界概览" help="只读地图。移动位置按已同步起终点和行军时间推算。自动刷新仅影响本模块，不改挂机间隔；可设5–300秒。" titleAfter={<div className="world-refresh-controls"><Button id="world-map-auto-refresh" size="sm" variant="outline" aria-pressed="true">自动刷新：开</Button><label className="world-refresh-setting">每<input id="world-map-refresh-seconds" aria-label="世界概览刷新秒数" type="number" min="5" max="300" step="1" defaultValue="10" />秒</label></div>}>
      <div id="world-map-fleets" className="fleet-summary" aria-label="我的舰队" />
      <details className="world-map-stats"><summary>城战与货轮详情</summary><div id="world-map-wars" /><div id="world-map-treasures" /></details>
      <details className="world-map-stats"><summary>汽油用量</summary><div id="world-map-resources" /></details>
      <div className="bar world-map-toolbar"><Button id="world-map-refresh" variant="outline" size="sm">刷新地图</Button><Button id="world-map-pan" variant="outline" size="sm" aria-pressed="false">移动地图</Button><Button id="world-map-reset" variant="outline" size="sm">全图</Button><Button id="world-map-home" variant="outline" size="sm">定位舰队</Button><label htmlFor="world-map-zoom">缩放</label><input id="world-map-zoom" type="range" min="1" max="8" step="0.25" defaultValue="1" /><span id="world-map-time" role="status">尚未读取</span></div>
      <div id="world-map-layers" className="bar" />
      <div className="world-map-layout"><div id="world-map-scroll" className="world-map-scroll"><svg id="world-map" role="group" aria-label="只读世界地图" /></div><div id="world-map-legend" className="world-map-legend" /><div id="world-map-state-legend" className="world-map-state-legend" /><p className="world-map-help"><span className="for-mouse">拖动平移 · Ctrl+滚轮缩放 · </span><span className="for-touch">点「移动地图」后单指拖动 · 用缩放滑块放大 · </span>放大查看舰队名和攻守优先+排队数</p><aside id="world-map-detail" className="world-map-detail" hidden /></div>
      <p id="world-map-notes" className="dim" />
    </Panel>
  </div>)
}

export function activitiesPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <div className="activity-toolbar"><Button id="activities-refresh" className="ml-auto" variant="outline" size="sm">刷新活动</Button></div>
    <div id="activities-status" className="dim" role="status" />
    <div className="activity-shell">
      <div id="activity-tabs" className="activity-tabs" role="tablist" aria-label="选择活动" />
      <section id="activity-panel" role="tabpanel" tabIndex={0} hidden>
        <Card><CardHeader><div className="activity-heading"><CardTitle id="activity-title" /><span id="activity-kind" /></div><p id="activity-end" className="dim" /></CardHeader>
          <CardContent className="activity-content">
            <div id="activity-pirates" hidden><div id="pirate-board-view" className="pirate-board" aria-live="polite" /></div>
            <div id="activity-detail"><div id="activities-list" className="activity-body" /><div id="activities-order" /></div>
          </CardContent>
        </Card>
      </section>
    </div>
    <template id="ui-event-switch"><Switch className="p-0" /></template>
  </div>)
}

export function manualPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="海面" help="收成品 → 竣工 → 交单 → 按订单缺口排产 → 余料升级建筑。本轮是否允许使用加速器、拒单重刷，由下方本次开关决定。">
    <div className="bar">
      <Option id="world-speedup" label="本轮允许花加速器" />
      <Option id="world-reroll" label="本轮拒单重刷" />
      <Button id="world-plan" variant="outline">刷新数据</Button>
      <Button id="world-run" variant="default">执行一轮</Button>
      <span id="world-hint" className="warn"></span>
    </div>
    <div id="world-view" role="status" />
    <div id="world-factories"></div>
    <div id="world-orders"></div>
    </Panel>
    <Panel title="需求联合排产" help="按用户配置的需求优先级逐级优化齐套时间，上游材料继承对应优先级。共享原料和生产位统一安排，独立设施并行生产。结果显示分层工期、投料顺序、时长依据和阻塞原因。">
      <div className="bar"><Button id="production-plan-refresh" variant="outline">计算联合排产</Button><span id="production-plan-status" className="dim" role="status">连接后可计算</span></div>
      <div id="production-plan-result" aria-live="polite" />
    </Panel>
    <Panel title="资源田"><div id="world-fields" /></Panel>
  </div>)
}

export function inventoryPage() {
  return renderToStaticMarkup(<div className="grid gap-3"><Panel title="仓库">
    <div className="bar"><Button id="inventory-refresh" variant="outline">刷新库存</Button><span id="inventory-status" className="dim" role="status">尚未读取</span></div>
    <div className="bar inventory-search"><label htmlFor="inventory-query">资源名称</label><Input id="inventory-query" type="search" placeholder="搜索资源名称" /><span id="inventory-match-count" className="dim" /></div>
    <details id="world-stock-panel"><summary>展开分类库存</summary><div id="world-stock" /></details>
  </Panel></div>)
}

export function heroesPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="英雄养成" help="升级、升星、升技能的条件取自游戏客户端的红点逻辑；执行前会先算一遍计划。">
<div className="bar">
      <Button id="hero-plan" variant="outline">计算计划</Button>
      <Button id="hero-run" variant="default">执行养成</Button>
      <span id="hero-hint" className="warn"></span>
    </div>
    <pre id="hero-view">尚未计算</pre>
    <div id="hero-table"></div>
    </Panel>
    <Panel title="英雄任命" help="开启后随自动挂机，使用游戏一键委任分配英雄，已有任命可能调整。" titleAfter={<div className="bar"><label htmlFor="appointments-enabled">自动委任</label><Switch id="appointments-enabled" className="p-0" disabled /></div>}>
      <div className="appointments-heading"><h4 id="appointments-priority-title">委任优先级</h4><span id="appointments-state" className="dim" role="status">请选择账号</span></div>
      <p id="appointments-help" className="dim">上方项目优先委任。拖动手柄或使用上移、下移调整，修改后自动保存。</p>
      <ol id="appointments-priorities" className="appointments-priorities" aria-labelledby="appointments-priority-title" aria-describedby="appointments-help" />
      <div className="bar"><Button id="appointments-retry" variant="outline" size="sm" hidden>重试保存</Button><Button id="appointments-reload" variant="outline" size="sm" hidden>重新载入</Button><span id="appointments-feedback" className="sr-only" aria-live="polite" /></div>
    </Panel>
    <Panel title="英雄装备">
      <div className="bar"><Button id="equipment-refresh" variant="outline">刷新装备</Button></div>
      <div id="equipment-view" className="progression-view" aria-live="polite" />
    </Panel>
    <Panel title="装备制造"><div className="bar"><Button id="crafting-refresh" variant="outline">刷新装备厂</Button></div><div id="crafting-view" className="progression-view" aria-live="polite" /></Panel>
    <Panel title="我的阵容" help="管理已保存的自定义阵容，点击查看或在弹窗中编辑。主线和试炼可在各自入口选择阵容，挑战结束后自动还原到挑战前的搭配。">
      <div className="bar"><Button id="saved-lineup-refresh" variant="outline">刷新已保存阵容</Button></div>
      <div id="saved-lineup-view" className="progression-view" />
    </Panel>
    <Panel title="推荐阵容"><div className="bar"><Button id="lineup-refresh" variant="outline">刷新推荐</Button></div><div id="lineup-view" className="progression-view" aria-live="polite" /></Panel>
    <Panel title="远征舰队编队" help="保留空编队的初始化入口。已有编队不会自动重排；舰队状态在总览查看，首杀连续推进在挑战页开启。"><div id="formation-view" className="progression-view" aria-live="polite" /></Panel>
  </div>)
}

export function accountPage() {
  return renderToStaticMarkup(<div className="account-page">
    <div className="account-page-heading">
      <div className="account-page-title"><h2 className="text-xl font-semibold">账号</h2><span id="account-count" className="dim" aria-live="polite">正在读取</span></div>
      <div className="account-page-actions">
        <form method="post" action="/auth/logout"><Button type="submit" variant="outline">退出登录</Button></form>
        <Button id="import-accounts" type="button" variant="outline">导入账号</Button>
        <input id="import-accounts-file" type="file" accept=".json,application/json" aria-label="选择账号备份文件" hidden />
        <Button id="export-accounts" type="button" variant="outline" aria-haspopup="dialog" aria-controls="account-export-dialog">导出账号</Button>
        <Button id="account-add" type="button" aria-haspopup="dialog" aria-controls="account-add-dialog"><Plus aria-hidden="true" />添加账号</Button>
      </div>
    </div>
    <div className="account-login-shortcuts" role="group" aria-label="快速添加账号">
      <Button id="account-add-alipay-shortcut" type="button" variant="outline"><QrCode aria-hidden="true" />支付宝扫码登录</Button>
      <Button id="account-add-phone-shortcut" type="button" variant="outline"><Smartphone aria-hidden="true" />手机号登录</Button>
      <Button id="account-add-wechat-shortcut" type="button" variant="outline"><MessageCircle aria-hidden="true" />电脑微信登录</Button>
    </div>
    <p className="dim">可连续添加多个账号，每个账号独立连接和挂机。切换当前查看的账号不会停止其他账号；可在账号卡片中单独暂停或恢复托管。</p>
    <p className="dim">新账号默认不挂机，点击账号卡片上的「开始挂机」后才会持续运行；可随时点击「暂停挂机」。</p>
    <p id="account-add-notice" className="dim" role="status" hidden />
    <p id="account-transfer-notice" className="dim" role="status" aria-live="polite" hidden />
    <div id="accounts" className="account-grid" />

    <dialog id="account-export-dialog" aria-labelledby="account-export-title" aria-describedby="account-export-scope">
      <div className="account-dialog-heading"><DialogHeader><DialogTitle id="account-export-title">导出账号</DialogTitle></DialogHeader><Button id="account-export-close" type="button" size="icon-sm" variant="ghost" aria-label="关闭账号导出"><X aria-hidden="true" /></Button></div>
      <div className="account-export-selection">
        <label className="account-export-all"><input id="account-export-all" type="checkbox" />全选账号</label>
        <p id="account-export-scope" className="dim" role="status" aria-live="polite" />
      </div>
      <div id="account-export-list" role="group" aria-label="选择要导出的账号" />
      <div className="grid gap-3">
        <Button id="account-export-only" type="button" variant="outline" className="h-auto pointer-coarse:h-auto whitespace-normal justify-start p-4"><span className="grid gap-1 text-left"><strong>仅账号</strong><span className="text-xs font-normal">保存登录凭据、备注和角色资料</span></span></Button>
        <Button id="account-export-settings" type="button" variant="outline" className="h-auto pointer-coarse:h-auto whitespace-normal justify-start p-4"><span className="grid gap-1 text-left"><strong>账号及配置</strong><span className="text-xs font-normal">同时保存每个账号的挂机配置和阵容预设</span></span></Button>
      </div>
      <p className="dim">文件含登录凭据，请妥善保管。配置不包含用量账本和运行状态。</p>
      <p id="account-export-error" className="warn" role="alert" hidden />
    </dialog>

    <dialog id="account-info-dialog" aria-labelledby="account-info-title">
      <div className="account-dialog-heading"><DialogHeader><DialogTitle id="account-info-title" className="leading-snug">账号详情</DialogTitle></DialogHeader><Button id="account-info-close" type="button" size="icon-sm" variant="ghost" aria-label="关闭账号详情"><X aria-hidden="true" /></Button></div>
      <div className="bar"><Button id="account-info-refresh" type="button" variant="outline">连接并读取</Button></div>
      <div id="account-details">
        <h4>角色概况</h4><div className="who" id="who">等待连接</div>
        <h4>资源</h4><div className="resource-strip" id="res">连接后显示</div>
        <h4>区服</h4>
        <div className="bar"><Button id="load-worlds" variant="outline">加载区服</Button><Input id="world-input" aria-label="区服 ID" placeholder="区服 ID" className="w-32" /><Button id="enter-world" variant="outline">进入该区服</Button><span id="worlds-hint" className="warn" /></div>
        <div id="worlds" />
      </div>
    </dialog>

    <dialog id="account-add-dialog" aria-labelledby="account-add-title" aria-describedby="account-add-step">
      <div className="account-dialog-heading"><DialogHeader><p id="account-add-step" className="dim" role="status">选择登录渠道</p><DialogTitle id="account-add-title" className="leading-snug">添加账号</DialogTitle></DialogHeader><Button id="account-add-close" type="button" size="icon-sm" variant="ghost" aria-label="关闭添加账号"><X aria-hidden="true" /></Button></div>
      <div className="account-add-body">
        <p id="account-add-feedback" className="phone-feedback" role="status" aria-live="polite" aria-atomic="true" />
        <div id="account-add-channels" className="account-channel-grid">
          <Button type="button" variant="outline" className="account-channel h-auto pointer-coarse:h-auto items-start justify-start gap-3.5 p-5 has-[>svg]:px-5 whitespace-normal text-left" data-login-channel="alipay"><QrCode className="size-[22px]" aria-hidden="true" /><span><strong>支付宝</strong><span>扫码登录，选择游戏角色</span></span></Button>
          <Button type="button" variant="outline" className="account-channel h-auto pointer-coarse:h-auto items-start justify-start gap-3.5 p-5 has-[>svg]:px-5 whitespace-normal text-left" data-login-channel="phone"><Smartphone className="size-[22px]" aria-hidden="true" /><span><strong>益世界 APP</strong><span>账号密码或短信验证码</span></span></Button>
          <Button type="button" variant="outline" className="account-channel h-auto pointer-coarse:h-auto items-start justify-start gap-3.5 p-5 has-[>svg]:px-5 whitespace-normal text-left" data-login-channel="wechat"><MessageCircle className="size-[22px]" aria-hidden="true" /><span><strong>微信小游戏</strong><span>从电脑微信读取登录信息</span></span></Button>
          <Button type="button" variant="outline" className="account-channel h-auto pointer-coarse:h-auto items-start justify-start gap-3.5 p-5 has-[>svg]:px-5 whitespace-normal text-left" data-login-channel="douyin"><Music2 className="size-[22px]" aria-hidden="true" /><span><strong>抖音小游戏</strong><span>从电脑抖音读取登录信息</span></span></Button>
        </div>
        <section id="account-add-alipay" hidden>
          <div id="alipay-flow" className="alipay-flow">
            <div className="bar"><Button id="alipay-start" type="button">生成二维码</Button><Button id="alipay-cancel" type="button" variant="outline" hidden>取消</Button></div>
            <a id="alipay-open-app" className="alipay-open-app" hidden target="_blank" rel="noopener noreferrer">打开支付宝登录</a>
            <p className="dim">手机上点击「打开支付宝登录」，确认授权后返回此页选择角色。无法跳转时，可截图二维码，在支付宝扫一扫中从相册识别；微信内请用系统浏览器打开。</p>
            <img id="alipay-qr" className="alipay-qr" alt="支付宝扫码登录二维码" width="256" height="256" hidden />
            <p id="alipay-hint" className="phone-feedback dim" role="status" aria-live="polite" aria-atomic="true">点击「生成二维码」，然后使用支付宝扫一扫。手机上可截屏后在支付宝扫一扫中从相册识别。</p>
            <div id="alipay-roles" hidden />
            <p id="alipay-result" hidden />
            <p id="alipay-expiry" className="dim" />
            <div className="bar"><Button id="alipay-save" type="button" hidden disabled>保存所选角色</Button><Button id="alipay-roles-retry" type="button" variant="outline" hidden>重新读取角色</Button></div>
          </div>
          <p className="dim">首次扫码会自动准备浏览器。扫码后选择角色并保存，新账号保存后可在账号卡片中点击「开始挂机」。</p>
        </section>
        <section id="account-add-phone" hidden>
          <p id="phone-step" className="sr-only" role="status">登录验证 → 选择区服和角色 → 保存并切换</p>
          <div className="phone-layout">
            <div id="phone-flow">
              <div id="phone-entry">
                <div className="config-subtabs phone-tabs" role="tablist" aria-label="APP 登录方式">
                  <button type="button" id="phone-password-tab" role="tab" aria-selected="true" aria-controls="phone-password-panel">账号密码</button>
                  <button type="button" id="phone-sms-tab" role="tab" aria-selected="false" aria-controls="phone-sms-panel" tabIndex={-1}>短信验证码</button>
                </div>
                <form id="phone-password-panel" className="phone-form" role="tabpanel" aria-labelledby="phone-password-tab" noValidate>
                  <div className="choice-field"><label htmlFor="phone-account">APP 账号或绑定手机号</label><Input id="phone-account" name="username" placeholder="输入益世界账号或手机号" autoComplete="username" aria-describedby="phone-hint" /></div>
                  <div className="choice-field"><label htmlFor="phone-password">APP 登录密码</label><div className="phone-input-action"><Input id="phone-password" name="password" type="password" placeholder="输入 APP 的登录密码" autoComplete="current-password" aria-describedby="phone-password-help phone-hint" /><Button id="phone-password-toggle" type="button" variant="outline" aria-label="显示密码" aria-pressed="false">显示</Button></div><p id="phone-password-help" className="dim">忘记密码可切换短信验证码，或在游戏 APP 中找回。</p></div>
                  <Button id="phone-login" type="submit">登录并读取角色</Button>
                </form>
                <form id="phone-sms-panel" className="phone-form" role="tabpanel" aria-labelledby="phone-sms-tab" noValidate hidden>
                  <div className="choice-field"><label htmlFor="phone-number">APP 绑定手机号</label><Input id="phone-number" name="tel" type="tel" placeholder="输入 11 位大陆手机号" inputMode="tel" autoComplete="tel-national" aria-describedby="phone-sms-help phone-hint" /></div>
                  <div className="choice-field"><label htmlFor="phone-code">短信验证码</label><div className="phone-input-action"><Input id="phone-code" name="code" placeholder="输入收到的验证码" inputMode="numeric" autoComplete="one-time-code" aria-describedby="phone-sms-help phone-hint" /><Button id="phone-send-code" type="button" variant="outline">获取验证码</Button></div><p id="phone-sms-help" className="dim">先获取验证码，再填写短信中的验证码登录。</p></div>
                  <Button id="phone-sms-login" type="submit">验证并读取角色</Button>
                </form>
              </div>
              <p id="phone-hint" className="phone-feedback" role="status" aria-live="polite" aria-atomic="true" />
              <section id="phone-preview" aria-labelledby="phone-preview-title" hidden>
                <h3 id="phone-preview-title" tabIndex={-1}>选择区服和游戏角色</h3>
                <div id="phone-result" />
                <p id="phone-selection" className="dim" role="status">请选择要使用的角色。</p>
                <p id="phone-expiry" className="dim" />
                <div className="bar"><Button id="phone-save" type="button" disabled>保存所选角色</Button><Button id="phone-roles-retry" type="button" variant="outline" hidden>重试读取失败的账号</Button><Button id="phone-back" type="button" variant="outline">返回修改</Button></div>
              </section>
              <section id="phone-success" aria-labelledby="phone-success-title" hidden>
                <h3 id="phone-success-title" tabIndex={-1}>账号已保存</h3>
                <p id="phone-saved-account" />
                <p id="phone-success-next" className="dim">账号已保存，尚未开始挂机。可先在「挂机配置」设置任务，再点击账号卡片或页头的「开始挂机」。</p>
                <Button id="phone-add-another" type="button" variant="outline">添加其他 APP 账号</Button>
              </section>
            </div>
            <aside className="phone-help" aria-label="APP 登录准备">
              <p id="phone-device-status" className="dim" role="status">正在检查本机设备档案…</p>
              <details id="phone-device-details">
                <summary>高级选项 · 导入设备档案</summary>
                <p className="dim">已有 APP 设备档案可在此导入，用于兼容性排查。</p>
                <p className="dim">档案需包含 di 和 deviceCode，oi 可自动补全。保存后会在后续登录中复用。</p>
                <div className="choice-field"><label htmlFor="phone-device-file">导入设备档案 JSON</label><Input id="phone-device-file" type="file" accept=".json,application/json" /></div>
                <p id="phone-device-path" className="dim" />
                <Button id="phone-device-refresh" type="button" variant="outline" size="sm">重新检查</Button>
              </details>
              <p id="phone-device-hint" className="phone-feedback" role="status" aria-live="polite" />
              <p className="dim">密码和验证码仅用于本次验证。读取角色时会登录游戏，可能让同账号的游戏客户端下线。</p>
            </aside>
          </div>
        </section>
        <section id="account-add-capture" hidden>
          <div className="bar"><Button id="cap-start" type="button" hidden>开始读取微信账号</Button><Button id="cap-douyin" type="button" hidden>开始读取抖音账号</Button><Button id="cap-stop" type="button" variant="outline" hidden>停止读取</Button><Button id="cap-recover" type="button" variant="outline" hidden>恢复上次采集残留</Button></div>
          <p id="cap-hint" className="phone-feedback" role="status" aria-live="polite" />
          <p className="dim">微信需在电脑客户端登录与手机相同的账号，再重新进入小游戏。目前不支持手机微信直接扫码授权；电脑微信采集需要 Windows。</p>
          <div id="cap-box" />
        </section>
      </div>
      <DialogFooter className="account-add-footer"><Button id="account-add-done" type="button" hidden>完成</Button><Button id="account-add-back" type="button" variant="outline" hidden>返回</Button></DialogFooter>
    </dialog>
  </div>)
}

// Client-rendered page; its bundle is loaded when the tab is first opened.
export function loginSettingsPage() {
  return renderToStaticMarkup(<div id="login-settings-root" data-account="">
    <p role="status" className="dim">正在载入登录设置…</p>
    <noscript>请启用 JavaScript 后编辑登录设置。</noscript>
  </div>)
}

export function guildPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="联盟福利">
      <div className="bar"><Button id="guild-refresh" variant="outline">刷新联盟</Button></div>
      <div id="guild-view" className="progression-view" aria-live="polite" />
    </Panel>
    <Panel title="联盟求助"><div id="guild-aid-view" className="progression-view" /></Panel>
    <Panel title="联盟科技" help="当前角色的科技等级与加成。升级只执行一级，扣除对应科技点；发送前重新核对等级、阶段、前置科技和费用。"><div className="bar"><Button id="guild-tech-refresh" variant="outline" size="sm">刷新科技</Button></div><div id="guild-tech-view" className="progression-view" aria-live="polite" /></Panel>
  </div>)
}
