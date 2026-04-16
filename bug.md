# Bug 记录

记录开发过程中发现的 bug、原因分析和修复方案。

---

## BUG-001：ES 模块 export 缺失导致地图无法加载

- **发现日期**：2026-04-15
- **现象**：页面显示空白，浏览器控制台报错 `The requested module doesn't provide an export named: 'SearchModule'`
- **原因**：`search.js` 用 `const SearchModule = {}` 声明对象但忘记加 `export` 关键字，`app.js` 的 `import { SearchModule }` 找不到导出，整个模块链加载失败
- **修复**：`search.js` 改为 `export const SearchModule = {}`
- **根因**：新增文件时遗漏 `export`，属于编写疏忽

---

## BUG-002：AMap AutoComplete 插件 JSONP MIME 类型被浏览器拒绝

- **发现日期**：2026-04-15
- **现象**：搜索功能无反应，控制台警告 ` MIME 类型（"application/json"）不是有效的 JavaScript MIME 类型`，请求地址为 `restapi.amap.com/v3/assistant/inputtips?...&callback=jsonp_xxx`
- **原因**：高德 JS API 2.0 的 `AutoComplete` 插件内部使用 JSONP 方式调用 REST API，但服务端返回的 Content-Type 为 `application/json` 而非 `application/javascript`，浏览器拒绝将其作为 `<script>` 执行
- **修复**：弃用 `AMap.AutoComplete` 插件，改为 `fetch()` 直接调用 REST API `/v3/assistant/inputtips`，绕过 JSONP 机制
- **影响范围**：`search.js`（重写）、`map.js`（移除插件声明）、`app.js`（修改初始化调用）

---

## BUG-003：侧边栏与搜索框重叠，关闭按钮被遮挡

- **发现日期**：2026-04-15
- **现象**：侧边栏展开后，搜索框仍停在原位，两者重叠，侧边栏关闭按钮被搜索框遮挡无法点击
- **原因**：侧边栏和搜索框都是 `position: fixed`，互不感知，展开侧边栏时搜索框没有联动位移
- **修复**：侧边栏打开时给 `body` 添加 `.sidebar-open` class，CSS 通过 `body.sidebar-open .search { left: calc(var(--sidebar-width) + 16px) }` 将搜索框右移，添加 `transition` 实现平滑过渡
- **移动端适配**：`left` 值使用 `calc(85vw + 12px)` 匹配移动端侧边栏宽度

---

## BUG-004：搜索功能无报错但不工作（排查中）

- **发现日期**：2026-04-15
- **现象**：输入搜索关键词后无任何反应，控制台无报错信息
- **排查方向**：
  - `_search()` 方法是否被调用
  - `fetch` 请求是否发出、响应内容是什么
  - API 返回的 `tips` 数据中 `location` 字段是否存在
  - DOM 渲染是否正确执行
- **原因**：`config.json` 中的 API Key 类型为「Web端(JS API)」，不能用于调用 `restapi.amap.com` 的 REST 接口，返回 `USERKEY_PLAT_NOMATCH` 错误
- **修复**：
  1. `config.json` 拆分为两个 Key：`js_api_key`（地图加载）和 `web_api_key`（搜索 REST API）
  2. 用户需在高德开放平台为同一应用新增一个「Web服务」类型的 Key，填入 `web_api_key`
  3. `map.js` 使用 `js_api_key` 加载地图，`search.js` 使用 `web_api_key` 调用搜索接口

---

## BUG-005：`showToast` 跨模块调用报 ReferenceError

- **发现日期**：2026-04-15
- **现象**：点击分类筛选芯片后页面报错 `Uncaught ReferenceError: showToast is not defined`，筛选功能完全失效
- **原因**：`showToast` 函数定义在 `marker.js` 的模块作用域内（普通 `function` 声明），没有 `export`。`category.js` 的 `toggleFilter` 方法中直接调用了 `showToast()`，但 ES 模块的作用域是隔离的，每个模块只能访问自己导出的成员和从其他模块 `import` 的成员。`category.js` 没有从 `marker.js` 导入 `showToast`，所以调用时抛出 `ReferenceError`
- **为什么会有这个 bug**：`toggleFilter` 原本没有调用 `showToast`，是我为了加调试提示（显示"隐藏：xxx"/"显示：xxx"）时直接写入了 `showToast()`，没有意识到这个函数属于另一个模块的私有作用域
- **修复**：在 `category.js` 中定义一个本地的 `showToast` 函数，逻辑与 `marker.js` 中的一致（操作 `#toast` DOM 元素）
- **预防**：工具函数（如 `showToast`、`escapeHtml`、`generateId`）如果被多个模块共用，应提取到独立的 `js/utils.js` 并统一导入，避免每个模块各写一份

---

## BUG-006：侧边栏「+分类」按钮被汉堡图标遮挡

- **发现日期**：2026-04-15
- **现象**：侧边栏头部的「+分类」按钮与页面左上角的汉堡图标（侧边栏开关）位置重叠，点击不到
- **原因**：汉堡图标 `#sidebar-toggle` 是 `position: fixed; top: 16px; left: 16px`，z-index 为 101。侧边栏 `#sidebar` 的 z-index 为 100。当侧边栏展开时，侧边栏 header 的 padding-top 也是 20px，内容起始位置恰好在汉堡图标覆盖范围内。两个固定定位元素在 z-index 上互不影响，但视觉上重叠了
- **修复**：给侧边栏 header 增加 `padding-left: 56px`（38px 图标宽度 + 16px 间距），为汉堡图标预留空间；同时给 header 加 `justify-content: flex-end`，让按钮组靠右对齐
- **根因**：汉堡图标和侧边栏 header 是独立定位的元素，设计时没有考虑两者的空间冲突

---

## BUG-007：分类筛选功能不生效（待进一步定位）

- **发现日期**：2026-04-15（持续排查中）
- **现象**：点击分类筛选芯片后，所有标记仍然全部显示，没有被隐藏
- **排查进展**：
  - 筛选逻辑链路：点击芯片 → `toggleFilter()` → 修改 `_hiddenCategories` Set → `applyFilter()` → 遍历标记 show/hide + `renderList()` 过滤渲染
  - 已添加 toast 和 console.log 调试，待用户反馈控制台输出
- **根本原因**：`category.js` 没有通过 `import` 导入 `MarkerModule`，而是用 `typeof MarkerModule !== 'undefined'` 检查后调用。在 ES 模块中，未 `import` 的变量永远是 `undefined`，所以 `MarkerModule.applyFilter()` 从未被执行。toast 提示了"隐藏：xxx"（因为 toast 是本地定义的），但实际的标记筛选逻辑完全没触发
- **为什么 `typeof` 检查没用**：`typeof` 能防止 `ReferenceError`，但无法让一个未导入的模块凭空出现。这段代码可能是参考了 CommonJS（`require`）或全局脚本的模式，在 ES 模块环境下无效
- **修复**：在 `category.js` 顶部添加 `import { MarkerModule } from './marker.js'`，移除所有 `typeof` 防御检查
- **循环依赖**：`marker.js` 和 `category.js` 互相导入形成循环依赖。ES 模块通过"活绑定"（live binding）处理循环依赖：模块加载时获取的是引用而非值，实际访问发生在运行时（用户点击时），此时两个模块都已完全加载，所以不会出问题
- **预防**：ES 模块中不要用 `typeof` 判断另一个模块是否可用，要么 `import` 要么不调用

---

## BUG-008：删除标签功能后遗留 `_formTags` 引用

- **发现日期**：2026-04-16
- **现象**：页面报错 `Uncaught ReferenceError: assignment to undeclared variable _formTags`，发生在 `closeForm()` 被调用时
- **原因**：ADR-011 决定移除备注和标签模块，删除了标签相关的 HTML 和逻辑，但 `closeForm()` 中仍保留了 `_formTags = []` 的重置代码。`_formTags` 变量从未声明（标签模块整体移除后，该变量声明也一并被删），导致赋值时抛出 `ReferenceError`
- **为什么之前没触发**：`closeForm()` 在用户关闭标记表单或表单提交成功后调用。如果用户没有打开过表单就直接关闭，或者在标签功能移除后首次测试时就触发了这个路径
- **修复**：删除 `closeForm()` 中的 `_formTags = []` 这一行
- **预防**：删除功能时，全局搜索该功能相关的所有变量引用，确保清理彻底。可以用编辑器的"查找引用"功能确认

---

## BUG-009：高德逆地理编码直辖市 city 字段返回空数组

- **发现日期**：2026-04-16
- **现象**：城市筛选栏按钮显示为空白，所有标记的城市字段为空字符串
- **排查过程**：
  1. 初步怀疑是 Geocoder JS 插件加载失败，改用 REST API `/v3/geocode/regeo`
  2. 改用 REST API 后仍然返回空值，加了调试日志查看 API 响应
  3. 发现 API 实际返回了正确数据，但北京（直辖市）的 `addressComponent.city` 字段值为 `[]`（空数组），不是空字符串 `""`
- **根因**：代码用 `ac.city || ac.province` 做降级，但 JavaScript 中空数组 `[]` 是 truthy，所以 `[] || "北京市"` 返回 `[]`，不会降级到 `province`
- **修复**：改为 `typeof ac.city === 'string' && ac.city || ac.province`，严格判断 `city` 是否为有效字符串
- **影响范围**：仅影响四个直辖市（北京、上海、天津、重庆），普通城市 `city` 为字符串不受影响
- **预防**：调用第三方 API 时，不能假设返回值的类型。高德 API 对同一字段在不同场景下可能返回不同类型（字符串或数组），需要做类型检查
- **附带修复**：
  - `loadAll()` 中 `m.city` 可能是 `null` 或非字符串（之前多次失败尝试写入的脏数据），增加 `typeof` 检查和 `String()` 强制转换
  - `map.js` 中 `geocode()` 不再重复调用 `Storage.loadConfig()`，改用 `init` 时缓存的 `_webApiKey`
