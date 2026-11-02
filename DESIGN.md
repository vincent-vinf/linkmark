---
name: "Linkmark"
description: "森林绿导航、雾绿画布与清晰关联的私人技术资料目录。"
colors:
  canvas: "#f5f7f4"
  rail: "#173f35"
  rail-ink: "#eef5ef"
  rail-muted: "#b3cabe"
  rail-active: "#31594b"
  surface: "#ffffff"
  surface-2: "#eef3ed"
  line: "#dce5dd"
  ink: "#243a31"
  muted: "#607369"
  subtle: "#435c4f"
  accent: "#2c6b50"
  accent-hover: "#22583f"
  on-accent: "#ffffff"
  accent-soft: "#e7f1e8"
  blue: "#426b9b"
  blue-soft: "#eaf0f8"
  violet: "#755493"
  violet-soft: "#f1ebf7"
  coral: "#ae4545"
  coral-soft: "#fbedeb"
  gold: "#8d682b"
  gold-soft: "#f8f1e1"
  focus: "#377b5c"
  dark-canvas: "#12221b"
  dark-rail: "#102d24"
  dark-rail-active: "#2a5140"
  dark-surface: "#1b3025"
  dark-surface-2: "#22392d"
  dark-line: "#385243"
  dark-ink: "#e6efe8"
  dark-muted: "#adc0b2"
  dark-subtle: "#c2d2c6"
  dark-accent: "#9bd4ab"
  dark-accent-hover: "#b4e4c1"
  dark-on-accent: "#153823"
  dark-accent-soft: "#2b4b36"
  dark-blue: "#a9c7ee"
  dark-blue-soft: "#293e50"
  dark-violet: "#cfb7eb"
  dark-violet-soft: "#41324d"
  dark-coral: "#f2aeaa"
  dark-coral-soft: "#4e302f"
  dark-gold: "#e8ca8f"
  dark-gold-soft: "#473e29"
  dark-focus: "#a0d8b0"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "40px"
    fontWeight: 550
    lineHeight: 1.55
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  dialog:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.6
  primary-control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.6
  nav:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.6
  metadata:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif"
    fontSize: "11px"
    lineHeight: 1.6
  address:
    fontFamily: "ui-monospace, \"SFMono-Regular\", Consolas, monospace"
    fontSize: "11px"
    lineHeight: 1.6
rounded:
  control: "8px"
  card: "12px"
  compact: "4px"
  tag: "5px"
  field-icon: "9px"
  menu: "10px"
  dialog: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  grid: "18px"
  section: "20px"
  panel: "24px"
  dialog: "28px"
  editor: "32px"
  workspace: "38px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.primary-control}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.subtle}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.coral}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-danger-hover:
    backgroundColor: "{colors.coral-soft}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.field-icon}"
    padding: "0 14px"
  nav-default:
    backgroundColor: "transparent"
    textColor: "{colors.rail-muted}"
    typography: "{typography.nav}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  nav-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.rail-ink}"
  filter-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  category-postgresql:
    backgroundColor: "{colors.violet-soft}"
    textColor: "{colors.violet}"
    rounded: "{rounded.menu}"
    width: "39px"
    height: "39px"
  entry-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  linked-key-chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
---

# Design System: Linkmark

## Overview

**Creative North Star: "大学图书馆分类导视的私人资料目录"**

以森林绿导航、雾绿画布和白色工作区建立稳定的查找环境。入口名称是阅读主角，分类颜色帮助识别资源，关联密钥在卡片内形成独立的操作区。标准网页控件承担搜索、筛选和编辑；图书馆导视是颜色与秩序的来源。

密度服务于反复查找：标题、地址、关联关系和动作按固定顺序排列。系统无衬线覆盖中文与拉丁文，等宽体只用于地址及只读配置。浅色是默认主题，手动深色主题沿用同一组语义变量。

**Key Characteristics:**
- 稳定的深绿导航与清晰内容层级。
- 分类图标始终伴随类型文字。
- 入口资料与关联密钥在卡片内分区。
- 浅深主题共享组件与可见键盘焦点。

## Colors

森林绿负责导航与任务强调，蓝、紫、珊瑚红和琥珀色负责资源分类；中性色承托内容。前置 YAML 是颜色数值的唯一规范记录。

### Primary

- **森林绿导航**（`rail`、`rail-active`）：侧栏、当前导航和创建/解锁页面的说明区。导航亮字使用 `rail-ink`，辅助文字使用 `rail-muted`。
- **操作绿**（`accent`、`accent-hover`、`on-accent`、`accent-soft`）：主按钮、关联密钥、选中的筛选项；淡绿用于关系与选中背景。
- **焦点绿**（`focus`）：键盘焦点轮廓及输入聚焦边界。

### Secondary

- **网站蓝**（`blue`、`blue-soft`）：网站类型标记。
- **数据库紫**（`violet`、`violet-soft`）：PostgreSQL 类型标记。
- **缓存珊瑚红**（`coral`、`coral-soft`）：Redis 类型标记，同时用于删除与错误提示。
- **通用琥珀**（`gold`、`gold-soft`）：通用服务类型标记及置顶提示。

### Neutral

- **雾绿画布**（`canvas`）：页面底色与卡片底部动作带。
- **内容白与浅层面**（`surface`、`surface-2`）：卡片、输入、菜单、表头和普通悬停背景。
- **边界与文字**（`line`、`ink`、`subtle`、`muted`）：分隔、正文、次级动作与辅助信息。

`dark-*` 记录 `[data-theme="dark"]` 覆盖的实际值；未覆盖的 `rail-ink` 与 `rail-muted` 在两种主题中继承。sidecar 的八阶色条是从规范色计算的面板预览，不增加产品颜色变量。

**The Semantic Theme Rule.** 组件使用语义变量；深色模式替换变量值，导航亮字与状态文字继续保留可读性。

## Typography

**Display Font / Body Font:** 平台系统无衬线，依次回退到 Segoe UI、苹方、微软雅黑及 Noto Sans CJK SC；完整栈见前置 tokens。

**Label/Mono Font:** 地址使用 ui-monospace / SFMono-Regular / Consolas；只读配置使用 ui-monospace / Consolas。

字号以实际任务层级组织，不采用固定比例。全局正文为（14px / 1.6），大量辅助信息为（10–12px）；标题使用紧凑负字距，正文不加字距。

### Hierarchy

- **Display**：创建/解锁说明主标题（40px、550、1.55）；在 1200px 与 900px 以下分别为（36px）与（32px），760px 以下隐藏此说明区。
- **Headline**：目录标题（28px、650、1.4）；900px 以下为（25px）。
- **Dialog**：对话框标题（22px、600、1.5）；创建/解锁表单标题另用（27px、600、1.4），760px 以下为（25px）。
- **Title**：资料卡名称（16px、600、1.5）。
- **Body / Control**：全局正文（14px、1.6）；常规按钮和字段（13px）。主按钮字重（600），普通按钮（500），导航（400）。
- **Label / Metadata**：表单标签（12px、500）；类型、地址和列表说明（11px），紧凑关联与状态文字（10px）。

安全说明最大宽度为（70ch），空状态说明最大宽度为（360px）。760px 以下表单字段使用（16px），目录搜索为（14px）。

**The Name First Rule.** 资料名称高于地址与关联元数据；地址使用等宽体，主要操作保留文字。

## Layout

桌面应用壳为固定宽度导航加弹性工作区。导航宽（232px），顶栏高（72px）；工作区最大宽（1520px），常规边距（38px）。目录网格使用 `auto-fill` 和（275px）最小列宽，间距（18px），卡片同一行拉齐高度。排版使用实测的 4/8/12/16 等间距，并保留表单、网格与工作区各自的密度。

| 真实 CSS 条件 | 布局变化 |
| --- | --- |
| `min-width: 1700px` | 工作区左右边距 50px，目录固定四列。 |
| `max-width: 1200px` | 顶栏与工作区左右边距 28px，工作区上边距 30px，网格间距 16px。 |
| `max-width: 900px` | 导航宽 206px，目录工具栏纵向排列，目录标题 25px。 |
| `max-width: 760px` | 隐藏桌面侧栏与位置提示，顶部显示品牌与菜单；顶栏 62px，工作区左右 20px，抽屉宽 `min(300px, calc(100% - 42px))`；操作行占满，分类可换行，网格最小列宽 270px、间距 14px。 |
| `max-width: 480px` | 目录单列，工作区左右 18px；普通对话框满屏，取消圆角；编辑面板保持满屏。 |

页面最小宽（320px）。创建/解锁桌面为说明与表单两栏，760px 以下仅保留表单和顶部品牌。密钥表格在手机缩小列内边距、隐藏头像，将查看与删除纵向排列，操作按钮禁止折行。

## Elevation & Depth

深度依靠画布、内容面、分隔线和浮层。资料卡无阴影，悬停或内部聚焦时只改变边框颜色。菜单、提示条和对话框使用阴影，遮罩使用半透明深绿。实际浅深主题阴影见 sidecar；这不是把浮层阴影推广给普通卡片。

### Shadow Vocabulary

- **Menu**：工具菜单和状态提示条使用 `--shadow-menu`。
- **Dialog**：对话框与侧边编辑面板使用 `--shadow-dialog`。

**The Overlay Depth Rule.** 目录卡片保持平面，菜单与对话框使用阴影表达浮层关系。

## Shapes

控件使用温和圆角（8px），资料卡（12px）。搜索与密钥头像（9px）、分类图标底板与菜单（10px）、普通对话框（16px）各有实测用途。边框常为（1px）语义 `line`；卡片内部以水平分隔线区分资料、密钥和底部动作。右侧编辑面板无圆角，手机满屏对话框同样无圆角。

图标为本地内联 SVG，默认尺寸（18px），描边（1.7），圆端点与圆连接；搜索、关联、底部动作按实现使用 20/14/15px 等尺寸。品牌使用线性书签标志，沿用本地 SVG/PWA 资源，不请求远端网站图标。

## Components

### Buttons

清楚、常规的文字操作。普通按钮最小高（36px），主按钮（40px），圆角沿用控件 token。普通按钮使用内容面与细边，悬停为次层面；主按钮使用操作绿和 `on-accent`，悬停切换 `accent-hover`。删除动作使用珊瑚红，悬停加淡红背景。

按钮按下使用（0.96）亮度，禁用透明度为（0.55）。颜色和边界过渡为（150ms），缓动使用 `--ease`。键盘焦点为（2px）轮廓加（3px）偏移。图标按钮使用可访问名称；文本操作保留明确动词。

### Chips

类型筛选是可按下的按钮，使用 `aria-pressed`；选中时淡绿底、绿色文字、加重。资源分类标记使用（39×39px）彩色图标底板与类型文字，并非可编辑标签。关联数量标签使用淡绿，未关联标签使用次层面与辅助文字；两者都写明状态。

### Cards / Containers

资料卡依次显示类型、名称、地址、可选备注和分组、关联密钥、底部动作。主体左右内边距（19px），顶部（20px），名称区上内边距（15px）。地址单行截断，名称允许断行；备注只显示一行。卡片底部使用画布色并保留独立打开/查看与编辑操作。

网站名称与“打开网站”使用真实链接，服务名称与“查看资料”打开编辑面板。卡片容器自身没有整体点击处理。密钥区有独立分隔线、密钥选择器与复制动作；只有一份关联密钥时选择器禁用但保持可读。未关联时显示明确文字与关联动作。

### Inputs / Fields

字段有显式标签，内容面底、细边和（8px）圆角，内边距（10px 12px），编辑表单最小高（42px），创建/解锁表单（46px）。输入聚焦切换焦点色边界并保留键盘轮廓。错误说明使用珊瑚红文字和淡红背景，以 `role="alert"` 呈现。字段没有独立的通用错误边框 token。

搜索是最小高（48px）的整行容器，输入无独立边框，聚焦容器显示焦点边界与淡绿轮廓。桌面显示 Ctrl / ⌘ K 提示，输入文字后显示清除按钮；760px 以下隐藏快捷键提示并为清除按钮保留空间。

### Navigation

深绿侧栏、浅色图标与文字；当前项目使用 `rail-active` 并加重，计数右对齐。常规行最小高（43px），手机抽屉行（46px）。手机菜单由按钮打开，抽屉可关闭并复用对话框焦点管理。

### Dialogs & Feedback

普通对话框宽 `min(530px, 100%)`，内边距（28px），最大高 `calc(100dvh - 48px)`，内容可滚动。编辑面板靠右，宽 `min(540px, 100%)`、高 100dvh、内边距（32px）；以（200ms）从右侧（24px）进入。Dialog 锁定背景交互与页面滚动、圈定 Tab、支持 Escape，关闭后恢复原焦点。菜单使用 details/summary。状态反馈使用 `role="status"` 的提示条。

减少动态效果偏好下，过渡与动画关闭。示例 sidecar 展示静态 HTML/CSS 的视觉状态；真实筛选、复制、菜单退出与对话框焦点由应用行为提供。

## Do's and Don'ts

### Do:

- Do 使用语义颜色变量，使同一组件自动适应浅色与深色主题。
- Do 将网站、PostgreSQL、Redis、通用服务的类型色与图标、文字一起呈现。
- Do 把查看资料、打开网站、复制账号和复制密钥做成各自明确的操作。
- Do 保留焦点轮廓、原生表单标签、筛选按下状态与减少动态效果支持。
- Do 在窄屏允许筛选换行，将导航移入抽屉，并提高卡片内操作高度。

### Don't:

- Don't 把目录卡片整体变成会吞掉复制和菜单动作的点击区域。
- Don't 用颜色单独表示资源类型、选中状态或未关联状态。
- Don't 将服务入口描述为可以连接或测试的客户端；它们的动作是查看资料。
- Don't 为地址和配置之外的普通中文正文引入等宽字体。


未规范化的缺陷：本次代码提取未发现需要固化的视觉偏差；正文未把一次性小字号导航分区标题或锁定页说明标签推广为新的展示型眉题规范。本轮独立 review 的两项修正均已 resolved，最终 disposition 为 ship；这里只记录已实现的可复用规则。
