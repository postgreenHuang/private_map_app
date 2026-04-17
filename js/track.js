/**
 * track.js — 轨迹管理模块
 * 轨迹 CRUD、独立分类系统、制作模式、地图渲染（途径点 + 导航路线）
 */

import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { CategoryModule } from './category.js';
import { CloudSync } from './cloud.js';

const TCATEGORIES_KEY = 'private_map_track_categories';
const _hiddenTrackCategories = new Set();
let _selectedTrackCategory = null;
let _tcEditId = null;

let _editingTrack = null;
let _tempWaypoints = [];
let _mapWaypoints = [];
let _mapPolylines = [];
let _savedOverlays = [];
let _expandedTrackId = null;
let _insertTarget = null;

function generateId() {
  return 'trk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2000);
}

export const TrackModule = {
  // ========== 轨迹分类 CRUD ==========

  getCategories() {
    const data = localStorage.getItem(TCATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCategory(category) {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === category.id);
    if (index >= 0) {
      categories[index] = category;
    } else {
      categories.push(category);
    }
    localStorage.setItem(TCATEGORIES_KEY, JSON.stringify(categories));
    CloudSync.pushTrackCategory(category);
  },

  deleteCategory(id) {
    const categories = this.getCategories().filter(c => c.id !== id);
    localStorage.setItem(TCATEGORIES_KEY, JSON.stringify(categories));
    CloudSync.removeTrackCategory(id);
    _hiddenTrackCategories.delete(id);
  },

  getCategoryById(id) {
    return this.getCategories().find(c => c.id === id) || null;
  },

  isCategoryHidden(id) {
    return _selectedTrackCategory && _selectedTrackCategory !== id;
  },

  toggleCategoryFilter(id) {
    _selectedTrackCategory = _selectedTrackCategory === id ? null : id;
    this.renderTrackFilterBar();
    this.renderSavedTracks();
  },

  // ========== 轨迹分类选择器（下拉弹窗） ==========

  /**
   * 显示分类选择弹窗，返回 Promise<string|null>（选中的 categoryId 或 null）
   * @param {string|null} currentCatId - 当前分类 ID
   */
  pickCategory(currentCatId = null) {
    const categories = this.getCategories();
    const overlay = document.getElementById('track-cat-picker-overlay');
    const select = document.getElementById('track-cat-picker-select');

    select.innerHTML = `<option value="">无分类</option>` +
      categories.map(c =>
        `<option value="${c.id}"${c.id === currentCatId ? ' selected' : ''}>${c.emoji} ${escapeHtml(c.name)}</option>`
      ).join('');

    overlay.classList.remove('hidden');

    return new Promise((resolve) => {
      const cleanup = () => {
        overlay.classList.add('hidden');
        document.getElementById('track-cat-picker-confirm').removeEventListener('click', onConfirm);
        document.getElementById('track-cat-picker-cancel').removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
      };
      const onConfirm = () => {
        const val = select.value || null;
        cleanup();
        resolve(val);
      };
      const onCancel = () => {
        cleanup();
        resolve(currentCatId); // 取消时保持原分类
      };
      const onOverlayClick = (e) => {
        if (e.target === overlay) onCancel();
      };

      document.getElementById('track-cat-picker-confirm').addEventListener('click', onConfirm);
      document.getElementById('track-cat-picker-cancel').addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
    });
  },

  // ========== 轨迹分类管理弹窗 ==========

  openCategoryModal() {
    _tcEditId = null;
    document.getElementById('tc-modal-overlay').classList.remove('hidden');
    this._renderCategoryList();
    this._hideCategoryForm();
  },

  closeCategoryModal() {
    document.getElementById('tc-modal-overlay').classList.add('hidden');
    this._hideCategoryForm();
    _tcEditId = null;
  },

  _renderCategoryList() {
    const listEl = document.getElementById('tc-category-list');
    const categories = this.getCategories();

    if (categories.length === 0) {
      listEl.innerHTML = '<p class="sidebar__empty">暂无分类<br>点击下方按钮创建</p>';
      return;
    }

    listEl.innerHTML = categories
      .map(c => `
        <div class="category-item">
          <span class="category-item__color" style="background:${c.color}"></span>
          <span class="category-item__emoji">${c.emoji}</span>
          <span class="category-item__name">${escapeHtml(c.name)}</span>
          <div class="category-item__actions">
            <button class="btn btn--small btn--secondary" data-tc-edit="${c.id}">编辑</button>
            <button class="btn btn--small btn--danger" data-tc-del="${c.id}">删除</button>
          </div>
        </div>`)
      .join('');

    listEl.querySelectorAll('[data-tc-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = this.getCategoryById(btn.dataset.tcEdit);
        if (cat) this._showCategoryForm(cat);
      });
    });

    listEl.querySelectorAll('[data-tc-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定删除该分类？轨迹不会被删除，但会变为「未分类」。')) {
          this.deleteCategory(btn.dataset.tcDel);
          this._renderCategoryList();
          this.renderTrackFilterBar();
          this.renderSavedTracks();
        }
      });
    });
  },

  _showCategoryForm(category) {
    document.getElementById('tc-form-area').classList.remove('hidden');
    document.getElementById('tc-add-btn').classList.add('hidden');
    document.getElementById('tc-name').value = category ? category.name : '';
    _tcEditId = category ? category.id : null;
    // 复用 CategoryModule 的 emoji/color picker，用不同容器 ID
    CategoryModule._renderEmojiPicker('tc-emoji-picker', category ? category.emoji : '🛤️');
    document.getElementById('tc-emoji-custom').value = '';
    CategoryModule._renderColorPicker('tc-color-picker', category ? category.color : '#007AFF');
  },

  _hideCategoryForm() {
    document.getElementById('tc-form-area').classList.add('hidden');
    document.getElementById('tc-add-btn').classList.remove('hidden');
    _tcEditId = null;
  },

  handleCategorySave() {
    const name = document.getElementById('tc-name').value.trim();
    if (!name) return;
    const emoji = CategoryModule._getSelectedEmoji('tc-emoji-picker', 'tc-emoji-custom') || '🛤️';
    const color = CategoryModule._getSelectedColor('tc-color-picker') || '#007AFF';
    this.saveCategory({ id: _tcEditId || ('tcat_' + Date.now()), name, emoji, color });
    this._renderCategoryList();
    this._hideCategoryForm();
    this.renderTrackFilterBar();
    this.renderSavedTracks();
  },

  // ========== 轨迹分类筛选栏 ==========

  renderTrackFilterBar() {
    const bar = document.getElementById('track-category-filter');
    if (!bar) return;
    const categories = this.getCategories();

    if (categories.length === 0) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = `
      <select class="filter-select">
        <option value="">全部分类</option>
        ${categories.map(c =>
          `<option value="${c.id}"${_selectedTrackCategory === c.id ? ' selected' : ''}>${c.emoji} ${escapeHtml(c.name)}</option>`
        ).join('')}
      </select>`;

    bar.querySelector('.filter-select').addEventListener('change', (e) => {
      _selectedTrackCategory = e.target.value || null;
      this.renderSavedTracks();
    });
  },

  // ========== 状态 ==========

  isEditing() {
    return _editingTrack !== null;
  },

  isInserting() {
    return _insertTarget !== null;
  },

  getInsertTarget() {
    return _insertTarget;
  },

  cancelInsert() {
    _insertTarget = null;
    this._updateContextMenu();
    this.renderSavedTracks();
  },

  // ========== 轨迹显示/隐藏 ==========

  isTrackVisible(id) {
    return _savedOverlays.some(o => o.id === id);
  },

  showAllTracks() {
    const tracks = Storage.getTracks();
    tracks.forEach(t => {
      if (!this.isTrackVisible(t.id)) {
        this.showTrack(t.id, t.routeMode);
      }
    });
    this.renderSavedTracks();
  },

  hideAllTracks() {
    [..._savedOverlays].forEach(o => this.hideTrack(o.id));
    this.renderSavedTracks();
  },

  // ========== 制作模式 ==========

  startEditing() {
    _editingTrack = { id: generateId(), name: '', waypoints: [], createdAt: new Date().toISOString() };
    _tempWaypoints = [];
    _insertTarget = null;
    this.renderPanel();
    this._updateContextMenu();
    showToast('进入制作模式，右键地图添加途径点');
  },

  cancelEditing() {
    this._clearTempMapElements();
    _editingTrack = null;
    _tempWaypoints = [];
    this.renderPanel();
    this._updateContextMenu();
    showToast('已取消制作');
  },

  async finishEditing() {
    if (_tempWaypoints.length < 2) {
      showToast('至少需要 2 个途径点');
      return;
    }
    const name = prompt('请输入轨迹名称：');
    if (!name || !name.trim()) return;
    _editingTrack.name = name.trim();
    _editingTrack.waypoints = [..._tempWaypoints];
    _editingTrack.routeMode = 'driving';

    // 选择轨迹分类
    const categories = this.getCategories();
    if (categories.length > 0) {
      const chosen = await this.pickCategory(null);
      if (chosen) _editingTrack.categoryId = chosen;
    }

    Storage.saveTrack(_editingTrack);
    this._clearTempMapElements();
    _editingTrack = null;
    _tempWaypoints = [];
    this.renderPanel();
    this._updateContextMenu();
    this.renderSavedTracks();
    showToast('轨迹已保存');
  },

  addWaypoint(lng, lat) {
    if (!_editingTrack) return;
    const wp = { lng, lat, name: `途径点 ${_tempWaypoints.length + 1}` };
    _tempWaypoints.push(wp);
    this._renderTempOnMap();
    this.renderWaypointList();
  },

  updateWaypointName(index, name) {
    if (!_editingTrack || index < 0 || index >= _tempWaypoints.length) return;
    _tempWaypoints[index].name = name.trim() || `途径点 ${index + 1}`;
    this._renderTempOnMap();
  },

  // ========== 已保存轨迹渲染 ==========

  renderSavedTracks() {
    const container = document.getElementById('track-list');
    const visBar = document.getElementById('track-visibility-bar');
    if (!container) return;
    let tracks = Storage.getTracks();

    tracks = tracks.filter(t => {
      if (!t.categoryId) return true;
      return !this.isCategoryHidden(t.categoryId);
    });

    if (visBar) visBar.style.display = tracks.length > 0 ? 'flex' : 'none';

    if (tracks.length === 0) {
      container.innerHTML = '';
      return;
    }

    const EYE_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_CLOSED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    container.innerHTML = tracks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => {
        const mode = t.routeMode || 'driving';
        const isExpanded = _expandedTrackId === t.id;
        const isVisible = this.isTrackVisible(t.id);
        const wpHtml = isExpanded ? this._buildTrackWaypointHtml(t) : '';
        const cat = t.categoryId ? this.getCategoryById(t.categoryId) : null;
        const catMeta = cat ? `<span style="color:${cat.color};margin-right:4px">${cat.emoji}</span>${escapeHtml(cat.name)}` : '未分类';
        return `
        <div class="track-card ${isExpanded ? 'track-card--expanded' : ''}" data-id="${t.id}">
          <div class="track-card__header">
            <span class="track-card__icon">${cat ? cat.emoji : '🛤️'}</span>
            <div class="track-card__info" data-track-toggle="${t.id}">
              <div class="track-card__name">${escapeHtml(t.name)}</div>
              <div class="track-card__meta">${t.waypoints.length} 个途径点 · ${catMeta}</div>
            </div>
            <div class="track-card__actions">
              <button class="track-visibility-btn ${isVisible ? 'track-visibility-btn--active' : ''}" data-track-vis="${t.id}" title="${isVisible ? '隐藏轨迹' : '显示轨迹'}">${isVisible ? EYE_OPEN : EYE_CLOSED}</button>
              <div class="track-mode-group">
                <button class="track-mode-btn ${isVisible && mode === 'driving' ? 'track-mode-btn--active' : ''}" data-track-show="${t.id}" data-mode="driving" title="导航路线">导航</button>
                <button class="track-mode-btn ${isVisible && mode === 'straight' ? 'track-mode-btn--active' : ''}" data-track-show="${t.id}" data-mode="straight" title="直线连接">直线</button>
              </div>
              <div class="track-card__menu-wrap">
                <button class="track-card__menu-btn" data-track-menu="${t.id}" title="更多">···</button>
                <div class="track-card__dropdown hidden" data-track-dropdown="${t.id}">
                  <button class="track-card__dropdown-item" data-track-change-cat="${t.id}">更改分类</button>
                  <button class="track-card__dropdown-item" data-track-export="${t.id}">导出轨迹</button>
                  <button class="track-card__dropdown-item" data-track-import="${t.id}">导入覆盖</button>
                  <button class="track-card__dropdown-item track-card__dropdown-item--danger" data-track-delete="${t.id}">删除轨迹</button>
                </div>
              </div>
            </div>
          </div>
          <div class="track-card__body">${wpHtml}</div>
        </div>`;
      })
      .join('');

    // 展开/收起
    container.querySelectorAll('[data-track-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.trackToggle;
        _expandedTrackId = _expandedTrackId === id ? null : id;
        this.renderSavedTracks();
      });
    });

    // 模式切换（点击已激活的模式按钮则隐藏）
    container.querySelectorAll('.track-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.trackShow;
        const mode = btn.dataset.mode;
        const isActive = btn.classList.contains('track-mode-btn--active');
        if (isActive) {
          this.hideTrack(id);
          this.renderSavedTracks();
          return;
        }
        const allTracks = Storage.getTracks();
        const track = allTracks.find(t => t.id === id);
        if (track) { track.routeMode = mode; Storage.saveTrack(track); }
        document.querySelectorAll(`.track-mode-btn[data-track-show="${id}"]`).forEach(b => {
          b.classList.toggle('track-mode-btn--active', b.dataset.mode === mode);
        });
        // 更新可见性按钮
        const visBtn = container.querySelector(`[data-track-vis="${id}"]`);
        if (visBtn) { visBtn.innerHTML = EYE_OPEN; visBtn.classList.add('track-visibility-btn--active'); }
        this.showTrack(id, mode);
      });
    });

    // 可见性切换（眼睛按钮）
    container.querySelectorAll('[data-track-vis]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.trackVis;
        if (this.isTrackVisible(id)) {
          this.hideTrack(id);
        } else {
          const track = Storage.getTracks().find(t => t.id === id);
          this.showTrack(id, track?.routeMode);
        }
        this.renderSavedTracks();
      });
    });

    // 更多菜单（fixed 定位避免被 overflow 裁切）
    container.querySelectorAll('[data-track-menu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelectorAll('.track-card__dropdown').forEach(d => {
          d.classList.add('hidden');
          d.style.position = '';
          d.style.top = '';
          d.style.left = '';
        });
        const dropdown = container.querySelector(`[data-track-dropdown="${btn.dataset.trackMenu}"]`);
        if (!dropdown) return;
        const rect = btn.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = rect.top + 'px';
        dropdown.style.right = (window.innerWidth - rect.right) + 'px';
        dropdown.style.left = '';
        dropdown.classList.remove('hidden');
      });
    });
    document.addEventListener('click', () => {
      container.querySelectorAll('.track-card__dropdown').forEach(d => {
        d.classList.add('hidden');
        d.style.position = '';
        d.style.top = '';
        d.style.left = '';
      });
    });

    // 更改分类
    container.querySelectorAll('[data-track-change-cat]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.trackChangeCat;
        const track = Storage.getTracks().find(t => t.id === id);
        if (!track) return;
        const categories = this.getCategories();
        if (categories.length === 0) {
          showToast('请先创建轨迹分类');
          return;
        }
        const chosen = await this.pickCategory(track.categoryId);
        track.categoryId = chosen;
        Storage.saveTrack(track);
        this.renderSavedTracks();
        showToast('分类已更新');
      });
    });

    // 导出
    container.querySelectorAll('[data-track-export]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const track = Storage.getTracks().find(t => t.id === btn.dataset.trackExport);
        if (!track) return;
        const json = JSON.stringify(track, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('轨迹已导出');
      });
    });

    // 导入覆盖
    container.querySelectorAll('[data-track-import]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.trackImport;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result);
              if (!data.waypoints || !Array.isArray(data.waypoints)) {
                showToast('无效的轨迹文件');
                return;
              }
              const track = Storage.getTracks().find(t => t.id === id);
              if (track) {
                track.waypoints = data.waypoints;
                if (data.name) track.name = data.name;
                if (data.routeMode) track.routeMode = data.routeMode;
                Storage.saveTrack(track);
                this.hideTrack(id);
                this.showTrack(id);
                this.renderSavedTracks();
                showToast('轨迹已覆盖导入');
              }
            } catch (err) {
              showToast('导入失败：' + err.message);
            }
          };
          reader.readAsText(file);
        });
        fileInput.click();
      });
    });

    // 删除
    container.querySelectorAll('[data-track-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定删除这条轨迹吗？')) {
          const id = btn.dataset.trackDelete;
          Storage.deleteTrack(id);
          this.hideTrack(id);
          if (_expandedTrackId === id) _expandedTrackId = null;
          if (_insertTarget && _insertTarget.trackId === id) _insertTarget = null;
          this.renderSavedTracks();
          showToast('轨迹已删除');
        }
      });
    });

    // 途径点名称编辑
    container.querySelectorAll('[data-tw-name]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const [trackId, idxStr] = el.dataset.twName.split('|');
        const idx = parseInt(idxStr);
        const track = Storage.getTracks().find(t => t.id === trackId);
        if (!track || !track.waypoints[idx]) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'waypoint-item__input';
        input.value = track.waypoints[idx].name;
        el.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          track.waypoints[idx].name = input.value.trim() || `途径点 ${idx + 1}`;
          Storage.saveTrack(track);
          this.showTrack(trackId);
          this.renderSavedTracks();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { input.value = track.waypoints[idx].name; input.blur(); }
        });
      });
    });

    // 删除途径点
    container.querySelectorAll('[data-tw-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [trackId, idxStr] = btn.dataset.twDel.split('|');
        this._deleteTrackWaypoint(trackId, parseInt(idxStr));
      });
    });

    // 插入途径点
    container.querySelectorAll('[data-tw-insert]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [trackId, idxStr] = btn.dataset.twInsert.split('|');
        this._startInsert(trackId, parseInt(idxStr));
      });
    });
  },

  _buildTrackWaypointHtml(track) {
    if (!track.waypoints.length) return '';
    const isActive = (idx) => _insertTarget && _insertTarget.trackId === track.id && _insertTarget.insertIndex === idx;
    return `<div class="track-wp-list">` + track.waypoints.map((wp, i) => {
      const dotClass = i === 0 ? 'waypoint-item__num--start' : (i === track.waypoints.length - 1 ? 'waypoint-item__num--end' : '');
      const dotText = i === 0 ? '起' : (i === track.waypoints.length - 1 ? '终' : `${i + 1}`);
      return `
        <div class="waypoint-item">
          <span class="waypoint-item__num ${dotClass}">${dotText}</span>
          <span class="waypoint-item__name" data-tw-name="${track.id}|${i}">${escapeHtml(wp.name)}</span>
          <button class="waypoint-item__del" data-tw-del="${track.id}|${i}" title="删除">×</button>
        </div>
        <button class="track-wp__add ${isActive(i + 1) ? 'track-wp__add--active' : ''}" data-tw-insert="${track.id}|${i + 1}" title="在此处插入途径点">+</button>`;
    }).join('') + '</div>';
  },

  _startInsert(trackId, insertIndex) {
    if (_insertTarget && _insertTarget.trackId === trackId && _insertTarget.insertIndex === insertIndex) {
      _insertTarget = null;
      this._updateContextMenu();
      this.renderSavedTracks();
      return;
    }
    _insertTarget = { trackId, insertIndex };
    this._updateContextMenu();
    showToast('在地图上右键选择途径点位置');
    this.renderSavedTracks();
  },

  insertWaypoint(trackId, index, lng, lat) {
    const track = Storage.getTracks().find(t => t.id === trackId);
    if (!track) return;
    track.waypoints.splice(index, 0, { lng, lat, name: `途径点 ${index + 1}` });
    Storage.saveTrack(track);
    _insertTarget = null;
    this._updateContextMenu();
    this.showTrack(trackId);
    this.renderSavedTracks();
    showToast('途径点已添加');
  },

  _deleteTrackWaypoint(trackId, index) {
    const track = Storage.getTracks().find(t => t.id === trackId);
    if (!track || track.waypoints.length <= 2) {
      showToast('至少保留 2 个途径点');
      return;
    }
    track.waypoints.splice(index, 1);
    Storage.saveTrack(track);
    this.hideTrack(trackId);
    this.showTrack(trackId);
    this.renderSavedTracks();
    showToast('途径点已删除');
  },

  // ========== 地图显示 ==========

  async showTrack(id, mode) {
    const track = Storage.getTracks().find(t => t.id === id);
    if (!track || track.waypoints.length < 2) return;
    const routeMode = mode || track.routeMode || 'driving';
    const AMap = MapModule.getAMap();
    const map = MapModule.getMap();
    this.hideTrack(id);

    const startWp = track.waypoints[0];
    const endWp = track.waypoints[track.waypoints.length - 1];
    const startLabel = startWp.name ? `<span class="wp-marker-label">${escapeHtml(startWp.name)}</span>` : '';
    const endLabel = endWp.name ? `<span class="wp-marker-label">${escapeHtml(endWp.name)}</span>` : '';
    const startMarker = new AMap.Marker({
      position: new AMap.LngLat(startWp.lng, startWp.lat),
      content: `<div class="wp-marker"><span class="wp-marker__dot wp-marker__dot--start">起</span>${startLabel}</div>`,
      zIndex: 110, offset: new AMap.Pixel(-15, -15)
    });
    const endMarker = new AMap.Marker({
      position: new AMap.LngLat(endWp.lng, endWp.lat),
      content: `<div class="wp-marker"><span class="wp-marker__dot wp-marker__dot--end">终</span>${endLabel}</div>`,
      zIndex: 110, offset: new AMap.Pixel(-15, -15)
    });
    startMarker.setMap(map);
    endMarker.setMap(map);

    const midMarkers = [];
    for (let i = 1; i < track.waypoints.length - 1; i++) {
      const wp = track.waypoints[i];
      const label = wp.name ? `<span class="wp-marker-label">${escapeHtml(wp.name)}</span>` : '';
      const marker = new AMap.Marker({
        position: new AMap.LngLat(wp.lng, wp.lat),
        content: `<div class="wp-marker"><span class="wp-marker__dot wp-marker__dot--mid">${i + 1}</span>${label}</div>`,
        zIndex: 110, offset: new AMap.Pixel(-15, -15)
      });
      marker.setMap(map);
      midMarkers.push(marker);
    }

    let routePath;
    if (routeMode === 'straight') {
      routePath = track.waypoints.map(wp => [wp.lng, wp.lat]);
    } else {
      routePath = await this._calculateRoute(track.waypoints);
    }

    const polyline = new AMap.Polyline({
      path: routePath,
      strokeColor: '#007AFF',
      strokeWeight: 4,
      strokeStyle: routeMode === 'straight' ? 'dashed' : 'solid',
      strokeDasharray: routeMode === 'straight' ? [10, 6] : undefined,
      strokeOpacity: 0.7,
      lineJoin: 'round'
    });
    polyline.setMap(map);
    _savedOverlays.push({ id, polyline, startMarker, endMarker, midMarkers });
    map.setFitView([polyline], false, [60, 60, 60, 60]);
  },

  hideTrack(id) {
    const index = _savedOverlays.findIndex(o => o.id === id);
    if (index >= 0) {
      const { polyline, startMarker, endMarker, midMarkers } = _savedOverlays[index];
      polyline.setMap(null);
      startMarker.setMap(null);
      endMarker.setMap(null);
      (midMarkers || []).forEach(m => m.setMap(null));
      _savedOverlays.splice(index, 1);
    }
  },

  // ========== 面板渲染 ==========

  renderPanel() {
    const panel = document.getElementById('tracks-panel');
    const editingArea = document.getElementById('track-editing-area');
    if (!panel) return;
    if (this.isEditing()) {
      panel.classList.remove('sidebar__panel--hidden');
      if (editingArea) editingArea.classList.remove('hidden');
      document.getElementById('track-saved-area').classList.add('hidden');
      document.getElementById('track-create-btn').classList.add('hidden');
    } else {
      if (editingArea) editingArea.classList.add('hidden');
      document.getElementById('track-saved-area').classList.remove('hidden');
      document.getElementById('track-create-btn').classList.remove('hidden');
    }
    this.renderSavedTracks();
  },

  renderWaypointList() {
    const container = document.getElementById('waypoint-list');
    if (!container) return;
    if (_tempWaypoints.length === 0) {
      container.innerHTML = '<p class="sidebar__empty" style="padding:32px 16px">右键地图添加途径点</p>';
      return;
    }
    container.innerHTML = _tempWaypoints
      .map((wp, i) => `
        <div class="waypoint-item" data-index="${i}">
          <span class="waypoint-item__num">${i + 1}</span>
          <span class="waypoint-item__name" data-wp-name="${i}">${escapeHtml(wp.name)}</span>
          <button class="waypoint-item__del" data-wp-del="${i}" title="移除">×</button>
        </div>`)
      .join('');

    container.querySelectorAll('[data-wp-name]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.wpName);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'waypoint-item__input';
        input.value = _tempWaypoints[idx].name;
        el.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          this.updateWaypointName(idx, input.value);
          this.renderWaypointList();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { input.value = _tempWaypoints[idx].name; input.blur(); }
        });
      });
    });

    container.querySelectorAll('[data-wp-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _tempWaypoints.splice(parseInt(btn.dataset.wpDel), 1);
        this._renderTempOnMap();
        this.renderWaypointList();
      });
    });
  },

  // ========== 路线计算 ==========

  async _calculateRoute(waypoints) {
    if (waypoints.length < 2) return waypoints.map(wp => [wp.lng, wp.lat]);
    const apiKey = MapModule._webApiKey;
    if (!apiKey) return waypoints.map(wp => [wp.lng, wp.lat]);
    const origin = `${waypoints[0].lng},${waypoints[0].lat}`;
    const dest = `${waypoints[waypoints.length - 1].lng},${waypoints[waypoints.length - 1].lat}`;
    let url = `https://restapi.amap.com/v3/direction/driving?origin=${origin}&destination=${dest}&key=${apiKey}&extensions=all`;
    if (waypoints.length > 2) {
      url += `&waypoints=${waypoints.slice(1, -1).map(wp => `${wp.lng},${wp.lat}`).join(';')}`;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.route?.paths?.length > 0) {
        const path = [];
        data.route.paths[0].steps.forEach(step => {
          step.polyline.split(';').forEach(pt => {
            const [lng, lat] = pt.split(',').map(Number);
            if (!isNaN(lng) && !isNaN(lat)) path.push([lng, lat]);
          });
        });
        if (path.length > 0) return path;
      }
    } catch (e) {
      console.error('[Route] 驾车路线计算失败:', e);
    }
    return waypoints.map(wp => [wp.lng, wp.lat]);
  },

  // ========== 地图渲染（制作模式）==========

  async _renderTempOnMap() {
    const AMap = MapModule.getAMap();
    const map = MapModule.getMap();
    this._clearTempMapElements();
    if (_tempWaypoints.length === 0) return;

    _tempWaypoints.forEach((wp, i) => {
      const label = wp.name ? `<span class="wp-marker-label">${escapeHtml(wp.name)}</span>` : '';
      const marker = new AMap.Marker({
        position: new AMap.LngLat(wp.lng, wp.lat),
        content: `<div class="wp-marker"><span class="wp-marker__dot">${i + 1}</span>${label}</div>`,
        zIndex: 115, offset: new AMap.Pixel(-15, -15)
      });
      marker.setMap(map);
      _mapWaypoints.push(marker);
    });

    const straightPath = _tempWaypoints.map(wp => [wp.lng, wp.lat]);
    const tempPolyline = new AMap.Polyline({
      path: straightPath,
      strokeColor: '#007AFF', strokeWeight: 3,
      strokeStyle: 'dashed', strokeDasharray: [10, 6], strokeOpacity: 0.5
    });
    tempPolyline.setMap(map);
    _mapPolylines.push(tempPolyline);

    const routePath = await this._calculateRoute(_tempWaypoints);
    if (!_editingTrack) return;

    tempPolyline.setMap(null);
    _mapPolylines = _mapPolylines.filter(p => p !== tempPolyline);
    const polyline = new AMap.Polyline({
      path: routePath,
      strokeColor: '#007AFF', strokeWeight: 4,
      strokeStyle: 'solid', strokeOpacity: 0.8, lineJoin: 'round'
    });
    polyline.setMap(map);
    _mapPolylines.push(polyline);
    map.setFitView([polyline], false, [60, 60, 60, 60]);
  },

  _clearTempMapElements() {
    const map = MapModule.getMap();
    _mapWaypoints.forEach(m => m.setMap(null));
    _mapPolylines.forEach(p => p.setMap(null));
    _mapWaypoints = [];
    _mapPolylines = [];
  },

  // ========== 右键菜单 ==========

  _updateContextMenu() {
    const item = document.getElementById('ctx-add-marker');
    if (!item) return;
    const isTrackMode = this.isEditing() || this.isInserting();
    item.textContent = isTrackMode ? '添加途径点' : '在此添加标记';
    item.classList.toggle('context-menu__item--waypoint', isTrackMode);
  },

  // ========== 初始化 ==========

  loadAll() {
    this.renderTrackFilterBar();
    this.renderSavedTracks();
    this.renderPanel();
  }
};
