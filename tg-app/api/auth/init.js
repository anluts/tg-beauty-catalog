/**
 * POST /api/auth/init
 *
 * Точка входа для авторизации через Telegram Mini App.
 * Вызывается один раз при открытии приложения.
 *
 * Body: { initData: string, master_id: string }
 *
 * Алгоритм:
 * 1. Находим мастера в БД по master_id
 * 2. Расшифровываем токен его бота
 * 3. Проверяем подпись initData через HMAC-SHA256 (стандарт Telegram)
 * 4. Определяем роль: master (если telegram_id совпадает с мастером) или client
 * 5. Выдаём JWT с ролью, master_id, telegram_id
 *
 * Все последующие запросы используют этот JWT (Bearer token).
 */

const crypto = require('crypto');
const supabase = require('../_lib/supabase');
const { decrypt } = require('../_lib/crypto');
const { sign } = require('../_lib/jwt');

// ─── CORS для разработки ────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Верификация initData по стандарту Telegram ────────────────────────────
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash) return false;

    params.delete('hash');

    // Строка для проверки: ключи отсортированы по алфавиту, разделены \n
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // secret_key = HMAC-SHA256('WebAppData', bot_token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // expected_hash = HMAC-SHA256(secret_key, check_string)
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(receivedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Обработчик ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { initData, master_id } = req.body || {};

  if (!initData || !master_id) {
    return res.status(400).json({ error: 'initData and master_id are required' });
  }

  // UUID формат — грубая проверка
  if (!/^[0-9a-f-]{36}$/.test(master_id)) {
    return res.status(400).json({ error: 'Invalid master_id format' });
  }

  // 1. Получаем мастера из БД
  const { data: master, error: dbError } = await supabase
    .from('masters')
    .select('id, telegram_id, bot_token, plan')
    .eq('id', master_id)
    .single();

  if (dbError || !master) {
    return res.status(404).json({ error: 'Master not found' });
  }

  // 2. Расшифровываем токен бота
  let botToken;
  try {
    botToken = decrypt(master.bot_token);
  } catch {
    return res.status(500).json({ error: 'Failed to decrypt bot token' });
  }

  // 3. Проверяем подпись initData
  if (!verifyInitData(initData, botToken)) {
    return res.status(401).json({ error: 'Invalid initData signature' });
  }

  // 4. Читаем данные пользователя из initData
  let user = {};
  try {
    const params = new URLSearchParams(initData);
    user = JSON.parse(params.get('user') || '{}');
  } catch {
    // user остаётся пустым
  }

  // 5. Определяем роль
  const role = String(user.id) === String(master.telegram_id) ? 'master' : 'client';

  // 6. Выдаём JWT
  const token = sign({
    telegram_id: user.id,
    role,
    master_id: master.id,
    plan: master.plan,
  });

  return res.status(200).json({
    token,
    role,
    master_id: master.id,
    plan: master.plan,
  });
};
