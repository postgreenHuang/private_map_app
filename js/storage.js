/**
 * storage.js — 数据持久化模块
 * 负责 config.json 加载和 localStorage 的标记数据增删改查
 */

import { CloudSync } from './cloud.js';

const STORAGE_KEY = 'private_map_markers';

export const Storage = {
  async loadConfig() {
    try {
      const res = await fetch('config.json');
      if (!res.ok) throw new Error('config.json 加载失败');
      return await res.json();
    } catch (e) {
      throw new Error(
        '无法加载配置文件。请确保通过本地服务器访问（如 npx serve .），而非直接双击打开 HTML。'
      );
    }
  },

  getMarkers() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveMarker(marker) {
    const markers = this.getMarkers();
    const index = markers.findIndex(m => m.id === marker.id);
    if (index >= 0) {
      markers[index] = marker;
    } else {
      markers.push(marker);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    CloudSync.pushMarker(marker);
  },

  deleteMarker(id) {
    const markers = this.getMarkers().filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    CloudSync.removeMarker(id);
  },

  // ========== 导出 ==========

  getCategories() {
    const data = localStorage.getItem('private_map_categories');
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
    localStorage.setItem('private_map_categories', JSON.stringify(categories));
  },

  exportJSON() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: this.getCategories(),
      markers: this.getMarkers()
    };
    return JSON.stringify(data, null, 2);
  },

  importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.markers || !Array.isArray(data.markers)) {
      throw new Error('无效的数据文件：缺少 markers 字段');
    }
    return data;
  },

  exportGPX() {
    const markers = this.getMarkers();
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let wptIndex = 0;
    const waypoints = markers.map(m => {
      wptIndex++;
      const lat = m.position.lat.toFixed(6);
      const lng = m.position.lng.toFixed(6);
      const name = m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `    <wpt lat="${lat}" lon="${lng}">
      <time>${now}</time>
      <name>${name}</name>
      <desc>${m.city || ''} ${m.links ? m.links.map(l => l.url).join(', ') : ''}</desc>
      <sym>📍</sym>
      <type>Waypoint</type>
    </wpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="私人地图标记工具"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>我的标记</name>
    <time>${now}</time>
  </metadata>
  <wpt lat="0" lon="0">
    <name>起始点</name>
  </wpt>
${waypoints}
</gpx>`;
  },

  // ========== 轨迹存储 ==========

  getTracks() {
    const data = localStorage.getItem('private_map_tracks');
    return data ? JSON.parse(data) : [];
  },

  saveTrack(track) {
    const tracks = this.getTracks();
    const index = tracks.findIndex(t => t.id === track.id);
    if (index >= 0) {
      tracks[index] = track;
    } else {
      tracks.push(track);
    }
    localStorage.setItem('private_map_tracks', JSON.stringify(tracks));
    CloudSync.pushTrack(track);
  },

  deleteTrack(id) {
    const tracks = this.getTracks().filter(t => t.id !== id);
    localStorage.setItem('private_map_tracks', JSON.stringify(tracks));
    CloudSync.removeTrack(id);
  }
};
