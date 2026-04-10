/**
 * Скрипт для создания тестового мастера в БД
 * Запуск: node backend/scripts/seed-test-master.js
 *
 * Создаёт мастера "Алина Петрова" с несколькими услугами.
 * Используется для тестирования API без регистрации через бота.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');

// ─── Шифрование токена ───────────────────────────────────────────────────────
function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map(b => b.toString('hex')).join(':');
}

// ─── Supabase REST API запрос ────────────────────────────────────────────────
const https = require('https');

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: process.env.SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    };
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '[]') });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🌱 Создаю тестового мастера...\n');

  // ВНИМАНИЕ: для теста используем фиктивный токен.
  // В реальности токен берётся от бота мастера через @BotFather.
  // Такой мастер не пройдёт верификацию initData — только для тестирования API.
  const FAKE_BOT_TOKEN = '0000000000:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const encryptedToken = encrypt(FAKE_BOT_TOKEN);

  // Создаём мастера
  const masterResult = await supabaseRequest('POST', 'masters', {
    telegram_id: 999999999, // фиктивный ID (заменить на реальный для теста)
    bot_token: encryptedToken,
    bot_username: 'test_beauty_bot',
    name: 'Алина Петрова',
    specialty: 'Мастер маникюра и педикюра',
    city: 'Москва',
    bio: 'Делаю маникюр, который держится 3–4 недели. Работаю только с материалами X-Gen и Kodi Professional. Стерильные инструменты, уютная атмосфера.',
    address: 'ул. Ленина, 45, кв. 12',
    metro: 'м. Чистые пруды, 7 мин',
    hours: 'Пн–Сб: 10:00–21:00',
    phone: '+7 (999) 123-45-67',
    rating: 4.9,
    reviews_count: 127,
    plan: 'pro', // даём pro для теста
  });

  if (masterResult.status >= 400) {
    console.error('❌ Ошибка создания мастера:', JSON.stringify(masterResult.data, null, 2));
    process.exit(1);
  }

  const master = Array.isArray(masterResult.data) ? masterResult.data[0] : masterResult.data;
  const masterId = master.id;

  console.log(`✅ Мастер создан!`);
  console.log(`   ID: ${masterId}`);
  console.log(`   Имя: ${master.name}`);
  console.log('');

  // Создаём услуги
  const services = [
    {
      master_id: masterId,
      name: 'Маникюр классический',
      short_desc: 'Уход за ногтями и кутикулой',
      description: 'Обработка кутикулы, придание формы ногтям, покрытие на выбор. Идеально для поддержания ухоженного вида. Держится 2–3 недели.',
      category: 'manicure',
      emoji: '💅',
      price: 1800,
      duration: 60,
      gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
      position: 1,
    },
    {
      master_id: masterId,
      name: 'Маникюр + гель-лак',
      short_desc: 'Держится 3–4 недели без сколов',
      description: 'Классический маникюр с покрытием гель-лаком. 200+ оттенков. Держится 3–4 недели без сколов и потери блеска.',
      category: 'manicure',
      emoji: '✨',
      price: 2500,
      duration: 90,
      gradient: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
      position: 2,
    },
    {
      master_id: masterId,
      name: 'Педикюр классический',
      short_desc: 'Полный уход за стопами',
      description: 'Комплексный уход: обработка стоп и ногтей, удаление огрубевшей кожи, расслабляющая ванночка.',
      category: 'pedicure',
      emoji: '🦶',
      price: 2200,
      duration: 90,
      gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
      position: 3,
    },
    {
      master_id: masterId,
      name: 'Педикюр + гель-лак',
      short_desc: 'Педикюр с долгосрочным покрытием',
      description: 'Полный уход за стопами с покрытием гель-лаком. Держится 3–4 недели.',
      category: 'pedicure',
      emoji: '🌊',
      price: 3000,
      duration: 120,
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
      position: 4,
    },
    {
      master_id: masterId,
      name: 'Дизайн ногтей',
      short_desc: 'Рисунки, стразы, фольга',
      description: 'Дополнение к маникюру: рисунки, стразы, фольга, градиент омбре.',
      category: 'nailart',
      emoji: '🎨',
      price: 500,
      duration: 30,
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
      position: 5,
    },
  ];

  const servicesResult = await supabaseRequest('POST', 'services', services);

  if (servicesResult.status >= 400) {
    console.error('❌ Ошибка создания услуг:', JSON.stringify(servicesResult.data, null, 2));
    process.exit(1);
  }

  console.log(`✅ Услуги созданы: ${services.length} шт.`);
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📋 ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ:');
  console.log('═══════════════════════════════════════════');
  console.log(`   master_id = ${masterId}`);
  console.log('');
  console.log('   URL для теста в браузере:');
  console.log(`   http://localhost:3000?master_id=${masterId}`);
  console.log('');
  console.log('   Или добавь в .env:');
  console.log(`   TEST_MASTER_ID=${masterId}`);
  console.log('═══════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
