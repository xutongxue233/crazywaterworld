import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Input } from "./input"
import { Switch } from "./switch"
import { HelpTip } from "./help-tip"

type AutoTask = { key: string; label: string; group: string; help?: string; idleGroup?: string; configTarget?: string; idleLabel?: string }

export function idlePanel(tasks: AutoTask[]) {
  const modules=tasks.filter(t=>t.idleGroup);
  const groups=["基地","世界","英雄","日常与活动"];
  return renderToStaticMarkup(<div className="grid gap-2">
    <Card className="idle-schedule">
      <CardHeader>
        <CardTitle className="title-with-help">定时挂机<HelpTip title="定时挂机">轮数填 0 表示持续运行。每轮只执行当前账号已开启的任务。</HelpTip><span className="dim heading-status" id="loop-hint" role="status" /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bar">
          <label htmlFor="loop-rounds">轮数</label>
          <Input id="loop-rounds" type="number" min="0" defaultValue="0" className="w-20" />
          <label htmlFor="loop-every">间隔（秒）</label>
          <Input id="loop-every" type="number" min="1" max="86400" defaultValue="60" className="w-24" />
          <Button id="loop-start" disabled>开始挂机</Button>
          <Button id="loop-stop" variant="outline" disabled>暂停挂机</Button>
        </div>
      </CardContent>
    </Card>
    <div className="bar"><label htmlFor="idle-search">查找功能</label><Input id="idle-search" type="search" placeholder="输入功能名称" className="w-56" /><label htmlFor="idle-filter">显示</label><select id="idle-filter" defaultValue="all"><option value="all">全部</option><option value="enabled">已开启</option></select><span id="idle-filter-count" role="status" /></div>
    <p className="dim" id="single-task-status">单独启动：首杀推进、主线推关、联盟互助。开始挂机不会自动启动这些任务。</p>
    <div className="bar"><Button id="single-go-pirate" variant="outline" size="sm">前往首杀推进</Button><Button id="single-go-stages" variant="outline" size="sm">前往主线推关</Button><Button id="single-go-mutual" variant="outline" size="sm">前往联盟互助</Button></div>
    <p className="dim" id="runtime-version" />
    <p className="dim">这里只控制模块开启；建造、收取、换单、招募与活动领奖等细项在<button id="idle-go-settings" type="button" className="inline-link">游戏配置</button>设置。</p>
    <p className="dim">当前进度和条件统一在<button id="idle-go-overview" type="button" className="inline-link">总览 → 运行概览</button>查看。</p>
    <nav className="config-subtabs" aria-label="挂机设置分组" role="tablist">
      {groups.map((group,index) => <button type="button" key={group} role="tab" id={'idle-tab-'+index} data-idle-group={index} aria-selected={index===0} aria-controls={'idle-group-'+index}>{group}</button>)}
    </nav>
    {groups.map((group,index) => <section key={group} id={'idle-group-'+index} data-idle-panel={index} role="tabpanel" aria-labelledby={'idle-tab-'+index} hidden={index!==0}>
      <Card><CardHeader><CardTitle>{group}</CardTitle></CardHeader>
      <CardContent className="task-grid idle-module-grid">
        {modules.filter(t => t.idleGroup === group).map(t => <div className="task-setting" key={t.key}>
          <div className="task-label-block"><div className="task-label-line"><label htmlFor={'auto-' + t.key}>{t.idleLabel||t.label}</label>{t.help && <HelpTip title={t.label}>{t.help}</HelpTip>}</div></div>
          <div className="idle-module-actions"><a href={"#config-group-"+t.configTarget} aria-label={"配置"+(t.idleLabel||t.label)}>配置</a><Switch id={'auto-' + t.key} data-auto-task={t.key} data-setting-control="" className="p-0" disabled /></div>
        </div>)}
      </CardContent></Card>
      {group === '世界' && <Card><CardHeader><CardTitle>海盗首杀连续推进</CardTitle></CardHeader><CardContent>
        <p className="dim">确认本人的首杀后逐级推进，战败或条件不足时停止。每次手动开启，重启后不自动恢复。</p>
        <div className="bar"><a href="#config-group-pirate-hunt">设置舰队、目标与预算</a><Button id="pirate-advance-start" disabled>开启首杀推进</Button><Button id="pirate-advance-stop" variant="outline" disabled>停止首杀推进</Button></div>
        <p id="pirate-advance-state" role="status">尚未开启</p>
      </CardContent></Card>}
    </section>)}
  </div>)
}

export function action(id: string, label: string, variant: React.ComponentProps<typeof Button>["variant"] = "outline", disabled = false) {
  return renderToStaticMarkup(<Button id={id} variant={variant} disabled={disabled}>{label}</Button>)
}

export function stagePanel() {
  return renderToStaticMarkup(
    <div className="grid gap-2">
    <Card>
      <CardHeader>
        <CardTitle className="title-with-help">挑战主线关卡<HelpTip title="挑战主线关卡">“次数”指同一关连续失败多少次后停止自动挑战。手动开启后每场间隔5秒，通关后连续失败次数清零。</HelpTip><span id="stage-view" className="heading-status" role="status" aria-live="polite">未同步</span></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bar">
          <label htmlFor="stage-failures">次数</label>
          <Input id="stage-failures" aria-label="主线连续失败停止次数" className="w-20" type="number" min="1" defaultValue="3" />
          <Button id="stage-start" disabled>自动挑战</Button>
          <Button id="stage-stop" variant="outline" disabled>停止自动</Button>
        </div>

      </CardContent>
    </Card>
    <Card>
      <CardHeader className="trial-section-header"><CardTitle className="title-with-help">试炼副本<HelpTip title="试炼副本">自动挑战逐关推进，次数指同一关连续失败后的停止上限。“挑战一次”只挑战下一关。扫荡掉落和次数规则在各副本说明中。</HelpTip></CardTitle><Button id="trial-refresh" variant="outline" size="sm">刷新试炼进度</Button></CardHeader>
      <CardContent>
        <div id="trial-view" className="progression-view" aria-live="polite" />
      </CardContent>
    </Card>
    </div>
  )
}
export * from "./layout"
export * from "./pages"
export * from "./settings"
