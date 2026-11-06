import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./button"
import { Card, CardAction, CardHeader, CardTitle, CardContent } from "./card"
import { Input } from "./input"
import { Switch } from "./switch"
import { HelpTip } from "./help-tip"

function Panel({title, help, titleAfter, collapseId, children}: {title: string; help?: string; titleAfter?: React.ReactNode; collapseId?: string; children: React.ReactNode}) {
  return <Card><CardHeader><CardTitle className="title-with-help">{title}{help && <HelpTip title={title}>{help}</HelpTip>}</CardTitle>{titleAfter && <CardAction className="row-span-1 self-center max-md:col-span-2 max-md:col-start-1 max-md:row-start-2 max-md:justify-self-start">{titleAfter}</CardAction>}{collapseId && <CardAction className="row-span-1 self-center"><Button type="button" size="sm" variant="ghost" data-panel-toggle={collapseId} aria-controls={collapseId} aria-expanded="false">展开</Button></CardAction>}</CardHeader><CardContent id={collapseId} hidden={!!collapseId}>{children}</CardContent></Card>
}

function Option({id, label, checked = false}: {id: string; label: string; checked?: boolean}) {
  return <div className="bar"><Switch id={id} data-local-switch="" defaultChecked={checked} className="p-0" /><label htmlFor={id}>{label}</label></div>
}

export function giftCodesPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="礼包兑换" help="每个账号独立排队，兑换请求逐个发送。账号登录失败或结果未知只停止该账号；任一账号遇到服务器限频时，同批尚未发送的账号全部停止，之后可重新提交。"><label htmlFor="gift-code-input">礼包码（换行或逗号分隔）</label>
      <textarea id="gift-code-input" rows={3} maxLength={12000} className="w-full" placeholder="每批最多100个" />
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
    <Panel title="收益日报" help="按北京时间统计当前账号的金币、钻石、汽油、加速器、战力、等级和主线关卡净变化。挂机运行后定期采样。"><div id="income-view" className="income-view"><span className="dim">挂机运行后开始记录</span></div></Panel>
    <Panel title="运行概览" help="按功能分别查看当前进度与当前条件。这里只读展示；开关仍在挂机页设置。">
      <div className="bar overview-task-filter"><Input id="overview-task-search" type="search" aria-label="查找运行状态" placeholder="功能名称或状态" /><label htmlFor="overview-task-filter">显示</label><select id="overview-task-filter" defaultValue="enabled"><option value="enabled">已开启</option><option value="issues">异常 / 受总控限制</option><option value="all">全部项目</option></select></div>
      <p id="overview-task-summary" className="dim" role="status">等待读取运行状态</p>
      <div id="overview-task-groups" />
    </Panel>
    <Panel title="活动统计" collapseId="activity-stats-content" help="活动名称取游戏当前期数配置。福利与达标奖励分别核对；“已达成已领”不表示所有档位都已完成，未同步不会记为已领取。时间使用北京时间MM-DD。">
      <div className="bar"><Button id="activity-stats-refresh" variant="outline" size="sm">刷新统计</Button><span id="activity-stats-status" className="dim" role="status">连接后读取</span></div>
      <div id="activity-stats-table" className="activity-statistics-scroll" aria-label="活动统计表格" tabIndex={0} />
    </Panel>
    <Panel title="活动排行榜" collapseId="activity-rank-content" help="只读查看游戏返回的玩家排行，不领取奖励或发起挑战。按页签切换，未开放与未上榜会单独说明。">
      <div className="bar"><Button id="activity-rank-refresh" variant="outline" size="sm">刷新排行</Button><span id="activity-rank-status" className="dim" role="status">连接后读取</span></div>
      <div id="activity-rank-tabs" className="config-subtabs" role="tablist" aria-label="活动排行榜" />
      <div id="activity-rank-panel" role="tabpanel"><p id="activity-rank-mine" className="dim" /><div id="activity-rank-table" className="activity-rank-table" /></div>
      <div className="bar"><Button id="activity-rank-prev" variant="outline" size="sm" disabled>上一页</Button><span id="activity-rank-page" className="dim" /><Button id="activity-rank-next" variant="outline" size="sm" disabled>下一页</Button></div>
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
    <div className="activity-toolbar"><p className="dim">选择活动，单独执行或设置自动运行。</p><Button id="activities-refresh" variant="outline" size="sm">刷新活动</Button></div>
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
    <Panel title="材料来源查询"><label htmlFor="source-query">游戏材料名称</label><Input id="source-query" placeholder="例如：有机土壤" /><div id="source-results" aria-live="polite" /></Panel>
    <template id="ui-event-switch"><Switch className="p-0" /></template>
  </div>)
}

export function manualPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="一键领取" help="领取主线、成就、邮件、挂机收益，以及已拥有英雄的技能展示首领奖励，不花钻石。逐项结果见运行日志。"><div className="bar"><Button id="loot-run">领取现在能领的</Button><span id="loot-hint" role="status" /></div></Panel>
    <Panel title="任务奖励" help="检查或领取主线、支线、成就和每日订单档位奖励。无法确认目标值的任务会跳过，结果见运行日志。"><div className="bar"><Button id="tasks-plan" variant="outline">检查可领</Button><Button id="tasks-run">领取任务奖励</Button><span id="tasks-hint" role="status" /></div></Panel>
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
    <Panel title="主力英雄"><div className="icons" id="hero-strip"><span className="dim">连接后显示</span></div></Panel>
    <Panel title="英雄养成" help="升级、升星、升技能的条件取自游戏客户端的红点逻辑；执行前会先算一遍计划。">
<div className="bar">
      <Button id="hero-plan" variant="outline">计算计划</Button>
      <Button id="hero-run" variant="default">执行养成</Button>
      <span id="hero-hint" className="warn"></span>
    </div>
    <pre id="hero-view">尚未计算</pre>
    <div id="hero-table"></div>
    </Panel>
    <Panel title="英雄任命" help="按游戏内的职位优先顺序自动分配英雄，已有任命可能调整。">
    <div className="bar">
      <Button id="appoint-view" variant="outline">查看职位</Button>
      <Button id="appoint-run" variant="default">一键任命</Button>
    </div>
    <div id="appoint-table" className="dim">尚未查看职位</div></Panel>
    <Panel title="英雄装备">
      <div className="bar"><Button id="equipment-refresh" variant="outline">刷新装备</Button></div>
      <div id="equipment-view" className="progression-view" aria-live="polite" />
    </Panel>
    <Panel title="装备制造"><div className="bar"><Button id="crafting-refresh" variant="outline">刷新装备厂</Button></div><div id="crafting-view" className="progression-view" aria-live="polite" /></Panel>
    <Panel title="推荐阵容"><div className="bar"><Button id="lineup-refresh" variant="outline">刷新推荐</Button></div><div id="lineup-view" className="progression-view" aria-live="polite" /></Panel>
    <Panel title="远征舰队编队" help="保留空编队的初始化入口。已有编队不会自动重排；舰队状态在总览查看，首杀连续推进在挂机页开启。"><div id="formation-view" className="progression-view" aria-live="polite" /></Panel>
  </div>)
}

export function dailiesPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="每日任务" help="先“探测”查看当前能做哪些任务及不能执行的原因。点金与折扣店默认跳过，勾选允许花钻石才会消费。">
<div className="bar">
      <Button id="dailies-plan" variant="outline">探测</Button>
      <Button id="dailies-run" variant="default">一键完成</Button>
      <Option id="dailies-paid" label="允许花钻石（默认关闭）" />
      <span id="dailies-hint" className="warn"></span>
    </div>

    <div id="dailies-table"></div></Panel>

  </div>)
}

export function accountPage() {
  return renderToStaticMarkup(<div className="grid gap-3">
    <Panel title="账号" help="导出的账号备份含登录凭证，请妥善保管。账号切换与暂停状态分别保存。">
    <div className="bar"><Button id="export-accounts" variant="outline">导出全部账号</Button><span className="dim">备份含登录凭证</span></div>
    <div id="accounts"></div>

    <div id="account-detail-home" hidden><div id="account-details">
      <h4>角色概况</h4><div className="who" id="who">等待连接</div>
      <h4>资源</h4><div className="resource-strip" id="res">连接后显示</div>
      <h4>凭证</h4>    <div className="bar">
      <Button id="cred-show" variant="outline">显示凭证</Button>
      <Button id="cred-hide" variant="outline">收起</Button>
      <span className="dim">仅限本机使用</span>
    </div>
    <div id="cred"></div>

      <h4>区服</h4>    <div className="bar">
      <Button id="load-worlds" variant="outline">加载区服</Button>
      <Input id="world-input" aria-label="区服 ID" placeholder="区服 ID" className="w-32" />
      <Button id="enter-world" variant="outline">进入该区服</Button>
      <span id="worlds-hint" className="warn"></span>
    </div>
    <div id="worlds"></div>

    </div></div></Panel>
    <Panel title="添加账号">
    <div className="bar">
      <Button id="cap-start" variant="default">从电脑微信添加</Button>
      <Button id="cap-douyin" variant="outline">从电脑抖音添加</Button>
      <Button id="cap-stop" variant="destructive">停止抓包</Button>
      <span id="cap-hint" className="warn"></span>
    </div>
    <div id="cap-box"></div>
</Panel>
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
