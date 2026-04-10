# BACKEND-PLAN.md

> Архитектурный план бэкенда для Beauty Master Platform  
> Стек: Supabase (PostgreSQL + Storage) + Vercel Serverless Functions + YooKassa + Telegram Bot API  
> Составлен на основе: research.md, brief.md, текущего кода проекта

---

## 1. Концепция системы

Платформа — это SaaS-конструктор для мастеров красоты. Один мастер = один экземпляр Mini App, который работает под его Telegram-ботом. Клиенты мастера видят только его данные.

```
┌─────────────────────────────────────────────────────┐
│                   ПЛАТФОРМА                         │
│                                                     │
│  Мастер А          Мастер Б          Мастер В       │
│  @bot_a            @bot_b            @bot_c         │
│  beauty-a.vercel   beauty-b.vercel   beauty-c.vercel│
│  5 услуг (free)    безлимит (pro)    безлимит (pro) │
└─────────────────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │     Supabase DB     │
              │   + Storage (S3)   │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  Vercel API Routes  │
              │  /api/*             │
              └─────────────────────┘
```

---

## 2. Роли и права доступа

| Роль | Кто | Что может |
|------|-----|-----------|
| **master** | Мастер красоты | Управлять своим профилем, услугами, расписанием, видеть записи своих клиентов |
| **client** | Клиент мастера | Просматривать каталог, записываться, смотреть свои записи |
| **platform_admin** | Ты (Александр) | Видеть всех мастеров, управлять тарифами, выплатами |

**Идентификация через Telegram** — не нужна отдельная авторизация. Все запросы содержат `initData` из `Telegram.WebApp.initData`, который проверяется на бэкенде подписью HMAC-SHA256.

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
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_master_date ON bookings(master_id, date);
CREATE INDEX idx_bookings_client ON bookings(client_id);
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
Вызывается при каждом открытии Mini App. Передаёт `initData` из Telegram.  
**Ответ:** JWT токен + данные мастера (если `telegram_id` = мастер) или клиента.

```
POST /api/auth/master-setup
```
Первичная настройка мастера. Вызывается ботом при `/start`.  
Тело: `{ bot_token, telegram_id, first_name }`.

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
POST /api/telegram/webhook/{bot_token}
```
Обрабатывает все апдейты от Telegram-бота мастера.

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
function generateAvailableSlots(date, masterId) {
  // 1. Получить расписание мастера на этот weekday
  const weekday = new Date(date).getDay(); // 0=Вс, ..., 6=Сб
  const daySchedule = await getSchedule(masterId, weekday);
  if (!daySchedule.is_working) return [];

  // 2. Проверить override (отпуск, выходной)
  const override = await getOverride(masterId, date);
  if (override && !override.is_working) return [];

  // 3. Сгенерировать все слоты от start_time до end_time
  const slots = generateTimeSlots(
    override?.start_time || daySchedule.start_time,
    override?.end_time || daySchedule.end_time,
    60 // минут на слот (или service.duration)
  );

  // 4. Убрать занятые (уже есть booking на это время)
  const existingBookings = await getBookings(masterId, date);
  return slots.map(slot => ({
    time: slot,
    available: !existingBookings.some(b =>
      timeOverlaps(slot, serviceDuration, b.time_start, b.time_end)
    )
  }));
}
```

---

## 11. Безопасность

### Проверка initData (обязательно на каждый запрос)

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

  return hash === expectedHash;
}
```

### Правила Row Level Security (Supabase RLS)

- Мастер видит только своих клиентов и свои записи
- Клиент видит только свои записи
- Фото услуг — публичное чтение, запись только через API с проверкой master_id
- Токены ботов хранятся зашифрованными (AES-256), ключ в env

---

## 12. Переменные окружения

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # только на бэкенде, никогда в клиент

# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Шифрование токенов ботов
ENCRYPTION_KEY=               # 32-байтный ключ AES-256

# Платформа
PLATFORM_BOT_TOKEN=           # Telegram бот самой платформы (для онбординга мастеров)
PLAN_PRO_PRICE_RUB=990
```

---

## 13. Порядок разработки (этапы)

### Этап 1 — Фундамент (без него ничего не работает)
1. Supabase: создать все таблицы, настроить RLS
2. `POST /api/auth/init` — проверка initData, выдача JWT
3. `POST /api/auth/master-setup` — регистрация мастера через бота
4. `GET /api/master/{id}/services` — отдать услуги в Mini App
5. Telegram webhook: команда `/start` с кнопкой Mini App

### Этап 2 — Записи
6. `GET /api/master/{id}/slots` — генерация слотов по расписанию
7. `POST /api/bookings` — создать запись + уведомить мастера в бот
8. `GET /api/bookings/my` — список записей клиента
9. `PATCH /api/bookings/{id}/cancel` — отмена

### Этап 3 — Кабинет мастера в Mini App
10. Новые экраны: дашборд, управление услугами, расписание
11. `POST /api/master/me/services` + загрузка фото
12. `PUT /api/master/me/schedule`
13. `PATCH /api/master/me/bookings/{id}/confirm|reject`

### Этап 4 — Монетизация
14. `POST /api/subscription/create-payment` (YooKassa)
15. `POST /api/subscription/webhook`
16. Применение White Label: темы, логотип, убрать брендинг

### Этап 5 — Отзывы и аналитика
17. `POST /api/bookings/{id}/review` + фото-отзыв
18. Автоуведомление мастеру «Запрос отзыва» через 2ч после completion
19. Аналитика для мастера: записи/месяц, выручка, топ-услуги
