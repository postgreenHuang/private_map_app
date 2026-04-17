# 私人地图标记工具

基于高德地图 JS API 的个人地点收藏与规划工具，支持 Mac 和 iPhone 浏览器访问。

## 项目概述

- **项目名称**：私人地图标记工具
- **当前阶段**：第三阶段（同步版+轨迹）进行中
- **目标平台**：Mac 浏览器 + iPhone 浏览器（Safari）
- **技术方案**：纯前端网页 App（HTML + JS + 高德 JS API），无需构建工具

## 技术栈

- **地图**：高德 JS API 2.0（Web 端）
- **语言**：JavaScript（ES6+），不使用 TypeScript
- **样式**：原生 CSS，移动端优先（Mobile First）
- **存储**：localStorage + Supabase 云端同步（第三阶段）
- **构建**：无构建工具，直接加载高德 JS API CDN + Supabase CDN
- **托管**：GitHub Pages（已部署：https://postgreenhuang.github.io/private_map_app/）

## 项目结构

```
/
├── index.html          # 主页面
├── config.json         # 配置文件（API Key、Supabase 等）
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── app.js          # 应用入口与初始化
│   ├── map.js          # 地图相关逻辑
│   ├── marker.js       # 标记增删改查
│   ├── category.js     # 标记分类管理
│   ├── track.js        # 轨迹管理与制作模式
│   ├── storage.js      # 数据持久化（localStorage / 云端）
│   ├── cloud.js        # 云端同步模块（Supabase）
│   └── search.js       # POI 搜索
├── assets/             # 图标、图片等静态资源
└── CLAUDE.md
```

## 代码规范

### JavaScript
- 使用 ES6+ 语法（const/let、箭头函数、模板字符串、解构赋值）
- 不使用任何框架（React/Vue/jQuery），纯原生 JS
- 使用立即执行函数或 ES Module 避免全局污染
- 变量命名：驼峰式（camelCase），常量用全大写下划线（UPPER_SNAKE_CASE）
- 函数职责单一，每个文件不超过 300 行
- 中文注释，解释"为什么"而非"做了什么"

### HTML/CSS
- 语义化 HTML 标签
- Mobile First 响应式设计，断点参考：375px（iPhone SE）/ 768px（iPad）/ 1024px
- CSS 类名用 BEM 命名（如 `.marker__icon--active`）
- 颜色、间距等用 CSS 变量统一管理

### 高德 API 使用
- 通过 CDN `<script>` 标签加载，API Key 在 JS 中配置
- 优先使用高德 JS API 2.0 的插件机制（`AMap.plugin()`）
- 地图实例通过模块导出共享，不在多处重复创建

## 功能开发阶段

1. **MVP** ✅：地图显示、右键添加标记、标记名称/备注、localStorage 存储、标记列表、POI 搜索
2. **分类版** ✅：
   - 自定义分类（如：想吃的、想去的、住过的）
   - 每个分类支持 emoji 图标、颜色设置
   - 按分类筛选显示/隐藏标记
   - 标记支持多标签
3. **同步版 + 轨迹**（进行中）：
   - 轨迹制作：途径点添加、导航路线/直线模式、名称编辑
   - 轨迹管理：独立分类系统、显示/隐藏、展开编辑途径点
   - 云端同步：Supabase 存储、多端同步、实时订阅
   - 部署：GitHub Pages
   - 移动端适配：长按添加、侧边栏半透明、拖拽调宽、左滑收起
4. **进阶功能**（待启动）：用户登录、导入 GPX、路线规划、照片附件、分享链接、离线支持

## 标记数据模型

```js
{
  id: "marker_001",
  name: "南锣鼓巷",
  position: { lng: 116.403, lat: 39.936 },
  city: "北京市",
  categoryId: "cat_food",
  links: [
    { name: "大众点评", url: "https://..." },
    { name: "小红书攻略", url: "https://..." }
  ],
  createdAt: "2026-04-12T10:00:00Z"
}
```

- 标记图标由所属分类的 emoji 决定，未分类使用默认 📍
- 每个标记可附加**种草链接列表**（`links`），每条链接包含自定义名称和 URL
- 标记表单字段：名称、分类、种草链接（已移除备注、标签、独立 emoji）

## 分类数据模型

```js
{
  id: "cat_food",
  name: "美食",
  emoji: "🍜",
  color: "#EF4444"
}
```

## 轨迹数据模型

```js
{
  id: "trk_001",
  name: "北京壁球馆巡游",
  waypoints: [
    { lng: 116.xxx, lat: 39.xxx, name: "怦燃壁球" },
    { lng: 116.xxx, lat: 39.xxx, name: "公园壁球" }
  ],
  routeMode: "driving",   // "driving" | "straight"
  categoryId: "tcat_sport",
  createdAt: "2026-04-16T..."
}
```

## 轨迹分类数据模型

```js
{
  id: "tcat_sport",
  name: "运动",
  emoji: "🎾",
  color: "#34C759"
}
```

## 云端同步方案

- **服务**：Supabase（BaaS，免费额度充足）
- **SDK**：@supabase/supabase-js v2（CDN 加载）
- **数据库表**：markers、marker_categories、track_categories、tracks
- **同步策略**：localStorage 为主，每次操作同步到云端；页面加载时先推后拉、合并策略（本地不丢失）
- **实时订阅**：PostgreSQL Changes，其他设备修改时自动刷新 UI
- **认证**：待实现（计划使用 Supabase Auth 邮箱+密码登录）

## 决策记录

### 2026-04-12：确定纯前端方案
- **决策**：采用 HTML + JS + 高德 JS API，不引入前端框架
- **原因**：项目规模小，MVP 功能简单，无需框架开销；高德 JS API 自身提供完整的地图交互能力
- **影响**：无构建步骤，直接打开 HTML 即可运行；后续如需复杂交互再考虑引入框架

### 2026-04-12：选择高德地图而非其他
- **决策**：使用高德地图而非 Google Maps / 百度地图
- **原因**：国内数据准确；用户已有高德使用习惯；参考产品 Google My Maps 在国内数据不准
- **影响**：依赖高德开放平台，需申请 API Key

### 2026-04-12：MVP 先用 localStorage
- **决策**：第一阶段数据存储用 localStorage，不引入后端
- **原因**：快速验证核心流程；localStorage 足以支撑个人使用量级
- **影响**：MVP 阶段无多端同步能力，数据仅存于当前浏览器

### 2026-04-16：选择 Supabase 作为云端存储
- **决策**：采用 Supabase 作为 BaaS 云端存储方案
- **原因**：免费额度充足（500MB 数据库、5GB 带宽、50000 月活）；PostgreSQL 数据库可直接查询；内置 Realtime 实时订阅；Auth 认证服务开箱即用；CDN 兼容无需构建工具
- **影响**：数据存储在 Supabase PostgreSQL，通过 JS SDK CDN 加载；RLS 策略控制访问；多设备打开同一页面可实时同步

### 2026-04-16：部署到 GitHub Pages
- **决策**：使用 GitHub Pages 托管静态文件
- **原因**：纯前端项目无服务端需求；免费、自动部署、支持自定义域名；与 GitHub 仓库集成方便版本管理
- **影响**：仓库需设为 Public；config.json 中的 API Key 为公开信息（均为客户端密钥）

## 待决策事项

| 问题 | 选项 | 当前倾向 |
|------|------|---------|
| 用户登录方案 | Supabase Auth 邮箱+密码 / Magic Link / 第三方 OAuth | 邮箱+密码 |
| iPhone 快捷入口 | 浏览器书签 / 添加到主屏幕（PWA） | 添加到主屏幕 |
| 是否支持离线 | Service Worker 缓存 / 完全离线 / 不支持 | 待定 |

## 参考资源

- 高德 JS API 文档：https://lbs.amap.com/api/javascript-api/summary
- 高德开放平台：https://lbs.amap.com
