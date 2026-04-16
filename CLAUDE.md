# 私人地图标记工具

基于高德地图 JS API 的个人地点收藏与规划工具，支持 Mac 和 iPhone 浏览器访问。

## 项目概述

- **项目名称**：私人地图标记工具
- **当前阶段**：第二阶段（分类版）已完成，待启动第三阶段（同步版）
- **目标平台**：Mac 浏览器 + iPhone 浏览器（Safari）
- **技术方案**：纯前端网页 App（HTML + JS + 高德 JS API），无需构建工具

## 技术栈

- **地图**：高德 JS API 2.0（Web 端）
- **语言**：JavaScript（ES6+），不使用 TypeScript
- **样式**：原生 CSS，移动端优先（Mobile First）
- **存储**：MVP 阶段用 localStorage，后续考虑 Firebase / GitHub JSON
- **构建**：无构建工具，直接加载高德 JS API CDN
- **托管**：GitHub Pages（静态文件直接部署）

## 项目结构

```
/
├── index.html          # 主页面
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── app.js          # 应用入口与初始化
│   ├── map.js          # 地图相关逻辑
│   ├── marker.js       # 标记增删改查
│   ├── category.js     # 分类管理（第二阶段）
│   └── storage.js      # 数据持久化（localStorage / 云端）
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

1. **MVP**：地图显示、点击添加标记、标记名称/备注、localStorage 存储、标记列表
2. **分类版**：
   - 自定义分类（如：想吃的、想去的、住过的）
   - 每个分类支持**自定义图标**：可选择 emoji 或上传自定义图片，统一裁剪为标准像素尺寸（如 32×32），在地图标记和分类列表中显示
   - 每个分类可设置颜色
   - 按分类筛选显示/隐藏标记
   - 标记支持多标签
3. **同步版**：云端存储、多端同步、数据导出（JSON/GPX/KML）
4. **进阶功能**：导入 GPX、路线规划、照片附件、分享链接、离线支持

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

## 待决策事项

| 问题 | 选项 | 当前倾向 |
|------|------|---------|
| 云端存储方案 | Firebase / GitHub JSON / 其他 | 待定 |
| 是否需要登录 | 登录 / 免登录（URL 访问） | 待定 |
| iPhone 快捷入口 | 浏览器书签 / 添加到主屏幕（PWA） | 添加到主屏幕 |
| 是否支持离线 | 是 / 否 | 待定 |

## 参考资源

- 高德 JS API 文档：https://lbs.amap.com/api/javascript-api/summary
- 高德开放平台：https://lbs.amap.com
