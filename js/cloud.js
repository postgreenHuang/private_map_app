/**
 * cloud.js — 云端同步模块（Supabase）
 * 负责数据上云、拉取、实时订阅
 */

let _client = null;

// ===== 数据转换 =====

function toCloudMarker(m) {
  return {
    id: m.id, name: m.name,
    lng: m.position.lng, lat: m.position.lat,
    city: m.city || '', category_id: m.categoryId || null,
    links: m.links || [], icon: m.icon || '📍',
    created_at: m.createdAt
  };
}

function toLocalMarker(r) {
  return {
    id: r.id, name: r.name,
    position: { lng: r.lng, lat: r.lat },
    city: r.city || '', categoryId: r.category_id || '',
    links: r.links || [], icon: r.icon || '📍',
    createdAt: r.created_at
  };
}

function toCloudTrack(t) {
  return {
    id: t.id, name: t.name,
    waypoints: t.waypoints || [],
    route_mode: t.routeMode || 'driving',
    category_id: t.categoryId || null,
    created_at: t.createdAt
  };
}

function toLocalTrack(r) {
  return {
    id: r.id, name: r.name,
    waypoints: r.waypoints || [],
    routeMode: r.route_mode || 'driving',
    categoryId: r.category_id || '',
    createdAt: r.created_at
  };
}

export const CloudSync = {
  isAvailable() {
    return !!_client;
  },

  async init(config) {
    if (!config.supabase?.url || !window.supabase) return;
    try {
      const { createClient } = window.supabase;
      _client = createClient(config.supabase.url, config.supabase.anon_key);
      await this.pullAll();
      console.log('[Cloud] 数据同步完成');
    } catch (e) {
      console.warn('[Cloud] 初始化失败，使用本地数据:', e);
      _client = null;
    }
  },

  // ===== 全量拉取 =====

  async pullAll() {
    if (!_client) return;
    try {
      // 先把本地数据推上去
      await this.pushAllLocal();

      // 从云端拉取，与本地合并（只添加云端独有的，不覆盖本地已有的）
      const [catRes, mkRes, tcRes, trRes] = await Promise.all([
        _client.from('marker_categories').select('*'),
        _client.from('markers').select('*'),
        _client.from('track_categories').select('*'),
        _client.from('tracks').select('*')
      ]);

      this._mergeToLocal('private_map_categories', catRes.data || []);
      this._mergeToLocal('private_map_markers', (mkRes.data || []).map(toLocalMarker));
      this._mergeToLocal('private_map_track_categories', tcRes.data || []);
      this._mergeToLocal('private_map_tracks', (trRes.data || []).map(toLocalTrack));

      console.log('[Cloud] 数据同步完成');
    } catch (e) {
      console.warn('[Cloud] 同步失败，使用本地数据:', e);
    }
  },

  _mergeToLocal(key, cloudItems) {
    const localItems = JSON.parse(localStorage.getItem(key) || '[]');
    const localIds = new Set(localItems.map(i => i.id));
    const newFromCloud = cloudItems.filter(i => !localIds.has(i.id));
    if (newFromCloud.length > 0) {
      localStorage.setItem(key, JSON.stringify([...localItems, ...newFromCloud]));
    }
  },

  async pushAllLocal() {
    if (!_client) return;
    try {
      const categories = JSON.parse(localStorage.getItem('private_map_categories') || '[]');
      const markers = JSON.parse(localStorage.getItem('private_map_markers') || '[]').map(toCloudMarker);
      const trackCats = JSON.parse(localStorage.getItem('private_map_track_categories') || '[]');
      const tracks = JSON.parse(localStorage.getItem('private_map_tracks') || '[]').map(toCloudTrack);

      const ops = [];
      if (categories.length) ops.push(_client.from('marker_categories').upsert(categories, { onConflict: 'id' }));
      if (markers.length) ops.push(_client.from('markers').upsert(markers, { onConflict: 'id' }));
      if (trackCats.length) ops.push(_client.from('track_categories').upsert(trackCats, { onConflict: 'id' }));
      if (tracks.length) ops.push(_client.from('tracks').upsert(tracks, { onConflict: 'id' }));

      if (ops.length) await Promise.all(ops);
    } catch (e) {
      console.warn('[Cloud] 上传本地数据失败:', e);
    }
  },

  // ===== 标记 =====

  pushMarker(marker) {
    if (!_client) return;
    _client.from('markers').upsert(toCloudMarker(marker), { onConflict: 'id' });
  },

  removeMarker(id) {
    if (!_client) return;
    _client.from('markers').delete().eq('id', id);
  },

  // ===== 标记分类 =====

  pushCategory(category) {
    if (!_client) return;
    _client.from('marker_categories').upsert(category, { onConflict: 'id' });
  },

  removeCategory(id) {
    if (!_client) return;
    _client.from('marker_categories').delete().eq('id', id);
  },

  // ===== 轨迹 =====

  pushTrack(track) {
    if (!_client) return;
    _client.from('tracks').upsert(toCloudTrack(track), { onConflict: 'id' });
  },

  removeTrack(id) {
    if (!_client) return;
    _client.from('tracks').delete().eq('id', id);
  },

  // ===== 轨迹分类 =====

  pushTrackCategory(category) {
    if (!_client) return;
    _client.from('track_categories').upsert(category, { onConflict: 'id' });
  },

  removeTrackCategory(id) {
    if (!_client) return;
    _client.from('track_categories').delete().eq('id', id);
  },

  // ===== 实时订阅 =====

  startRealtime(callbacks) {
    if (!_client) return;

    const sub = (table, pullFn, cb) => {
      _client.channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async () => {
          await pullFn();
          cb?.();
        })
        .subscribe();
    };

    sub('markers', () => this._pullTable('markers', toLocalMarker, 'private_map_markers'),
      () => callbacks.onMarkersChange?.());
    sub('marker_categories', () => this._pullSimpleTable('marker_categories', 'private_map_categories'),
      () => callbacks.onCategoriesChange?.());
    sub('track_categories', () => this._pullSimpleTable('track_categories', 'private_map_track_categories'),
      () => callbacks.onTrackCategoriesChange?.());
    sub('tracks', () => this._pullTable('tracks', toLocalTrack, 'private_map_tracks'),
      () => callbacks.onTracksChange?.());
  },

  // ===== 单表拉取辅助 =====

  async _pullTable(table, toLocal, storageKey) {
    if (!_client) return;
    try {
      const res = await _client.from(table).select('*');
      if (res.data) localStorage.setItem(storageKey, JSON.stringify(res.data.map(toLocal)));
    } catch (e) {
      console.warn(`[Cloud] 拉取 ${table} 失败:`, e);
    }
  },

  async _pullSimpleTable(table, storageKey) {
    if (!_client) return;
    try {
      const res = await _client.from(table).select('*');
      if (res.data) localStorage.setItem(storageKey, JSON.stringify(res.data));
    } catch (e) {
      console.warn(`[Cloud] 拉取 ${table} 失败:`, e);
    }
  }
};
