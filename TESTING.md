# TESTING.md — Руководство тестировщика

**Проект:** Beauty Master Platform  
**Бот мастера:** @oz_beauty_bot  
**Ссылка для клиентов:** `t.me/oz_beauty_bot?startapp=55849bef-cc4a-4c56-8528-7c56f6a50d3e`  
**Production URL:** https://beauty-catalog-azure.vercel.app  
**GitHub:** https://github.com/anluts/tg-beauty-catalog  
**master_id:** `55849bef-cc4a-4c56-8528-7c56f6a50d3e`

---

## 1. Архитектура проекта

```
tg-beauty-catalog/
├── tg-app/                        # Фронтенд (деплоится на Vercel)
│   ├── index.html                 # Точка входа
│   ├── css/styles.css             # Все стили
│   ├── js/
│   │   ├── api.js                 # API-клиент: авторизация + загрузка данных из БД
│   │   ├── data.js                # Демо-данные (fallback без API)
│   │   ├── tg.js                  # Обёртка Telegram WebApp SDK
│   │   ├── state.js               # Глобальное состояние + localStorage
│   │   ├── router.js              # SPA роутер
│   │   ├── onboarding.js          # Онбординг при первом запуске
│   │   ├── offer.js               # Оффер скидки 15%
│   │   ├── app.js                 # Инициализация + загрузка данных мастера
│   │   └── screens/               # Экраны приложения
│   └── api/                       # Vercel Serverless Functions (бэкенд)
│       ├── auth/init.js           # POST /api/auth/init — авторизация через Telegram
│       ├── master.js              # GET /api/master — профиль + услуги мастера
│       └── _lib/
│           ├── supabase.js        # Supabase клиент (service role)
│           ├── crypto.js          # AES-256-GCM шифрование токенов ботов
│           └── jwt.js             # JWT подпись и верификация
├── backend/
│   ├── bot/platform.js            # Platform Bot — регистрация новых мастеров
│   ├── ecosystem.config.js        # PM2 конфиг для Beget VPS
│   ├── install.sh                 # Скрипт автоустановки на VPS
│   ├── scripts/
│   │   ├── register-master.js     # Скрипт: зарегистрировать мастера по токену бота
│   │   └── seed-test-master.js    # Скрипт: создать тестовые данные в БД
│   ├── db/schema.sql              # SQL: 10 таблиц, индексы, триггеры
│   └── .env                       # Секретные ключи (не в git)
├── BACKEND-PLAN.md                # Архитектурный план (v3)
├── TESTING.md                     # Этот файл
└── brief.md / research.md         # ТЗ и исследование
```

**Стек:**
- Фронтенд: Vanilla JS (IIFE-модули), без фреймворков
- Бэкенд API: Vercel Serverless Functions (Node.js)
- Platform Bot: Node.js long polling, деплой на Beget VPS
- БД: Supabase (PostgreSQL + Storage)
- Авторизация: Telegram initData → HMAC-SHA256 → JWT

---

## 2. Как работает система

### Поток для клиента

```
1. Клиент получает ссылку: t.me/oz_beauty_bot?startapp=MASTER_UUID
2. Telegram открывает Mini App: https://beauty-catalog-azure.vercel.app
3. js/api.js читает MASTER_UUID из start_param
4. POST /api/auth/init {initData, master_id} → JWT токен
5. GET /api/master (Bearer JWT) → данные мастера + услуги
6. UI обновляется реальными данными из БД
```

### Поток для нового мастера (через Platform Bot)

```
1. Мастер пишет /start боту платформы
2. Отправляет токен своего бота
3. Бот проверяет токен, создаёт запись в masters, шифрует токен
4. Бот отвечает: ссылка для клиентов t.me/ЕГО_БОТ?startapp=MASTER_UUID
```

### Авторизация (технически)

- `initData` подписан ботом мастера через HMAC-SHA256 (стандарт Telegram)
- Бэкенд расшифровывает токен мастера из БД, верифицирует подпись
- Выдаёт JWT с `{ telegram_id, role, master_id, plan }`
- Роль: `master` если telegram_id совпадает с мастером, иначе `client`
- JWT TTL: 24 часа

---

## 3. Серверная инфраструктура

### Vercel (API + фронтенд)

- **URL:** https://beauty-catalog-azure.vercel.app
- **Что деплоится:** папка `tg-app/` (фронтенд + Serverless Functions)
- **Переменные окружения:** заданы в Vercel Dashboard

```bash
# Деплой (из папки tg-app/)
cd tg-app
HTTPS_PROXY=http://191.102.148.189:9842 npx vercel --prod
```

### Beget VPS (Platform Bot)

- **Сервер:** Admirable Rayne
- **IP:** 84.54.31.175
- **OS:** Ubuntu 24.04 LTS
- **Тариф:** Simple (1 ядро, 1 ГБ RAM, 10 ГБ SSD) — 11 ₽/день
- **SSH:** `ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175`
- **Файлы:** `/root/tg-beauty-catalog/backend/`
- **Логи:** `/root/logs/beauty-bot.out.log`
- **Менеджер процессов:** PM2

**Статус деплоя:** ✅ VPS настроен, код загружен, PM2 установлен  
**Ожидает:** `PLATFORM_BOT_TOKEN` — создать через @BotFather, записать в `/root/tg-beauty-catalog/backend/.env`

```bash
# Подключиться к серверу (с Mac):
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175

# Запустить бота (после заполнения .env):
cd /root/tg-beauty-catalog/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # выполнить выведенную команду для автозапуска

# Полезные PM2 команды:
pm2 status              # статус
pm2 logs beauty-bot     # логи в реальном времени
pm2 restart beauty-bot  # перезапуск
```

---

## 4. Локальный запуск (разработка)

### Запуск фронтенда

```bash
cd tg-app
python3 -m http.server 3000
```

Открыть: `http://localhost:3000`

> Без master_id — демо-данные ("Алина Петрова").  
> С master_id: `http://localhost:3000?master_id=55849bef-cc4a-4c56-8528-7c56f6a50d3e`

### Запуск Platform Bot локально

```bash
cd backend
# Заполнить backend/.env: PLATFORM_BOT_TOKEN=...
node bot/platform.js
```

---

## 5. API эндпоинты

### POST /api/auth/init

```
Body:    { initData: string, master_id: string }
200 OK:  { token, role, master_id, plan }
400:     initData или master_id не переданы
401:     невалидная подпись initData
404:     мастер не найден
```

```bash
curl -X POST https://beauty-catalog-azure.vercel.app/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{"initData":"test","master_id":"55849bef-cc4a-4c56-8528-7c56f6a50d3e"}'
# Ожидаемый ответ: {"error":"Invalid initData signature"}
```

### GET /api/master

```
Headers: Authorization: Bearer <jwt>
200 OK:  { master: {...}, services: [...] }
401:     нет токена или токен просрочен
```

---

## 6. База данных (Supabase)

**Проект:** ktmblxavaieujivguemc  
**Dashboard:** https://supabase.com/dashboard/project/ktmblxavaieujivguemc

**Зарегистрированный мастер:**
```
bot:       @oz_beauty_bot
master_id: 55849bef-cc4a-4c56-8528-7c56f6a50d3e
plan:      pro
```

---

## 7. Тест-кейсы

### TC-01 — Приложение открывается

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | Открыть `https://beauty-catalog-azure.vercel.app` | Каталог с демо-данными |
| 2 | Открыть с `?master_id=55849bef-...` | Каталог загружается, в фоне API-запрос |
| 3 | Открыть `t.me/oz_beauty_bot?startapp=55849bef-...` | Mini App, авторизация через JWT |

### TC-02 — API

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | POST /api/auth/init без тела | 400 |
| 2 | POST /api/auth/init с неверным master_id | 404 |
| 3 | POST /api/auth/init с невалидным initData | 401 |

### TC-03 — Каталог

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | Открыть приложение | Экран виден СРАЗУ (не ждёт API) |
| 2 | Фильтры по категориям | Работают |
| 3 | Нажать на услугу → «Записаться» | Wizard записи (3 шага) |

---

## 8. Известные ограничения (MVP)

| # | Ограничение |
|---|-------------|
| 1 | Записи сохраняются в localStorage, не в БД |
| 2 | Расписание и слоты — демо-генерация |
| 3 | Platform Bot не запущен (нужен PLATFORM_BOT_TOKEN) |
| 4 | Профиль мастера в БД не заполнен (имя, специализация) |
| 5 | Telegram ID мастера в БД = ID бота, а не реальный TG ID |

---

## 9. Что сделано / Что впереди

### ✅ Сделано

- [x] Фронтенд: все экраны (каталог, услуга, мастер, записи, wizard, портфолио)
- [x] База данных: 10 таблиц, индексы, триггеры, RLS, Storage
- [x] API: /api/auth/init (JWT авторизация через Telegram HMAC)
- [x] API: /api/master (профиль + услуги, защищён JWT)
- [x] Шифрование токенов ботов (AES-256-GCM)
- [x] Frontend api.js: загрузка реальных данных в фоне
- [x] @oz_beauty_bot зарегистрирован в БД
- [x] Beget VPS настроен: Ubuntu 24.04, Node.js 20, PM2, код задеплоен
- [x] SSH-доступ к VPS через ключ (`~/.ssh/id_vps_beauty`)
- [x] Platform Bot: код готов, ждёт PLATFORM_BOT_TOKEN

### ⬜ Ближайшие шаги (в порядке приоритета)

1. **Создать платформенный бот** через @BotFather → получить токен → вставить в `/root/tg-beauty-catalog/backend/.env` → запустить PM2
2. **Заполнить профиль мастера** в БД (имя, специализация, адрес, часы)
3. **Добавить реальные услуги** в БД через API
4. API: `/api/master/{id}/slots` — генерация слотов из расписания
5. API: `POST /api/bookings` — реальное бронирование в БД
6. Кабинет мастера в Mini App (управление услугами, расписанием)
