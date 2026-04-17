/**
 * auth.js — 用户认证模块
 * Supabase Auth 邮箱+密码登录/注册/登出/会话管理
 */

let _client = null;
let _currentUser = null;

export const Auth = {
  /** 初始化：传入 supabase client，检查已有会话 */
  async init(supabaseClient) {
    _client = supabaseClient;
    if (!_client) return null;

    try {
      // 监听登录状态变化（其他标签页登出时同步）
      _client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          _currentUser = null;
          this._onAuthChange?.(null);
        } else if (event === 'SIGNED_IN' && session.user) {
          _currentUser = session.user;
          this._onAuthChange?.(session.user);
        }
      });

      const { data: { session } } = await _client.auth.getSession();
      if (session?.user) {
        _currentUser = session.user;
        return session.user;
      }

      return null;
    } catch (e) {
      console.warn('[Auth] 会话检查失败:', e);
      return null;
    }
  },

  /** 注册 */
  async signUp(email, password) {
    if (!_client) throw new Error('Auth 未初始化');
    const { data, error } = await _client.auth.signUp({ email, password });
    if (error) throw error;

    // 关闭了邮箱确认，注册即登录
    if (data.user) {
      _currentUser = data.user;
      return data.user;
    }
    return null;
  },

  /** 登录 */
  async signIn(email, password) {
    if (!_client) throw new Error('Auth 未初始化');
    const { data, error } = await _client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      _currentUser = data.user;
      return data.user;
    }
    return null;
  },

  /** 登出 */
  async signOut() {
    if (!_client) return;
    await _client.auth.signOut();
    _currentUser = null;
  },

  /** 获取当前用户 */
  getUser() {
    return _currentUser;
  },

  /** 获取当前用户 ID */
  getUserId() {
    return _currentUser?.id || null;
  },

  /** 是否已登录 */
  isLoggedIn() {
    return !!_currentUser;
  },

  /** 登录状态变化回调 */
  _onAuthChange: null,
  onAuthChange(callback) {
    this._onAuthChange = callback;
  }
};
