/**
 * cloud.js — 云端同步模块（Supabase）
 * 负责数据上云、拉取、实时订阅，按用户隔离
 */

import { Auth } from './auth.js';

let _client = null;
let _supabaseClient = null;

// ===== 数据转换 =====

function toCloudMarker(m) {
  return {
    id: m.id, name: m.name,
    lng: m.position.lng, lat: m.position.lat,
    city: m.city || '', category_id: m.categoryId || null,
    links: m.links || [], icon: m.icon || '📍',
    created_at: m.createdAt,
    user_id: Auth.getUserId()
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
    created_at: t.createdAt,
    user_id: Auth.getUserId()
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

function toCloudCategory(c) {
  return {
    ...c,
    user_id: Auth.getUserId()
  };
}

export const CloudSync = {
  isAvailable() {
    return !!_client;
  },

  /** 暴露 supabase client 供 Auth 模块使用 */
  getSupabaseClient() {
    return _client;
  },

  async init(config) {
    if (!config.supabase?.url || !window.supabase) return;
    try {
      const { createClient } = window.supabase;
      _supabaseClient = createClient(config.supabase.url, config.supabase.anon_key);
      _client = _supabaseClient;
      console.log('[Cloud] Supabase client 已创建');
    } catch (e) {
      console.warn('[Cloud] 初始化失败:', e);
      _client = null;
    }
  },

  /** 登录后调用：推送 → 认领 → 拉取合并 → 清理云端多余数据 */
  async pullUserData() {
    if (!_client || !Auth.getUserId()) return;
    try {
      const userId = Auth.getUserId();

      // 1. 先把本地数据推上去
      await this.pushAllLocal();

      // 2. 把无主数据认领为当前用户
      await this._claimOrphanData(userId);

      // 3. 拉取当前用户的数据并与本地合并
      const [catRes, mkRes, tcRes, trRes] = await Promise.all([
        _client.from('marker_categories').select('*').eq('user_id', userId),
        _client.from('markers').select('*').eq('user_id', userId),
        _client.from('track_categories').select('*').eq('user_id', userId),
        _client.from('tracks').select('*').eq('user_id', userId)
      ]);

      this._mergeToLocal('private_map_categories', catRes.data || []);
      this._mergeToLocal('private_map_markers', (mkRes.data || []).map(toLocalMarker));
      this._mergeToLocal('private_map_track_categories', tcRes.data || []);
      this._mergeToLocal('private_map_tracks', (trRes.data || []).map(toLocalTrack));

      // 4. 清理云端有但本地没有的数据（用户删了但之前没同步成功）
      await this._cleanupStaleData(userId);

      console.log('[Cloud] 用户数据同步完成');
    } catch (e) {
      console.warn('[Cloud] 用户数据同步失败:', e);
    }
  },

  /** 清理云端多余数据：云端有但本地没有的（包括无主和已认领的）→ 从云端删除 */
  async _cleanupStaleData(userId) {
    if (!_client) return;
    try {
      const localIds = {
        markers: new Set(JSON.parse(localStorage.getItem('private_map_markers') || '[]').map(m => m.id)),
        marker_categories: new Set(JSON.parse(localStorage.getItem('private_map_categories') || '[]').map(c => c.id)),
        track_categories: new Set(JSON.parse(localStorage.getItem('private_map_track_categories') || '[]').map(c => c.id)),
        tracks: new Set(JSON.parse(localStorage.getItem('private_map_tracks') || '[]').map(t => t.id))
      };

      const tables = ['markers', 'marker_categories', 'track_categories', 'tracks'];
      const ops = tables.map(async (table) => {
        // 清理当前用户的数据中本地不存在的（用户删了但之前没同步成功）
        const res = await _client.from(table).select('id').eq('user_id', userId);
        const staleIds = (res.data || []).filter(r => !localIds[table].has(r.id)).map(r => r.id);
        if (staleIds.length === 0) return;
        await _client.from(table).delete().in('id', staleIds);
        console.log(`[Cloud] 清理了 ${table} 中 ${staleIds.length} 条过期数据`);
      });
      await Promise.all(ops);
    } catch (e) {
      console.warn('[Cloud] 清理过期数据失败:', e);
    }
  },

  /** 认领无主数据（user_id IS NULL → 设为当前用户） */
  async _claimOrphanData(userId) {
    if (!_client) return;
    try {
      await Promise.all([
        _client.from('marker_categories').update({ user_id: userId }).is('user_id', null),
        _client.from('markers').update({ user_id: userId }).is('user_id', null),
        _client.from('track_categories').update({ user_id: userId }).is('user_id', null),
        _client.from('tracks').update({ user_id: userId }).is('user_id', null)
      ]);
    } catch (e) {
      console.warn('[Cloud] 认领旧数据失败:', e);
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
    if (!_client || !Auth.getUserId()) return;
    try {
      const categories = JSON.parse(localStorage.getItem('private_map_categories') || '[]').map(toCloudCategory);
      const markers = JSON.parse(localStorage.getItem('private_map_markers') || '[]').map(toCloudMarker);
      const trackCats = JSON.parse(localStorage.getItem('private_map_track_categories') || '[]').map(toCloudCategory);
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
    if (!_client || !Auth.getUserId()) return;
    _client.from('markers').upsert(toCloudMarker(marker), { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('[Cloud] 上传标记失败:', error);
    });
  },

  removeMarker(id) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('markers').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[Cloud] 删除标记失败:', error);
    });
  },

  // ===== 标记分类 =====

  pushCategory(category) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('marker_categories').upsert(toCloudCategory(category), { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('[Cloud] 上传分类失败:', error);
    });
  },

  removeCategory(id) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('marker_categories').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[Cloud] 删除分类失败:', error);
    });
  },

  // ===== 轨迹 =====

  pushTrack(track) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('tracks').upsert(toCloudTrack(track), { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('[Cloud] 上传轨迹失败:', error);
    });
  },

  removeTrack(id) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('tracks').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[Cloud] 删除轨迹失败:', error);
    });
  },

  // ===== 轨迹分类 =====

  pushTrackCategory(category) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('track_categories').upsert(toCloudCategory(category), { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('[Cloud] 上传轨迹分类失败:', error);
    });
  },

  removeTrackCategory(id) {
    if (!_client || !Auth.getUserId()) return;
    _client.from('track_categories').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[Cloud] 删除轨迹分类失败:', error);
    });
  },

  // ===== 实时订阅 =====

  startRealtime(callbacks) {
    if (!_client || !Auth.getUserId()) return;

    try {
      const userId = Auth.getUserId();
      const sub = (table, pullFn, cb) => {
        _client.channel(`${table}-${userId}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table,
            filter: `user_id=eq.${userId}`
          }, async () => {
            try {
              await pullFn();
              cb?.();
            } catch (e) {
              console.warn(`[Cloud] Realtime ${table} 处理失败:`, e);
            }
          })
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') return;
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[Cloud] Realtime ${table} 连接失败:`, err);
            }
          });
      };

      sub('markers', () => this._pullTable('markers', toLocalMarker, 'private_map_markers'),
        () => callbacks.onMarkersChange?.());
      sub('marker_categories', () => this._pullSimpleTable('marker_categories', 'private_map_categories'),
        () => callbacks.onCategoriesChange?.());
      sub('track_categories', () => this._pullSimpleTable('track_categories', 'private_map_track_categories'),
        () => callbacks.onTrackCategoriesChange?.());
      sub('tracks', () => this._pullTable('tracks', toLocalTrack, 'private_map_tracks'),
        () => callbacks.onTracksChange?.());
    } catch (e) {
      console.warn('[Cloud] Realtime 初始化失败（不影响基础同步）:', e);
    }
  },

  // ===== 单表拉取辅助 =====

  async _pullTable(table, toLocal, storageKey) {
    if (!_client || !Auth.getUserId()) return;
    try {
      const userId = Auth.getUserId();
      const res = await _client.from(table).select('*')
        .eq('user_id', userId);
      if (res.data) localStorage.setItem(storageKey, JSON.stringify(res.data.map(toLocal)));
    } catch (e) {
      console.warn(`[Cloud] 拉取 ${table} 失败:`, e);
    }
  },

  async _pullSimpleTable(table, storageKey) {
    if (!_client || !Auth.getUserId()) return;
    try {
      const userId = Auth.getUserId();
      const res = await _client.from(table).select('*')
        .eq('user_id', userId);
      if (res.data) localStorage.setItem(storageKey, JSON.stringify(res.data));
    } catch (e) {
      console.warn(`[Cloud] 拉取 ${table} 失败:`, e);
    }
  }
};
