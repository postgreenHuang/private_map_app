/**
 * search.js — 地点搜索模块
 * 使用高德 POI 搜索 API（/v3/place/text），搜索后批量在地图上显示结果
 */

import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { MarkerModule } from './marker.js';
import { TrackModule } from './track.js';

let _debounceTimer = null;
let _webApiKey = null;
let _poiMarkers = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export const SearchModule = {
  async init() {
    const config = await Storage.loadConfig();
    _webApiKey = config.amap.web_api_key;
    this._bindEvents();
  },

  _bindEvents() {
    const input = document.getElementById('search-input');

    input.addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => this._search(input.value.trim()), 300);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._closeResults();
        this._clearPoiMarkers();
        input.blur();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search')) {
        this._closeResults();
      }
    });
  },

  async _search(keyword) {
    if (!keyword) {
      this._closeResults();
      this._clearPoiMarkers();
      return;
    }

    try {
      const params = new URLSearchParams({
        keywords: keyword,
        key: _webApiKey,
        city: '全国',
        offset: '25',
        page: '1',
        extensions: 'base'
      });
      const url = `https://restapi.amap.com/v3/place/text?${params}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === '1' && data.pois) {
        this._renderResults(data.pois, keyword);
      } else {
        this._closeResults();
        this._clearPoiMarkers();
      }
    } catch (e) {
      console.error('[Search] fetch error:', e);
      this._closeResults();
    }
  },

  _renderResults(pois, keyword) {
    const listEl = document.getElementById('search-results');

    if (pois.length === 0) {
      listEl.innerHTML = '<div class="search-results__empty">无匹配结果</div>';
      listEl.classList.remove('hidden');
      this._clearPoiMarkers();
      return;
    }

    // 列表头部提示
    listEl.innerHTML = `
      <div class="search-results__header">找到 ${pois.length} 个结果，已显示在地图上</div>` +
      pois
        .map(
          (poi, i) => `
        <div class="search-result-item" data-index="${i}">
          <div class="search-result-item__name">${this._highlight(poi.name, keyword)}</div>
          <div class="search-result-item__address">${escapeHtml(poi.address || poi.cityname || '')}</div>
        </div>`
        )
        .join('');

    listEl.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const poi = pois[parseInt(el.dataset.index)];
        const [lng, lat] = poi.location.split(',').map(Number);
        MapModule.centerOn(lng, lat);
        document.getElementById('search-input').value = poi.name;
        this._closeResults();
      });
    });

    listEl.classList.remove('hidden');

    // 批量在地图上标记
    this._showPoiMarkers(pois);
  },

  _highlight(text, keyword) {
    const escaped = escapeHtml(text);
    const kw = escapeHtml(keyword);
    const regex = new RegExp(
      `(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    return escaped.replace(regex, '<mark>$1</mark>');
  },

  _closeResults() {
    document.getElementById('search-results').classList.add('hidden');
  },

  _showPoiMarkers(pois) {
    const AMap = MapModule.getAMap();
    const map = MapModule.getMap();

    // 清除之前的 POI 标记
    this._clearPoiMarkers();

    pois.forEach(poi => {
      const [lng, lat] = poi.location.split(',').map(Number);
      const marker = new AMap.Marker({
        position: new AMap.LngLat(lng, lat),
        content: `<div class="poi-marker">
          <span class="poi-marker__icon">📍</span>
          <span class="poi-marker__label">${escapeHtml(poi.name)}</span>
        </div>`,
        zIndex: 100,
        anchor: 'bottom-center'
      });
      marker.setMap(map);
      _poiMarkers.push(marker);

      // 点击 POI 标记跳转
      marker.on('click', () => {
        MapModule.centerOn(lng, lat);
        document.getElementById('search-input').value = poi.name;
      });

      // 右键 POI 标记 → 轨迹模式下添加途径点，否则添加标记
      marker.on('rightclick', () => {
        if (TrackModule.isInserting()) {
          const { trackId, insertIndex } = TrackModule.getInsertTarget();
          TrackModule.insertWaypoint(trackId, insertIndex, lng, lat);
        } else if (TrackModule.isEditing()) {
          TrackModule.addWaypoint(lng, lat);
        } else {
          MarkerModule.openForm({ lng, lat });
          document.getElementById('marker-name').value = poi.name;
        }
      });
    });

    // 自适应视野：让所有 POI 标记都在可视范围内
    if (_poiMarkers.length > 0) {
      map.setFitView(_poiMarkers.map(m => m), false, [60, 60, 60, 60]);
    }
  },

  _clearPoiMarkers() {
    const map = MapModule.getMap();
    _poiMarkers.forEach(m => m.setMap(null));
    _poiMarkers = [];
  }
};
