# TESTING.md — Руководство тестировщика

**Проект:** Beauty Master Platform  
**Бот мастера:** @oz_beauty_bot  
**Ссылка для клиентов:** `t.me/oz_beauty_bot?startapp=55849bef-cc4a-4c56-8528-7c56f6a50d3e`  
**Прямая ссылка (старая):** https://t.me/oz_beauty_bot/app  
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
- Бэкенд: Vercel Serverless Functions (Node.js)
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

## 3. Локальный запуск (разработка)

### Запуск фронтенда

```bash
cd tg-app
python3 -m http.server 3000
# или
npx serve -p 3000
```

Открыть: `http://localhost:3000`

> Без master_id в URL приложение работает с демо-данными из data.js (захардкоженная "Алина Петрова").  
> С master_id: `http://localhost:3000?master_id=55849bef-cc4a-4c56-8528-7c56f6a50d3e`

### Запуск Platform Bot

```bash
cd backend
npm install
# Заполнить backend/.env: PLATFORM_BOT_TOKEN=...
node bot/platform.js
```

---

## 4. API эндпоинты

### POST /api/auth/init

Авторизация при открытии Mini App. Вызывается один раз, дальше используется JWT.

```
Body:    { initData: string, master_id: string }
200 OK:  { token, role, master_id, plan }
400:     initData или master_id не переданы
401:     невалидная подпись initData
404:     мастер не найден
```

**Как проверить:**
```bash
curl -X POST https://beauty-catalog-azure.vercel.app/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{"initData":"test","master_id":"55849bef-cc4a-4c56-8528-7c56f6a50d3e"}'
# Ответ: {"error":"Invalid initData signature"} — правильно, "test" не валидная подпись
```

### GET /api/master

Возвращает профиль мастера и список услуг. Требует JWT.

```
Headers: Authorization: Bearer <jwt>
200 OK:  { master: {...}, services: [...] }
401:     нет токена или токен просрочен
404:     мастер не найден
```

---

## 5. База данных (Supabase)

**Проект:** ktmblxavaieujivguemc  
**URL:** https://ktmblxavaieujivguemc.supabase.co  
**Dashboard:** https://supabase.com/dashboard/project/ktmblxavaieujivguemc

**Таблицы (созданы в backend/db/schema.sql):**

| Таблица | Назначение |
|---------|-----------|
| `masters` | Мастера: профиль, токен бота (зашифрован), тариф |
| `services` | Услуги мастера (до 5 на free, безлимит на pro) |
| `service_photos` | Фотографии услуг → Supabase Storage |
| `portfolio_photos` | Портфолио мастера → Supabase Storage |
| `schedule` | Расписание работы по дням недели |
| `schedule_overrides` | Выходные и особые дни |
| `clients` | Клиенты мастеров (идентифицируются по telegram_id) |
| `bookings` | Записи клиентов |
| `reviews` | Отзывы к услугам |
| `subscriptions` | История платежей YooKassa |

**Storage бакеты:** `masters` (аватары), `services` (фото услуг) — оба публичные

**Зарегистрированный мастер:**
```
bot:       @oz_beauty_bot
master_id: 55849bef-cc4a-4c56-8528-7c56f6a50d3e
plan:      pro
```

---

## 6. Деплой на Vercel

```bash
# Из папки tg-app/
cd tg-app

# Если сеть блокирует Vercel — через прокси:
HTTPS_PROXY=http://191.102.148.189:9842 npx vercel --prod

# Проверить что задеплоилось:
curl -I https://beauty-catalog-azure.vercel.app/js/app.js
# Ожидаемый ответ: HTTP/2 200
```

**Переменные окружения на Vercel (уже заданы):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_TTL`
- `ENCRYPTION_KEY`

---

## 7. Тест-кейсы

### TC-01 — Приложение открывается

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | Открыть `https://beauty-catalog-azure.vercel.app` в браузере | Загружается каталог с демо-данными ("Алина Петрова") |
| 2 | Открыть `https://beauty-catalog-azure.vercel.app?master_id=55849bef-cc4a-4c56-8528-7c56f6a50d3e` | Каталог загружается, в фоне идёт запрос к API |
| 3 | Открыть `t.me/oz_beauty_bot/app` в Telegram | Mini App открывается |
| 4 | Открыть `t.me/oz_beauty_bot?startapp=55849bef-cc4a-4c56-8528-7c56f6a50d3e` | Mini App открывается, пробует авторизоваться |

### TC-02 — API авторизация

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | POST /api/auth/init без тела | 400 Bad Request |
| 2 | POST /api/auth/init с неверным master_id | 404 Not Found |
| 3 | POST /api/auth/init с невалидным initData | 401 Invalid initData signature |
| 4 | Открыть Mini App через правильную ссылку в Telegram | 200 + JWT токен |

### TC-03 — Каталог услуг

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | Открыть приложение | Экран каталога виден СРАЗУ (не ждёт API) |
| 2 | Фильтры по категориям | Маникюр / Педикюр / Дизайн / Наращивание / Брови |
| 3 | Нажать на услугу | Экран услуги с ценой, длительностью, описанием |
| 4 | Нажать «Записаться» | Wizard записи (3 шага) |

### TC-04 — Онбординг и оффер

| # | Шаг | Ожидаемый результат |
|---|-----|---------------------|
| 1 | Первое открытие (localStorage пустой) | Через 0.6 сек онбординг с приветствием |
| 2 | После онбординга | Через 0.4 сек оффер скидки 15% |
| 3 | Повторное открытие | Онбординг и оффер НЕ показываются |

**Сброс состояния:**
```js
// В консоли браузера:
localStorage.clear(); location.reload();
```

---

## 8. Известные ограничения (MVP)

| # | Ограничение | Где |
|---|-------------|-----|
| 1 | Записи сохраняются в localStorage, не в БД | wizard.js |
| 2 | Расписание и слоты — демо-генерация | data.js |
| 3 | Фото услуг — цветные заглушки (нет реальных фото) | data.js |
| 4 | Platform Bot требует отдельного запуска (node bot/platform.js) | backend/bot/ |
| 5 | Telegram ID мастера в БД = ID бота (нужно заменить на реальный) | masters.telegram_id |

---

## 9. Что сделано / Что впереди

### ✅ Сделано

- [x] Фронтенд: все экраны (каталог, услуга, мастер, записи, wizard, портфолио)
- [x] База данных: 10 таблиц, индексы, триггеры, RLS, Storage
- [x] API: /api/auth/init (JWT авторизация через Telegram HMAC)
- [x] API: /api/master (профиль + услуги, защищён JWT)
- [x] Шифрование токенов ботов (AES-256-GCM)
- [x] Frontend api.js: загрузка реальных данных в фоне, без блокировки UI
- [x] @oz_beauty_bot зарегистрирован в БД (master_id = 55849bef...)
- [x] Platform Bot: код написан, ожидает PLATFORM_BOT_TOKEN

### ⬜ Следующие шаги

- [ ] Заполнить профиль мастера (имя, специализация, адрес)
- [ ] Добавить реальные услуги в БД через API
- [ ] Запустить Platform Bot (нужен токен платформенного бота)
- [ ] API: /api/master/{id}/slots — генерация слотов из расписания
- [ ] API: POST /api/bookings — реальное бронирование в БД
- [ ] Кабинет мастера в Mini App (управление услугами, расписанием)
- [ ] Перенос на VPS (Beget) для ускорения в России
