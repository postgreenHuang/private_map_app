/**
 * category.js — 分类管理模块
 * 分类 CRUD、管理弹窗、颜色/图标选择器、筛选状态
 */

import { MarkerModule } from './marker.js';
import { Storage } from './storage.js';
import { CloudSync } from './cloud.js';

const CATEGORIES_KEY = 'private_map_categories';
const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#78716C'
];

const EMOJI_LIST = [
  '📍', '🏠', '🍜', '🏨', '🎯', '❤️', '⭐', '🎮',
  '🛒', '📚', '🏔️', '🏖️', '🎵', '🍺', '☕', '🍰',
  '🏥', '🏢', '🎪', '📿', '🍕', '🍔', '🍣', '🥘',
  '🌮', '🥩', '🍜', '🍦', '🧁', '🍵', '🥂', '🧃',
  '✈️', '🚗', '🚄', '🚌', '🚲', '⛴️', '🛳️', '🚁',
  '🏔️', '🏖️', '🌊', '🏞️', '🏕️', '🌅', '🌌', '🎄',
  '💪', '⚽', '🎾', '🏀', '🏊', '🎿', '🧗', '🎳',
  '🎭', '🎬', '🖼️', '🎪', '🛍️', '💄', '💇', '💆',
  '🐶', '🐱', '🐼', '🦊', '🐰', '🦁', '🐬', '🦋',
  '👶', '👨', '👩', '👫', '👨‍👩‍👧', '🎉', '💡', '📌'
];

let _editId = null;
const _hiddenCategories = new Set();
let _selectedFilter = null; // 当前选中的分类筛选，null 表示全部
const EMOJI_PER_PAGE = 14; // 7 列 × 2 行
const _emojiPages = {}; // 记录每个 picker 的当前页码

function generateId() {
  return 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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

export const CategoryModule = {
  // ========== 数据层 ==========

  getCategories() {
    const data = localStorage.getItem(CATEGORIES_KEY);
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
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    CloudSync.pushCategory(category);
  },

  deleteCategory(id) {
    const categories = this.getCategories().filter(c => c.id !== id);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    CloudSync.removeCategory(id);
  },

  getCategoryById(id) {
    return this.getCategories().find(c => c.id === id) || null;
  },

  getAllTags() {
    const tags = new Set();
    try {
      Storage.getMarkers().forEach(m => {
        if (m.tags) m.tags.forEach(t => tags.add(t));
      });
    } catch (e) { /* Storage 可能未初始化 */ }
    return [...tags];
  },

  // ========== 管理弹窗 ==========

  openModal(editId = null) {
    _editId = editId;
    document.getElementById('category-modal-overlay').classList.remove('hidden');
    this.renderCategoryList();

    if (editId) {
      const category = this.getCategoryById(editId);
      if (category) this._showForm(category);
    } else {
      this._hideForm();
    }
  },

  closeModal() {
    document.getElementById('category-modal-overlay').classList.add('hidden');
    this._hideForm();
    _editId = null;
  },

  renderCategoryList() {
    const listEl = document.getElementById('category-list');
    const categories = this.getCategories();

    if (categories.length === 0) {
      listEl.innerHTML = '<p class="sidebar__empty">暂无分类<br>点击下方按钮创建</p>';
      return;
    }

    listEl.innerHTML = categories
      .map(
        c => `
      <div class="category-item">
        <span class="category-item__color" style="background:${c.color}"></span>
        <span class="category-item__emoji">${c.emoji}</span>
        <span class="category-item__name">${escapeHtml(c.name)}</span>
        <div class="category-item__actions">
          <button class="btn btn--small btn--secondary category-item__btn" data-edit="${c.id}">编辑</button>
          <button class="btn btn--small btn--danger category-item__btn" data-delete="${c.id}">删除</button>
        </div>
      </div>`
      )
      .join('');

    listEl.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this._showForm(this.getCategoryById(btn.dataset.edit)));
    });

    listEl.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定删除该分类？标记不会被删除，但会变为「未分类」。')) {
          this.deleteCategory(btn.dataset.delete);
          this.renderCategoryList();
          this._notifyChange();
          this.renderFilterBar();
        }
      });
    });
  },

  _showForm(category) {
    document.getElementById('category-form-area').classList.remove('hidden');
    document.getElementById('cat-add-btn').classList.add('hidden');
    document.getElementById('cat-name').value = category ? category.name : '';
    this._renderEmojiPicker('cat-emoji-picker', category ? category.emoji : '📍');
    document.getElementById('cat-emoji-custom').value = '';
    this._renderColorPicker('cat-color-picker', category ? category.color : PRESET_COLORS[0]);
    _editId = category ? category.id : null;
  },

  _hideForm() {
    document.getElementById('category-form-area').classList.add('hidden');
    document.getElementById('cat-add-btn').classList.remove('hidden');
    _editId = null;
  },

  handleSave() {
    const name = document.getElementById('cat-name').value.trim();
    if (!name) return;
    const emoji = this._getSelectedEmoji('cat-emoji-picker', 'cat-emoji-custom') || '📍';
    const color = this._getSelectedColor('cat-color-picker') || PRESET_COLORS[0];

    this.saveCategory({ id: _editId || generateId(), name, emoji, color });
    this.renderCategoryList();
    this._hideForm();
    this._notifyChange();
    this.renderFilterBar();
  },

  _notifyChange() {
    MarkerModule.renderCategoryOptions();
    MarkerModule.applyFilter();
  },

  // ========== Emoji 选择器 ==========

  renderEmojiPicker(containerId, selected) {
    this._renderEmojiPicker(containerId, selected);
  },

  _renderEmojiPicker(containerId, selected, autoJump = true) {
    const container = document.getElementById(containerId);
    const totalPages = Math.ceil(EMOJI_LIST.length / EMOJI_PER_PAGE);
    if (!_emojiPages[containerId]) _emojiPages[containerId] = 0;

    // 仅在首次渲染（如编辑已有分类）时自动跳转到已选 emoji 所在页
    if (autoJump && selected) {
      const idx = EMOJI_LIST.indexOf(selected);
      if (idx >= 0) {
        _emojiPages[containerId] = Math.floor(idx / EMOJI_PER_PAGE);
      }
    }

    const page = _emojiPages[containerId];
    const start = page * EMOJI_PER_PAGE;
    const pageEmojis = EMOJI_LIST.slice(start, start + EMOJI_PER_PAGE);

    container.innerHTML = pageEmojis
      .map(
        e =>
          `<button type="button" class="emoji-picker__btn${
            e === selected ? ' emoji-picker__btn--active' : ''
          }" data-emoji="${e}">${e}</button>`
      )
      .join('');

    container.querySelectorAll('.emoji-picker__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.emoji-picker__btn').forEach(b => b.classList.remove('emoji-picker__btn--active'));
        btn.classList.add('emoji-picker__btn--active');
        const customInput = container.parentElement.querySelector('.emoji-picker__custom');
        if (customInput) customInput.value = '';
      });
    });

    // 翻页按钮
    const wrap = container.closest('.emoji-picker-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.emoji-picker__arrow').forEach(a => a.remove());

    const currentSelected = this._getSelectedEmoji(
      containerId,
      containerId === 'cat-emoji-picker' ? 'cat-emoji-custom' : 'emoji-custom'
    );

    if (page > 0) {
      const leftBtn = document.createElement('button');
      leftBtn.type = 'button';
      leftBtn.className = 'emoji-picker__arrow';
      leftBtn.textContent = '‹';
      leftBtn.addEventListener('click', () => {
        _emojiPages[containerId] = Math.max(0, _emojiPages[containerId] - 1);
        this._renderEmojiPicker(containerId, currentSelected, false);
      });
      wrap.insertBefore(leftBtn, container);
    }

    if (page < totalPages - 1) {
      const rightBtn = document.createElement('button');
      rightBtn.type = 'button';
      rightBtn.className = 'emoji-picker__arrow';
      rightBtn.textContent = '›';
      rightBtn.addEventListener('click', () => {
        _emojiPages[containerId] = Math.min(totalPages - 1, _emojiPages[containerId] + 1);
        this._renderEmojiPicker(containerId, currentSelected, false);
      });
      wrap.appendChild(rightBtn);
    }
  },

  _getSelectedEmoji(pickerId, customId) {
    const customEl = document.getElementById(customId);
    if (customEl && customEl.value.trim()) return customEl.value.trim();
    const active = document.querySelector(`#${pickerId} .emoji-picker__btn--active`);
    return active ? active.dataset.emoji : null;
  },

  // ========== 颜色选择器 ==========

  _renderColorPicker(containerId, selected) {
    const container = document.getElementById(containerId);
    container.innerHTML = PRESET_COLORS
      .map(
        c =>
          `<button type="button" class="color-picker__btn${
            c === selected ? ' color-picker__btn--active' : ''
          }" data-color="${c}" style="background:${c}"></button>`
      )
      .join('');

    container.querySelectorAll('.color-picker__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.color-picker__btn').forEach(b => b.classList.remove('color-picker__btn--active'));
        btn.classList.add('color-picker__btn--active');
      });
    });
  },

  _getSelectedColor(containerId) {
    const active = document.querySelector(`#${containerId} .color-picker__btn--active`);
    return active ? active.dataset.color : null;
  },

  // ========== 筛选 ==========

  getSelectedFilter() {
    return _selectedFilter;
  },

  isHidden(categoryId) {
    return _selectedFilter && _selectedFilter !== categoryId;
  },

  renderFilterBar() {
    const bar = document.getElementById('category-filter');
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
          `<option value="${c.id}"${_selectedFilter === c.id ? ' selected' : ''}>${c.emoji} ${escapeHtml(c.name)}</option>`
        ).join('')}
      </select>`;

    bar.querySelector('.filter-select').addEventListener('change', (e) => {
      _selectedFilter = e.target.value || null;
      MarkerModule.applyFilter();
    });
  }
};
