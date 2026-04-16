/**
 * map.js — 地图初始化模块
 * 负责高德地图实例创建、事件绑定、视图控制
 */

import { Storage } from './storage.js';

const DEFAULT_CENTER = [116.397, 39.908]; // 北京
const DEFAULT_ZOOM = 12;

export const MapModule = {
  AMap: null,
  map: null,
  _webApiKey: null,

  async init(config) {
    this._webApiKey = config.amap.web_api_key;

    // 安全密钥必须在 API 加载前设置
    window._AMapSecurityConfig = {
      securityJsCode: config.amap.security_code
    };

    this.AMap = await window.AMapLoader.load({
      key: config.amap.js_api_key,
      version: '2.0',
      plugins: ['AMap.Geolocation']
    });

    this.map = new this.AMap.Map('map', {
      zoom: DEFAULT_ZOOM,
      center: DEFAULT_CENTER,
      resizeEnable: true
    });

    // 尝试自动定位到用户当前位置
    this._tryGeolocate();
  },

  setClickListener(callback) {
    // PC 端：右键菜单
    this.map.on('rightclick', (e) => {
      callback(
        { lng: e.lnglat.getLng(), lat: e.lnglat.getLat() },
        { x: e.pixel.getX(), y: e.pixel.getY() }
      );
    });

    // 移动端：长按模拟右键
    this._setupLongPress(callback);
  },

  _setupLongPress(callback) {
    const mapEl = this.map.getContainer();
    let timer = null;
    let startX = 0, startY = 0;

    mapEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      timer = setTimeout(() => {
        const rect = mapEl.getBoundingClientRect();
        const pixel = new this.AMap.Pixel(
          touch.clientX - rect.left,
          touch.clientY - rect.top
        );
        const lnglat = this.map.containerToLngLat(pixel);
        if (lnglat) {
          callback(
            { lng: lnglat.getLng(), lat: lnglat.getLat() },
            { x: touch.clientX, y: touch.clientY }
          );
        }
        timer = null;
      }, 500);
    }, { passive: true });

    mapEl.addEventListener('touchmove', (e) => {
      if (!timer || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
        clearTimeout(timer);
        timer = null;
      }
    }, { passive: true });

    mapEl.addEventListener('touchend', () => {
      if (timer) { clearTimeout(timer); timer = null; }
    });
  },

  centerOn(lng, lat) {
    this.map.setZoomAndCenter(15, [lng, lat]);
  },

  getAMap() {
    return this.AMap;
  },

  getMap() {
    return this.map;
  },

  async geocode(lng, lat) {
    try {
      if (!this._webApiKey) return '';
      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${this._webApiKey}&location=${lng},${lat}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.regeocode) {
        const ac = data.regeocode.addressComponent;
        return (typeof ac.city === 'string' && ac.city) || ac.province || '';
      }
    } catch (e) {
      console.error('[Geocode] 逆地理编码失败:', e);
    }
    return '';
  },

  _tryGeolocate() {
    try {
      const geolocation = new this.AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 5000
      });
      this.map.addControl(geolocation);
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          this.map.setCenter([result.position.lng, result.position.lat]);
          this.map.setZoom(14);
        }
      });
    } catch (e) {
      // 定位失败不影响使用，保持默认中心（北京）
    }
  }
};
