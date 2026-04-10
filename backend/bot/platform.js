/**
 * Platform Bot — бот для регистрации мастеров
 *
 * Запуск: node backend/bot/platform.js
 *
 * Что делает:
 * 1. Мастер пишет /start → бот приветствует и просит токен бота
 * 2. Мастер отправляет токен вида 123456789:ABC...
 * 3. Бот проверяет токен через Telegram API (getMe)
 * 4. Создаёт или обновляет запись в таблице masters
 * 5. Настраивает Mini App URL для бота мастера
 * 6. Отправляет мастеру его личную ссылку для клиентов
 *
 * ENV: PLATFORM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      ENCRYPTION_KEY, APP_URL (URL задеплоенного Vercel приложения)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// ─── Проверяем обязательные переменные ─────────────────────────────────────
const REQUIRED_ENV = [
  'PLATFORM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'APP_URL', // например: https://beauty-catalog.vercel.app
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing env var: ${key}`);
    process.exit(1);
  }
}

const BOT_TOKEN = process.env.PLATFORM_BOT_TOKEN;
const APP_URL = process.env.APP_URL.replace(/\/$/, ''); // убираем trailing slash

// ─── Supabase ───────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Шифрование ─────────────────────────────────────────────────────────────
const crypto = require('crypto');

function getEncKey() {
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
}

function encrypt(text) {
  const key = getEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map(b => b.toString('hex')).join(':');
}

// ─── Telegram API helpers ────────────────────────────────────────────────────
function tgRequest(token, method, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Отправляем сообщение мастеру
function sendMessage(chatId, text, options = {}) {
  return tgRequest(BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...options,
  });
}

// Проверяем токен чужого бота через getMe
async function validateBotToken(token) {
  try {
    const result = await tgRequest(token, 'getMe', {});
    if (result.ok) return result.result; // { id, username, first_name, ... }
    return null;
  } catch {
    return null;
  }
}

// Устанавливаем кнопку "Запустить каталог" в боте мастера
async function setMenuButton(masterBotToken, appUrl) {
  return tgRequest(masterBotToken, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '💅 Открыть каталог',
      web_app: { url: appUrl },
    },
  });
}

// ─── Состояния диалога (in-memory, для MVP) ──────────────────────────────────
// { chatId: { step: 'awaiting_token' | 'registered', masterId?, name? } }
const sessions = new Map();

// ─── Обработка входящих сообщений ───────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const userId = msg.from?.id;
  const firstName = msg.from?.first_name || 'Мастер';

  console.log(`[msg] chat=${chatId} user=${userId} text="${text.slice(0, 50)}"`);

  // /start — приветствие и начало регистрации
  if (text === '/start') {
    sessions.set(chatId, { step: 'awaiting_token' });

    await sendMessage(chatId,
      `👋 Привет, ${firstName}!\n\n` +
      `Я помогу тебе создать <b>личный каталог услуг</b> в Telegram.\n\n` +
      `<b>Что нужно сделать:</b>\n` +
      `1. Создай бота через @BotFather (команда /newbot)\n` +
      `2. Скопируй токен бота (выглядит так: 123456789:ABC-def...)\n` +
      `3. Отправь мне этот токен\n\n` +
      `Пришли токен своего бота 👇`
    );
    return;
  }

  // /help — помощь
  if (text === '/help') {
    await sendMessage(chatId,
      `<b>Как пользоваться:</b>\n\n` +
      `/start — начать регистрацию\n` +
      `/mylink — получить ссылку для клиентов\n` +
      `/status — проверить статус аккаунта\n\n` +
      `По вопросам: @beauty_platform_support`
    );
    return;
  }

  // /mylink — отправить ссылку мастера
  if (text === '/mylink') {
    const { data: master } = await supabase
      .from('masters')
      .select('id, bot_username, name')
      .eq('telegram_id', userId)
      .single();

    if (!master) {
      await sendMessage(chatId,
        '❌ Ты ещё не зарегистрирован. Напиши /start чтобы начать.'
      );
    } else {
      const link = `t.me/${master.bot_username}?startapp=${master.id}`;
      await sendMessage(chatId,
        `🔗 <b>Твоя ссылка для клиентов:</b>\n\n` +
        `<code>${link}</code>\n\n` +
        `Отправь эту ссылку клиентам или добавь в описание своего профиля.`
      );
    }
    return;
  }

  // /status — проверить свой аккаунт
  if (text === '/status') {
    const { data: master } = await supabase
      .from('masters')
      .select('id, name, plan, plan_expires_at, bot_username')
      .eq('telegram_id', userId)
      .single();

    if (!master) {
      await sendMessage(chatId, '❌ Аккаунт не найден. Напиши /start');
    } else {
      const planLabel = master.plan === 'pro' ? '⭐ Pro' : '🆓 Free';
      await sendMessage(chatId,
        `<b>Твой аккаунт:</b>\n\n` +
        `👤 Имя: ${master.name || '(не заполнено)'}\n` +
        `🤖 Бот: @${master.bot_username}\n` +
        `💎 Тариф: ${planLabel}\n` +
        `🆔 ID мастера: <code>${master.id}</code>`
      );
    }
    return;
  }

  // Ждём токен бота
  const session = sessions.get(chatId);
  if (session?.step === 'awaiting_token') {
    // Проверяем формат токена: NNNNNNNNNN:AAA...
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(text)) {
      await sendMessage(chatId,
        '⚠️ Это не похоже на токен бота.\n\n' +
        'Токен выглядит так: <code>123456789:ABCdef-ghijklmnop...</code>\n\n' +
        'Скопируй токен из @BotFather и отправь мне.'
      );
      return;
    }

    await sendMessage(chatId, '⏳ Проверяю токен...');

    // Проверяем токен через Telegram API
    const botInfo = await validateBotToken(text);
    if (!botInfo) {
      await sendMessage(chatId,
        '❌ Токен недействителен. Убедись, что скопировал правильно.\n\n' +
        'Попробуй ещё раз 👇'
      );
      return;
    }

    // Шифруем токен перед сохранением
    const encryptedToken = encrypt(text);

    // Создаём или обновляем мастера в БД
    const masterData = {
      telegram_id: userId,
      bot_token: encryptedToken,
      bot_username: botInfo.username,
      name: firstName, // потом мастер заполнит профиль
    };

    const { data: master, error } = await supabase
      .from('masters')
      .upsert(masterData, { onConflict: 'telegram_id' })
      .select('id, bot_username')
      .single();

    if (error || !master) {
      console.error('[DB error]', error);
      await sendMessage(chatId, '❌ Ошибка при сохранении. Попробуй ещё раз или напиши в поддержку.');
      return;
    }

    // Ссылка для клиентов
    const clientLink = `t.me/${master.bot_username}?startapp=${master.id}`;
    // URL Mini App который откроется у клиентов
    const webAppUrl = `${APP_URL}?master_id=${master.id}`;

    // Устанавливаем кнопку "Открыть каталог" в боте мастера
    await setMenuButton(text, webAppUrl);

    sessions.set(chatId, { step: 'registered', masterId: master.id });

    await sendMessage(chatId,
      `✅ <b>Готово! Твой каталог создан.</b>\n\n` +
      `🤖 Бот: @${master.bot_username}\n\n` +
      `🔗 <b>Ссылка для клиентов:</b>\n` +
      `<code>${clientLink}</code>\n\n` +
      `Клиент нажимает на ссылку → открывается твой каталог.\n\n` +
      `<b>Следующие шаги:</b>\n` +
      `1. Заполни профиль в каталоге\n` +
      `2. Добавь свои услуги\n` +
      `3. Отправь ссылку клиентам!\n\n` +
      `Команды:\n` +
      `/mylink — получить ссылку ещё раз\n` +
      `/status — информация об аккаунте`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🌐 Открыть мой каталог', web_app: { url: webAppUrl } }
          ]]
        }
      }
    );

    console.log(`[registered] master_id=${master.id} bot=@${master.bot_username} tg=${userId}`);
    return;
  }

  // Любое другое сообщение
  await sendMessage(chatId,
    'Напиши /start чтобы начать или /help для помощи.'
  );
}

// ─── Long Polling (для запуска без сервера) ──────────────────────────────────
let offset = 0;

async function poll() {
  try {
    const response = await tgRequest(BOT_TOKEN, 'getUpdates', {
      offset,
      timeout: 30,
      allowed_updates: ['message'],
    });

    if (response.ok && response.result.length > 0) {
      for (const update of response.result) {
        offset = update.update_id + 1;
        if (update.message) {
          handleMessage(update.message).catch(err => {
            console.error('[handleMessage error]', err.message);
          });
        }
      }
    }
  } catch (err) {
    console.error('[poll error]', err.message);
    await new Promise(r => setTimeout(r, 5000)); // пауза при ошибке
  }

  setImmediate(poll); // запускаем следующий цикл
}

// ─── Запуск ─────────────────────────────────────────────────────────────────
async function main() {
  const me = await tgRequest(BOT_TOKEN, 'getMe', {});
  if (!me.ok) {
    console.error('❌ Invalid PLATFORM_BOT_TOKEN');
    process.exit(1);
  }

  console.log(`✅ Platform Bot запущен: @${me.result.username}`);
  console.log(`📦 Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`🌐 App URL: ${APP_URL}`);
  console.log('');
  console.log('Жду сообщений от мастеров...');

  poll();
}

main();
