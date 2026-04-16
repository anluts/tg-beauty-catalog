/**
 * seed-test-master.js — заполнить тестовыми данными существующего мастера
 *
 * Запуск: node scripts/seed-test-master.js
 *
 * Что делает:
 * 1. Обновляет профиль мастера (имя, специализация, адрес и т.д.)
 * 2. Удаляет старые услуги и добавляет 5 новых тестовых
 * 3. Добавляет расписание (Пн–Пт и Сб рабочие, Вс выходной)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

// ID мастера @oz_beauty_bot, уже зарегистрированного в БД
const MASTER_ID = '55849bef-cc4a-4c56-8528-7c56f6a50d3e';

// ─── Supabase REST API ───────────────────────────────────────────────────────
function supabaseRequest(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: process.env.SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey':          process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization':   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':    'application/json',
        'Prefer':          'return=representation',
        ...extraHeaders,
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body || '[]') }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Тестовые данные ─────────────────────────────────────────────────────────

const MASTER_PROFILE = {
  name:       'Алина Петрова',
  specialty:  'Маникюр и педикюр',
  city:       'Москва',
  bio:        'Мастер ногтевого сервиса с опытом 5 лет. Работаю с безопасными материалами и гипоаллергенными покрытиями. Стерильные инструменты, уютная атмосфера 💅',
  address:    'ул. Тверская, 15, студия Nail Art, каб. 3',
  metro:      'Тверская',
  hours:      'Пн–Пт: 10:00–21:00, Сб: 10:00–20:00, Вс: выходной',
  phone:      '+7 (999) 123-45-67',
  theme:      'rose',
  app_name:   'Алина — Ногтевой сервис',
};

const SERVICES = [
  {
    name:        'Маникюр с покрытием гель-лак',
    short_desc:  'Обработка, форма, 200+ оттенков. Держится 3–4 недели',
    description: 'Включает: снятие старого покрытия, обработку кутикулы, придание формы, нанесение гель-лака. Держится 3–4 недели без сколов и потери блеска.',
    category:    'manicure',
    emoji:       '💅',
    price:       2500,
    duration:    90,
    gradient:    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    position:    1,
  },
  {
    name:        'Маникюр без покрытия',
    short_desc:  'Классический уход за ногтями без лака',
    description: 'Обработка кутикулы, придание формы, полировка. Идеально для восстановления натуральных ногтей. Держится 2–3 недели.',
    category:    'manicure',
    emoji:       '✨',
    price:       1200,
    duration:    60,
    gradient:    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    position:    2,
  },
  {
    name:        'Педикюр классический',
    short_desc:  'Полный уход за стопами и ногтями ног',
    description: 'Ванночка, обработка кожи стоп, удаление огрубевшей кожи, придание формы ногтям, покрытие на выбор. Результат держится 4–5 недель.',
    category:    'pedicure',
    emoji:       '🦶',
    price:       2000,
    duration:    75,
    gradient:    'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    position:    3,
  },
  {
    name:        'Наращивание ногтей',
    short_desc:  'Наращивание на типсах или формах, любая длина',
    description: 'Наращивание акрилом или гелем. Форма на выбор: миндаль, квадрат, стилет. Длина — любая. Включает базовый дизайн.',
    category:    'extensions',
    emoji:       '💎',
    price:       3500,
    duration:    150,
    gradient:    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    position:    4,
  },
  {
    name:        'Дизайн ногтей',
    short_desc:  'Рисунки, стразы, фольга, омбре',
    description: 'Дополнение к маникюру или педикюру: роспись, фольга, втирки, стразы, стемпинг, градиент омбре. Стоимость за весь маникюр.',
    category:    'nailart',
    emoji:       '🎨',
    price:       800,
    duration:    30,
    gradient:    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    position:    5,
  },
];

const SCHEDULE = [
  { weekday: 0, start_time: '10:00', end_time: '21:00', is_working: true,  slot_duration: 60 }, // Пн
  { weekday: 1, start_time: '10:00', end_time: '21:00', is_working: true,  slot_duration: 60 }, // Вт
  { weekday: 2, start_time: '10:00', end_time: '21:00', is_working: true,  slot_duration: 60 }, // Ср
  { weekday: 3, start_time: '10:00', end_time: '21:00', is_working: true,  slot_duration: 60 }, // Чт
  { weekday: 4, start_time: '10:00', end_time: '21:00', is_working: true,  slot_duration: 60 }, // Пт
  { weekday: 5, start_time: '10:00', end_time: '20:00', is_working: true,  slot_duration: 60 }, // Сб
  { weekday: 6, start_time: '00:00', end_time: '00:00', is_working: false, slot_duration: 60 }, // Вс — выходной
];

// ─── Запуск ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Заполняем тестовые данные...\n');
  console.log(`   master_id: ${MASTER_ID}\n`);

  // 1. Обновляем профиль
  console.log('[ 1/3 ] Обновляем профиль мастера...');
  const profileRes = await supabaseRequest(
    'PATCH',
    `masters?id=eq.${MASTER_ID}`,
    MASTER_PROFILE
  );
  if (profileRes.status >= 400) {
    console.error('❌ Ошибка обновления профиля:', JSON.stringify(profileRes.data));
    process.exit(1);
  }
  console.log(`    ✅ ${MASTER_PROFILE.name} (${MASTER_PROFILE.specialty})`);

  // 2. Удаляем старые услуги, добавляем новые
  console.log('\n[ 2/3 ] Добавляем услуги...');
  await supabaseRequest('DELETE', `services?master_id=eq.${MASTER_ID}`, null);

  const servicesRes = await supabaseRequest(
    'POST',
    'services',
    SERVICES.map(s => ({ ...s, master_id: MASTER_ID }))
  );
  if (servicesRes.status >= 400) {
    console.error('❌ Ошибка добавления услуг:', JSON.stringify(servicesRes.data));
    process.exit(1);
  }
  SERVICES.forEach(s => console.log(`    ✅ ${s.emoji} ${s.name} — ${s.price} руб.`));

  // 3. Расписание
  console.log('\n[ 3/3 ] Добавляем расписание...');
  await supabaseRequest('DELETE', `schedule?master_id=eq.${MASTER_ID}`, null);

  const schedRes = await supabaseRequest(
    'POST',
    'schedule',
    SCHEDULE.map(s => ({ ...s, master_id: MASTER_ID }))
  );
  if (schedRes.status >= 400) {
    console.error('❌ Ошибка добавления расписания:', JSON.stringify(schedRes.data));
    process.exit(1);
  }
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  SCHEDULE.forEach(s => {
    const status = s.is_working ? `${s.start_time}–${s.end_time}` : 'выходной';
    console.log(`    ✅ ${days[s.weekday]}: ${status}`);
  });

  console.log('\n✅ Готово! Тестовые данные загружены.');
  console.log('\n🔗 Открой каталог в браузере:');
  console.log(`   https://beauty-catalog-azure.vercel.app?master_id=${MASTER_ID}\n`);
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});
