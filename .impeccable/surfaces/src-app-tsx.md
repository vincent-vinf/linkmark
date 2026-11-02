---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/app.css","src/responsive.css"]
---

# 前端重设计

- Mode: Operate
- Scope: src/App.tsx, src/app.css, src/responsive.css；覆盖创建/解锁、入口目录、密钥列表与编辑/导入等流程。
- 用户已委托自主完成第一版，不开启方案投票或等待确认。保留 PRODUCT.md 的产品事实和安全边界。
- 真实场景：个人开发者在白天桌面浏览器和手机上反复查找访问资料；以浅色内容区减少阅读负担，保留手动深色模式。

## Direction contract

THESIS: 私人技术资料目录。入口回答“去哪里”，密钥回答“用什么访问”；去掉首页无助操作的统计带与重复新建按钮。

OWN-WORLD: 大学图书馆导视的森林绿导航、雾绿底色、白色工作区，中文系统无衬线，统一 18px 线性图标，8px 控件和 12px 资料卡圆角。分类与关联标签是唯一签名。

STORY: 创建/解锁后直接找入口；搜索、类型筛选、置顶和排序缩小范围；卡片明确打开网站/查看资料，关联密钥可直接复制。密钥独立导航，备份分享收纳到工具菜单。

FIRST VIEWPORT: 桌面 232px 深绿导航，顶部轻量位置提示与锁定操作；内容标题 28px 与唯一主新建操作，搜索与类型筛选在网格上方；白色卡片分为名称地址和关联凭据两区，底部状态条显示本地存储和解锁到期。手机用顶部品牌和菜单抽屉，主操作和搜索先出现。

FORM: 第 7 个候选：大学图书馆分类导视；seed:b66cd2d8dd1aeffc。常规导航与表单承载任务，分类类型色与凭据关联标签承担签名。签名交互是切换分类即筛选目录、空结果可一键清除，150ms 颜色反馈，减少动态偏好下关闭运动。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 探索记录

产品机制：一个本地加密密钥库统一保护可多对多关联的入口与密钥。避免常见的霓虹终端面板，也避免反向的米色衬线纸张。

1. 技术出版社的双色索引：蓝白底、无衬线标题和地址等宽体，书脊式类型标识；目录优先，搜索在顶。
2. 公共植物园导视：深绿与薄荷地面、清晰分类色，小字说明和独立名称；类型筛选优先。
3. 工程图例标准：灰蓝与橙色状态、均匀字号、严格对齐；紧凑列表优先。
4. 城市公共服务导视：海军蓝与白，固定字号与双色目的地标识；搜索和明确动作优先。
5. 大学档案馆标签：墨绿与中性白、低密度无衬线、独立关联标签；入口与密钥的关系优先。
6. 软件参考手册：冷灰与紫色、克制层级和可折叠信息；逐步披露编辑字段。
7. 大学图书馆分类导视：森林绿导航、雾绿画布、白色资料区、蓝紫琥珀分类色，中文无衬线；标准应用壳，入口分类与密钥关联一目了然。抽签指定方向。

## 对参考方案的判断

- variable-font-specimen: declined；放大字样不提高个人资料识别或任务清晰度。保留纪律：把类型层级收紧，名称始终高于元数据。
- digital-design-canon-metro-typographic-tiles: declined；大色块与全景切换降低高频查找效率。保留纪律：导航颜色在整个区域坚定一致，减少零散装饰。
- vernacular-ephemera-cassette-j-card: declined；手写与折叠隐喻对凭据工作流均无收益。保留纪律：每行严格对齐，操作位置固定。
- rw-manual-acetate-tab-board: competitive（受众识别）；参考手册有受众关联，但叠层降低任务清晰度。当前版仍采用更易扫描的目录。
- pop-culture-shelf-vertical-video-feed-surface: declined；一次只看一个条目伤害扫描与关系理解。保留纪律：一张卡只承担一个入口的访问任务。
- wayfinding-cartography-signage-midnight-transit-diagram: competitive（受众识别）；清晰目的地标签有共鸣，路网隐喻无必要。保留纪律：类别色与文字一起出现，状态不能只靠颜色表达。

## 验证要求

真实渲染桌面 1440、1280 和手机 390/320；空目录、带数据目录、筛选无结果、密钥、编辑、锁定和深色；验证键盘焦点、菜单与对话框退出、复制和入口点击互不干扰。测试数据只在独立浏览器会话创建，不预置到产品。

## 配色决策更新

本文件保留第一版方向与探索历史。其森林绿配色、固定深绿导航和手动浅深模式已由 [appearance.md](appearance.md) 的四套主题、浅深/跟随系统模式与浅色导航决策取代；当前规范值以根目录 DESIGN.md 和 src/themes.css 为准。
