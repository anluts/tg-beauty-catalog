/**
 * Регистрирует мастера в БД с реальным токеном бота
 * Запуск: node backend/scripts/register-master.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const https = require('https');

const BOT_TOKEN = process.argv[2];
if (!BOT_TOKEN) { console.error('Usage: node register-master.js <BOT_TOKEN>'); process.exit(1); }

function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map(b => b.toString('hex')).join(':');
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf || 'null') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Проверяем токен
  const tgMe = await httpsRequest({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/getMe`,
    method: 'GET',
    headers: {}
  });

  if (!tgMe.data.ok) { console.error('❌ Токен невалиден'); process.exit(1); }
  const bot = tgMe.data.result;
  console.log(`✅ Бот: @${bot.username} (ID: ${bot.id})`);

  // 2. Шифруем токен
  const encryptedToken = encrypt(BOT_TOKEN);
  const host = process.env.SUPABASE_URL.replace('https://', '');
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=merge-duplicates',
  };

  // 3. Создаём/обновляем мастера (upsert по bot_username)
  const masterData = {
    telegram_id: bot.id, // временно используем ID бота — потом заменим на личный TG ID
    bot_token: encryptedToken,
    bot_username: bot.username,
    name: bot.first_name,  // потом мастер заполнит своё имя
    plan: 'pro',
  };

  const result = await httpsRequest({
    hostname: host,
    path: '/rest/v1/masters',
    method: 'POST',
    headers,
  }, masterData);

  if (result.status >= 400) {
    console.error('❌ Ошибка БД:', JSON.stringify(result.data));
    process.exit(1);
  }

  const master = Array.isArray(result.data) ? result.data[0] : result.data;
  console.log(`✅ Мастер в БД: ID = ${master.id}`);
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🔗 ССЫЛКА ДЛЯ КЛИЕНТОВ:');
  console.log(`   t.me/${bot.username}?startapp=${master.id}`);
  console.log('');
  console.log('🌐 ПРЯМАЯ ССЫЛКА (для теста в браузере):');
  console.log(`   https://beauty-catalog-azure.vercel.app?master_id=${master.id}`);
  console.log('');
  console.log('📋 master_id:');
  console.log(`   ${master.id}`);
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
