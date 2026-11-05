import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Compass, LayoutDashboard, Timer, Hand, Flag, Swords, CalendarDays, ContactRound, Gift, Settings2 } from "lucide-react"
import { Button } from "./button"
import { Badge } from "./badge"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { NativeSelect } from "./native-select"
import { Input } from "./input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"
import { LOG_CATEGORIES, LOG_GROUPS } from "../log-categories.mjs"

const tabs = [
  ["overview", "总览", "icon_btn_bottom_home", LayoutDashboard], ["idle", "挂机", "icon_btn_offline", Timer],
  ["settings", "游戏配置", "", Settings2],
  ["manual", "建筑一览", "icon_btn_bottom_bag", Hand], ["stages", "挑战", "icon_btn_bottom_battle", Flag],
  ["resources", "资源与玩法", "icon_activity_week_month", Gift], ["account", "账号", "icon_btn_moreFunc", ContactRound],
] as const

type Sprite = { url: string; x: number; y: number; w: number; h: number; rotated: boolean }
function GameIcon({ sprite, size, children }: { sprite: Sprite | null; size: number; children: React.ReactNode }) {
  if (!sprite) return children;
  const { url, x, y, w, h, rotated } = sprite;
  const scale = size / Math.max(w, h);
  return <span aria-hidden="true" style={{ position: "relative", display: "inline-block", flexShrink: 0,
    width: w * scale, height: h * scale, overflow: "hidden" }}>
    <span style={{ position: "absolute", top: 0, left: 0, width: rotated ? h : w, height: rotated ? w : h,
      background: `url("${url}") ${-x}px ${-y}px no-repeat`, transformOrigin: "0 0",
      transform: rotated ? `translateY(${h * scale}px) rotate(-90deg) scale(${scale})` : `scale(${scale})` }} />
  </span>
}

export function chrome(icon: (name: string) => Sprite | null) {
  return renderToStaticMarkup(<header>
    <div className="headline">
      <div className="mast"><span className="mast-icon"><GameIcon sprite={icon("icon_sail")} size={29}><Compass className="bearing" aria-hidden="true" /></GameIcon></span><h1>疯狂水世界</h1><span className="brand-label">航行控制台</span></div>
      <div className="connection">
        <label className="account-label" htmlFor="account">当前账号</label>
        <NativeSelect id="account" title="选择账号" />
        <Button id="connect" size="sm">连接</Button><Button id="disconnect" size="sm" variant="outline">断开</Button>
        <Button id="account-pause" size="sm" variant="outline" title="暂停后断开游戏连接，方便自行上号">暂停托管</Button>
        <Button id="logs-open" size="sm" variant="outline" aria-haspopup="dialog" aria-controls="journal-dialog">日志 <span id="log-top-count">0</span></Button>
        <span id="busy" className="dim" /><span id="hint" className="warn" />
      </div>
    </div>
    <nav id="tabs" aria-label="功能导航">{tabs.map(([key, title, name, Icon]) =>
      <Button key={key} data-tab={key} aria-current={key === "overview" ? "page" : undefined} variant="ghost" className="h-8 gap-1 px-2"><GameIcon sprite={icon(name)} size={20}><Icon aria-hidden="true" /></GameIcon>{title}</Button>
    )}</nav>
  </header>)
}

export function journal() {
  return renderToStaticMarkup(<dialog id="journal-dialog" aria-label="运行日志"><aside id="journal" aria-label="运行日志"><Card>
    <CardHeader><div className="journal-top"><CardTitle>运行日志</CardTitle><Badge id="log-count">0</Badge><Button id="logs-close" size="sm" variant="outline" aria-label="关闭运行日志">关闭</Button></div></CardHeader>
    <CardContent>
      <div className="log-toolbar">
        <label className="log-category-label" htmlFor="log-category">功能<select id="log-category" aria-label="日志功能分类" defaultValue="all"><option value="all">全部功能</option>{Object.entries(LOG_GROUPS).map(([group, keys]) => <optgroup key={group} label={group}>{keys.map(key => <option key={key} value={key}>{LOG_CATEGORIES[key]}</option>)}</optgroup>)}</select></label>
        <div className="log-filter" role="group" aria-label="日志筛选">
          <Button id="log-all" size="sm" variant="outline" aria-pressed="true">全部</Button>
          <Button id="log-issues" size="sm" variant="outline" aria-pressed="false">警告与错误</Button>
        </div>
        <Button id="log-clear" size="sm" variant="outline" title="清空当前账号的运行日志">清空日志</Button>
      </div>
      <div id="log" role="log" aria-live="polite" aria-label="操作记录" />
      <p id="log-empty">还没有运行记录</p>
    </CardContent>
  </Card></aside></dialog>)
}

export function dialogs() {
  return renderToStaticMarkup(<>
    <dialog id="modal" aria-labelledby="m-title"><Card>
      <CardHeader><CardTitle id="m-title" /></CardHeader>
      <CardContent><div id="m-body" />
        <div className="bar"><Button id="m-ok">确认</Button><Button id="m-cancel" variant="outline">取消</Button></div>
      </CardContent>
    </Card></dialog>
    <dialog id="account-dialog" aria-labelledby="account-title"><form method="dialog"><Card>
      <CardHeader><CardTitle id="account-title" /></CardHeader>
      <CardContent><p id="account-message" /><Input id="account-label-input" aria-label="账号备注" />
        <div className="bar"><Button value="ok">确认</Button><Button value="cancel" variant="outline">取消</Button></div>
      </CardContent>
    </Card></form></dialog>
    <div id="ui-help-popover" className="help-popover" role="dialog" aria-modal="false" aria-labelledby="ui-help-title" tabIndex={-1} hidden>
      <div className="help-popover-head"><strong id="ui-help-title">说明</strong><button type="button" id="ui-help-close" aria-label="关闭说明">关闭</button></div>
      <div id="ui-help-body" />
    </div>
  </>)
}

// Clone these rendered components for data that arrives after the initial page.
export function templates() {
  return renderToStaticMarkup(<>
    <template id="ui-table"><Table><TableHeader><TableRow><TableHead /></TableRow></TableHeader><TableBody><TableRow><TableCell /></TableRow></TableBody></Table></template>
    <template id="ui-button"><Button variant="outline" size="sm" /></template>
    <template id="ui-select"><NativeSelect size="sm" /></template>
    <template id="ui-delete"><Button variant="destructive" size="sm" /></template>
    <template id="ui-badge"><Badge variant="outline" /></template>
  </>)
}
