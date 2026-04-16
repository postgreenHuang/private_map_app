/**
 * marker.js — 标记管理模块
 * 标记增删改、表单弹窗（分类/标签/链接）、侧边栏列表、筛选
 */

import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { CategoryModule } from './category.js';

const DEFAULT_ICON = '📍';
const _mapMarkers = {};
let _formState = { mode: 'add', position: null, editId: null };
let _formLinks = [];
let _cityFilter = null; // null = 全部
let _loadingAll = false;

function generateId() {
  return 'mk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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

function normalizeMarker(m) {
  return {
    icon: m.icon || DEFAULT_ICON,
    categoryId: m.categoryId || '',
    city: m.city || '',
    links: m.links || [],
    ...m
  };
}

export const MarkerModule = {
  // ========== 地图标记 ==========

  add(data) {
    const AMap = MapModule.getAMap();
    const cat = data.categoryId ? CategoryModule.getCategoryById(data.categoryId) : null;
    const displayIcon = cat ? cat.emoji : data.icon;

    const marker = new AMap.Marker({
      position: new AMap.LngLat(data.position.lng, data.position.lat),
      title: data.name,
      anchor: 'bottom-center',
      content: `<div class="user-marker">
        <span class="user-marker__icon">${displayIcon}</span>
        <span class="user-marker__label">${escapeHtml(data.name)}</span>
      </div>`
    });

    marker.on('click', () => {
      this.openForm(data.position, data);
    });

    marker.setMap(MapModule.getMap());
    _mapMarkers[data.id] = { amapMarker: marker, data };
  },

  remove(id) {
    const entry = _mapMarkers[id];
    if (entry) {
      entry.amapMarker.setMap(null);
      delete _mapMarkers[id];
    }
  },

  update(id, data) {
    this.remove(id);
    this.add(data);
  },

  // ========== 筛选 ==========

  applyFilter() {
    const markers = Storage.getMarkers();
    const catFilter = CategoryModule.getSelectedFilter();
    const hideAll = catFilter === '__none__';
    markers.forEach(m => {
      const entry = _mapMarkers[m.id];
      if (!entry) return;
      if (hideAll) {
        entry.amapMarker.hide();
      } else {
        const nm = normalizeMarker(m);
        const catHidden = catFilter && nm.categoryId !== catFilter;
        const cityHidden = _cityFilter && nm.city !== _cityFilter;
        if (catHidden || cityHidden) {
          entry.amapMarker.hide();
        } else {
          entry.amapMarker.show();
        }
      }
    });
    this.renderList();
  },

  // ========== 表单 ==========

  openForm(position, existingData) {
    _formState.mode = existingData ? 'edit' : 'add';
    _formState.position = position;
    _formState.editId = existingData ? existingData.id : null;

    const data = existingData ? normalizeMarker(existingData) : null;

    document.getElementById('marker-form-title').textContent = data ? '编辑标记' : '添加标记';
    document.getElementById('marker-name').value = data ? data.name : '';

    // 分类下拉
    this.renderCategoryOptions();
    if (data && data.categoryId) {
      document.getElementById('marker-category').value = data.categoryId;
    } else {
      document.getElementById('marker-category').value = '';
    }

    // 链接
    _formLinks = data && data.links ? data.links.map(l => ({ ...l })) : [];
    this._renderLinks();

    document.getElementById('marker-delete').classList.toggle('hidden', !data);
    document.getElementById('marker-form-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('marker-name').focus(), 100);
  },

  closeForm() {
    document.getElementById('marker-form-overlay').classList.add('hidden');
    _formState = { mode: 'add', position: null, editId: null };
    _formLinks = [];
  },

  renderCategoryOptions() {
    const select = document.getElementById('marker-category');
    if (!select) return;
    const categories = CategoryModule.getCategories();
    select.innerHTML = '<option value="">未分类</option>' +
      categories.map(c => `<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
  },

  // ---------- 链接 ----------

  _renderLinks() {
    const container = document.getElementById('marker-links');
    if (!container) return;
    if (_formLinks.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = _formLinks
      .map(
        (l, i) =>
          `<div class="link-item">
          <a class="link-item__name" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.name)}<span class="link-item__arrow"></span></a>
          <div class="link-item__actions">
            <button type="button" class="btn btn--small btn--secondary" data-link-edit="${i}">编辑</button>
            <button type="button" class="btn btn--small btn--danger" data-link-delete="${i}">删除</button>
          </div>
        </div>`
      )
      .join('');

    container.querySelectorAll('[data-link-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.linkEdit);
        const link = _formLinks[idx];
        document.getElementById('link-name').value = link.name;
        document.getElementById('link-url').value = link.url;
        // 切换为编辑模式
        document.getElementById('link-add-btn').textContent = '更新';
        document.getElementById('link-add-btn').dataset.editIndex = idx;
      });
    });

    container.querySelectorAll('[data-link-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        _formLinks.splice(parseInt(btn.dataset.linkDelete), 1);
        this._renderLinks();
      });
    });
  },

  handleAddLink() {
    let name = document.getElementById('link-name').value.trim();
    const url = document.getElementById('link-url').value.trim();
    if (!url) return;
    if (!name) {
      try { name = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { name = url; }
    }

    const editIndex = document.getElementById('link-add-btn').dataset.editIndex;
    if (editIndex !== undefined && editIndex !== '') {
      _formLinks[parseInt(editIndex)] = { name, url };
      delete document.getElementById('link-add-btn').dataset.editIndex;
      document.getElementById('link-add-btn').textContent = '添加';
    } else {
      _formLinks.push({ name, url });
    }

    document.getElementById('link-name').value = '';
    document.getElementById('link-url').value = '';
    this._renderLinks();
  },

  // ---------- 提交 / 删除 ----------

  async handleSubmit() {
    const name = document.getElementById('marker-name').value.trim();
    if (!name) return;

    const categoryId = document.getElementById('marker-category').value;
    const links = _formLinks.map(l => ({ name: l.name, url: l.url }));
    const pos = { lng: _formState.position.lng, lat: _formState.position.lat };

    if (_formState.mode === 'add') {
      const city = await MapModule.geocode(pos.lng, pos.lat);
      const marker = {
        id: generateId(),
        name,
        categoryId,
        city,
        links,
        position: pos,
        createdAt: new Date().toISOString()
      };
      Storage.saveMarker(marker);
      this.add(marker);
      showToast('标记已添加');
    } else {
      const markers = Storage.getMarkers();
      const index = markers.findIndex(m => m.id === _formState.editId);
      if (index >= 0) {
        const existing = markers[index];
        const city = existing.city || await MapModule.geocode(pos.lng, pos.lat);
        Object.assign(markers[index], { name, categoryId, city, links });
        Storage.saveMarker(markers[index]);
        this.update(_formState.editId, markers[index]);
        showToast('标记已更新');
      }
    }

    this.renderCityFilter();
    this.renderList();
    this.closeForm();
  },

  handleDelete() {
    if (!_formState.editId) return;
    if (!confirm('确定删除这个标记吗？')) return;
    Storage.deleteMarker(_formState.editId);
    this.remove(_formState.editId);
    this.renderCityFilter();
    this.renderList();
    this.closeForm();
    showToast('标记已删除');
  },

  // ========== 侧边栏列表 ==========

  renderList() {
    const markers = Storage.getMarkers();
    const listEl = document.getElementById('markers-panel');

    if (markers.length === 0) {
      listEl.innerHTML = '<p class="sidebar__empty">暂无标记<br>右键地图即可添加</p>';
      return;
    }

    const sorted = [...markers]
      .map(normalizeMarker)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .filter(m => {
        const catFilter = CategoryModule.getSelectedFilter();
        if (catFilter === '__none__') return false;
        if (catFilter && m.categoryId !== catFilter) return false;
        if (_cityFilter && m.city !== _cityFilter) return false;
        return true;
      });

    listEl.innerHTML = sorted
      .map(m => {
        const cat = m.categoryId ? CategoryModule.getCategoryById(m.categoryId) : null;
        const displayEmoji = cat ? cat.emoji : m.icon;
        const catColor = cat ? cat.color : null;
        const linkCount = m.links ? m.links.length : 0;
        const hasExpandable = linkCount > 0;
        return `
        <div class="marker-card" data-id="${m.id}" data-lng="${m.position.lng}" data-lat="${m.position.lat}">
          <div class="marker-card__header">
            <span class="marker-card__icon">${displayEmoji}</span>
            <div class="marker-card__info">
              <div class="marker-card__name">${escapeHtml(m.name)}</div>
              <div class="marker-card__meta">
                ${cat ? `<span class="marker-card__category" style="color:${catColor}">${escapeHtml(cat.name)}</span>` : ''}
                ${hasExpandable ? `<span class="marker-card__link-count">${linkCount}条链接</span>` : ''}
              </div>
            </div>
            <button class="marker-card__edit" data-edit="${m.id}" title="编辑标记">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${hasExpandable ? '<span class="marker-card__chevron"></span>' : ''}
          </div>
          ${hasExpandable ? `
          <div class="marker-card__body">
            <div class="marker-card__links">
              ${m.links.map(l => `<a class="marker-card__link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.name)}<span class="link-item__arrow"></span></a>`).join('')}
            </div>
          </div>` : ''}
        </div>`;
      })
      .join('');

    // 点击卡片跳转到地图位置
    listEl.querySelectorAll('.marker-card__header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.marker-card__edit')) return;
        if (e.target.closest('.marker-card__link')) return;
        const card = header.closest('.marker-card');
        // 跳转到地图位置
        const lng = parseFloat(card.dataset.lng);
        const lat = parseFloat(card.dataset.lat);
        if (!isNaN(lng) && !isNaN(lat)) {
          MapModule.centerOn(lng, lat);
        }
        // 如果有链接区域则展开/折叠
        if (card.querySelector('.marker-card__body')) {
          card.classList.toggle('marker-card--expanded');
        }
      });
    });

    // 编辑按钮
    listEl.querySelectorAll('.marker-card__edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const marker = Storage.getMarkers().find(m => m.id === btn.dataset.edit);
        if (marker) {
          MapModule.centerOn(marker.position.lng, marker.position.lat);
          this.openForm(marker.position, marker);
        }
      });
    });
  },

  async loadAll() {
    if (_loadingAll) return;
    _loadingAll = true;
    try {
      Object.keys(_mapMarkers).forEach(id => this.remove(id));
      const markers = Storage.getMarkers();
    let needSave = false;
    for (const m of markers) {
      if (typeof m.city !== 'string' || !m.city.trim()) {
        const city = await MapModule.geocode(m.position.lng, m.position.lat);
        m.city = String(city || '').trim();
        needSave = true;
      }
      this.add(normalizeMarker(m));
    }
    if (needSave) {
      localStorage.setItem('private_map_markers', JSON.stringify(markers));
    }
    this.renderCityFilter();
    this.renderList();
    } finally {
      _loadingAll = false;
    }
  },

  // ========== 城市筛选 ==========

  renderCityFilter() {
    const bar = document.getElementById('city-filter');
    if (!bar) return;

    const cities = [...new Set(
      Storage.getMarkers().map(m => normalizeMarker(m).city).filter(c => typeof c === 'string' && c.trim())
    )].sort();

    bar.classList.remove('hidden');

    if (cities.length === 0) {
      bar.innerHTML = `<span class="filter-hint">添加标记后自动识别城市</span>`;
      return;
    }

    bar.innerHTML =
      `<button class="filter-chip${!_cityFilter ? ' filter-chip--active' : ''}" data-city="">全部</button>` +
      cities.map(c =>
        `<button class="filter-chip${_cityFilter === c ? ' filter-chip--active' : ''}" data-city="${escapeHtml(c)}">${escapeHtml(c)}</button>`
      ).join('');

    bar.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        _cityFilter = chip.dataset.city || null;
        this.renderCityFilter();
        this.applyFilter();
      });
    });
  }
};
