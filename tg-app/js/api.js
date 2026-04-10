/**
 * api.js — клиент для работы с бэкендом
 *
 * Что делает:
 * 1. При инициализации читает master_id из Telegram startParam (или URL)
 * 2. Вызывает /api/auth/init → получает JWT токен
 * 3. Все последующие запросы идут с Bearer JWT
 * 4. Загружает данные мастера и услуги из /api/master
 * 5. Заполняет глобальные переменные MASTER и SERVICES (используются экранами)
 *
 * После успешной инициализации вызывает App.init() для запуска UI.
 */

const API = (() => {

  // ─── Внутренний стейт ─────────────────────────────────────────────────────
  let _token = null;      // JWT
  let _masterId = null;   // UUID мастера
  let _role = null;       // 'master' | 'client'

  // ─── Читаем master_id ──────────────────────────────────────────────────────
  // Приоритет: Telegram startParam → URL параметр ?master_id=...
  function getMasterId() {
    // Telegram Mini App: ссылка вида t.me/bot?startapp=MASTER_UUID
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam && /^[0-9a-f-]{36}$/.test(startParam)) {
      return startParam;
    }

    // Fallback для разработки в браузере: ?master_id=UUID или ?master_id=test
    const urlParam = new URLSearchParams(location.search).get('master_id');
    if (urlParam) return urlParam;

    return null;
  }

  // ─── URL бэкенда ───────────────────────────────────────────────────────────
  // В продакшн — тот же домен (Vercel), в dev — localhost
  function getBaseUrl() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return ''; // тот же origin (Vercel)
  }

  // ─── HTTP запросы ──────────────────────────────────────────────────────────
  async function request(path, options = {}) {
    const url = getBaseUrl() + path;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`;
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  // ─── Авторизация ───────────────────────────────────────────────────────────
  async function init() {
    _masterId = getMasterId();

    if (!_masterId) {
      // Нет master_id — показываем ошибку или демо
      console.warn('[API] No master_id found. Using demo data.');
      return false;
    }

    const initData = window.Telegram?.WebApp?.initData || '';

    // В режиме разработки (нет Telegram) — пропускаем авторизацию
    if (!initData) {
      console.warn('[API] No initData (running outside Telegram). Skipping auth.');
      return false;
    }

    try {
      const result = await request('/api/auth/init', {
        method: 'POST',
        body: JSON.stringify({ initData, master_id: _masterId }),
      });

      _token = result.token;
      _role = result.role;

      console.log(`[API] Auth OK. Role: ${_role}, master_id: ${_masterId}`);
      return true;
    } catch (err) {
      console.error('[API] Auth failed:', err.message);
      return false;
    }
  }

  // ─── Загрузка данных мастера ───────────────────────────────────────────────
  async function loadMasterData() {
    if (!_token) return null;

    try {
      const data = await request('/api/master');
      return data; // { master: {...}, services: [...] }
    } catch (err) {
      console.error('[API] Failed to load master data:', err.message);
      return null;
    }
  }

  // ─── Геттеры ───────────────────────────────────────────────────────────────
  function getToken()    { return _token; }
  function getMasterIdCached() { return _masterId; }
  function getRole()     { return _role; }
  function isMaster()    { return _role === 'master'; }
  function isAuthenticated() { return !!_token; }

  // ─── Публичный API ─────────────────────────────────────────────────────────
  return {
    init,
    loadMasterData,
    getToken,
    getMasterId: getMasterIdCached,
    getRole,
    isMaster,
    isAuthenticated,
  };
})();
