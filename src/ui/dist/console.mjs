// src/ui/console.tsx
import * as React13 from "react";
import { renderToStaticMarkup as renderToStaticMarkup4 } from "react-dom/server";

// src/ui/button.tsx
import * as React from "react";
import { cva } from "class-variance-authority";

// src/ui/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/ui/button.tsx
import * as Slot from "@radix-ui/react-slot";
var buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 pointer-coarse:h-10 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 pointer-coarse:h-10 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button";
  return /* @__PURE__ */ React.createElement(
    Comp,
    {
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/ui/card.tsx
import * as React2 from "react";
function Card({ className, ...props }) {
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      "data-slot": "card",
      className: cn(
        "flex min-w-0 flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm max-md:gap-4 max-md:py-4",
        className
      ),
      ...props
    }
  );
}
function CardHeader({ className, ...props }) {
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      "data-slot": "card-header",
      className: cn(
        "@container/card-header grid auto-rows-min items-start gap-2 px-6 items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-action]:items-center has-data-[slot=card-description]:grid-rows-[auto_auto] max-md:px-4 [.border-b]:pb-6",
        className
      ),
      ...props
    }
  );
}
function CardTitle({ className, ...props }) {
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      "data-slot": "card-title",
      className: cn("text-base leading-none font-semibold", className),
      ...props
    }
  );
}
function CardAction({ className, ...props }) {
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      "data-slot": "card-action",
      className: cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      ),
      ...props
    }
  );
}
function CardContent({ className, ...props }) {
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      "data-slot": "card-content",
      className: cn("min-w-0 px-6 max-md:px-4", className),
      ...props
    }
  );
}

// src/ui/input.tsx
import * as React3 from "react";
function Input({ type, ...props }) {
  return /* @__PURE__ */ React3.createElement("input", { type, "data-slot": "input", ...props });
}

// src/ui/switch.tsx
import * as React4 from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
function Switch({
  className,
  size = "default",
  ...props
}) {
  return /* @__PURE__ */ React4.createElement(
    SwitchPrimitive.Root,
    {
      "data-slot": "switch",
      "data-size": size,
      className: cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        className
      ),
      ...props
    },
    /* @__PURE__ */ React4.createElement(
      SwitchPrimitive.Thumb,
      {
        "data-slot": "switch-thumb",
        className: cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground"
        )
      }
    )
  );
}

// src/ui/help-tip.tsx
import * as React5 from "react";
function HelpTip({ title, children }) {
  return /* @__PURE__ */ React5.createElement(
    "button",
    {
      type: "button",
      className: "help-tip",
      "data-help-title": title,
      "data-help-text": children,
      "aria-label": title + "\u8BF4\u660E",
      "aria-haspopup": "dialog",
      "aria-controls": "ui-help-popover",
      "aria-expanded": "false"
    }
  );
}

// src/ui/layout.tsx
import * as React10 from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Boxes, Building2, CircleUserRound, LayoutDashboard, LogIn, ScrollText, Settings2, Ship, Swords, Timer, X } from "lucide-react";

// src/ui/badge.tsx
import * as React6 from "react";
import { cva as cva2 } from "class-variance-authority";
import * as Slot2 from "@radix-ui/react-slot";
var badgeVariants = cva2(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot2.Root : "span";
  return /* @__PURE__ */ React6.createElement(
    Comp,
    {
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(badgeVariants({ variant }), className),
      ...props
    }
  );
}

// src/ui/dialog.tsx
import * as React7 from "react";
function DialogHeader({ className, ...props }) {
  return /* @__PURE__ */ React7.createElement("div", { "data-slot": "dialog-header", className: cn("flex flex-col gap-2 text-left", className), ...props });
}
function DialogTitle({ className, ...props }) {
  return /* @__PURE__ */ React7.createElement("h2", { "data-slot": "dialog-title", className: cn("text-lg leading-none font-semibold", className), ...props });
}
function DialogFooter({ className, ...props }) {
  return /* @__PURE__ */ React7.createElement("div", { "data-slot": "dialog-footer", className: cn("flex flex-col gap-2 sm:flex-row-reverse sm:justify-start", className), ...props });
}

// src/ui/native-select.tsx
import * as React8 from "react";
function NativeSelect({
  className,
  size = "default",
  ...props
}) {
  return /* @__PURE__ */ React8.createElement(
    "div",
    {
      className: "group/native-select relative inline-block max-w-full min-w-0 has-[select:disabled]:opacity-50",
      "data-slot": "native-select-wrapper"
    },
    /* @__PURE__ */ React8.createElement(
      "select",
      {
        "data-slot": "native-select",
        "data-size": size,
        className: cn("w-full", className),
        ...props
      }
    )
  );
}

// src/ui/table.tsx
import * as React9 from "react";
function Table({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "div",
    {
      "data-slot": "table-container",
      className: "relative w-full overflow-x-auto"
    },
    /* @__PURE__ */ React9.createElement(
      "table",
      {
        "data-slot": "table",
        className: cn("w-full caption-bottom text-sm", className),
        ...props
      }
    )
  );
}
function TableHeader({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "thead",
    {
      "data-slot": "table-header",
      className: cn("[&_tr]:border-b", className),
      ...props
    }
  );
}
function TableBody({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "tbody",
    {
      "data-slot": "table-body",
      className: cn("[&_tr:last-child]:border-0", className),
      ...props
    }
  );
}
function TableRow({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "tr",
    {
      "data-slot": "table-row",
      className: cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      ),
      ...props
    }
  );
}
function TableHead({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "th",
    {
      "data-slot": "table-head",
      className: cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}
function TableCell({ className, ...props }) {
  return /* @__PURE__ */ React9.createElement(
    "td",
    {
      "data-slot": "table-cell",
      className: cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}

// src/log-categories.mjs
var LOG_CATEGORIES = {
  radar: "\u8054\u76DF\u60C5\u62A5",
  pirate: "\u6D77\u76D7\u9996\u6740\u4E0E\u626B\u8361",
  boss: "\u4E16\u754CBoss",
  merchant: "\u6D77\u5546\u738B",
  forge: "\u88C5\u5907\u953B\u9020",
  fleet: "\u8230\u961F\u4E0E\u7EF4\u4FEE",
  codes: "\u793C\u5305\u5151\u6362",
  orders: "\u5468\u8BA2\u5355",
  gather: "\u91C7\u96C6\u4E0E\u6253\u635E",
  system: "\u7CFB\u7EDF\u4E0E\u8FDE\u63A5",
  idle: "\u6302\u673A",
  building: "\u5EFA\u8BBE",
  production: "\u751F\u4EA7",
  events: "\u57FA\u5730\u4E8B\u4EF6",
  base: "\u57FA\u7840\u517B\u6210",
  treasure: "\u4E07\u5428\u5DE8\u8F6E",
  alliance: "\u8054\u76DF/\u57CE\u6218",
  heroes: "\u82F1\u96C4",
  daily: "\u65E5\u5E38\u9886\u5956",
  activity: "\u6D3B\u52A8",
  trials: "\u8BD5\u70BC",
  stages: "\u4E3B\u7EBF\u63A8\u5173"
};
var LOG_GROUPS = {
  "\u7CFB\u7EDF": ["system", "idle", "codes"],
  "\u57FA\u5730\u4E0E\u8D44\u6E90": ["building", "production", "gather", "forge", "events", "base", "orders"],
  "\u4E16\u754C\u4E0E\u8054\u76DF": ["treasure", "radar", "pirate", "boss", "fleet", "alliance"],
  "\u65E5\u5E38\u4E0E\u6D3B\u52A8": ["heroes", "daily", "activity", "merchant", "trials", "stages"]
};

// src/ui/layout.tsx
var tabs = [
  ["overview", "\u603B\u89C8", "\u603B\u89C8", LayoutDashboard],
  ["idle", "\u6302\u673A", "\u6302\u673A", Timer],
  ["settings", "\u6E38\u620F\u914D\u7F6E", "\u914D\u7F6E", Settings2],
  ["manual", "\u5EFA\u7B51\u4E00\u89C8", "\u5EFA\u7B51", Building2],
  ["stages", "\u6311\u6218", "\u6311\u6218", Swords],
  ["resources", "\u8D44\u6E90\u4E0E\u73A9\u6CD5", "\u8D44\u6E90", Boxes],
  ["account", "\u8D26\u53F7", "\u8D26\u53F7", CircleUserRound],
  ["login-settings", "\u767B\u5F55\u8BBE\u7F6E", "\u767B\u5F55", LogIn]
];
function chrome() {
  return renderToStaticMarkup(/* @__PURE__ */ React10.createElement("header", null, /* @__PURE__ */ React10.createElement("div", { className: "headline" }, /* @__PURE__ */ React10.createElement("div", { className: "mast" }, /* @__PURE__ */ React10.createElement("span", { className: "mast-icon" }, /* @__PURE__ */ React10.createElement(Ship, { "aria-hidden": "true" })), /* @__PURE__ */ React10.createElement("h1", null, "\u75AF\u72C2\u6C34\u4E16\u754C"), /* @__PURE__ */ React10.createElement("span", { className: "brand-label" }, "\u822A\u884C\u63A7\u5236\u53F0")), /* @__PURE__ */ React10.createElement("div", { className: "connection" }, /* @__PURE__ */ React10.createElement(Badge, { id: "busy", variant: "outline", className: "status-pill", "data-state": "off", role: "status" }, "\u672A\u8FDE\u63A5"), /* @__PURE__ */ React10.createElement("label", { className: "account-label", htmlFor: "account" }, "\u5F53\u524D\u8D26\u53F7"), /* @__PURE__ */ React10.createElement(NativeSelect, { id: "account", title: "\u9009\u62E9\u8D26\u53F7" }), /* @__PURE__ */ React10.createElement(Button, { id: "connect", size: "sm" }, "\u8FDE\u63A5"), /* @__PURE__ */ React10.createElement(Button, { id: "disconnect", size: "sm", variant: "outline" }, "\u65AD\u5F00"), /* @__PURE__ */ React10.createElement(Button, { id: "account-pause", size: "sm", variant: "outline", title: "\u6682\u505C\u540E\u65AD\u5F00\u6E38\u620F\u8FDE\u63A5\uFF0C\u65B9\u4FBF\u81EA\u884C\u4E0A\u53F7" }, "\u6682\u505C\u6258\u7BA1"), /* @__PURE__ */ React10.createElement(Button, { id: "logs-open", size: "sm", variant: "outline", "aria-haspopup": "dialog", "aria-controls": "journal-dialog" }, /* @__PURE__ */ React10.createElement(ScrollText, { "aria-hidden": "true" }), "\u65E5\u5FD7 ", /* @__PURE__ */ React10.createElement("span", { id: "log-top-count" }, "0")), /* @__PURE__ */ React10.createElement("span", { id: "hint", className: "warn" }))), /* @__PURE__ */ React10.createElement("nav", { id: "tabs", "aria-label": "\u529F\u80FD\u5BFC\u822A" }, tabs.map(
    ([key, title, short, Icon]) => /* @__PURE__ */ React10.createElement("button", { type: "button", key, className: "nav-tab", "data-tab": key, "aria-current": key === "overview" ? "page" : void 0 }, /* @__PURE__ */ React10.createElement(Icon, { "aria-hidden": "true" }), /* @__PURE__ */ React10.createElement("span", { className: "nav-full" }, title), /* @__PURE__ */ React10.createElement("span", { className: "nav-short", "aria-hidden": "true" }, short))
  )), /* @__PURE__ */ React10.createElement("div", { id: "page-progress", "aria-hidden": "true" })));
}
function journal() {
  return renderToStaticMarkup(/* @__PURE__ */ React10.createElement("dialog", { id: "journal-dialog", "aria-label": "\u8FD0\u884C\u65E5\u5FD7" }, /* @__PURE__ */ React10.createElement("aside", { id: "journal", "aria-label": "\u8FD0\u884C\u65E5\u5FD7" }, /* @__PURE__ */ React10.createElement(DialogHeader, null, /* @__PURE__ */ React10.createElement(DialogTitle, { className: "journal-title" }, "\u8FD0\u884C\u65E5\u5FD7", /* @__PURE__ */ React10.createElement(Badge, { id: "log-count" }, "0"))), /* @__PURE__ */ React10.createElement(Button, { id: "logs-close", size: "icon-sm", variant: "ghost", "aria-label": "\u5173\u95ED\u8FD0\u884C\u65E5\u5FD7" }, /* @__PURE__ */ React10.createElement(X, { "aria-hidden": "true" })), /* @__PURE__ */ React10.createElement("div", { className: "log-toolbar" }, /* @__PURE__ */ React10.createElement("label", { className: "log-category-label", htmlFor: "log-category" }, "\u529F\u80FD", /* @__PURE__ */ React10.createElement("select", { id: "log-category", "aria-label": "\u65E5\u5FD7\u529F\u80FD\u5206\u7C7B", defaultValue: "all" }, /* @__PURE__ */ React10.createElement("option", { value: "all" }, "\u5168\u90E8\u529F\u80FD"), Object.entries(LOG_GROUPS).map(([group, keys]) => /* @__PURE__ */ React10.createElement("optgroup", { key: group, label: group }, keys.map((key) => /* @__PURE__ */ React10.createElement("option", { key, value: key }, LOG_CATEGORIES[key])))))), /* @__PURE__ */ React10.createElement("div", { className: "log-filter", role: "group", "aria-label": "\u65E5\u5FD7\u7B5B\u9009" }, /* @__PURE__ */ React10.createElement("button", { type: "button", id: "log-all", "aria-pressed": "true" }, "\u5168\u90E8"), /* @__PURE__ */ React10.createElement("button", { type: "button", id: "log-issues", "aria-pressed": "false" }, "\u8B66\u544A\u4E0E\u9519\u8BEF")), /* @__PURE__ */ React10.createElement(Button, { id: "log-clear", size: "sm", variant: "outline", title: "\u6E05\u7A7A\u5F53\u524D\u8D26\u53F7\u7684\u8FD0\u884C\u65E5\u5FD7" }, "\u6E05\u7A7A\u65E5\u5FD7")), /* @__PURE__ */ React10.createElement("div", { id: "log", role: "log", "aria-live": "polite", "aria-label": "\u64CD\u4F5C\u8BB0\u5F55" }), /* @__PURE__ */ React10.createElement("p", { id: "log-empty" }, "\u8FD8\u6CA1\u6709\u8FD0\u884C\u8BB0\u5F55"))));
}
function dialogs() {
  return renderToStaticMarkup(/* @__PURE__ */ React10.createElement(React10.Fragment, null, /* @__PURE__ */ React10.createElement("dialog", { id: "modal", "aria-labelledby": "m-title" }, /* @__PURE__ */ React10.createElement(DialogHeader, null, /* @__PURE__ */ React10.createElement(DialogTitle, { id: "m-title" })), /* @__PURE__ */ React10.createElement("div", { id: "m-body" }), /* @__PURE__ */ React10.createElement(DialogFooter, null, /* @__PURE__ */ React10.createElement(Button, { id: "m-ok" }, "\u786E\u8BA4"), /* @__PURE__ */ React10.createElement(Button, { id: "m-cancel", variant: "outline" }, "\u53D6\u6D88"))), /* @__PURE__ */ React10.createElement("dialog", { id: "account-dialog", "aria-labelledby": "account-title" }, /* @__PURE__ */ React10.createElement("form", { method: "dialog" }, /* @__PURE__ */ React10.createElement(DialogHeader, null, /* @__PURE__ */ React10.createElement(DialogTitle, { id: "account-title" }), /* @__PURE__ */ React10.createElement("p", { id: "account-message", className: "dim" })), /* @__PURE__ */ React10.createElement(Input, { id: "account-label-input", "aria-label": "\u8D26\u53F7\u5907\u6CE8" }), /* @__PURE__ */ React10.createElement(DialogFooter, null, /* @__PURE__ */ React10.createElement(Button, { value: "ok" }, "\u786E\u8BA4"), /* @__PURE__ */ React10.createElement(Button, { value: "cancel", variant: "outline" }, "\u53D6\u6D88")))), /* @__PURE__ */ React10.createElement("div", { id: "ui-help-popover", className: "help-popover", role: "dialog", "aria-modal": "false", "aria-labelledby": "ui-help-title", tabIndex: -1, hidden: true }, /* @__PURE__ */ React10.createElement("div", { className: "help-popover-head" }, /* @__PURE__ */ React10.createElement("strong", { id: "ui-help-title" }, "\u8BF4\u660E"), /* @__PURE__ */ React10.createElement(Button, { id: "ui-help-close", size: "icon-xs", variant: "ghost", "aria-label": "\u5173\u95ED\u8BF4\u660E" }, /* @__PURE__ */ React10.createElement(X, { "aria-hidden": "true" }))), /* @__PURE__ */ React10.createElement("div", { id: "ui-help-body" }))));
}
function templates() {
  return renderToStaticMarkup(/* @__PURE__ */ React10.createElement(React10.Fragment, null, /* @__PURE__ */ React10.createElement("template", { id: "ui-table" }, /* @__PURE__ */ React10.createElement(Table, null, /* @__PURE__ */ React10.createElement(TableHeader, null, /* @__PURE__ */ React10.createElement(TableRow, null, /* @__PURE__ */ React10.createElement(TableHead, null))), /* @__PURE__ */ React10.createElement(TableBody, null, /* @__PURE__ */ React10.createElement(TableRow, null, /* @__PURE__ */ React10.createElement(TableCell, null))))), /* @__PURE__ */ React10.createElement("template", { id: "ui-button" }, /* @__PURE__ */ React10.createElement(Button, { variant: "outline", size: "sm" })), /* @__PURE__ */ React10.createElement("template", { id: "ui-select" }, /* @__PURE__ */ React10.createElement(NativeSelect, { size: "sm" })), /* @__PURE__ */ React10.createElement("template", { id: "ui-number" }, /* @__PURE__ */ React10.createElement(Input, { type: "number" })), /* @__PURE__ */ React10.createElement("template", { id: "ui-delete" }, /* @__PURE__ */ React10.createElement(Button, { variant: "destructive", size: "sm" })), /* @__PURE__ */ React10.createElement("template", { id: "ui-badge" }, /* @__PURE__ */ React10.createElement(Badge, { variant: "outline" }))));
}

// src/ui/pages.tsx
import * as React11 from "react";
import { renderToStaticMarkup as renderToStaticMarkup2 } from "react-dom/server";
function Panel({ title, help, titleAfter, collapseId, children }) {
  return /* @__PURE__ */ React11.createElement(Card, null, /* @__PURE__ */ React11.createElement(CardHeader, null, /* @__PURE__ */ React11.createElement(CardTitle, { className: "title-with-help" }, title, help && /* @__PURE__ */ React11.createElement(HelpTip, { title }, help)), titleAfter && /* @__PURE__ */ React11.createElement(CardAction, { className: "row-span-1 self-center max-md:col-span-2 max-md:col-start-1 max-md:row-start-2 max-md:justify-self-start" }, titleAfter), collapseId && /* @__PURE__ */ React11.createElement(CardAction, { className: "row-span-1 self-center" }, /* @__PURE__ */ React11.createElement(Button, { type: "button", size: "sm", variant: "ghost", "data-panel-toggle": collapseId, "aria-controls": collapseId, "aria-expanded": "false" }, "\u5C55\u5F00"))), /* @__PURE__ */ React11.createElement(CardContent, { id: collapseId, hidden: !!collapseId }, children));
}
function Option({ id, label, checked = false }) {
  return /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Switch, { id, "data-local-switch": "", defaultChecked: checked, className: "p-0" }), /* @__PURE__ */ React11.createElement("label", { htmlFor: id }, label));
}
function giftCodesPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u793C\u5305\u5151\u6362", help: "\u6BCF\u4E2A\u8D26\u53F7\u72EC\u7ACB\u6392\u961F\uFF0C\u5151\u6362\u8BF7\u6C42\u9010\u4E2A\u53D1\u9001\u3002\u8D26\u53F7\u767B\u5F55\u5931\u8D25\u6216\u7ED3\u679C\u672A\u77E5\u53EA\u505C\u6B62\u8BE5\u8D26\u53F7\uFF1B\u4EFB\u4E00\u8D26\u53F7\u9047\u5230\u670D\u52A1\u5668\u9650\u9891\u65F6\uFF0C\u540C\u6279\u5C1A\u672A\u53D1\u9001\u7684\u8D26\u53F7\u5168\u90E8\u505C\u6B62\uFF0C\u4E4B\u540E\u53EF\u91CD\u65B0\u63D0\u4EA4\u3002" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "gift-code-input" }, "\u793C\u5305\u7801\uFF08\u6362\u884C\u6216\u9017\u53F7\u5206\u9694\uFF09"), /* @__PURE__ */ React11.createElement("textarea", { id: "gift-code-input", rows: 3, maxLength: 12e3, className: "w-full", placeholder: "\u6BCF\u6279\u6700\u591A100\u4E2A" }), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { type: "button", variant: "outline", size: "sm", id: "gift-load-initial" }, "\u8F7D\u5165\u521D\u59CB\u7801"), /* @__PURE__ */ React11.createElement("span", { id: "gift-code-initial-note", className: "dim", role: "status" })), /* @__PURE__ */ React11.createElement("fieldset", { className: "gift-accounts" }, /* @__PURE__ */ React11.createElement("legend", null, "\u5151\u6362\u8D26\u53F7"), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { variant: "outline", size: "sm", id: "gift-select-all" }, "\u5168\u9009"), /* @__PURE__ */ React11.createElement(Button, { variant: "outline", size: "sm", id: "gift-select-none" }, "\u6E05\u7A7A"), /* @__PURE__ */ React11.createElement("span", { id: "gift-selected-count", className: "dim" })), /* @__PURE__ */ React11.createElement("div", { id: "gift-account-list", className: "gift-account-list" }), /* @__PURE__ */ React11.createElement("p", { className: "dim" }, "\u672A\u8FDE\u63A5\u7684\u8D26\u53F7\u4F1A\u81EA\u52A8\u767B\u5F55\uFF0C\u53EF\u80FD\u628A\u6B63\u5728\u73A9\u7684\u6E38\u620F\u9876\u4E0B\u7EBF\uFF0C\u5151\u6362\u540E\u4FDD\u6301\u8FDE\u63A5\u3002\u5DF2\u6682\u505C\u7684\u8D26\u53F7\u4E0D\u80FD\u9009\u62E9\u3002")), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "gift-code-start" }, "\u5F00\u59CB\u5151\u6362"), /* @__PURE__ */ React11.createElement("span", { id: "gift-code-state", role: "status" }))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u5151\u6362\u8BB0\u5F55" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "gift-record-account" }, "\u67E5\u770B\u8D26\u53F7"), /* @__PURE__ */ React11.createElement("select", { id: "gift-record-account" })), /* @__PURE__ */ React11.createElement("div", { className: "overflow-auto" }, /* @__PURE__ */ React11.createElement("table", null, /* @__PURE__ */ React11.createElement("thead", null, /* @__PURE__ */ React11.createElement("tr", null, ["\u793C\u5305\u7801", "\u72B6\u6001", "\u7ED3\u679C", "\u65F6\u95F4"].map((t) => /* @__PURE__ */ React11.createElement("th", { key: t }, t)))), /* @__PURE__ */ React11.createElement("tbody", { id: "gift-code-history" }))), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { variant: "outline", id: "gift-prev" }, "\u4E0A\u4E00\u9875"), /* @__PURE__ */ React11.createElement("span", { id: "gift-page" }), /* @__PURE__ */ React11.createElement(Button, { variant: "outline", id: "gift-next" }, "\u4E0B\u4E00\u9875")))));
}
function overviewPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u8FD0\u884C\u6982\u89C8", help: "\u6309\u529F\u80FD\u5206\u522B\u67E5\u770B\u5F53\u524D\u8FDB\u5EA6\u4E0E\u5F53\u524D\u6761\u4EF6\u3002\u8FD9\u91CC\u53EA\u8BFB\u5C55\u793A\uFF1B\u5F00\u5173\u4ECD\u5728\u6302\u673A\u9875\u8BBE\u7F6E\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar overview-task-filter" }, /* @__PURE__ */ React11.createElement(Input, { id: "overview-task-search", type: "search", "aria-label": "\u67E5\u627E\u8FD0\u884C\u72B6\u6001", placeholder: "\u529F\u80FD\u540D\u79F0\u6216\u72B6\u6001" }), /* @__PURE__ */ React11.createElement("label", { htmlFor: "overview-task-filter" }, "\u663E\u793A"), /* @__PURE__ */ React11.createElement("select", { id: "overview-task-filter", defaultValue: "enabled" }, /* @__PURE__ */ React11.createElement("option", { value: "enabled" }, "\u5DF2\u5F00\u542F"), /* @__PURE__ */ React11.createElement("option", { value: "issues" }, "\u5F02\u5E38 / \u53D7\u603B\u63A7\u9650\u5236"), /* @__PURE__ */ React11.createElement("option", { value: "all" }, "\u5168\u90E8\u9879\u76EE"))), /* @__PURE__ */ React11.createElement("p", { id: "overview-task-summary", className: "dim", role: "status" }, "\u7B49\u5F85\u8BFB\u53D6\u8FD0\u884C\u72B6\u6001"), /* @__PURE__ */ React11.createElement("div", { id: "overview-task-groups" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u6D3B\u52A8\u7EDF\u8BA1", collapseId: "activity-stats-content", help: "\u6D3B\u52A8\u540D\u79F0\u53D6\u6E38\u620F\u5F53\u524D\u671F\u6570\u914D\u7F6E\u3002\u798F\u5229\u4E0E\u8FBE\u6807\u5956\u52B1\u5206\u522B\u6838\u5BF9\uFF1B\u201C\u5DF2\u8FBE\u6210\u5DF2\u9886\u201D\u4E0D\u8868\u793A\u6240\u6709\u6863\u4F4D\u90FD\u5DF2\u5B8C\u6210\uFF0C\u672A\u540C\u6B65\u4E0D\u4F1A\u8BB0\u4E3A\u5DF2\u9886\u53D6\u3002\u65F6\u95F4\u4F7F\u7528\u5317\u4EAC\u65F6\u95F4MM-DD\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "activity-stats-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u7EDF\u8BA1"), /* @__PURE__ */ React11.createElement("span", { id: "activity-stats-status", className: "dim", role: "status" }, "\u8FDE\u63A5\u540E\u8BFB\u53D6")), /* @__PURE__ */ React11.createElement("div", { id: "activity-stats-table", className: "activity-statistics-scroll", "aria-label": "\u6D3B\u52A8\u7EDF\u8BA1\u8868\u683C", tabIndex: 0 })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u6D3B\u52A8\u6392\u884C\u699C", collapseId: "activity-rank-content", help: "\u53EA\u8BFB\u67E5\u770B\u6E38\u620F\u8FD4\u56DE\u7684\u73A9\u5BB6\u6392\u884C\uFF0C\u4E0D\u9886\u53D6\u5956\u52B1\u6216\u53D1\u8D77\u6311\u6218\u3002\u6309\u9875\u7B7E\u5207\u6362\uFF0C\u672A\u5F00\u653E\u4E0E\u672A\u4E0A\u699C\u4F1A\u5355\u72EC\u8BF4\u660E\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "activity-rank-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u6392\u884C"), /* @__PURE__ */ React11.createElement("span", { id: "activity-rank-status", className: "dim", role: "status" }, "\u8FDE\u63A5\u540E\u8BFB\u53D6")), /* @__PURE__ */ React11.createElement("div", { id: "activity-rank-tabs", className: "config-subtabs", role: "tablist", "aria-label": "\u6D3B\u52A8\u6392\u884C\u699C" }), /* @__PURE__ */ React11.createElement("div", { id: "activity-rank-panel", role: "tabpanel" }, /* @__PURE__ */ React11.createElement("p", { id: "activity-rank-mine", className: "dim" }), /* @__PURE__ */ React11.createElement("div", { id: "activity-rank-table", className: "activity-rank-table" })), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "activity-rank-prev", variant: "outline", size: "sm", disabled: true }, "\u4E0A\u4E00\u9875"), /* @__PURE__ */ React11.createElement("span", { id: "activity-rank-page", className: "dim" }), /* @__PURE__ */ React11.createElement(Button, { id: "activity-rank-next", variant: "outline", size: "sm", disabled: true }, "\u4E0B\u4E00\u9875"))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u4E16\u754C\u6982\u89C8", help: "\u53EA\u8BFB\u5730\u56FE\u3002\u79FB\u52A8\u4F4D\u7F6E\u6309\u5DF2\u540C\u6B65\u8D77\u7EC8\u70B9\u548C\u884C\u519B\u65F6\u95F4\u63A8\u7B97\u3002\u81EA\u52A8\u5237\u65B0\u4EC5\u5F71\u54CD\u672C\u6A21\u5757\uFF0C\u4E0D\u6539\u6302\u673A\u95F4\u9694\uFF1B\u53EF\u8BBE5\u2013300\u79D2\u3002", titleAfter: /* @__PURE__ */ React11.createElement("div", { className: "world-refresh-controls" }, /* @__PURE__ */ React11.createElement(Button, { id: "world-map-auto-refresh", size: "sm", variant: "outline", "aria-pressed": "true" }, "\u81EA\u52A8\u5237\u65B0\uFF1A\u5F00"), /* @__PURE__ */ React11.createElement("label", { className: "world-refresh-setting" }, "\u6BCF", /* @__PURE__ */ React11.createElement("input", { id: "world-map-refresh-seconds", "aria-label": "\u4E16\u754C\u6982\u89C8\u5237\u65B0\u79D2\u6570", type: "number", min: "5", max: "300", step: "1", defaultValue: "10" }), "\u79D2")) }, /* @__PURE__ */ React11.createElement("div", { id: "world-map-fleets", className: "fleet-summary", "aria-label": "\u6211\u7684\u8230\u961F" }), /* @__PURE__ */ React11.createElement("details", { className: "world-map-stats" }, /* @__PURE__ */ React11.createElement("summary", null, "\u57CE\u6218\u4E0E\u8D27\u8F6E\u8BE6\u60C5"), /* @__PURE__ */ React11.createElement("div", { id: "world-map-wars" }), /* @__PURE__ */ React11.createElement("div", { id: "world-map-treasures" })), /* @__PURE__ */ React11.createElement("details", { className: "world-map-stats" }, /* @__PURE__ */ React11.createElement("summary", null, "\u6C7D\u6CB9\u7528\u91CF"), /* @__PURE__ */ React11.createElement("div", { id: "world-map-resources" })), /* @__PURE__ */ React11.createElement("div", { className: "bar world-map-toolbar" }, /* @__PURE__ */ React11.createElement(Button, { id: "world-map-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u5730\u56FE"), /* @__PURE__ */ React11.createElement(Button, { id: "world-map-pan", variant: "outline", size: "sm", "aria-pressed": "false" }, "\u79FB\u52A8\u5730\u56FE"), /* @__PURE__ */ React11.createElement(Button, { id: "world-map-reset", variant: "outline", size: "sm" }, "\u5168\u56FE"), /* @__PURE__ */ React11.createElement(Button, { id: "world-map-home", variant: "outline", size: "sm" }, "\u5B9A\u4F4D\u8230\u961F"), /* @__PURE__ */ React11.createElement("label", { htmlFor: "world-map-zoom" }, "\u7F29\u653E"), /* @__PURE__ */ React11.createElement("input", { id: "world-map-zoom", type: "range", min: "1", max: "8", step: "0.25", defaultValue: "1" }), /* @__PURE__ */ React11.createElement("span", { id: "world-map-time", role: "status" }, "\u5C1A\u672A\u8BFB\u53D6")), /* @__PURE__ */ React11.createElement("div", { id: "world-map-layers", className: "bar" }), /* @__PURE__ */ React11.createElement("div", { className: "world-map-layout" }, /* @__PURE__ */ React11.createElement("div", { id: "world-map-scroll", className: "world-map-scroll" }, /* @__PURE__ */ React11.createElement("svg", { id: "world-map", role: "group", "aria-label": "\u53EA\u8BFB\u4E16\u754C\u5730\u56FE" })), /* @__PURE__ */ React11.createElement("div", { id: "world-map-legend", className: "world-map-legend" }), /* @__PURE__ */ React11.createElement("div", { id: "world-map-state-legend", className: "world-map-state-legend" }), /* @__PURE__ */ React11.createElement("p", { className: "world-map-help" }, /* @__PURE__ */ React11.createElement("span", { className: "for-mouse" }, "\u62D6\u52A8\u5E73\u79FB \xB7 Ctrl+\u6EDA\u8F6E\u7F29\u653E \xB7 "), /* @__PURE__ */ React11.createElement("span", { className: "for-touch" }, "\u70B9\u300C\u79FB\u52A8\u5730\u56FE\u300D\u540E\u5355\u6307\u62D6\u52A8 \xB7 \u7528\u7F29\u653E\u6ED1\u5757\u653E\u5927 \xB7 "), "\u653E\u5927\u67E5\u770B\u8230\u961F\u540D\u548C\u653B\u5B88\u4F18\u5148+\u6392\u961F\u6570"), /* @__PURE__ */ React11.createElement("aside", { id: "world-map-detail", className: "world-map-detail", hidden: true })), /* @__PURE__ */ React11.createElement("p", { id: "world-map-notes", className: "dim" }))));
}
function activitiesPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement("div", { className: "activity-toolbar" }, /* @__PURE__ */ React11.createElement("p", { className: "dim" }, "\u9009\u62E9\u6D3B\u52A8\uFF0C\u5355\u72EC\u6267\u884C\u6216\u8BBE\u7F6E\u81EA\u52A8\u8FD0\u884C\u3002"), /* @__PURE__ */ React11.createElement(Button, { id: "activities-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u6D3B\u52A8")), /* @__PURE__ */ React11.createElement("div", { id: "activities-status", className: "dim", role: "status" }), /* @__PURE__ */ React11.createElement("div", { className: "activity-shell" }, /* @__PURE__ */ React11.createElement("div", { id: "activity-tabs", className: "activity-tabs", role: "tablist", "aria-label": "\u9009\u62E9\u6D3B\u52A8" }), /* @__PURE__ */ React11.createElement("section", { id: "activity-panel", role: "tabpanel", tabIndex: 0, hidden: true }, /* @__PURE__ */ React11.createElement(Card, null, /* @__PURE__ */ React11.createElement(CardHeader, null, /* @__PURE__ */ React11.createElement("div", { className: "activity-heading" }, /* @__PURE__ */ React11.createElement(CardTitle, { id: "activity-title" }), /* @__PURE__ */ React11.createElement("span", { id: "activity-kind" })), /* @__PURE__ */ React11.createElement("p", { id: "activity-end", className: "dim" })), /* @__PURE__ */ React11.createElement(CardContent, { className: "activity-content" }, /* @__PURE__ */ React11.createElement("div", { id: "activity-pirates", hidden: true }, /* @__PURE__ */ React11.createElement("div", { id: "pirate-board-view", className: "pirate-board", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement("div", { id: "activity-detail" }, /* @__PURE__ */ React11.createElement("div", { id: "activities-list", className: "activity-body" }), /* @__PURE__ */ React11.createElement("div", { id: "activities-order" })))))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u6750\u6599\u6765\u6E90\u67E5\u8BE2" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "source-query" }, "\u6E38\u620F\u6750\u6599\u540D\u79F0"), /* @__PURE__ */ React11.createElement(Input, { id: "source-query", placeholder: "\u4F8B\u5982\uFF1A\u6709\u673A\u571F\u58E4" }), /* @__PURE__ */ React11.createElement("div", { id: "source-results", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement("template", { id: "ui-event-switch" }, /* @__PURE__ */ React11.createElement(Switch, { className: "p-0" }))));
}
function manualPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u4E00\u952E\u9886\u53D6", help: "\u9886\u53D6\u4E3B\u7EBF\u3001\u6210\u5C31\u3001\u90AE\u4EF6\u3001\u6302\u673A\u6536\u76CA\uFF0C\u4EE5\u53CA\u5DF2\u62E5\u6709\u82F1\u96C4\u7684\u6280\u80FD\u5C55\u793A\u9996\u9886\u5956\u52B1\uFF0C\u4E0D\u82B1\u94BB\u77F3\u3002\u9010\u9879\u7ED3\u679C\u89C1\u8FD0\u884C\u65E5\u5FD7\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "loot-run" }, "\u9886\u53D6\u73B0\u5728\u80FD\u9886\u7684"), /* @__PURE__ */ React11.createElement("span", { id: "loot-hint", role: "status" }))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u4EFB\u52A1\u5956\u52B1", help: "\u68C0\u67E5\u6216\u9886\u53D6\u4E3B\u7EBF\u3001\u652F\u7EBF\u3001\u6210\u5C31\u548C\u6BCF\u65E5\u8BA2\u5355\u6863\u4F4D\u5956\u52B1\u3002\u65E0\u6CD5\u786E\u8BA4\u76EE\u6807\u503C\u7684\u4EFB\u52A1\u4F1A\u8DF3\u8FC7\uFF0C\u7ED3\u679C\u89C1\u8FD0\u884C\u65E5\u5FD7\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "tasks-plan", variant: "outline" }, "\u68C0\u67E5\u53EF\u9886"), /* @__PURE__ */ React11.createElement(Button, { id: "tasks-run" }, "\u9886\u53D6\u4EFB\u52A1\u5956\u52B1"), /* @__PURE__ */ React11.createElement("span", { id: "tasks-hint", role: "status" }))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u6D77\u9762", help: "\u6536\u6210\u54C1 \u2192 \u7AE3\u5DE5 \u2192 \u4EA4\u5355 \u2192 \u6309\u8BA2\u5355\u7F3A\u53E3\u6392\u4EA7 \u2192 \u4F59\u6599\u5347\u7EA7\u5EFA\u7B51\u3002\u672C\u8F6E\u662F\u5426\u5141\u8BB8\u4F7F\u7528\u52A0\u901F\u5668\u3001\u62D2\u5355\u91CD\u5237\uFF0C\u7531\u4E0B\u65B9\u672C\u6B21\u5F00\u5173\u51B3\u5B9A\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Option, { id: "world-speedup", label: "\u672C\u8F6E\u5141\u8BB8\u82B1\u52A0\u901F\u5668" }), /* @__PURE__ */ React11.createElement(Option, { id: "world-reroll", label: "\u672C\u8F6E\u62D2\u5355\u91CD\u5237" }), /* @__PURE__ */ React11.createElement(Button, { id: "world-plan", variant: "outline" }, "\u5237\u65B0\u6570\u636E"), /* @__PURE__ */ React11.createElement(Button, { id: "world-run", variant: "default" }, "\u6267\u884C\u4E00\u8F6E"), /* @__PURE__ */ React11.createElement("span", { id: "world-hint", className: "warn" })), /* @__PURE__ */ React11.createElement("div", { id: "world-view", role: "status" }), /* @__PURE__ */ React11.createElement("div", { id: "world-factories" }), /* @__PURE__ */ React11.createElement("div", { id: "world-orders" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u8D44\u6E90\u7530" }, /* @__PURE__ */ React11.createElement("div", { id: "world-fields" }))));
}
function inventoryPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u4ED3\u5E93" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "inventory-refresh", variant: "outline" }, "\u5237\u65B0\u5E93\u5B58"), /* @__PURE__ */ React11.createElement("span", { id: "inventory-status", className: "dim", role: "status" }, "\u5C1A\u672A\u8BFB\u53D6")), /* @__PURE__ */ React11.createElement("div", { className: "bar inventory-search" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "inventory-query" }, "\u8D44\u6E90\u540D\u79F0"), /* @__PURE__ */ React11.createElement(Input, { id: "inventory-query", type: "search", placeholder: "\u641C\u7D22\u8D44\u6E90\u540D\u79F0" }), /* @__PURE__ */ React11.createElement("span", { id: "inventory-match-count", className: "dim" })), /* @__PURE__ */ React11.createElement("details", { id: "world-stock-panel" }, /* @__PURE__ */ React11.createElement("summary", null, "\u5C55\u5F00\u5206\u7C7B\u5E93\u5B58"), /* @__PURE__ */ React11.createElement("div", { id: "world-stock" })))));
}
function heroesPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u4E3B\u529B\u82F1\u96C4" }, /* @__PURE__ */ React11.createElement("div", { className: "icons", id: "hero-strip" }, /* @__PURE__ */ React11.createElement("span", { className: "dim" }, "\u8FDE\u63A5\u540E\u663E\u793A"))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u82F1\u96C4\u517B\u6210", help: "\u5347\u7EA7\u3001\u5347\u661F\u3001\u5347\u6280\u80FD\u7684\u6761\u4EF6\u53D6\u81EA\u6E38\u620F\u5BA2\u6237\u7AEF\u7684\u7EA2\u70B9\u903B\u8F91\uFF1B\u6267\u884C\u524D\u4F1A\u5148\u7B97\u4E00\u904D\u8BA1\u5212\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "hero-plan", variant: "outline" }, "\u8BA1\u7B97\u8BA1\u5212"), /* @__PURE__ */ React11.createElement(Button, { id: "hero-run", variant: "default" }, "\u6267\u884C\u517B\u6210"), /* @__PURE__ */ React11.createElement("span", { id: "hero-hint", className: "warn" })), /* @__PURE__ */ React11.createElement("pre", { id: "hero-view" }, "\u5C1A\u672A\u8BA1\u7B97"), /* @__PURE__ */ React11.createElement("div", { id: "hero-table" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u82F1\u96C4\u4EFB\u547D", help: "\u6309\u6E38\u620F\u5185\u7684\u804C\u4F4D\u4F18\u5148\u987A\u5E8F\u81EA\u52A8\u5206\u914D\u82F1\u96C4\uFF0C\u5DF2\u6709\u4EFB\u547D\u53EF\u80FD\u8C03\u6574\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "appoint-view", variant: "outline" }, "\u67E5\u770B\u804C\u4F4D"), /* @__PURE__ */ React11.createElement(Button, { id: "appoint-run", variant: "default" }, "\u4E00\u952E\u4EFB\u547D")), /* @__PURE__ */ React11.createElement("div", { id: "appoint-table", className: "dim" }, "\u5C1A\u672A\u67E5\u770B\u804C\u4F4D")), /* @__PURE__ */ React11.createElement(Panel, { title: "\u82F1\u96C4\u88C5\u5907" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "equipment-refresh", variant: "outline" }, "\u5237\u65B0\u88C5\u5907")), /* @__PURE__ */ React11.createElement("div", { id: "equipment-view", className: "progression-view", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u88C5\u5907\u5236\u9020" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "crafting-refresh", variant: "outline" }, "\u5237\u65B0\u88C5\u5907\u5382")), /* @__PURE__ */ React11.createElement("div", { id: "crafting-view", className: "progression-view", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u63A8\u8350\u9635\u5BB9" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "lineup-refresh", variant: "outline" }, "\u5237\u65B0\u63A8\u8350")), /* @__PURE__ */ React11.createElement("div", { id: "lineup-view", className: "progression-view", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u8FDC\u5F81\u8230\u961F\u7F16\u961F", help: "\u4FDD\u7559\u7A7A\u7F16\u961F\u7684\u521D\u59CB\u5316\u5165\u53E3\u3002\u5DF2\u6709\u7F16\u961F\u4E0D\u4F1A\u81EA\u52A8\u91CD\u6392\uFF1B\u8230\u961F\u72B6\u6001\u5728\u603B\u89C8\u67E5\u770B\uFF0C\u9996\u6740\u8FDE\u7EED\u63A8\u8FDB\u5728\u6302\u673A\u9875\u5F00\u542F\u3002" }, /* @__PURE__ */ React11.createElement("div", { id: "formation-view", className: "progression-view", "aria-live": "polite" }))));
}
function dailiesPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u6BCF\u65E5\u4EFB\u52A1", help: "\u5148\u201C\u63A2\u6D4B\u201D\u67E5\u770B\u5F53\u524D\u80FD\u505A\u54EA\u4E9B\u4EFB\u52A1\u53CA\u4E0D\u80FD\u6267\u884C\u7684\u539F\u56E0\u3002\u70B9\u91D1\u4E0E\u6298\u6263\u5E97\u9ED8\u8BA4\u8DF3\u8FC7\uFF0C\u52FE\u9009\u5141\u8BB8\u82B1\u94BB\u77F3\u624D\u4F1A\u6D88\u8D39\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "dailies-plan", variant: "outline" }, "\u63A2\u6D4B"), /* @__PURE__ */ React11.createElement(Button, { id: "dailies-run", variant: "default" }, "\u4E00\u952E\u5B8C\u6210"), /* @__PURE__ */ React11.createElement(Option, { id: "dailies-paid", label: "\u5141\u8BB8\u82B1\u94BB\u77F3\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF09" }), /* @__PURE__ */ React11.createElement("span", { id: "dailies-hint", className: "warn" })), /* @__PURE__ */ React11.createElement("div", { id: "dailies-table" }))));
}
function accountPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u8D26\u53F7", help: "\u5BFC\u51FA\u7684\u8D26\u53F7\u5907\u4EFD\u542B\u767B\u5F55\u51ED\u8BC1\uFF0C\u8BF7\u59A5\u5584\u4FDD\u7BA1\u3002\u8D26\u53F7\u5207\u6362\u4E0E\u6682\u505C\u72B6\u6001\u5206\u522B\u4FDD\u5B58\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "export-accounts", variant: "outline" }, "\u5BFC\u51FA\u5168\u90E8\u8D26\u53F7"), /* @__PURE__ */ React11.createElement("span", { className: "dim" }, "\u5907\u4EFD\u542B\u767B\u5F55\u51ED\u8BC1")), /* @__PURE__ */ React11.createElement("div", { id: "accounts" }), /* @__PURE__ */ React11.createElement("div", { id: "account-detail-home", hidden: true }, /* @__PURE__ */ React11.createElement("div", { id: "account-details" }, /* @__PURE__ */ React11.createElement("h4", null, "\u89D2\u8272\u6982\u51B5"), /* @__PURE__ */ React11.createElement("div", { className: "who", id: "who" }, "\u7B49\u5F85\u8FDE\u63A5"), /* @__PURE__ */ React11.createElement("h4", null, "\u8D44\u6E90"), /* @__PURE__ */ React11.createElement("div", { className: "resource-strip", id: "res" }, "\u8FDE\u63A5\u540E\u663E\u793A"), /* @__PURE__ */ React11.createElement("h4", null, "\u51ED\u8BC1"), "    ", /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "cred-show", variant: "outline" }, "\u663E\u793A\u51ED\u8BC1"), /* @__PURE__ */ React11.createElement(Button, { id: "cred-hide", variant: "outline" }, "\u6536\u8D77"), /* @__PURE__ */ React11.createElement("span", { className: "dim" }, "\u4EC5\u9650\u672C\u673A\u4F7F\u7528")), /* @__PURE__ */ React11.createElement("div", { id: "cred" }), /* @__PURE__ */ React11.createElement("h4", null, "\u533A\u670D"), "    ", /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "load-worlds", variant: "outline" }, "\u52A0\u8F7D\u533A\u670D"), /* @__PURE__ */ React11.createElement(Input, { id: "world-input", "aria-label": "\u533A\u670D ID", placeholder: "\u533A\u670D ID", className: "w-32" }), /* @__PURE__ */ React11.createElement(Button, { id: "enter-world", variant: "outline" }, "\u8FDB\u5165\u8BE5\u533A\u670D"), /* @__PURE__ */ React11.createElement("span", { id: "worlds-hint", className: "warn" })), /* @__PURE__ */ React11.createElement("div", { id: "worlds" })))), /* @__PURE__ */ React11.createElement(Panel, { title: "\u624B\u673A\u53F7\u767B\u5F55", help: "\u4F7F\u7528\u76CA\u4E16\u754C/APP \u7684\u8D26\u53F7\u5BC6\u7801\u6216\u77ED\u4FE1\u9A8C\u8BC1\u7801\u767B\u5F55\u3002\u5BC6\u7801\u53EA\u7528\u4E8E\u672C\u6B21\u8BF7\u6C42\uFF0C\u4E0D\u4FDD\u5B58\u3002\u767B\u5F55\u540E\u5148\u6838\u5BF9 openId \u662F\u5426\u5BF9\u5E94\u5DF2\u6709\u89D2\u8272\uFF0C\u518D\u4FDD\u5B58\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Input, { id: "phone-account", placeholder: "\u624B\u673A\u53F7\u6216\u8D26\u53F7", autoComplete: "username" }), /* @__PURE__ */ React11.createElement(Input, { id: "phone-password", type: "password", placeholder: "\u767B\u5F55\u5BC6\u7801", autoComplete: "current-password" }), /* @__PURE__ */ React11.createElement(Button, { id: "phone-login", variant: "default" }, "\u8D26\u53F7\u767B\u5F55\u5E76\u9884\u89C8"), /* @__PURE__ */ React11.createElement(Button, { id: "phone-save", variant: "outline", disabled: true }, "\u4FDD\u5B58\u4E3A\u8D26\u53F7"), /* @__PURE__ */ React11.createElement("span", { id: "phone-hint", className: "warn", role: "status" })), /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Input, { id: "phone-code", placeholder: "\u77ED\u4FE1\u9A8C\u8BC1\u7801", inputMode: "numeric", autoComplete: "one-time-code" }), /* @__PURE__ */ React11.createElement(Button, { id: "phone-send-code", variant: "outline" }, "\u53D1\u9001\u9A8C\u8BC1\u7801"), /* @__PURE__ */ React11.createElement(Button, { id: "phone-sms-login", variant: "default" }, "\u9A8C\u8BC1\u7801\u767B\u5F55\u5E76\u9884\u89C8")), /* @__PURE__ */ React11.createElement("div", { id: "phone-result" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u6DFB\u52A0\u8D26\u53F7" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "cap-start", variant: "default" }, "\u4ECE\u7535\u8111\u5FAE\u4FE1\u6DFB\u52A0"), /* @__PURE__ */ React11.createElement(Button, { id: "cap-douyin", variant: "outline" }, "\u4ECE\u7535\u8111\u6296\u97F3\u6DFB\u52A0"), /* @__PURE__ */ React11.createElement(Button, { id: "cap-stop", variant: "destructive" }, "\u505C\u6B62\u6293\u5305"), /* @__PURE__ */ React11.createElement("span", { id: "cap-hint", className: "warn" })), /* @__PURE__ */ React11.createElement("div", { id: "cap-box" }))));
}
function loginSettingsPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { id: "login-settings-root", className: "login-settings-page" }, /* @__PURE__ */ React11.createElement("div", { className: "login-settings-heading" }, /* @__PURE__ */ React11.createElement("div", { className: "login-settings-heading-copy" }, /* @__PURE__ */ React11.createElement("div", null, /* @__PURE__ */ React11.createElement("h2", { className: "text-xl font-semibold" }, "\u767B\u5F55\u8BBE\u7F6E"), /* @__PURE__ */ React11.createElement("p", { className: "dim mt-1" }, "\u8D26\u53F7\u88AB\u9876\u53F7\u540E\u81EA\u52A8\u91CD\u65B0\u8FDE\u63A5"))), /* @__PURE__ */ React11.createElement(Badge, { id: "login-settings-state", className: "login-settings-state", variant: "outline", role: "status", "aria-live": "polite" }, "\u5C1A\u672A\u8F7D\u5165")), /* @__PURE__ */ React11.createElement("form", { id: "login-settings-form", noValidate: true }, /* @__PURE__ */ React11.createElement(Card, { className: "login-settings-card" }, /* @__PURE__ */ React11.createElement(CardHeader, null, /* @__PURE__ */ React11.createElement(CardTitle, null, "\u9876\u53F7\u91CD\u8FDE\u5EF6\u8FDF\u65F6\u95F4"), /* @__PURE__ */ React11.createElement("p", { className: "dim" }, "\u8D26\u53F7\u5728\u6267\u884C\u4EFB\u52A1\u65F6\u88AB\u9876\u53F7\uFF0C\u7B49\u5F85\u4E00\u6BB5\u65F6\u95F4\u540E\u518D\u91CD\u65B0\u767B\u5F55\u3002")), /* @__PURE__ */ React11.createElement(CardContent, null, /* @__PURE__ */ React11.createElement("div", { className: "login-settings-toggle-row" }, /* @__PURE__ */ React11.createElement("div", null, /* @__PURE__ */ React11.createElement("strong", null, "\u542F\u7528\u88AB\u9876\u53F7\u540E\u81EA\u52A8\u91CD\u8FDE"), /* @__PURE__ */ React11.createElement("span", { className: "dim" }, "\u4EC5\u5728\u68C0\u6D4B\u5230\u201C\u8D26\u53F7\u5728\u522B\u5904\u767B\u5F55\u201D\u65F6\u89E6\u53D1\u3002")), /* @__PURE__ */ React11.createElement(Switch, { id: "login-reconnect-enabled", "data-login-setting": "reconnectEnabled", "aria-label": "\u542F\u7528\u88AB\u9876\u53F7\u540E\u81EA\u52A8\u91CD\u8FDE" })), /* @__PURE__ */ React11.createElement("div", { className: "login-settings-grid" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-reconnect-delay" }, /* @__PURE__ */ React11.createElement("span", null, "\u57FA\u7840\u91CD\u8FDE\u95F4\u9694"), /* @__PURE__ */ React11.createElement("span", { className: "login-settings-field" }, /* @__PURE__ */ React11.createElement(Input, { id: "login-reconnect-delay", "data-login-setting": "baseDelaySeconds", type: "number", min: "1", max: "86400", step: "1", defaultValue: "900" }), /* @__PURE__ */ React11.createElement("span", null, "\u79D2"))), /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-reconnect-jitter" }, /* @__PURE__ */ React11.createElement("span", null, "\u95F4\u9694\u6296\u52A8"), /* @__PURE__ */ React11.createElement("span", { className: "login-settings-field" }, /* @__PURE__ */ React11.createElement(Input, { id: "login-reconnect-jitter", "data-login-setting": "jitterSeconds", type: "number", min: "0", max: "86400", step: "1", defaultValue: "0" }), /* @__PURE__ */ React11.createElement("span", null, "\u79D2")))), /* @__PURE__ */ React11.createElement("p", { className: "dim login-settings-note" }, "\u5B9E\u9645\u7B49\u5F85\u65F6\u95F4\u4F1A\u5728\u57FA\u7840\u95F4\u9694\u4E0A\u4E0B\u968F\u673A\u8C03\u6574\uFF0C\u907F\u514D\u56FA\u5B9A\u65F6\u95F4\u91CD\u590D\u767B\u5F55\u3002"))), /* @__PURE__ */ React11.createElement(Card, { className: "login-settings-card" }, /* @__PURE__ */ React11.createElement(CardHeader, null, /* @__PURE__ */ React11.createElement(CardTitle, null, "\u6DF1\u591C\u7A7A\u7A97\u671F"), /* @__PURE__ */ React11.createElement("p", { className: "dim" }, "\u5728\u6307\u5B9A\u65F6\u95F4\u6BB5\u5185\u4F7F\u7528\u72EC\u7ACB\u7684\u77ED\u5EF6\u8FDF\uFF0C\u9002\u5408\u51CC\u6668\u81EA\u52A8\u6062\u590D\u8FDE\u63A5\u3002")), /* @__PURE__ */ React11.createElement(CardContent, null, /* @__PURE__ */ React11.createElement("div", { className: "login-settings-toggle-row" }, /* @__PURE__ */ React11.createElement("div", null, /* @__PURE__ */ React11.createElement("strong", null, "\u542F\u7528\u6DF1\u591C\u7A7A\u7A97\u671F"), /* @__PURE__ */ React11.createElement("span", { className: "dim" }, "\u8DE8\u5348\u591C\u7684\u65F6\u95F4\u6BB5\u4E5F\u53EF\u4EE5\u4F7F\u7528\uFF0C\u4F8B\u5982 23:00\u201306:00\u3002")), /* @__PURE__ */ React11.createElement(Switch, { id: "login-deep-enabled", "data-login-setting": "deep.enabled", "aria-label": "\u542F\u7528\u6DF1\u591C\u7A7A\u7A97\u671F" })), /* @__PURE__ */ React11.createElement("div", { className: "login-settings-grid login-settings-time-grid" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-deep-start" }, /* @__PURE__ */ React11.createElement("span", null, "\u5F00\u59CB\u65F6\u95F4"), /* @__PURE__ */ React11.createElement(Input, { id: "login-deep-start", "data-login-setting": "deep.start", type: "time", defaultValue: "02:00" })), /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-deep-end" }, /* @__PURE__ */ React11.createElement("span", null, "\u7ED3\u675F\u65F6\u95F4"), /* @__PURE__ */ React11.createElement(Input, { id: "login-deep-end", "data-login-setting": "deep.end", type: "time", defaultValue: "07:00" })), /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-deep-delay" }, /* @__PURE__ */ React11.createElement("span", null, "\u7A7A\u7A97\u671F\u91CD\u8FDE\u5EF6\u8FDF"), /* @__PURE__ */ React11.createElement("span", { className: "login-settings-field" }, /* @__PURE__ */ React11.createElement(Input, { id: "login-deep-delay", "data-login-setting": "deep.delaySeconds", type: "number", min: "1", max: "86400", step: "1", defaultValue: "60" }), /* @__PURE__ */ React11.createElement("span", null, "\u79D2")))))), /* @__PURE__ */ React11.createElement(Card, { className: "login-settings-card" }, /* @__PURE__ */ React11.createElement(CardHeader, null, /* @__PURE__ */ React11.createElement(CardTitle, null, "\u91CD\u8BD5\u9650\u5236"), /* @__PURE__ */ React11.createElement("p", { className: "dim" }, "\u9876\u53F7\u91CD\u8FDE\u8FDE\u7EED\u5931\u8D25\u8FBE\u5230\u4E0A\u9650\u540E\u505C\u6B62\u672C\u8F6E\u91CD\u8BD5\uFF0C\u5E76\u5728\u8FD0\u884C\u65E5\u5FD7\u4E2D\u8BB0\u5F55\u539F\u56E0\u3002")), /* @__PURE__ */ React11.createElement(CardContent, null, /* @__PURE__ */ React11.createElement("div", { className: "login-settings-grid login-settings-retry-grid" }, /* @__PURE__ */ React11.createElement("label", { htmlFor: "login-reconnect-max-retries" }, /* @__PURE__ */ React11.createElement("span", null, "\u6700\u5927\u91CD\u8BD5\u6B21\u6570"), /* @__PURE__ */ React11.createElement("span", { className: "login-settings-field" }, /* @__PURE__ */ React11.createElement(Input, { id: "login-reconnect-max-retries", "data-login-setting": "maxRetries", type: "number", min: "1", max: "1000", step: "1", defaultValue: "5" }), /* @__PURE__ */ React11.createElement("span", null, "\u6B21")))), /* @__PURE__ */ React11.createElement("p", { id: "login-reconnect-log", className: "dim login-settings-log", role: "status" }, "\u8D85\u8FC7\u4E0A\u9650\u540E\u81EA\u52A8\u505C\u6B62\u91CD\u8BD5\uFF0C\u8BE6\u60C5\u89C1\u8FD0\u884C\u65E5\u5FD7\u3002"))), /* @__PURE__ */ React11.createElement("div", { className: "login-settings-actions" }, /* @__PURE__ */ React11.createElement(Button, { id: "login-settings-reset", type: "button", variant: "outline" }, "\u6062\u590D\u5DF2\u4FDD\u5B58\u8BBE\u7F6E"), /* @__PURE__ */ React11.createElement(Button, { id: "login-settings-save", type: "submit" }, "\u4FDD\u5B58\u8BBE\u7F6E")))));
}
function guildPage() {
  return renderToStaticMarkup2(/* @__PURE__ */ React11.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React11.createElement(Panel, { title: "\u8054\u76DF\u798F\u5229" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "guild-refresh", variant: "outline" }, "\u5237\u65B0\u8054\u76DF")), /* @__PURE__ */ React11.createElement("div", { id: "guild-view", className: "progression-view", "aria-live": "polite" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u8054\u76DF\u6C42\u52A9" }, /* @__PURE__ */ React11.createElement("div", { id: "guild-aid-view", className: "progression-view" })), /* @__PURE__ */ React11.createElement(Panel, { title: "\u8054\u76DF\u79D1\u6280", help: "\u5F53\u524D\u89D2\u8272\u7684\u79D1\u6280\u7B49\u7EA7\u4E0E\u52A0\u6210\u3002\u5347\u7EA7\u53EA\u6267\u884C\u4E00\u7EA7\uFF0C\u6263\u9664\u5BF9\u5E94\u79D1\u6280\u70B9\uFF1B\u53D1\u9001\u524D\u91CD\u65B0\u6838\u5BF9\u7B49\u7EA7\u3001\u9636\u6BB5\u3001\u524D\u7F6E\u79D1\u6280\u548C\u8D39\u7528\u3002" }, /* @__PURE__ */ React11.createElement("div", { className: "bar" }, /* @__PURE__ */ React11.createElement(Button, { id: "guild-tech-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u79D1\u6280")), /* @__PURE__ */ React11.createElement("div", { id: "guild-tech-view", className: "progression-view", "aria-live": "polite" }))));
}

// src/ui/settings.tsx
import * as React12 from "react";
import { renderToStaticMarkup as renderToStaticMarkup3 } from "react-dom/server";
function settingsPage() {
  return renderToStaticMarkup3(/* @__PURE__ */ React12.createElement("div", { id: "config-root" }, /* @__PURE__ */ React12.createElement("div", { className: "config-toolbar" }, /* @__PURE__ */ React12.createElement("div", { className: "config-owner" }, /* @__PURE__ */ React12.createElement("div", { className: "title-with-help" }, /* @__PURE__ */ React12.createElement("strong", { id: "config-account-name" }, "\u5F53\u524D\u8D26\u53F7\u7684\u6E38\u620F\u914D\u7F6E"), /* @__PURE__ */ React12.createElement(HelpTip, { title: "\u6E38\u620F\u914D\u7F6E" }, "\u4FDD\u5B58\u53EA\u66F4\u65B0\u5F53\u524D\u8D26\u53F7\u7684\u914D\u7F6E\uFF0C\u4E0D\u4F1A\u542F\u52A8\u6302\u673A\u3002\u5DF2\u6709\u6302\u673A\u5728\u4E0B\u6B21\u68C0\u67E5\u65F6\u4F7F\u7528\u65B0\u8BBE\u7F6E\uFF1B\u8FD0\u884C\u8F6E\u6570\u5728\u4E0B\u6B21\u5F00\u59CB\u6302\u673A\u65F6\u751F\u6548\u3002")), /* @__PURE__ */ React12.createElement("span", { id: "config-state", role: "status", "aria-live": "polite" }, "\u5C1A\u672A\u8F7D\u5165")), /* @__PURE__ */ React12.createElement("div", { className: "config-actions" }, /* @__PURE__ */ React12.createElement(Button, { id: "config-import", type: "button", size: "sm", variant: "outline", disabled: true }, "\u5BFC\u5165"), /* @__PURE__ */ React12.createElement(Button, { id: "config-export", type: "button", size: "sm", variant: "outline", disabled: true }, "\u5BFC\u51FA"), /* @__PURE__ */ React12.createElement(Button, { id: "config-save", type: "submit", size: "sm", form: "config-form", "aria-label": "\u4FDD\u5B58\u914D\u7F6E", disabled: true }, "\u4FDD\u5B58"), /* @__PURE__ */ React12.createElement("input", { id: "config-file", type: "file", accept: ".json,application/json", hidden: true }))), /* @__PURE__ */ React12.createElement("div", { className: "config-message", id: "config-message", role: "alert", hidden: true }), /* @__PURE__ */ React12.createElement("div", { className: "config-tabs", role: "tablist", "aria-label": "\u914D\u7F6E\u5206\u7C7B" }, [["base", "\u57FA\u5730"], ["world", "\u4E16\u754C"], ["heroes", "\u82F1\u96C4"], ["daily", "\u65E5\u5E38\u4E0E\u6D3B\u52A8"]].map(
    ([key, title], index) => /* @__PURE__ */ React12.createElement("button", { key, type: "button", role: "tab", id: "config-tab-" + key, "data-config-tab": key, "aria-controls": "config-panel-" + key, "aria-selected": index === 0, tabIndex: index === 0 ? 0 : -1 }, title)
  )), /* @__PURE__ */ React12.createElement("form", { id: "config-form", noValidate: true }, /* @__PURE__ */ React12.createElement("div", { id: "config-fields", className: "config-sheet" }, /* @__PURE__ */ React12.createElement("p", { className: "config-empty" }, "\u8F7D\u5165\u5F53\u524D\u8D26\u53F7\u540E\u5373\u53EF\u8BBE\u7F6E\u3002"))), /* @__PURE__ */ React12.createElement("div", { className: "config-foot" }, /* @__PURE__ */ React12.createElement(Button, { id: "config-reload", type: "button", size: "sm", variant: "ghost", "aria-label": "\u91CD\u65B0\u8F7D\u5165\u5DF2\u4FDD\u5B58\u914D\u7F6E", disabled: true }, "\u91CD\u65B0\u8F7D\u5165"), /* @__PURE__ */ React12.createElement("span", { id: "config-saved-time" })), /* @__PURE__ */ React12.createElement("section", { className: "config-preview", "aria-labelledby": "config-preview-title" }, /* @__PURE__ */ React12.createElement("div", { className: "config-preview-head" }, /* @__PURE__ */ React12.createElement("div", { className: "title-with-help" }, /* @__PURE__ */ React12.createElement("h3", { id: "config-preview-title" }, "\u6267\u884C\u9884\u89C8"), /* @__PURE__ */ React12.createElement(HelpTip, { title: "\u53EA\u8BFB\u9884\u89C8" }, "\u6309\u5F53\u524D\u8349\u7A3F\u8BFB\u53D6\u771F\u5B9E\u72B6\u6001\uFF0C\u53EA\u8BA1\u7B97\u8BA1\u5212\uFF0C\u4E0D\u6D88\u8017\u8D44\u6E90\u3002\u8BA1\u5212\u662F\u5F53\u524D\u5FEB\u7167\uFF0C\u6267\u884C\u524D\u4ECD\u4F1A\u91CD\u65B0\u68C0\u67E5\u6761\u4EF6\u3002\u57FA\u5730\u3001\u4E07\u5428\u3001\u82F1\u96C4\u3001\u65E5\u5E38\u3001\u8054\u76DF/\u57CE\u6218\u4E0E\u953B\u9020\u90FD\u53EF\u9009\u62E9\uFF1B\u6D3B\u52A8\u53EA\u5C55\u793A\u5F00\u653E\u72B6\u6001\uFF0C\u8FD0\u884C\u5B89\u6392\u4E0D\u9700\u8981\u8FDE\u63A5\u3002")), /* @__PURE__ */ React12.createElement("div", { className: "config-preview-controls" }, /* @__PURE__ */ React12.createElement("label", { htmlFor: "config-preview-scope" }, "\u8303\u56F4"), /* @__PURE__ */ React12.createElement("select", { id: "config-preview-scope", "aria-label": "\u9884\u89C8\u8303\u56F4", className: "config-select", defaultValue: "current" }, /* @__PURE__ */ React12.createElement("option", { value: "current" }, "\u5F53\u524D\u5206\u7C7B"), /* @__PURE__ */ React12.createElement("option", { value: "base" }, "\u57FA\u5730\u5168\u90E8\u9879\u76EE"), /* @__PURE__ */ React12.createElement("option", { value: "world" }, "\u4E07\u5428\u5DE8\u8F6E"), /* @__PURE__ */ React12.createElement("option", { value: "radar" }, "\u8054\u76DF\u60C5\u62A5"), /* @__PURE__ */ React12.createElement("option", { value: "pirateHunt" }, "\u6D77\u76D7\u9996\u6740"), /* @__PURE__ */ React12.createElement("option", { value: "pirateSweep" }, "\u6D77\u76D7\u65E5\u5E38\u626B\u8361"), /* @__PURE__ */ React12.createElement("option", { value: "worldBoss" }, "\u4E16\u754CBoss\u9996\u6218"), /* @__PURE__ */ React12.createElement("option", { value: "cityWar" }, "\u8054\u76DF/\u57CE\u6218"), /* @__PURE__ */ React12.createElement("option", { value: "forge" }, "\u88C5\u5907\u953B\u9020"), /* @__PURE__ */ React12.createElement("option", { value: "heroes" }, "\u82F1\u96C4\u517B\u6210"), /* @__PURE__ */ React12.createElement("option", { value: "daily" }, "\u65E5\u5E38\u4EFB\u52A1\u4E0E\u9886\u5956"), /* @__PURE__ */ React12.createElement("option", { value: "activity" }, "\u6D3B\u52A8\u72B6\u6001\uFF08\u53EA\u8BFB\uFF09"), /* @__PURE__ */ React12.createElement("option", { value: "fleetDispatch" }, "\u8230\u961F\u8C03\u5EA6\uFF08\u53EA\u8BFB\uFF09"), /* @__PURE__ */ React12.createElement("option", { value: "runtime" }, "\u8FD0\u884C\u5B89\u6392\uFF08\u53EA\u8BFB\uFF09")), /* @__PURE__ */ React12.createElement(Button, { id: "config-preview", type: "button", size: "sm", variant: "outline", "aria-label": "\u53EA\u8BFB\u9884\u89C8\u8BA1\u5212", disabled: true }, "\u53EA\u8BFB\u9884\u89C8"))), /* @__PURE__ */ React12.createElement("div", { id: "config-usage" }), /* @__PURE__ */ React12.createElement("div", { id: "config-preview-result", "aria-live": "polite" })), /* @__PURE__ */ React12.createElement("template", { id: "config-switch-template" }, /* @__PURE__ */ React12.createElement("button", { type: "button", role: "switch", "aria-checked": "false", "data-state": "unchecked", className: "config-switch" }, /* @__PURE__ */ React12.createElement("span", { className: "config-switch-track", "aria-hidden": "true" }, /* @__PURE__ */ React12.createElement("span", { className: "config-switch-thumb" }))))));
}

// src/ui/console.tsx
function idlePanel(tasks) {
  const modules = tasks.filter((t) => t.idleGroup);
  const groups = ["\u57FA\u5730", "\u4E16\u754C", "\u82F1\u96C4", "\u65E5\u5E38\u4E0E\u6D3B\u52A8"];
  return renderToStaticMarkup4(/* @__PURE__ */ React13.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React13.createElement(Card, { className: "idle-schedule" }, /* @__PURE__ */ React13.createElement(CardHeader, null, /* @__PURE__ */ React13.createElement(CardTitle, { className: "title-with-help" }, "\u5B9A\u65F6\u6302\u673A", /* @__PURE__ */ React13.createElement(HelpTip, { title: "\u5B9A\u65F6\u6302\u673A" }, "\u8F6E\u6570\u586B 0 \u8868\u793A\u6301\u7EED\u8FD0\u884C\u3002\u6BCF\u8F6E\u53EA\u6267\u884C\u5F53\u524D\u8D26\u53F7\u5DF2\u5F00\u542F\u7684\u4EFB\u52A1\u3002\u5173\u95ED\u7F51\u9875\u540E\u7EE7\u7EED\u5728\u540E\u53F0\u8FD0\u884C\uFF0C\u65E5\u5FD7\u540C\u6B65\u8F93\u51FA\u5230\u542F\u52A8\u7A97\u53E3\uFF1B\u8BF7\u4FDD\u6301\u542F\u52A8\u7A97\u53E3\u6253\u5F00\u3002"), /* @__PURE__ */ React13.createElement("span", { className: "dim heading-status", id: "loop-hint", role: "status" }))), /* @__PURE__ */ React13.createElement(CardContent, null, /* @__PURE__ */ React13.createElement("div", { className: "loop-form" }, /* @__PURE__ */ React13.createElement("label", { htmlFor: "loop-rounds" }, "\u8F6E\u6570", /* @__PURE__ */ React13.createElement(Input, { id: "loop-rounds", type: "number", min: "0", defaultValue: "0" })), /* @__PURE__ */ React13.createElement("label", { htmlFor: "loop-every" }, "\u95F4\u9694\uFF08\u79D2\uFF09", /* @__PURE__ */ React13.createElement(Input, { id: "loop-every", type: "number", min: "1", max: "86400", defaultValue: "60" })), /* @__PURE__ */ React13.createElement(Button, { id: "loop-start", disabled: true }, "\u5F00\u59CB\u6302\u673A"), /* @__PURE__ */ React13.createElement(Button, { id: "loop-stop", variant: "outline", disabled: true }, "\u6682\u505C\u6302\u673A")), /* @__PURE__ */ React13.createElement("p", { className: "dim" }, "\u5173\u95ED\u7F51\u9875\u540E\u7EE7\u7EED\u6302\u673A\uFF0C\u65E5\u5FD7\u540C\u6B65\u663E\u793A\u5728\u542F\u52A8\u7A97\u53E3\u3002\u6301\u7EED\u8FD0\u884C\u8BF7\u5C06\u8F6E\u6570\u8BBE\u4E3A 0\uFF0C\u5E76\u4FDD\u6301\u542F\u52A8\u7A97\u53E3\u6253\u5F00\u3002"))), /* @__PURE__ */ React13.createElement(Card, { className: "idle-notes" }, /* @__PURE__ */ React13.createElement(CardContent, null, /* @__PURE__ */ React13.createElement("p", { className: "dim", id: "single-task-status" }, "\u5355\u72EC\u542F\u52A8\uFF1A\u9996\u6740\u63A8\u8FDB\u3001\u4E3B\u7EBF\u63A8\u5173\u3001\u8054\u76DF\u4E92\u52A9\u3002\u5F00\u59CB\u6302\u673A\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\u8FD9\u4E9B\u4EFB\u52A1\u3002"), /* @__PURE__ */ React13.createElement("div", { className: "bar" }, /* @__PURE__ */ React13.createElement(Button, { id: "single-go-pirate", variant: "outline", size: "sm" }, "\u524D\u5F80\u9996\u6740\u63A8\u8FDB"), /* @__PURE__ */ React13.createElement(Button, { id: "single-go-stages", variant: "outline", size: "sm" }, "\u524D\u5F80\u4E3B\u7EBF\u63A8\u5173"), /* @__PURE__ */ React13.createElement(Button, { id: "single-go-mutual", variant: "outline", size: "sm" }, "\u524D\u5F80\u8054\u76DF\u4E92\u52A9")), /* @__PURE__ */ React13.createElement("details", { className: "idle-more" }, /* @__PURE__ */ React13.createElement("summary", null, "\u4F7F\u7528\u8BF4\u660E"), /* @__PURE__ */ React13.createElement("p", { className: "dim" }, "\u8FD9\u91CC\u53EA\u63A7\u5236\u6A21\u5757\u5F00\u542F\uFF1B\u5EFA\u9020\u3001\u6536\u53D6\u3001\u6362\u5355\u3001\u62DB\u52DF\u4E0E\u6D3B\u52A8\u9886\u5956\u7B49\u7EC6\u9879\u5728", /* @__PURE__ */ React13.createElement("button", { id: "idle-go-settings", type: "button", className: "inline-link" }, "\u6E38\u620F\u914D\u7F6E"), "\u8BBE\u7F6E\u3002"), /* @__PURE__ */ React13.createElement("p", { className: "dim" }, "\u5F53\u524D\u8FDB\u5EA6\u548C\u6761\u4EF6\u7EDF\u4E00\u5728", /* @__PURE__ */ React13.createElement("button", { id: "idle-go-overview", type: "button", className: "inline-link" }, "\u603B\u89C8 \u2192 \u8FD0\u884C\u6982\u89C8"), "\u67E5\u770B\u3002"), /* @__PURE__ */ React13.createElement("p", { className: "dim", id: "runtime-version" })))), /* @__PURE__ */ React13.createElement("div", { className: "bar idle-filter-bar" }, /* @__PURE__ */ React13.createElement(Input, { id: "idle-search", type: "search", "aria-label": "\u67E5\u627E\u529F\u80FD", placeholder: "\u67E5\u627E\u529F\u80FD\u540D\u79F0" }), /* @__PURE__ */ React13.createElement("label", { htmlFor: "idle-filter" }, "\u663E\u793A"), /* @__PURE__ */ React13.createElement("select", { id: "idle-filter", defaultValue: "all" }, /* @__PURE__ */ React13.createElement("option", { value: "all" }, "\u5168\u90E8"), /* @__PURE__ */ React13.createElement("option", { value: "enabled" }, "\u5DF2\u5F00\u542F")), /* @__PURE__ */ React13.createElement("span", { id: "idle-filter-count", role: "status" })), /* @__PURE__ */ React13.createElement("nav", { className: "config-subtabs", "aria-label": "\u6302\u673A\u8BBE\u7F6E\u5206\u7EC4", role: "tablist" }, groups.map((group, index) => /* @__PURE__ */ React13.createElement("button", { type: "button", key: group, role: "tab", id: "idle-tab-" + index, "data-idle-group": index, "aria-selected": index === 0, "aria-controls": "idle-group-" + index }, group))), groups.map((group, index) => /* @__PURE__ */ React13.createElement("section", { key: group, id: "idle-group-" + index, "data-idle-panel": index, role: "tabpanel", "aria-labelledby": "idle-tab-" + index, hidden: index !== 0 }, /* @__PURE__ */ React13.createElement(Card, null, /* @__PURE__ */ React13.createElement(CardHeader, null, /* @__PURE__ */ React13.createElement(CardTitle, null, group)), /* @__PURE__ */ React13.createElement(CardContent, { className: "task-grid idle-module-grid" }, modules.filter((t) => t.idleGroup === group).map((t) => /* @__PURE__ */ React13.createElement("div", { className: "task-setting", key: t.key }, /* @__PURE__ */ React13.createElement("div", { className: "task-label-block" }, /* @__PURE__ */ React13.createElement("div", { className: "task-label-line" }, /* @__PURE__ */ React13.createElement("label", { htmlFor: "auto-" + t.key }, t.idleLabel || t.label), t.help && /* @__PURE__ */ React13.createElement(HelpTip, { title: t.label }, t.help))), /* @__PURE__ */ React13.createElement("div", { className: "idle-module-actions" }, /* @__PURE__ */ React13.createElement("a", { href: "#config-group-" + t.configTarget, "aria-label": "\u914D\u7F6E" + (t.idleLabel || t.label) }, "\u914D\u7F6E"), /* @__PURE__ */ React13.createElement(Switch, { id: "auto-" + t.key, "data-auto-task": t.key, "data-setting-control": "", className: "p-0", disabled: true })))))), group === "\u4E16\u754C" && /* @__PURE__ */ React13.createElement(Card, null, /* @__PURE__ */ React13.createElement(CardHeader, null, /* @__PURE__ */ React13.createElement(CardTitle, null, "\u6D77\u76D7\u9996\u6740\u8FDE\u7EED\u63A8\u8FDB")), /* @__PURE__ */ React13.createElement(CardContent, null, /* @__PURE__ */ React13.createElement("p", { className: "dim" }, "\u786E\u8BA4\u672C\u4EBA\u7684\u9996\u6740\u540E\u9010\u7EA7\u63A8\u8FDB\uFF0C\u6218\u8D25\u6216\u6761\u4EF6\u4E0D\u8DB3\u65F6\u505C\u6B62\u3002\u6BCF\u6B21\u624B\u52A8\u5F00\u542F\uFF0C\u91CD\u542F\u540E\u4E0D\u81EA\u52A8\u6062\u590D\u3002"), /* @__PURE__ */ React13.createElement("div", { className: "bar" }, /* @__PURE__ */ React13.createElement("a", { href: "#config-group-pirate-hunt" }, "\u8BBE\u7F6E\u8230\u961F\u3001\u76EE\u6807\u4E0E\u9884\u7B97"), /* @__PURE__ */ React13.createElement(Button, { id: "pirate-advance-start", disabled: true }, "\u5F00\u542F\u9996\u6740\u63A8\u8FDB"), /* @__PURE__ */ React13.createElement(Button, { id: "pirate-advance-stop", variant: "outline", disabled: true }, "\u505C\u6B62\u9996\u6740\u63A8\u8FDB")), /* @__PURE__ */ React13.createElement("p", { id: "pirate-advance-state", role: "status" }, "\u5C1A\u672A\u5F00\u542F")))))));
}
function action(id, label, variant = "outline", disabled = false) {
  return renderToStaticMarkup4(/* @__PURE__ */ React13.createElement(Button, { id, variant, disabled }, label));
}
function stagePanel() {
  return renderToStaticMarkup4(
    /* @__PURE__ */ React13.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React13.createElement(Card, null, /* @__PURE__ */ React13.createElement(CardHeader, null, /* @__PURE__ */ React13.createElement(CardTitle, { className: "title-with-help" }, "\u6311\u6218\u4E3B\u7EBF\u5173\u5361", /* @__PURE__ */ React13.createElement(HelpTip, { title: "\u6311\u6218\u4E3B\u7EBF\u5173\u5361" }, "\u201C\u6B21\u6570\u201D\u6307\u540C\u4E00\u5173\u8FDE\u7EED\u5931\u8D25\u591A\u5C11\u6B21\u540E\u505C\u6B62\u81EA\u52A8\u6311\u6218\u3002\u624B\u52A8\u5F00\u542F\u540E\u6BCF\u573A\u95F4\u96945\u79D2\uFF0C\u901A\u5173\u540E\u8FDE\u7EED\u5931\u8D25\u6B21\u6570\u6E05\u96F6\u3002"), /* @__PURE__ */ React13.createElement("span", { id: "stage-view", className: "heading-status", role: "status", "aria-live": "polite" }, "\u672A\u540C\u6B65"))), /* @__PURE__ */ React13.createElement(CardContent, null, /* @__PURE__ */ React13.createElement("div", { className: "bar" }, /* @__PURE__ */ React13.createElement("label", { htmlFor: "stage-failures" }, "\u6B21\u6570"), /* @__PURE__ */ React13.createElement(Input, { id: "stage-failures", "aria-label": "\u4E3B\u7EBF\u8FDE\u7EED\u5931\u8D25\u505C\u6B62\u6B21\u6570", className: "w-20", type: "number", min: "1", defaultValue: "3" }), /* @__PURE__ */ React13.createElement(Button, { id: "stage-start", disabled: true }, "\u81EA\u52A8\u6311\u6218"), /* @__PURE__ */ React13.createElement(Button, { id: "stage-stop", variant: "outline", disabled: true }, "\u505C\u6B62\u81EA\u52A8")))), /* @__PURE__ */ React13.createElement(Card, null, /* @__PURE__ */ React13.createElement(CardHeader, null, /* @__PURE__ */ React13.createElement(CardTitle, { className: "title-with-help" }, "\u8BD5\u70BC\u526F\u672C", /* @__PURE__ */ React13.createElement(HelpTip, { title: "\u8BD5\u70BC\u526F\u672C" }, "\u81EA\u52A8\u6311\u6218\u9010\u5173\u63A8\u8FDB\uFF0C\u6B21\u6570\u6307\u540C\u4E00\u5173\u8FDE\u7EED\u5931\u8D25\u540E\u7684\u505C\u6B62\u4E0A\u9650\u3002\u201C\u6311\u6218\u4E00\u6B21\u201D\u53EA\u6311\u6218\u4E0B\u4E00\u5173\u3002\u626B\u8361\u6389\u843D\u548C\u6B21\u6570\u89C4\u5219\u5728\u5404\u526F\u672C\u8BF4\u660E\u4E2D\u3002")), /* @__PURE__ */ React13.createElement(CardAction, { className: "row-span-1 self-center" }, /* @__PURE__ */ React13.createElement(Button, { id: "trial-refresh", variant: "outline", size: "sm" }, "\u5237\u65B0\u8BD5\u70BC\u8FDB\u5EA6"))), /* @__PURE__ */ React13.createElement(CardContent, null, /* @__PURE__ */ React13.createElement("div", { id: "trial-view", className: "progression-view", "aria-live": "polite" }))))
  );
}
export {
  accountPage,
  action,
  activitiesPage,
  chrome,
  dailiesPage,
  dialogs,
  giftCodesPage,
  guildPage,
  heroesPage,
  idlePanel,
  inventoryPage,
  journal,
  loginSettingsPage,
  manualPage,
  overviewPage,
  settingsPage,
  stagePanel,
  templates
};
