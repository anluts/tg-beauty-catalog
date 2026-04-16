# BACKEND-PLAN.md

> Архитектурный план бэкенда для Beauty Master Platform  
> Стек: Supabase (PostgreSQL + Storage) + Vercel Serverless Functions + YooKassa + Telegram Bot API  
> Составлен на основе: research.md, brief.md, текущего кода проекта  
> **v2** — исправлены: race condition бронирования, multi-tenant routing, auth flow, webhook security, weekday bug  
> **v3** — зафиксированы решения: хостинг, admin-панель, уведомления

---

## 1. Концепция системы

Платформа — это SaaS-конструктор для мастеров красоты. Один мастер = один экземпляр Mini App, который работает под его Telegram-ботом. Клиенты мастера видят только его данные.

```
┌──────────────────────────────────────────────────────────────┐
│                        ПЛАТФОРМА                             │
│                                                              │
│  Мастер А (@bot_a)   Мастер Б (@bot_b)   Мастер В (@bot_c)  │
│  t.me/bot_a?startapp=MASTER_ID_A  ...                        │
│  5 услуг (free)      безлимит (pro)       безлимит (pro)     │
└───────────────────────────┬──────────────────────────────────┘
                            │ один общий деплой
          ┌─────────────────▼─────────────────┐
          │       beauty-catalog.vercel.app    │
          │       Vercel API Routes /api/*     │
          │   (читает master_id из startParam) │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │           Supabase DB              │
          │       + Storage (S3)              │
          │   RLS изолирует данных мастеров   │
          └───────────────────────────────────┘
```

**Важно: один Vercel-проект для всей платформы.** Каждый мастер получает ссылку вида `t.me/его_бот?startapp=MASTER_UUID`. Фронтенд читает `startParam` при открытии и делает все API-запросы с этим `master_id`. Отдельные деплои на мастера — операционный кошмар (100 мастеров = 100 проектов на Vercel).

---

## 2. Роли и права доступа

| Роль | Кто | Что может |
|------|-----|-----------|
| **master** | Мастер красоты | Управлять своим профилем, услугами, расписанием, видеть записи своих клиентов |
| **client** | Клиент мастера | Просматривать каталог, записываться, смотреть свои записи |
| **platform_admin** | Ты (Александр) | Видеть всех мастеров, управлять тарифами, выплатами |

**Идентификация через Telegram + JWT:**
- При открытии Mini App → `POST /api/auth/init` с `initData` из `Telegram.WebApp.initData`
- Бэкенд проверяет `initData` через HMAC-SHA256 **один раз** и выдаёт JWT (TTL 24ч)
- Все последующие запросы идут с заголовком `Authorization: Bearer <jwt>` — initData больше не нужен
- JWT содержит `{ telegram_id, role: 'master'|'client', master_id }` в payload
- При 401 — фронтенд повторяет `/api/auth/init` и получает свежий токен

---

## 3. Схема базы данных (Supabase / PostgreSQL)

### 3.1 Таблица `masters`

Один мастер = одна строка. Создаётся при первом запуске бота.

```sql
CREATE TABLE masters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   BIGINT UNIQUE NOT NULL,    -- tg user id мастера
  bot_token     TEXT UNIQUE NOT NULL,      -- токен бота мастера (зашифрован)
  bot_username  TEXT,                       -- @username бота
  
  -- Профиль
  name          TEXT NOT NULL,             -- имя мастера
  specialty     TEXT,                      -- специализация
  city          TEXT,
  bio           TEXT,
  address       TEXT,
  metro         TEXT,
  hours         TEXT,                      -- "Пн–Сб: 10:00–21:00"
  phone         TEXT,
  
  -- Медиа
  avatar_url    TEXT,                      -- URL из Supabase Storage
  logo_url      TEXT,
  
  -- White Label (только на pro)
  theme         TEXT DEFAULT 'default',    -- 'rose', 'lavender', 'gold', 'dark', 'ocean'
  app_name      TEXT,                      -- название в шапке
  show_branding BOOLEAN DEFAULT true,      -- "Powered by Beauty Master"
  
  -- Тариф
  plan          TEXT DEFAULT 'free',       -- 'free' | 'pro'
  plan_expires_at TIMESTAMPTZ,
  
  -- Статистика
  total_bookings INT DEFAULT 0,
  rating        DECIMAL(2,1) DEFAULT 0,
  reviews_count INT DEFAULT 0,
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Таблица `services`

Услуги мастера. Бесплатный план — максимум 5 строк на мастера.

```sql
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID REFERENCES masters(id) ON DELETE CASCADE,
  
  -- Контент
  name          TEXT NOT NULL,
  short_desc    TEXT,
  description   TEXT,
  category      TEXT NOT NULL,   -- 'manicure' | 'pedicure' | 'nailart' | 'extensions' | 'brows'
  emoji         TEXT DEFAULT '💅',
  
  -- Цена и время
  price         INTEGER NOT NULL,           -- в рублях
  duration      INTEGER NOT NULL,           -- в минутах
  
  -- Визуал
  gradient      TEXT,                       -- CSS gradient как fallback
  position      INTEGER DEFAULT 0,          -- порядок в каталоге
  is_active     BOOLEAN DEFAULT true,
  
  -- Статистика
  rating        DECIMAL(2,1) DEFAULT 0,
  reviews_count INT DEFAULT 0,
  
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Ограничение: не более 5 услуг на free-плане (проверяется в API)
```

### 3.3 Таблица `service_photos`

Фотографии услуг. Хранятся в Supabase Storage.

```sql
CREATE TABLE service_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  master_id   UUID REFERENCES masters(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,              -- URL из Supabase Storage
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 Таблица `portfolio_photos`

Общее портфолио мастера (не привязано к конкретной услуге).

```sql
CREATE TABLE portfolio_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID REFERENCES masters(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Таблица `schedule`

Рабочие дни и часы мастера. Мастер настраивает в приложении.

```sql
CREATE TABLE schedule (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID REFERENCES masters(id) ON DELETE CASCADE,
  
  -- Регулярное расписание
  weekday     SMALLINT NOT NULL,    -- 0=Пн, 1=Вт, ..., 6=Вс
  start_time  TIME NOT NULL,        -- начало рабочего дня
  end_time    TIME NOT NULL,        -- конец
  is_working  BOOLEAN DEFAULT true,
  slot_duration INTEGER DEFAULT 60, -- длительность слота в минутах
  
  UNIQUE(master_id, weekday)
);
```

### 3.6 Таблица `schedule_overrides`

Исключения из расписания: выходные, отпуск, дополнительные дни.

```sql
CREATE TABLE schedule_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID REFERENCES masters(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_working  BOOLEAN NOT NULL,     -- false = выходной, true = рабочий
  start_time  TIME,
  end_time    TIME,
  note        TEXT,                 -- "Отпуск", "Больничный"
  
  UNIQUE(master_id, date)
);
```

### 3.7 Таблица `clients`

Клиенты, которые записывались к мастерам. Создаются автоматически.

```sql
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   BIGINT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  username      TEXT,
  phone         TEXT,
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(telegram_id)
);
```

### 3.8 Таблица `bookings`

Записи клиентов к мастерам. Ключевая таблица.

```sql
CREATE TABLE bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID REFERENCES masters(id),
  client_id     UUID REFERENCES clients(id),
  service_id    UUID REFERENCES services(id),
  
  -- Данные записи
  service_name  TEXT NOT NULL,       -- snapshot на момент записи
  price         INTEGER NOT NULL,    -- snapshot
  date          DATE NOT NULL,
  time_start    TIME NOT NULL,
  time_end      TIME NOT NULL,       -- вычисляется: time_start + service.duration
  
  -- Контакты клиента (введены в wizard)
  client_name   TEXT NOT NULL,
  client_phone  TEXT,
  comment       TEXT,
  
  -- Статус
  status        TEXT DEFAULT 'pending',
  -- 'pending'    — ожидает подтверждения мастера
  -- 'confirmed'  — подтверждена
  -- 'completed'  — выполнена
  -- 'cancelled'  — отменена клиентом
  -- 'rejected'   — отклонена мастером
  
  cancelled_by  TEXT,               -- 'client' | 'master'
  cancel_reason TEXT,
  
  -- Soft delete: запись не удаляется физически, только помечается
  deleted_at    TIMESTAMPTZ,
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  -- КРИТИЧНО: защита от двойного бронирования на уровне БД
  -- Уникальность: один мастер не может иметь два confirmed-бронирования на одно время
  CONSTRAINT unique_master_slot UNIQUE (master_id, date, time_start)
);

CREATE INDEX idx_bookings_master_date ON bookings(master_id, date);
CREATE INDEX idx_bookings_client ON bookings(client_id);
-- Частичный индекс: ищем только активные записи (не отменённые/не завершённые)
CREATE INDEX idx_bookings_active ON bookings(master_id, date, time_start)
  WHERE status NOT IN ('cancelled', 'rejected') AND deleted_at IS NULL;
```

### 3.9 Таблица `reviews`

Отзывы клиентов после завершённых записей.

```sql
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID REFERENCES bookings(id),
  master_id   UUID REFERENCES masters(id),
  client_id   UUID REFERENCES clients(id),
  
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT,
  photo_url   TEXT,                  -- фото-отзыв (ключевое отличие от конкурентов)
  
  is_visible  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 3.10 Таблица `subscriptions`

История платежей и подписок мастеров.

```sql
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       UUID REFERENCES masters(id),
  
  plan            TEXT NOT NULL,       -- 'pro'
  amount          INTEGER NOT NULL,    -- в копейках
  currency        TEXT DEFAULT 'RUB',
  
  -- YooKassa
  yookassa_payment_id TEXT,
  yookassa_status     TEXT,           -- 'pending' | 'succeeded' | 'canceled'
  
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Supabase Storage (файлы)

Структура бакетов:

```
beauty-master/
├── masters/
│   └── {master_id}/
│       ├── avatar.jpg
│       ├── logo.jpg
│       └── portfolio/
│           ├── {photo_id}.jpg
│           └── ...
└── services/
    └── {service_id}/
        ├── {photo_id}.jpg
        └── ...
```

**Правила доступа:**
- Чтение: публичное (фото видны всем клиентам)
- Запись: только мастер через authenticated API (проверяем master_id)

---

## 5. API Routes (Vercel Serverless Functions)

Все маршруты в `tg-app/api/` или отдельном `backend/api/`.  
Каждый запрос проверяет `initData` подписью HMAC-SHA256.

### 5.1 Аутентификация

```
POST /api/auth/init
```
Вызывается **один раз** при открытии Mini App. Передаёт `initData` из `Telegram.WebApp.initData`.

Тело запроса:
```json
{
  "initData": "query_id=...&user=...&hash=...",
  "master_id": "uuid-мастера-из-startParam"
}
```

Логика на бэкенде:
1. Найти мастера по `master_id` → получить его `bot_token` (расшифровать из БД)
2. Проверить подпись `initData` через HMAC-SHA256 с этим `bot_token`
3. Если мастер пишет к своему же боту (`telegram_id` совпадает с `masters.telegram_id`) → роль `master`
4. Иначе → роль `client`, создать/обновить запись в `clients`
5. Вернуть JWT с TTL 24ч

**Ответ:**
```json
{
  "token": "eyJhbGci...",
  "role": "client",
  "master": { "id": "...", "name": "...", "theme": "rose", "app_name": "..." },
  "client": { "id": "...", "first_name": "Алёна" }
}
```

> Все последующие запросы: `Authorization: Bearer <token>`. initData больше **не нужен**.

```
POST /api/auth/master-setup
```
Первичная настройка мастера. Вызывается **ботом платформы** (не Mini App) при `/start`.  
Тело: `{ bot_token, telegram_id, first_name }`.  
Создаёт запись в `masters`, возвращает `master_id`.  
После этого бот платформы отправляет мастеру его персональную ссылку:  
`t.me/его_бот?startapp=MASTER_UUID`.

### 5.2 Публичные данные (видят клиенты)

```
GET /api/master/{master_id}/profile
```
Профиль мастера: имя, фото, bio, адрес, тема, рейтинг.

```
GET /api/master/{master_id}/services
```
Список активных услуг с фото.

```
GET /api/master/{master_id}/portfolio
```
Портфолио фото.

```
GET /api/master/{master_id}/reviews
```
Отзывы с рейтингом и фото.

```
GET /api/master/{master_id}/slots?date=2026-04-15&service_id=xxx
```
Доступные слоты на дату с учётом расписания и существующих записей.

### 5.3 Записи (клиент)

```
POST /api/bookings
```
Создать запись.  
Тело: `{ master_id, service_id, date, time_start, client_name, client_phone, comment }`.  
После создания: Telegram-уведомление мастеру.

```
GET /api/bookings/my
```
Мои записи (предстоящие + прошедшие). Идентификация по `telegram_id` из initData.

```
PATCH /api/bookings/{id}/cancel
```
Отмена записи клиентом. Доступна до 24ч до визита.

```
POST /api/bookings/{id}/review
```
Оставить отзыв. Доступно только по завершённым записям (`status = 'completed'`).

### 5.4 Управление (только мастер)

```
GET /api/master/me
```
Полный профиль текущего мастера.

```
PATCH /api/master/me
```
Обновить профиль: имя, bio, адрес, часы.

```
POST /api/master/me/avatar
PATCH /api/master/me/theme
```
Загрузка аватара, выбор темы (только pro).

```
GET /api/master/me/services
POST /api/master/me/services
PATCH /api/master/me/services/{id}
DELETE /api/master/me/services/{id}
```
CRUD услуг. `POST` проверяет лимит (5 на free).

```
POST /api/master/me/services/{id}/photos
DELETE /api/master/me/services/{id}/photos/{photo_id}
```
Фото услуг. Загружает в Supabase Storage.

```
GET /api/master/me/schedule
PUT /api/master/me/schedule
```
Расписание по дням недели.

```
POST /api/master/me/schedule/override
DELETE /api/master/me/schedule/override/{date}
```
Исключения: выходной день, отпуск.

```
GET /api/master/me/bookings
PATCH /api/master/me/bookings/{id}/confirm
PATCH /api/master/me/bookings/{id}/reject
PATCH /api/master/me/bookings/{id}/complete
```
Управление записями клиентов.

### 5.5 Оплата подписки (YooKassa)

```
POST /api/subscription/create-payment
```
Создаёт платёж в YooKassa. Тело: `{ plan: 'pro', months: 1 }`.  
Ответ: `{ payment_url }` — редиректим мастера.

```
POST /api/subscription/webhook
```
Webhook от YooKassa. При `succeeded` — обновляет `masters.plan = 'pro'` и `plan_expires_at`.

### 5.6 Telegram Bot Webhook

```
POST /api/telegram/webhook
```
Обрабатывает все апдейты от Telegram-бота мастера.

**Безопасность: bot_token НЕ идёт в URL** (он попадает в логи Vercel/CDN).  
Вместо этого используем механизм Telegram `secret_token`:

```javascript
// При регистрации webhook для каждого бота мастера:
await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://beauty-catalog.vercel.app/api/telegram/webhook',
    secret_token: crypto.randomBytes(32).toString('hex'),  // сохраняем в masters.webhook_secret
  })
});

// В /api/telegram/webhook:
const secret = req.headers['x-telegram-bot-api-secret-token'];
const master = await db.masters.findOne({ webhook_secret: secret });
if (!master) return res.status(403).end();
// Дальше обрабатываем update от имени этого мастера
```

Добавить в таблицу `masters`:
```sql
webhook_secret TEXT UNIQUE,  -- случайный 32-байтный hex, устанавливается при регистрации бота
```

---

## 6. Telegram Bot — логика команд

Бот каждого мастера обрабатывается одним webhook-роутом, но с разными `bot_token`.

### 6.1 Команды для клиентов

| Команда | Что делает |
|---------|------------|
| `/start` | Отправляет кнопку «Открыть приложение» (InlineKeyboardButton с Mini App URL) |
| `/help` | Описание: как записаться, как отменить |
| `/bookings` | Список активных записей клиента |

### 6.2 Команды для мастера

Мастер пишет своему же боту. Система определяет его по `telegram_id`.

| Команда | Что делает |
|---------|------------|
| `/setup` | Онбординг: пошаговое заполнение профиля через бота |
| `/bookings` | Список записей на сегодня и завтра |
| `/schedule` | Показать текущее расписание |
| `/vacation {date_from} {date_to}` | Закрыть дни как выходные |
| `/plan` | Текущий тариф + ссылка на оплату pro |

### 6.3 Уведомления мастеру (автоматические)

| Событие | Сообщение боту |
|---------|---------------|
| Новая запись | «📅 Новая запись! [Имя], [услуга], [дата] [время]. [Подтвердить] [Отклонить]» |
| Отмена клиентом | «❌ [Имя] отменил(а) запись на [дата] [время]» |
| Напоминание за 24ч | «⏰ Завтра в [время] — [Имя] на [услугу]» |

### 6.4 Уведомления клиенту (автоматические)

| Событие | Сообщение боту |
|---------|---------------|
| Запись создана | «✅ Запись принята! Мастер подтвердит в ближайшее время» |
| Мастер подтвердил | «🟢 Запись подтверждена. [Дата] в [время]. Адрес: [адрес]» |
| Напоминание за 24ч | «⏰ Напоминаем: завтра в [время] у мастера [имя]. [Перенести] [Отменить]» |
| Запись завершена | «💖 Как всё прошло? Оставьте отзыв — это важно для мастера» |

---

## 7. Тарифы

### Free
- До 5 услуг
- До 3 фото на услугу
- Базовая тема (default)
- Брендинг «Powered by Beauty Master» виден
- Уведомления в бот: ✅
- Онлайн-расписание: ✅

### Pro (подписка, ежемесячно)
- Безлимитные услуги
- Безлимитные фото
- Выбор темы: Роза, Лаванда, Золото, Тёмная, Океан
- Свой логотип и название в шапке
- Убрать «Powered by Beauty Master»
- Аналитика записей (сколько за месяц, выручка)
- Приоритетная поддержка

**Цена:** устанавливается через `PLAN_PRO_PRICE_RUB` в env. Предлагаемая цена: 990 ₽/месяц.

### Проверка лимита услуг (в API)

```javascript
// /api/master/me/services POST
const serviceCount = await supabase
  .from('services')
  .select('id', { count: 'exact' })
  .eq('master_id', master.id)
  .eq('is_active', true);

if (master.plan === 'free' && serviceCount.count >= 5) {
  return res.status(403).json({
    error: 'FREE_LIMIT',
    message: 'На бесплатном плане доступно до 5 услуг. Перейдите на Pro.',
    upgrade_url: `https://t.me/${master.bot_username}?start=upgrade`
  });
}
```

---

## 8. Онбординг мастера (первый запуск)

Когда мастер впервые запускает своего бота — начинается пошаговый онбординг через Telegram:

```
Шаг 1: Бот просит ввести имя мастера
Шаг 2: Специализация (кнопки: Маникюр / Брови / Ресницы / Другое)
Шаг 3: Город
Шаг 4: Адрес
Шаг 5: Часы работы (кнопки выбора)
Шаг 6: Загрузить фото профиля (или пропустить)
Шаг 7: «Готово! Открыть приложение →» (кнопка открывает Mini App)
```

В Mini App мастер сразу видит свой профиль и может добавлять услуги.

---

## 9. Как мастер управляет приложением

Управление происходит прямо в Mini App — отдельный режим «Кабинет мастера».

При входе система определяет: если `telegram_id` совпадает с `masters.telegram_id` — показывается панель управления.

### Экраны кабинета мастера (новые экраны в Mini App)

| Экран | Что там |
|-------|---------|
| **Дашборд** | Записи сегодня/завтра, выручка за месяц |
| **Управление услугами** | Список услуг + кнопка добавить + редактировать каждую |
| **Добавить/редактировать услугу** | Форма: название, цена, длительность, категория, описание, фото |
| **Расписание** | Недельный вид, настройка часов, добавить выходной |
| **Записи** | Все входящие записи, кнопки «Подтвердить»/«Отклонить» |
| **Настройки профиля** | Фото, bio, адрес |
| **Тариф и оплата** | Текущий план, кнопка «Перейти на Pro», выбор темы |

---

## 10. Генерация слотов (логика)

```javascript
// ИСПРАВЛЕНО: функция async, weekday конвертирован правильно
async function generateAvailableSlots(date, masterId, serviceDuration) {
  // 1. Получить weekday в формате БД (0=Пн ... 6=Вс)
  // JS getDay() возвращает 0=Вс, 1=Пн ... 6=Сб — нужна конвертация!
  const jsDay = new Date(date).getDay();          // 0=Вс
  const weekday = jsDay === 0 ? 6 : jsDay - 1;   // 0=Пн, 6=Вс — как в таблице schedule

  // 2. Получить расписание на этот день
  const daySchedule = await getSchedule(masterId, weekday);
  if (!daySchedule || !daySchedule.is_working) return [];

  // 3. Проверить override (отпуск, выходной)
  const override = await getOverride(masterId, date);
  if (override && !override.is_working) return [];

  // 4. Сгенерировать все слоты от start_time до end_time
  const startTime = override?.start_time || daySchedule.start_time;
  const endTime   = override?.end_time   || daySchedule.end_time;
  const slots = generateTimeSlots(startTime, endTime, serviceDuration);

  // 5. Убрать занятые (статусы pending/confirmed занимают время)
  const existingBookings = await getBookings(masterId, date, ['pending', 'confirmed']);
  return slots.map(slot => ({
    time: slot,
    available: !existingBookings.some(b =>
      timeOverlaps(slot, serviceDuration, b.time_start, b.time_end)
    )
  }));
}

// Вспомогательная: генерирует массив времён ["10:00", "11:30", ...]
function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  let [h, m] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const endTotal = endH * 60 + endM;

  while (h * 60 + m + durationMinutes <= endTotal) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += durationMinutes;
    h += Math.floor(m / 60);
    m = m % 60;
  }
  return slots;
}

// Вспомогательная: проверяет пересечение двух временных отрезков
function timeOverlaps(slotStart, slotDuration, bookStart, bookEnd) {
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const sS = toMin(slotStart);
  const sE = sS + slotDuration;
  const bS = toMin(bookStart);
  const bE = toMin(bookEnd);
  return sS < bE && sE > bS;  // стандартная проверка пересечения отрезков
}
```

---

## 11. Безопасность

### 11.1 Проверка initData (только в /api/auth/init)

```javascript
function verifyTelegramInitData(initData, botToken) {
  const data = new URLSearchParams(initData);
  const hash = data.get('hash');
  data.delete('hash');

  const dataCheckString = [...data.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(botToken).digest();

  const expectedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString).digest('hex');

  // Дополнительно: проверяем что auth_date не старше 24ч
  const authDate = parseInt(data.get('auth_date'));
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > 86400) return false; // просрочено

  return hash === expectedHash;
}
```

### 11.2 JWT middleware (для всех остальных роутов)

```javascript
// middleware/auth.js
import jwt from 'jsonwebtoken';

export function requireAuth(handler) {
  return async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      req.user = payload; // { telegram_id, role, master_id, client_id }
      return handler(req, res);
    } catch {
      return res.status(401).json({ error: 'TOKEN_EXPIRED' });
    }
  };
}

// Пример использования в роуте:
export default requireAuth(async (req, res) => {
  const { master_id } = req.user;
  // ...
});
```

Добавить в `.env`:
```env
JWT_SECRET=   # случайная строка ≥ 64 символа
JWT_TTL=86400 # 24 часа в секундах
```

### 11.3 Защита от двойного бронирования (concurrency)

Ключевая проблема: два клиента одновременно выбирают один слот.  
Решение — два уровня защиты:

**Уровень 1 (БД):** UNIQUE constraint `(master_id, date, time_start)` в таблице `bookings`.

**Уровень 2 (API):** При создании записи — `INSERT ... ON CONFLICT DO NOTHING` + проверка результата:

```javascript
// POST /api/bookings
const { data, error } = await supabase
  .from('bookings')
  .insert({
    master_id, client_id, service_id,
    date, time_start, time_end,
    service_name, price,
    client_name, client_phone, comment,
    status: 'pending',
  })
  .select()
  .single();

// Если вставка не прошла из-за конфликта (другой клиент занял слот):
if (!data) {
  return res.status(409).json({
    error: 'SLOT_TAKEN',
    message: 'Этот слот только что заняли. Выберите другое время.',
  });
}
// Иначе — бронирование создано, уведомляем мастера
```

**Уровень 3 (UX):** Фронтенд при получении 409 автоматически обновляет слоты (`GET /api/master/{id}/slots`) и показывает сообщение.

### 11.4 Правила Row Level Security (Supabase RLS)

> RLS в Supabase работает на уровне PostgreSQL. API использует `SUPABASE_SERVICE_ROLE_KEY` (обходит RLS), поэтому сама изоляция данных реализована в логике API-роутов, а не в RLS-политиках. RLS — дополнительный слой защиты на случай прямого доступа к БД.

- Мастер видит только свои `services`, `bookings`, `clients` через `master_id`
- Клиент видит только свои `bookings` через `client_id`
- `service_photos`, `portfolio_photos` — публичное чтение (SELECT), запись только через API с проверкой `master_id`
- `bot_token` и `webhook_secret` — никогда не отдаются клиенту (SELECT policy исключает эти колонки)
- Токены ботов хранятся зашифрованными (AES-256-GCM), ключ в `ENCRYPTION_KEY` env

```javascript
// Шифрование bot_token перед сохранением в БД:
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 байта

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(b => b.toString('hex')).join(':');
}

function decrypt(stored) {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}
```

---

## 12. Переменные окружения

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # только на бэкенде, никогда в клиент

# JWT
JWT_SECRET=                   # случайная строка ≥ 64 символа (openssl rand -hex 64)
JWT_TTL=86400                 # TTL токена в секундах (24ч)

# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Шифрование токенов ботов в БД (AES-256-GCM)
ENCRYPTION_KEY=               # 32-байтный hex (openssl rand -hex 32)

# Платформа
PLATFORM_BOT_TOKEN=           # Telegram бот самой платформы (для онбординга мастеров)
PLAN_PRO_PRICE_RUB=990

# Vercel (для локальной разработки через proxy)
# HTTPS_PROXY=http://191.102.148.189:9842
```

---

## 13. Порядок разработки (этапы)

### Этап 0 — Multi-tenant routing ✅ ВЫПОЛНЕНО

Фронтенд должен знать с каким мастером работает. Это решается один раз и не меняется.

**Как фронтенд получает master_id:**
```javascript
// tg-app/js/app.js — самый первый код при инициализации
function getMasterId() {
  // 1. Telegram передаёт startParam при открытии t.me/bot?startapp=MASTER_UUID
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam && startParam.match(/^[0-9a-f-]{36}$/)) return startParam;

  // 2. Fallback для локальной разработки: URL параметр ?master=UUID
  const urlParam = new URLSearchParams(location.search).get('master');
  if (urlParam) return urlParam;

  // 3. Если нет master_id — показываем заглушку «Откройте приложение через бот»
  return null;
}

const MASTER_ID = getMasterId();
if (!MASTER_ID) {
  document.getElementById('app-shell').innerHTML =
    '<div style="padding:24px;text-align:center">Откройте приложение через бота мастера</div>';
} else {
  init(); // запускаем приложение
}
```

**Как мастер получает свою ссылку:**  
При регистрации через бот платформы → бот отвечает:
```
✅ Ваше приложение готово!
Ссылка для клиентов: t.me/ваш_бот?startapp=550e8400-e29b-41d4-a716-446655440000
```

### Этап 1 — Фундамент ✅ ЧАСТИЧНО ВЫПОЛНЕНО

1. ✅ Supabase: 10 таблиц, индексы, триггеры, RLS, Storage (masters + services)
2. ✅ `POST /api/auth/init` — HMAC-SHA256 проверка initData, роль, JWT (tg-app/api/auth/init.js)
3. ✅ Middleware `requireAuth` — проверка JWT внутри каждого роута (tg-app/api/_lib/jwt.js)
4. ✅ Регистрация мастера: скрипт register-master.js + Platform Bot (backend/bot/platform.js)
5. ✅ `GET /api/master` — профиль + услуги мастера по JWT (tg-app/api/master.js)
6. ✅ Шифрование bot_token в БД: AES-256-GCM (tg-app/api/_lib/crypto.js)
7. ✅ Beget VPS настроен: Ubuntu 24.04, Node.js 20, PM2, код задеплоен (`/root/tg-beauty-catalog/backend/`)
8. ⬜ Platform Bot запущен в PM2 (ожидает PLATFORM_BOT_TOKEN — создать через @BotFather)
9. ⬜ Webhook каждого бота мастера: X-Telegram-Bot-Api-Secret-Token

**Beget VPS:**
- IP: 84.54.31.175 (публичный, можно отключить после настройки)
- SSH: `ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175`
- Код: `/root/tg-beauty-catalog/backend/`
- Логи: `/root/logs/beauty-bot.out.log`

**Зарегистрированный мастер:**
- bot: @oz_beauty_bot (token: 7326226014:AAFx...)
- master_id: `55849bef-cc4a-4c56-8528-7c56f6a50d3e`
- plan: pro

### Этап 2 — Записи ⬜ НЕ НАЧАТО

9. `GET /api/master/{id}/slots?date=&service_id=` — генерация слотов (исправленный weekday)
10. `POST /api/bookings` — создать запись + `ON CONFLICT DO NOTHING` + уведомить мастера
11. `GET /api/bookings/my` — список записей клиента (по `client_id` из JWT)
12. `PATCH /api/bookings/{id}/cancel` — отмена (проверяем что `>24ч` до записи)
13. Фронтенд: обработка `409 SLOT_TAKEN` → автообновление слотов + сообщение пользователю

### Этап 3 — Кабинет мастера в Mini App ⬜ НЕ НАЧАТО

14. Фронтенд: роутинг по роли — если `role === 'master'` в JWT → показываем кабинет
15. Новые экраны: дашборд (записи сегодня/завтра), управление услугами, расписание, записи
16. `POST /api/master/me/services` + проверка лимита (5 на free)
17. `POST /api/master/me/services/{id}/photos` — загрузка в Supabase Storage
18. `PUT /api/master/me/schedule` — расписание по дням
19. `POST /api/master/me/schedule/override` — выходные/отпуск
20. `PATCH /api/master/me/bookings/{id}/confirm|reject|complete`
21. Telegram inline кнопки подтверждения (нажал «Подтвердить» в боте → меняет статус в БД)

### Этап 4 — Монетизация ⬜ НЕ НАЧАТО

22. `POST /api/subscription/create-payment` (YooKassa) — создание платежа
23. `POST /api/subscription/webhook` — обработка `succeeded` → `plan = 'pro'`
24. Применение White Label: фронтенд читает `master.theme`, `master.app_name`, `master.show_branding` из ответа `/api/auth/init` и применяет CSS-переменные + меняет заголовок
25. UI апгрейда: если мастер на free и пытается добавить 6-ю услугу → экран «Перейти на Pro»

### Этап 5 — Отзывы и аналитика ⬜ НЕ НАЧАТО

26. `POST /api/bookings/{id}/review` + фото-отзыв в Supabase Storage
27. Scheduled task (Vercel Cron или внешний cron): через 2ч после `status = 'completed'` → бот пишет клиенту запрос отзыва с deep link в Mini App
28. Аналитика для мастера: записи/месяц, выручка, топ-услуги (агрегация на лету через Supabase RPC)
29. Pagination для всех list-эндпоинтов (`?page=1&limit=20`) — добавить до публичного запуска

---

## 14. Admin-панель владельца платформы

### Решение: статическая веб-страница + Telegram Login + уведомления в бот

**Что видно на странице:**
- Количество мастеров (всего / активные за 30 дней)
- Выручка за текущий месяц (сумма платежей `subscriptions` со статусом `succeeded`)
- Активные подписки (мастера с `plan = 'pro'` и `plan_expires_at > now()`)
- Сколько всего подписчиков было за всё время
- Таблица мастеров: имя, бот, план, дата регистрации, количество клиентов

**Защита:** Telegram Login Widget — вход через Telegram-кнопку. Бэкенд проверяет что `telegram_id` совпадает с `PLATFORM_ADMIN_ID` в env. Не нужен пароль.

**Уведомления при оплате:** платформенный бот (`PLATFORM_BOT_TOKEN`) пишет в личку:
```
💳 Новая оплата!
Мастер: Анна Иванова (@anna_bot)
Тариф: Pro на 1 месяц
Сумма: 990 ₽
YooKassa ID: 2a56...
```

### API для admin-панели

```
GET /api/admin/stats
```
Защита: Telegram Login (заголовок `X-Telegram-Id` + подпись виджета).  
Ответ: все метрики одним запросом.

```
GET /api/admin/masters
```
Список мастеров с пагинацией.

### Переменные окружения (добавить)

```env
PLATFORM_ADMIN_ID=   # твой telegram_id (число), только он видит admin-панель
```

### Порядок разработки admin-панели (после Этапа 4 — монетизации)

1. Добавить `PLATFORM_ADMIN_ID` в env
2. Создать `GET /api/admin/stats` с проверкой telegram_id
3. Написать простую HTML-страницу `admin/index.html` (Telegram Login Widget → fetch `/api/admin/stats` → рендер таблиц)
4. В webhook YooKassa при `succeeded` → отправить сообщение в личку через `PLATFORM_BOT_TOKEN`

---

## 15. Решения по хостингу и домену

| Вопрос | Решение |
|--------|---------|
| **Где API** | Vercel Serverless Functions (старт) → VPS (когда упрёмся в лимиты или цену) |
| **Где база данных** | Supabase (PostgreSQL + Storage) — остаётся всегда |
| **Домен** | Купить один домен для платформы (например `beautymaster.ru`). API будет на `api.beautymaster.ru`, admin — на `admin.beautymaster.ru` |
| **Когда VPS** | Когда станет выгоднее по цене (~50+ мастеров на Pro) или понадобятся cron-задачи каждую минуту |
| **Провайдер VPS** | Timeweb Cloud или Hetzner (есть в России, хорошее соотношение цена/качество) |

### Что нужно сделать с доменом (когда купишь)
1. Купить домен (reg.ru, nic.ru, namecheap.com)
2. В DNS добавить: `api` → Vercel, `admin` → Vercel (или отдельный VPS)
3. Vercel автоматически выдаёт SSL-сертификат
4. Шаги объясню подробно когда дойдём до этого момента

---

## 16. Что намеренно не вошло в текущий план (но нужно до production)

| Тема | Почему важно | Когда добавлять |
|------|-------------|-----------------|
| **Rate limiting** | Без него любой может создать тысячи записей через API | Перед публичным запуском (Vercel Edge Middleware или Upstash Redis) |
| **Pagination** | `GET /api/master/{id}/reviews` вернёт все 1000 отзывов без лимита | При Этапе 2, добавить `?page=&limit=` ко всем list-роутам |
| **Audit log** | Мастер изменил расписание, удалил запись — нет истории | После Этапа 3 (таблица `audit_log` с `entity_type`, `entity_id`, `action`, `actor_id`, `diff`) |
| **Soft delete везде** | Физическое удаление услуги сломает ссылки в старых bookings | Добавить `deleted_at TIMESTAMPTZ` к `services`, `portfolio_photos`, `service_photos`; все SELECT фильтруют `WHERE deleted_at IS NULL` |
| **Напоминания за 24ч** | Cron-задача для уведомлений клиентов и мастеров | Этап 5, Vercel Cron: `0 9 * * *` → проверить записи на завтра → разослать |
| **Обработка expired JWT** | Фронтенд должен уметь обновлять токен без перезапуска | Добавить `refresh_token` (TTL 30 дней) или просто повторять `/api/auth/init` при 401 |
