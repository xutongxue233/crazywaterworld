import * as React from "react"

export function HelpTip({ title, children }: { title: string; children: string }) {
  return <button type="button" className="help-tip" data-help-title={title} data-help-text={children}
    aria-label={title + "说明"} aria-haspopup="dialog" aria-controls="ui-help-popover" aria-expanded="false"><span aria-hidden="true">!</span></button>
}
