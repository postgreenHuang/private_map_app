# 学习路线推荐

为理解本项目的代码，按从零基础到进阶的顺序整理。

> 当前项目涉及：HTML + CSS + JavaScript (ES Modules + async/await + DOM 操作) + Supabase (云端数据库/实时同步)
> 整个项目由 AI 编写，以下教程帮助你逐步读懂每一行代码。

---

## 第一阶段：读懂网页长什么样（1-2 周）

先理解 HTML 和 CSS，知道页面的结构和样式是怎么写出来的。

### HTML — 网页的骨架

- [HTML 和 CSS 入门教程（播放列表）](https://www.youtube.com/playlist?list=PLU7jXxAKmKkFKD5zH7Wcc58nsRMCKzi4x)
  — 中文，边学边开发，通过一个网页项目学习
- [freeCodeCamp 中文 — Web 开发入门](https://www.freecodecamp.org/chinese/news/web-development-for-beginners-basic-html-and-css/)
  — 免费互动课程，可以在线练习
- [MDN Web Docs — HTML 学习](https://developer.mozilla.org/zh-CN/docs/Learn/HTML)
  — Mozilla 官方文档，权威且全面

**学完你应该能看懂**：`index.html` 中每个标签的含义、`<div>`/`<button>`/`<form>` 的用法、`class` 和 `id` 属性的作用。

### CSS — 网页的皮肤

- [3 小时 HTML + CSS 初学者课程](https://www.youtube.com/watch?v=fa214Ct6t9w)
  — 中文，快速过一遍 CSS 基础
- [菜鸟教程 — CSS](https://www.runoob.com/css/css-tutorial.html)
  — 中文图文教程，可以当字典查
- [Google web.dev — 学习 CSS](https://web.dev/learn/css/welcome?hl=zh-cn)
  — Google 官方出品，Flexbox 和 Grid 讲解得很好
- [CSS 变量 (CSS Custom Properties)](https://web.dev/learn/css/custom-properties/)
  — 本项目大量使用 `var(--color-primary)` 这种写法，必学

**学完你应该能看懂**：`style.css` 中每个 class 的含义、`flex`/`position: fixed`/`transition`/`backdrop-filter` 等属性的作用。

---

## 第二阶段：读懂网页怎么动起来（2-3 周）

JavaScript 是本项目的核心，重点学 DOM 操作和事件处理。

### JavaScript 基础语法

- [黑马程序员 JavaScript 入门教程](https://www.youtube.com/results?search_query=黑马程序员+JavaScript+入门教程)
  — 在 YouTube 搜索此频道，有完整的零基础系列
- [freeCodeCamp 中文 — JavaScript 算法与数据结构](https://www.freecodecamp.org/chinese/)
  — 免费互动课程，学 JS 语法的同时练编程思维
- [MDN Web Docs — JavaScript 第一步](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/First_steps)
  — 官方入门指南

### ES6+ 现代语法

本项目大量使用以下语法，必须掌握：

- `const` / `let` — 声明变量（区别于 `var`）
- 箭头函数 `() => {}` — 本项目到处都是
- 模板字符串 `` `Hello ${name}` `` — 本项目的 `innerHTML` 全用这个
- 解构赋值 `const { id, name } = obj` — `storage.js` 里有
- 展开运算符 `...arr` — 数组合并
- `async` / `await` — 异步操作（本项目有大量 fetch 调用）

推荐教程：
- [JavaScript Async/Await 7 分钟入门](https://www.youtube.com/watch?v=qnuyoAKrqMI)
  — 快速理解 async/await
- [JavaScript Full Course 2025-26 (Shradha Khapra)](https://www.youtube.com/playlist?list=PLGjplNEQ1it_oTvuLRNqXfz_v_0pq6unW)
  — 完整课程，包含 async/await 章节

### DOM 操作 — 本项目最核心的知识

本项目代码中大量的 `getElementById`、`innerHTML`、`classList`、`addEventListener` 都属于 DOM 操作。

- [freeCodeCamp — JavaScript DOM Full Course](https://www.youtube.com/watch?v=5fb2aPlgoys)
  — 最经典的 DOM 入门教程
- [The Net Ninja — JavaScript DOM Tutorial 播放列表](https://www.youtube.com/playlist?list=PL4cUxeGkcC9gfoKa5la9dsdCNpuey2s-V)
  — 分小节讲，适合跟着练
- [What is the JavaScript DOM?](https://www.youtube.com/watch?v=c6IyCwAV6BY)
  — 5 分钟理解 DOM 是什么

**学完你应该能看懂**：
- `category.js` 里的 `renderCategoryList()` 怎么生成 HTML 列表
- `app.js` 里的 `addEventListener('click', ...)` 怎么绑定事件
- `track.js` 里的 `container.querySelectorAll('[data-track-show]')` 怎么查找元素
- `marker.js` 里的 `e.target.closest('.marker-card__edit')` 怎么向上查找父元素

### 事件处理

本项目用到了以下事件，需要逐个理解：

| 事件 | 在哪用的 | 什么场景触发 |
|------|---------|-------------|
| `click` | 几乎所有按钮 | 点击按钮 |
| `contextmenu` | `map.js` | 右键点击地图 |
| `touchstart`/`touchmove`/`touchend` | `map.js`, `app.js` | 移动端长按和滑动 |
| `change` | `app.js` | 下拉菜单选择变化 |
| `paste` | `app.js` | 粘贴链接文本 |
| `input` | `app.js` | 输入框输入 |
| `keydown` | `track.js` | 回车键提交 |

---

## 第三阶段：读懂代码怎么组织（1-2 周）

理解 ES Modules（`import`/`export`）和模块化思维。

### ES Modules

本项目每个 `.js` 文件都是一个模块，通过 `import/export` 互相引用。

- [JavaScript ES Modules Tutorial (The Net Ninja)](https://www.youtube.com/results?search_query=net+ninja+es6+modules+tutorial)
  — 搜索此教程
- [MDN — JavaScript 模块](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)
  — 官方文档

**重点理解本项目**：
- `import { Storage } from './storage.js'` — 从其他文件引入功能
- `export const MarkerModule = { ... }` — 把功能暴露给其他文件用
- 为什么 `marker.js` 和 `category.js` 互相 `import` 不会死循环？——因为它们只引入对方的接口，不引入自身

### 模块间依赖关系

画出本项目各文件的依赖图：

```
app.js ──→ storage.js
       ──→ map.js
       ──→ marker.js ──→ storage.js, map.js, category.js
       ──→ category.js ──→ marker.js, storage.js, cloud.js
       ──→ track.js ──→ storage.js, map.js, category.js, cloud.js
       ─→ search.js
       ──→ cloud.js
```

---

## 第四阶段：读懂数据怎么存储（1 周）

### localStorage

- [MDN — Web Storage API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Storage_API)
  — 官方文档

**重点理解**：
- `localStorage.setItem(key, JSON.stringify(data))` — 本项目所有 `saveXxx` 方法的底层
- `JSON.parse(localStorage.getItem(key))` — 本项目所有 `getXxx` 方法的底层
- 数据持久化：关闭浏览器后数据不丢失

### Fetch API

本项目调用高德 REST API 和 Supabase API 都用 `fetch`。

- [MDN — Fetch API](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)
  — 官方文档

**重点理解**：
- `fetch(url)` 返回 Promise
- `await res.json()` 解析 JSON 响应
- `try/catch` 错误处理（本项目 `cloud.js` 中大量使用）

---

## 第五阶段：读懂云端同步（1-2 周）

### Supabase / 数据库基础

先理解数据库是什么，再去看 Supabase。

- [SQL 入门教程（菜鸟教程）](https://www.runoob.com/sql/sql-tutorial.html)
  — 理解 CREATE TABLE、INSERT、SELECT、UPDATE、DELETE
- [JSONB 数据类型](https://www.runoob.com/postgresql/postgresql-jsonb-data-type.html)
  — 本项目的 `links`（种草链接）和 `waypoints`（途径点）就是 JSONB
- [Supabase 官方文档 — JavaScript 快速开始](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=language=javascript)
  — 理解本项目 `cloud.js` 中的 Supabase SDK 用法

**重点理解**：
- `cloud.js` 中的 `toCloudMarker()` 和 `toLocalMarker()` 是数据格式转换层
- `_mergeToLocal()` 的合并策略为什么不丢数据
- Realtime 订阅（WebSocket）的工作原理

---

## 第六阶段：向现代前端进阶（2-4 周）

### npm + Vite（构建工具）

- [NPM Crash Course 2026](https://www.youtube.com/watch?v=fqlFpNg99S0)
- [Codevolution npm 播放列表](https://www.youtube.com/playlist?list=PLC3y8-rFHvwhgWwm5J3KqzX47n7dwWNrq)
- [Vite 官方文档](https://vite.dev/guide/)

### TypeScript（类型系统）

- [TypeScript 入门学习（已完结）](https://www.youtube.com/playlist?list=PLGzwzBsMvr-nuowi2m6ECK58G6tFKBtDW)
  — 中文完整系列
- [前端 TypeScript 零基础入门到实战](https://www.youtube.com/watch?v=5ZWGP2vtVHs)
  — 零基础友好

### Vue 3（前端框架）

- [Vue 3 快速上手](https://www.youtube.com/watch?v=gpZSn24oTMo)
  — 中文系统课程
- [极简 Vue 3 系列](https://www.youtube.com/results?search_query=极简+Vue+3+教程)
  — Composition API + TypeScript + setup 语法糖，最现代的写法

### 单元测试

- [Vitest 官方频道](https://www.youtube.com/@vitest_dev)
- [Traversy Media — Vitest Crash Course](https://www.youtube.com/@TraversyMedia)
  — 搜索此视频

---

## 持续关注的频道

| 频道 | 语言 | 特点 |
|------|------|------|
| [Fireship](https://www.youtube.com/@Fireship) | 英文 | 100 秒系列，快速了解新技术概念 |
| [Traversy Media](https://www.youtube.com/@TraversyMedia) | 英文 | Crash Course 系列，项目驱动 |
| [The Net Ninja](https://www.youtube.com/@NetNinja) | 英文 | 分小节，适合跟着练 |
| [六角学院](https://www.youtube.com/watch?v=Exsc3i_KbCo) | 中文 | 实战课，有讲师指导 |
| [MDN Web Docs](https://developer.mozilla.org/zh-CN/) | 中文 | 官方权威文档，当字典用 |

---

## 建议的学习方法

1. **对照代码看视频** — 看到教程讲某个语法时，在项目代码里搜索这个语法，看实际怎么用的。比如看到教程讲 `addEventListener`，就去项目里搜 `addEventListener` 看有哪些用法
2. **用浏览器 DevTools 调试** — 在浏览器里按 F12 打开开发者工具，在 Sources 面板里打断点、单步执行，看变量值的变化过程
3. **改一行代码试效果** — 每学一个知识点，就改项目的一小部分，刷新看效果。比如学完 CSS 变量，就改一个颜色值看看
4. **不会的搜 MDN** — MDN Web Docs 是前端最权威的参考文档，`developer.mozilla.org/zh-CN` 里有几乎所有前端 API 的详细说明和示例
