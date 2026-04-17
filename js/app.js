/**
 * app.js — 应用入口
 * 加载配置、认证、初始化地图、恢复标记、绑定所有事件
 */

import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { MarkerModule } from './marker.js';
import { SearchModule } from './search.js';
import { CategoryModule } from './category.js';
import { TrackModule } from './track.js';
import { CloudSync } from './cloud.js';
import { Auth } from './auth.js';

let _contextPosition = null;
let _isLoginMode = true; // true = 登录, false = 注册

async function init() {
  try {
    const config = await Storage.loadConfig();
    await MapModule.init(config);
    await CloudSync.init(config);

    // 检查已有会话
    const user = await Auth.init(CloudSync.getSupabaseClient());

    if (user) {
      await onLoginSuccess(config);
    } else {
      showAuthUI();
    }

    // 绑定认证相关事件
    bindAuthEvents();

  } catch (err) {
    document.getElementById('map').innerHTML =
      `<div class="error">
        <div class="error__title">加载失败</div>
        <div class="error__msg">${escapeHtml(err.message)}</div>
      </div>`;
  }
}

/** 登录成功后的初始化流程 */
async function onLoginSuccess(config) {
  // 隐藏登录弹窗，显示地图功能
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('auth-logout-btn').classList.remove('hidden');

  // 同步用户数据
  await CloudSync.pullUserData();

  // 加载本地数据
  MarkerModule.loadAll();
  await SearchModule.init();
  TrackModule.loadAll();
  CategoryModule.renderFilterBar();
  TrackModule.renderTrackFilterBar();

  // 实时订阅
  CloudSync.startRealtime({
    onMarkersChange: () => MarkerModule.loadAll(),
    onCategoriesChange: () => {
      CategoryModule.renderFilterBar();
      CategoryModule.renderCategoryList();
      MarkerModule.renderCategoryOptions();
      MarkerModule.applyFilter();
    },
    onTracksChange: () => TrackModule.loadAll(),
    onTrackCategoriesChange: () => {
      TrackModule.renderTrackFilterBar();
      TrackModule.renderSavedTracks();
    }
  });

  // 绑定所有交互事件
  bindAppEvents();
}

/** 显示登录/注册 UI */
function showAuthUI() {
  document.getElementById('auth-overlay').classList.remove('hidden');
}

/** 绑定认证相关事件 */
function bindAuthEvents() {
  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchLink = document.getElementById('auth-switch-link');
  const switchText = document.getElementById('auth-switch-text');
  const subtitle = document.getElementById('auth-subtitle');

  // 切换登录/注册
  switchLink.addEventListener('click', (e) => {
    e.preventDefault();
    _isLoginMode = !_isLoginMode;
    if (_isLoginMode) {
      submitBtn.textContent = '登录';
      switchText.textContent = '没有账号？';
      switchLink.textContent = '注册';
      subtitle.textContent = '登录以同步你的数据';
    } else {
      submitBtn.textContent = '注册';
      switchText.textContent = '已有账号？';
      switchLink.textContent = '登录';
      subtitle.textContent = '创建新账号';
    }
    errorEl.classList.add('hidden');
  });

  // 提交表单
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '请稍候...';
    errorEl.classList.add('hidden');

    try {
      const user = _isLoginMode
        ? await Auth.signIn(email, password)
        : await Auth.signUp(email, password);

      if (user) {
        const config = await Storage.loadConfig();
        await onLoginSuccess(config);
      }
    } catch (err) {
      errorEl.textContent = err.message || '操作失败，请重试';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = _isLoginMode ? '登录' : '注册';
    }
  });

  // 登出（确认弹窗）
  document.getElementById('auth-logout-btn').addEventListener('click', async () => {
    if (!confirm('确定要退出登录吗？')) return;
    await Auth.signOut();
    location.reload();
  });

  // 登录状态变化回调（其他标签页登出时触发）
  Auth.onAuthChange(async (user) => {
    if (!user) {
      location.reload();
    }
  });
}

/** 绑定地图和 UI 交互事件 */
function bindAppEvents() {
  // 右键菜单 → 添加标记
  const hideContextMenu = () => document.getElementById('context-menu').classList.add('hidden');
  MapModule.setClickListener((lnglat, pixel) => {
    _contextPosition = lnglat;
    const menu = document.getElementById('context-menu');
    const mw = 160, mh = 44;
    let x = pixel.x + 8, y = pixel.y - mh / 2;
    if (x + mw > window.innerWidth) x = pixel.x - mw - 8;
    if (y < 8) y = 8;
    if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.bottom = '';
    menu.style.transform = '';
    menu.classList.remove('hidden');
  });

  document.getElementById('map').addEventListener('contextmenu', e => e.preventDefault());
  document.getElementById('map').style.cssText += '-webkit-touch-callout:none; -webkit-user-select:none;';

  document.getElementById('ctx-add-marker').addEventListener('click', () => {
    hideContextMenu();
    if (TrackModule.isInserting()) {
      const { trackId, insertIndex } = TrackModule.getInsertTarget();
      if (_contextPosition) TrackModule.insertWaypoint(trackId, insertIndex, _contextPosition.lng, _contextPosition.lat);
    } else if (TrackModule.isEditing()) {
      if (_contextPosition) TrackModule.addWaypoint(_contextPosition.lng, _contextPosition.lat);
    } else {
      if (_contextPosition) MarkerModule.openForm(_contextPosition);
    }
  });

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('touchstart', hideContextMenu, { passive: true });

  // 标记表单
  document.getElementById('marker-form').addEventListener('submit', e => {
    e.preventDefault();
    MarkerModule.handleSubmit();
  });
  document.getElementById('marker-form-cancel').addEventListener('click', () => MarkerModule.closeForm());
  document.getElementById('marker-delete').addEventListener('click', () => MarkerModule.handleDelete());
  document.getElementById('marker-form-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) MarkerModule.closeForm();
  });

  // 链接添加/更新
  document.getElementById('link-add-btn').addEventListener('click', () => MarkerModule.handleAddLink());

  // 粘贴分享文本时自动拆分标题和URL
  document.getElementById('link-url').addEventListener('paste', (e) => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const urlMatch = pasted.match(/(https?:\/\/\S+)/);
    if (!urlMatch) return;

    e.preventDefault();
    const url = urlMatch[1];
    const beforeUrl = pasted.substring(0, pasted.indexOf(url)).trim();

    document.getElementById('link-url').value = url;

    const nameInput = document.getElementById('link-name');
    if (nameInput.value.trim() || !beforeUrl) return;

    const clean = beforeUrl
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+[A-Za-z0-9]{10,}\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    nameInput.value = clean || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return ''; } })();
  });

  // 侧边栏开关
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('sidebar--open');
    document.body.classList.add('sidebar-open');
  });
  document.getElementById('sidebar-close').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('sidebar--open');
    document.body.classList.remove('sidebar-open');
  });

  // 侧边栏拖拽调整宽度
  const sidebar = document.getElementById('sidebar');
  const resizeHandle = document.getElementById('sidebar-resize-handle');
  const SIDEBAR_MIN = 200, SIDEBAR_MAX = 500;
  const savedWidth = localStorage.getItem('private_map_sidebar_width');
  if (savedWidth) {
    const w = Math.min(Math.max(parseInt(savedWidth), SIDEBAR_MIN), SIDEBAR_MAX);
    sidebar.style.width = w + 'px';
    document.documentElement.style.setProperty('--sidebar-width', w + 'px');
  }

  let resizing = false;
  const onResizeStart = (e) => {
    resizing = true;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  };
  const onResizeMove = (e) => {
    if (!resizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = sidebar.getBoundingClientRect();
    const newWidth = clientX - rect.left;
    if (newWidth >= SIDEBAR_MIN && newWidth <= SIDEBAR_MAX) {
      sidebar.style.width = newWidth + 'px';
      document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
    }
  };
  const onResizeEnd = () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    const w = parseInt(sidebar.style.width);
    if (w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) {
      document.documentElement.style.setProperty('--sidebar-width', w + 'px');
      localStorage.setItem('private_map_sidebar_width', w);
    }
  };
  resizeHandle.addEventListener('mousedown', onResizeStart);
  resizeHandle.addEventListener('touchstart', onResizeStart, { passive: true });
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('touchmove', onResizeMove, { passive: true });
  document.addEventListener('mouseup', onResizeEnd);
  document.addEventListener('touchend', onResizeEnd);

  // 移动端：左滑收起侧边栏
  let touchStartX = 0;
  let touchStartY = 0;
  let swiping = false;
  sidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swiping = false;
  }, { passive: true });
  sidebar.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!swiping && Math.abs(dx) > Math.abs(dy) && dx < -20) swiping = true;
  }, { passive: true });
  sidebar.addEventListener('touchend', (e) => {
    if (swiping && e.changedTouches[0].clientX - touchStartX < -60) {
      sidebar.classList.remove('sidebar--open');
      document.body.classList.remove('sidebar-open');
    }
  });

  // 侧边栏 Tab 切换
  const tabs = document.querySelectorAll('.sidebar__tab');
  const categoryBtn = document.getElementById('category-manage-btn');
  const categoryFilter = document.getElementById('category-filter');
  const cityFilter = document.getElementById('city-filter');
  const trackFilter = document.getElementById('track-category-filter');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('sidebar__tab--active'));
      tab.classList.add('sidebar__tab--active');
      const isMarkers = tab.dataset.tab === 'markers';
      document.getElementById('markers-panel').classList.toggle('sidebar__panel--hidden', !isMarkers);
      document.getElementById('tracks-panel').classList.toggle('sidebar__panel--hidden', isMarkers);
      categoryBtn.classList.toggle('hidden', false);
      categoryFilter.classList.toggle('hidden', !isMarkers);
      cityFilter.classList.toggle('hidden', !isMarkers);
      trackFilter.classList.toggle('hidden', isMarkers);
    });
  });

  // 轨迹制作
  document.getElementById('track-create-btn').addEventListener('click', () => TrackModule.startEditing());
  document.getElementById('track-cancel-btn').addEventListener('click', () => TrackModule.cancelEditing());
  document.getElementById('track-finish-btn').addEventListener('click', () => TrackModule.finishEditing());
  document.getElementById('track-show-all').addEventListener('click', () => TrackModule.showAllTracks());
  document.getElementById('track-hide-all').addEventListener('click', () => TrackModule.hideAllTracks());

  // 分类管理（根据当前 Tab 打开对应分类弹窗）
  document.getElementById('category-manage-btn').addEventListener('click', () => {
    const isMarkers = document.querySelector('.sidebar__tab--active').dataset.tab === 'markers';
    if (isMarkers) {
      CategoryModule.openModal();
    } else {
      TrackModule.openCategoryModal();
    }
  });

  // 标记分类弹窗
  document.getElementById('category-modal-close').addEventListener('click', () => CategoryModule.closeModal());
  document.getElementById('category-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) CategoryModule.closeModal();
  });
  document.getElementById('cat-add-btn').addEventListener('click', () => {
    CategoryModule._showForm(null);
  });
  document.getElementById('cat-form-cancel').addEventListener('click', () => CategoryModule._hideForm());
  document.getElementById('cat-form-save').addEventListener('click', () => CategoryModule.handleSave());

  // 轨迹分类弹窗
  document.getElementById('tc-modal-close').addEventListener('click', () => TrackModule.closeCategoryModal());
  document.getElementById('tc-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) TrackModule.closeCategoryModal();
  });
  document.getElementById('tc-add-btn').addEventListener('click', () => {
    TrackModule._showCategoryForm(null);
  });
  document.getElementById('tc-form-cancel').addEventListener('click', () => TrackModule._hideCategoryForm());
  document.getElementById('tc-form-save').addEventListener('click', () => TrackModule.handleCategorySave());
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
