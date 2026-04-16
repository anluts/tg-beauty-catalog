# DEPLOYMENT.md — Инструкция по деплою

**Проект:** Beauty Master Platform  
**Уровень:** Для новичков — каждый шаг объяснён

---

## Что такое деплой и зачем он нужен

Деплой — это публикация кода в интернет, чтобы им могли пользоваться другие люди.  
Этот проект состоит из **трёх частей**, каждая деплоится отдельно:

```
┌─────────────────────────────────────────────────────────────┐
│                      Клиент открывает                       │
│              t.me/oz_beauty_bot?startapp=UUID               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ЧАСТЬ 1: Vercel (фронтенд + API)                          │
│  Сайт: beauty-catalog-azure.vercel.app                      │
│  Деплоится из папки: tg-app/                                │
│  Что делает: показывает каталог, авторизует через Telegram  │
└──────────────────────┬──────────────────────────────────────┘
                       │ запросы к БД
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ЧАСТЬ 2: Supabase (база данных)                           │
│  Адрес: ktmblxavaieujivguemc.supabase.co                    │
│  Что делает: хранит мастеров, услуги, записи клиентов       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ЧАСТЬ 3: Beget VPS (Platform Bot)                         │
│  IP сервера: 84.54.31.175                                   │
│  Что делает: бот для регистрации новых мастеров             │
└─────────────────────────────────────────────────────────────┘
```

---

## Что нужно иметь перед началом

| Сервис | Для чего | Статус |
|--------|----------|--------|
| Аккаунт на [supabase.com](https://supabase.com) | База данных | ✅ Готово |
| Аккаунт на [vercel.com](https://vercel.com) | Хостинг сайта | ✅ Готово |
| Аккаунт на [beget.com](https://beget.com) | VPS-сервер | ✅ Готово |
| Аккаунт в Telegram | Создание ботов | ✅ Готово |
| @BotFather в Telegram | Управление ботами | ✅ Готово |

---

## ЧАСТЬ 1 — Supabase (база данных)

> Supabase — это облачная база данных. Здесь хранятся все данные: мастера, услуги, записи.

### Шаг 1.1 — Создать проект в Supabase

1. Зайди на [supabase.com](https://supabase.com) → войди в аккаунт
2. Нажми **New Project**
3. Заполни:
   - **Name:** `beauty-catalog`
   - **Database Password:** придумай пароль (сохрани его!)
   - **Region:** выбери ближайший к России (например, Frankfurt)
4. Нажми **Create new project** — подождёт ~2 минуты

### Шаг 1.2 — Создать таблицы

1. В Supabase: левое меню → **SQL Editor** → **New query**
2. Открой файл [backend/db/schema.sql](backend/db/schema.sql) из этого проекта
3. Скопируй весь текст → вставь в SQL Editor → нажми **Run**
4. Должно появиться: `Success. No rows returned`

### Шаг 1.3 — Получить ключи

1. В Supabase: левое меню → **Settings** → **API**
2. Скопируй и сохрани:
   - **Project URL** — выглядит как `https://XXXXXX.supabase.co`
   - **service_role** ключ (не `anon`!) — длинная строка начинающаяся с `eyJ...`

> ⚠️ `service_role` ключ — секретный. Не публикуй его в GitHub.

---

## ЧАСТЬ 2 — Vercel (фронтенд + API)

> Vercel — это хостинг для сайтов. Здесь деплоится весь фронтенд и API-функции.

### Шаг 2.1 — Сгенерировать секретные ключи

Открой Терминал на Mac и выполни эти команды по одной:

```bash
# JWT_SECRET — ключ для подписи токенов авторизации
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY — ключ для шифрования токенов ботов
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Каждая команда выдаст длинную строку — **сохрани обе** (это твои секретные ключи).

> ⚠️ Эти ключи нельзя менять после того как в БД есть данные. Если поменяешь — зашифрованные токены не расшифруются.

### Шаг 2.2 — Задать переменные окружения в Vercel

1. Зайди на [vercel.com](https://vercel.com) → открой проект `beauty-catalog`
2. Вкладка **Settings** → **Environment Variables**
3. Добавь каждую переменную по одной (кнопка **Add**):

| Имя переменной | Значение |
|----------------|----------|
| `SUPABASE_URL` | URL из шага 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ из шага 1.3 |
| `JWT_SECRET` | ключ из шага 2.1 (первый) |
| `JWT_TTL` | `86400` |
| `ENCRYPTION_KEY` | ключ из шага 2.1 (второй) |

4. После добавления всех — нажми **Save**

### Шаг 2.3 — Задеплоить на Vercel

Открой Терминал, перейди в папку проекта:

```bash
cd /путь/до/проекта/tg-app

# Если Vercel CLI не установлен:
npm install -g vercel

# Деплой:
npx vercel --prod
```

> Если в России нужен прокси, добавь перед командой:  
> `HTTPS_PROXY=http://191.102.148.189:9842 npx vercel --prod`

После деплоя Vercel выдаст URL вида `https://beauty-catalog-azure.vercel.app` — это адрес твоего сайта.

### Шаг 2.4 — Проверить что API работает

```bash
curl https://beauty-catalog-azure.vercel.app/api/auth/init \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"initData":"test","master_id":"00000000-0000-0000-0000-000000000000"}'
```

Ожидаемый ответ: `{"error":"Master not found"}` — это нормально, значит API работает.

---

## ЧАСТЬ 3 — Beget VPS (Platform Bot)

> VPS — это виртуальный сервер в интернете. На нём круглосуточно работает Platform Bot.  
> Platform Bot — это Telegram-бот, через который мастера регистрируются в системе.

### Шаг 3.1 — Создать Platform Bot в Telegram

1. Открой Telegram → найди **@BotFather**
2. Напиши: `/newbot`
3. BotFather спросит имя — напиши: `Beauty Masters Platform`
4. BotFather спросит username — напиши: `beauty_masters_platform_bot`  
   _(если занят, попробуй `bm_masters_bot` или похожее)_
5. BotFather пришлёт токен — длинная строка вида `1234567890:AABBcc...`
6. **Сохрани этот токен** — он понадобится на следующем шаге

> ⚠️ Это ОТДЕЛЬНЫЙ бот от `@oz_beauty_bot`. Клиенты его не видят — он только для мастеров.

### Шаг 3.2 — Узнать свой Telegram ID

1. Открой Telegram → найди **@userinfobot**
2. Напиши ему что угодно
3. Он пришлёт твой ID — число вида `123456789`
4. Сохрани его — это `PLATFORM_ADMIN_ID`

### Шаг 3.3 — Подготовить VPS

> Если VPS уже настроен (Ubuntu 24.04, Node.js 20, PM2, код задеплоен) — переходи к шагу 3.4.

**3.3а — Подключиться к серверу:**

```bash
# С Mac через Терминал:
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175
```

Если подключение работает — увидишь приветствие Ubuntu.

**3.3б — Запустить установку (один раз на новом сервере):**

```bash
# На сервере (после подключения по SSH):
curl -fsSL https://raw.githubusercontent.com/anluts/tg-beauty-catalog/main/backend/install.sh | bash
```

Скрипт сам установит Node.js 20, PM2 и скачает код проекта.

### Шаг 3.4 — Создать файл с настройками на сервере

Выполни эту команду **на своём Mac** (подставь реальные значения вместо `...`):

```bash
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175 "cat > /root/tg-beauty-catalog/backend/.env" << 'EOF'
SUPABASE_URL=https://ktmblxavaieujivguemc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ВСТАВЬ_КЛЮЧ_ИЗ_VERCEL
JWT_SECRET=ВСТАВЬ_ТОТ_ЖЕ_КЛЮЧ_ЧТО_В_VERCEL
JWT_TTL=86400
ENCRYPTION_KEY=ВСТАВЬ_ТОТ_ЖЕ_КЛЮЧ_ЧТО_В_VERCEL
PLATFORM_BOT_TOKEN=ВСТАВЬ_ТОКЕН_ИЗ_ШАГА_3.1
APP_URL=https://beauty-catalog-azure.vercel.app
PLATFORM_ADMIN_ID=ВСТАВЬ_СВОЙ_TELEGRAM_ID
PLAN_PRO_PRICE_RUB=990
EOF
```

> ⚠️ `ENCRYPTION_KEY` должен быть **точно таким же**, как в Vercel. Иначе токены ботов не расшифруются.

### Шаг 3.5 — Запустить бота через PM2

```bash
# Подключиться к серверу:
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175

# Запустить бота:
cd /root/tg-beauty-catalog/backend
pm2 start ecosystem.config.js

# Сохранить чтобы бот стартовал после перезагрузки сервера:
pm2 save
pm2 startup
# Выполни команду, которую выведет pm2 startup
```

### Шаг 3.6 — Проверить что бот работает

```bash
# Статус процессов:
pm2 status

# Логи в реальном времени:
pm2 logs beauty-bot
```

Если бот запустился — в логах увидишь:
```
✅ Platform Bot запущен: @beauty_masters_platform_bot
```

Теперь открой Telegram → найди свой Platform Bot → напиши `/start` → должен ответить.

---

## Проверка — всё ли работает

| # | Что проверяем | Как проверить | Ожидаемый результат |
|---|---------------|---------------|---------------------|
| 1 | Сайт открывается | Открыть [beauty-catalog-azure.vercel.app](https://beauty-catalog-azure.vercel.app) | Каталог с демо-данными |
| 2 | API работает | `curl` из шага 2.4 | `{"error":"Master not found"}` |
| 3 | Platform Bot | Написать `/start` своему боту | Приветствие и инструкции |
| 4 | Mini App | Открыть `t.me/oz_beauty_bot?startapp=55849bef-cc4a-4c56-8528-7c56f6a50d3e` | Каталог с реальными данными |

---

## Управление сервером

```bash
# Подключиться к серверу:
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175

# Статус бота:
pm2 status

# Логи (последние 50 строк):
pm2 logs beauty-bot --lines 50

# Перезапустить бота:
pm2 restart beauty-bot

# Остановить бота:
pm2 stop beauty-bot

# Обновить код с GitHub и перезапустить:
cd /root/tg-beauty-catalog && git pull && pm2 restart beauty-bot
```

---

## Обновление кода (после изменений)

### Фронтенд (Vercel)

```bash
cd tg-app
npx vercel --prod
```

Vercel сам подхватит изменения. Деплой занимает ~1 минуту.

### Platform Bot (VPS)

```bash
# Залить изменения на GitHub:
git push origin main

# Подключиться к серверу и обновить:
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175 \
  "cd /root/tg-beauty-catalog && git pull && pm2 restart beauty-bot"
```

---

## Что делать если что-то сломалось

### Бот не отвечает

```bash
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175
pm2 logs beauty-bot --lines 100
```

Ищи строки с `❌` или `error` — там будет причина.

### Сайт не открывается

1. Проверь [vercel.com](https://vercel.com) → проект → вкладка **Deployments** — последний деплой должен быть зелёным
2. Проверь что все переменные окружения заданы (Settings → Environment Variables)

### API возвращает 500

Скорее всего проблема в переменных окружения — проверь что `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` заданы правильно.

---

## Текущий статус деплоя

| Компонент | Статус | Детали |
|-----------|--------|--------|
| Supabase (БД) | ✅ Готово | ktmblxavaieujivguemc.supabase.co |
| Vercel (сайт + API) | ✅ Готово | beauty-catalog-azure.vercel.app |
| Beget VPS (сервер) | ✅ Готово | 84.54.31.175, Ubuntu 24.04, PM2 установлен |
| Platform Bot | ⬜ Ожидает | Нужен PLATFORM_BOT_TOKEN — создать через @BotFather |
