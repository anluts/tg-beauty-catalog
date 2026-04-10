/**
 * GET /api/master?id=MASTER_UUID
 *
 * Возвращает публичный профиль мастера + его услуги.
 * Требует Bearer JWT в заголовке Authorization.
 *
 * Response: { master: {...}, services: [...] }
 */

const supabase = require('./_lib/supabase');
const { verify } = require('./_lib/jwt');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── JWT middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return null;
  }
  try {
    return verify(authHeader.slice(7));
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// ─── Обработчик ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Проверяем JWT
  const payload = requireAuth(req, res);
  if (!payload) return; // requireAuth уже отправил ответ

  const master_id = payload.master_id;

  // Получаем профиль мастера (только публичные поля, без bot_token)
  const { data: master, error: masterErr } = await supabase
    .from('masters')
    .select(
      'id, name, specialty, city, bio, address, metro, hours, phone, ' +
      'avatar_url, logo_url, rating, reviews_count, plan, ' +
      'theme, app_name, show_branding'
    )
    .eq('id', master_id)
    .single();

  if (masterErr || !master) {
    return res.status(404).json({ error: 'Master not found' });
  }

  // Получаем услуги мастера (только активные, не удалённые)
  const { data: services, error: servicesErr } = await supabase
    .from('services')
    .select(
      'id, name, short_desc, description, category, emoji, ' +
      'price, duration, gradient, position, rating, reviews_count'
    )
    .eq('master_id', master_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (servicesErr) {
    return res.status(500).json({ error: 'Failed to load services' });
  }

  return res.status(200).json({
    master,
    services: services || [],
  });
};
