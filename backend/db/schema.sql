-- =============================================================================
-- Beauty Master Platform — схема базы данных
-- Supabase / PostgreSQL
-- =============================================================================
-- Запускать в Supabase: Dashboard → SQL Editor → New query → вставить → Run
-- =============================================================================


-- =============================================================================
-- 0. РАСШИРЕНИЯ
-- =============================================================================

-- uuid_generate_v4() — генерация UUID (обычно уже включено в Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- 1. МАСТЕРА (masters)
-- =============================================================================
-- Один мастер = одна строка. Создаётся когда мастер регистрируется через бот платформы.
-- Метафора: это «карточка сотрудника» в нашей системе.

CREATE TABLE IF NOT EXISTS masters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id     BIGINT UNIQUE NOT NULL,      -- числовой ID пользователя в Telegram
  bot_token       TEXT UNIQUE NOT NULL,        -- токен бота мастера (хранится зашифрованным AES-256-GCM)
  bot_username    TEXT,                        -- @username бота без @, например: anna_beauty_bot
  webhook_secret  TEXT UNIQUE,                 -- случайный 32-байтный hex, для X-Telegram-Bot-Api-Secret-Token

  -- Профиль мастера
  name            TEXT NOT NULL,              -- полное имя: «Анна Иванова»
  specialty       TEXT,                       -- специализация: «Маникюр и педикюр»
  city            TEXT,                       -- «Москва»
  bio             TEXT,                       -- описание мастера (до 500 символов)
  address         TEXT,                       -- «ул. Ленина 15, студия Beauty»
  metro           TEXT,                       -- ближайшая станция метро
  hours           TEXT,                       -- текстовое описание часов: «Пн–Сб: 10:00–21:00»
  phone           TEXT,                       -- телефон для связи

  -- Медиа
  avatar_url      TEXT,                       -- URL аватара из Supabase Storage
  logo_url        TEXT,                       -- URL логотипа (только pro)

  -- White Label настройки (применяются только на pro-тарифе)
  theme           TEXT DEFAULT 'default',     -- 'default' | 'rose' | 'lavender' | 'gold' | 'dark' | 'ocean'
  app_name        TEXT,                       -- кастомное название в шапке Mini App
  show_branding   BOOLEAN DEFAULT true,       -- показывать «Powered by Beauty Master»

  -- Тариф
  plan            TEXT DEFAULT 'free'         -- 'free' | 'pro'
                  CHECK (plan IN ('free', 'pro')),
  plan_expires_at TIMESTAMPTZ,                -- когда истекает pro-подписка

  -- Кэшированная статистика (обновляется триггером или фоновой задачей)
  total_bookings  INT DEFAULT 0,
  rating          DECIMAL(2,1) DEFAULT 0,
  reviews_count   INT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Индексы для быстрого поиска мастера
CREATE INDEX IF NOT EXISTS idx_masters_telegram_id ON masters(telegram_id);
CREATE INDEX IF NOT EXISTS idx_masters_plan ON masters(plan) WHERE plan = 'pro';


-- =============================================================================
-- 2. УСЛУГИ (services)
-- =============================================================================
-- Услуги мастера (маникюр, педикюр и т.д.). Free-план — максимум 5 активных услуг.
-- Метафора: это «меню» в ресторане.

CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,

  -- Контент
  name          TEXT NOT NULL,               -- «Маникюр с покрытием»
  short_desc    TEXT,                        -- короткое описание (для карточки)
  description   TEXT,                        -- полное описание (для экрана услуги)
  category      TEXT NOT NULL               -- категория для фильтра
                CHECK (category IN ('manicure', 'pedicure', 'nailart', 'extensions', 'brows', 'lashes', 'other')),
  emoji         TEXT DEFAULT '💅',           -- эмодзи для карточки

  -- Цена и время
  price         INTEGER NOT NULL            -- цена в рублях (целое число)
                CHECK (price > 0),
  duration      INTEGER NOT NULL            -- длительность в минутах
                CHECK (duration > 0),

  -- Визуал
  gradient      TEXT,                       -- CSS gradient как fallback: 'linear-gradient(135deg, #f093fb, #f5576c)'
  position      INTEGER DEFAULT 0,          -- порядок отображения (меньше = выше)
  is_active     BOOLEAN DEFAULT true,       -- false = скрыта от клиентов (не удаляем физически)

  -- Кэшированная статистика
  rating        DECIMAL(2,1) DEFAULT 0,
  reviews_count INT DEFAULT 0,

  -- Soft delete: услуга «удалена» но данные сохранены (чтобы старые записи не сломались)
  deleted_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_master ON services(master_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_active ON services(master_id, is_active) WHERE deleted_at IS NULL;


-- =============================================================================
-- 3. ФОТОГРАФИИ УСЛУГ (service_photos)
-- =============================================================================
-- Фото к каждой конкретной услуге. Free: до 3 фото. Pro: безлимит.
-- Метафора: «портфолио конкретной работы».

CREATE TABLE IF NOT EXISTS service_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,                -- URL из Supabase Storage
  position    INTEGER DEFAULT 0,           -- порядок (первое фото = главное)
  deleted_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_photos_service ON service_photos(service_id) WHERE deleted_at IS NULL;


-- =============================================================================
-- 4. ПОРТФОЛИО (portfolio_photos)
-- =============================================================================
-- Общее портфолио мастера — лучшие работы без привязки к конкретной услуге.
-- Метафора: «instagram-лента» мастера внутри нашего приложения.

CREATE TABLE IF NOT EXISTS portfolio_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,                         -- подпись к фото
  position    INTEGER DEFAULT 0,
  deleted_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_master ON portfolio_photos(master_id) WHERE deleted_at IS NULL;


-- =============================================================================
-- 5. РАСПИСАНИЕ (schedule)
-- =============================================================================
-- Рабочие дни и часы мастера по дням недели.
-- Метафора: «типовая рабочая неделя».
-- ВАЖНО: weekday в нашей БД: 0=Пн, 1=Вт, ..., 6=Вс
-- (В JavaScript getDay() возвращает 0=Вс — нужна конвертация в коде!)

CREATE TABLE IF NOT EXISTS schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,

  weekday         SMALLINT NOT NULL         -- 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс
                  CHECK (weekday BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,            -- начало рабочего дня: '10:00:00'
  end_time        TIME NOT NULL,            -- конец рабочего дня: '21:00:00'
  is_working      BOOLEAN DEFAULT true,     -- false = выходной

  -- Длительность слота для записи (может отличаться по дням)
  -- Если null — используется duration из конкретной услуги
  slot_duration   INTEGER DEFAULT 60        -- минут
                  CHECK (slot_duration > 0),

  UNIQUE (master_id, weekday)              -- один мастер = одна запись на каждый день недели
);

CREATE INDEX IF NOT EXISTS idx_schedule_master ON schedule(master_id);


-- =============================================================================
-- 6. ИСКЛЮЧЕНИЯ В РАСПИСАНИИ (schedule_overrides)
-- =============================================================================
-- Конкретные даты: отпуск, больничный, дополнительный рабочий день.
-- Метафора: «стикер на календаре поверх обычного расписания».

CREATE TABLE IF NOT EXISTS schedule_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,

  date        DATE NOT NULL,               -- конкретная дата: '2026-05-01'
  is_working  BOOLEAN NOT NULL,            -- true = рабочий день, false = выходной/закрыто
  start_time  TIME,                        -- если is_working=true и время отличается от основного
  end_time    TIME,
  note        TEXT,                        -- «Майские праздники», «Отпуск», «Слёт мастеров»

  UNIQUE (master_id, date)                 -- один мастер = одно переопределение на дату
);

CREATE INDEX IF NOT EXISTS idx_overrides_master_date ON schedule_overrides(master_id, date);


-- =============================================================================
-- 7. КЛИЕНТЫ (clients)
-- =============================================================================
-- Клиенты, которые записывались через Mini App. Создаются автоматически при первой записи.
-- Метафора: «книга клиентов» всей платформы.
-- ВАЖНО: клиент един для всей платформы (один telegram_id = одна запись),
-- но может записываться к разным мастерам через таблицу bookings.

CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   BIGINT NOT NULL UNIQUE,    -- числовой ID клиента в Telegram
  first_name    TEXT,
  last_name     TEXT,
  username      TEXT,                      -- @username без @
  phone         TEXT,                      -- если клиент оставил при записи

  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_telegram ON clients(telegram_id);


-- =============================================================================
-- 8. ЗАПИСИ (bookings)
-- =============================================================================
-- Ключевая таблица. Каждая запись клиента к мастеру.
-- Метафора: «страница в журнале записей» мастера.

CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID NOT NULL REFERENCES masters(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  service_id    UUID REFERENCES services(id),  -- null если услуга была удалена

  -- Снэпшот данных на момент записи (важно: цена/название могут измениться потом)
  service_name  TEXT NOT NULL,             -- «Маникюр с покрытием» — как было в момент записи
  price         INTEGER NOT NULL           -- цена в рублях как была в момент записи
                CHECK (price > 0),
  date          DATE NOT NULL,             -- '2026-05-15'
  time_start    TIME NOT NULL,             -- '14:00:00'
  time_end      TIME NOT NULL,             -- '15:30:00' (time_start + service.duration)

  -- Контактные данные клиента (введены в wizard при записи)
  client_name   TEXT NOT NULL,             -- имя из wizard (может отличаться от Telegram-имени)
  client_phone  TEXT,                      -- телефон (опционально)
  comment       TEXT,                      -- комментарий клиента («аллергия на...»)

  -- Статус жизненного цикла записи
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  -- pending   = создана, ожидает подтверждения мастера
  -- confirmed = мастер подтвердил
  -- completed = визит состоялся, мастер отметил выполненной
  -- cancelled = отменена клиентом (до 24ч до записи)
  -- rejected  = отклонена мастером

  cancelled_by  TEXT CHECK (cancelled_by IN ('client', 'master')),
  cancel_reason TEXT,

  -- Soft delete: не удаляем физически (история важна для аналитики)
  deleted_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  -- КРИТИЧНО: защита от двойного бронирования на уровне БД
  -- Два клиента не могут занять одно и то же время у одного мастера
  CONSTRAINT unique_master_slot UNIQUE (master_id, date, time_start)
);

-- Индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_bookings_master_date
  ON bookings(master_id, date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client
  ON bookings(client_id)
  WHERE deleted_at IS NULL;

-- Частичный индекс: только активные записи (не отменённые)
CREATE INDEX IF NOT EXISTS idx_bookings_active
  ON bookings(master_id, date, time_start)
  WHERE status NOT IN ('cancelled', 'rejected') AND deleted_at IS NULL;


-- =============================================================================
-- 9. ОТЗЫВЫ (reviews)
-- =============================================================================
-- Отзывы клиентов после завершённых записей. Ключевое отличие — фото-отзыв.
-- Метафора: «листок с оценкой в конце журнала записи».

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id),
  master_id   UUID NOT NULL REFERENCES masters(id),
  client_id   UUID NOT NULL REFERENCES clients(id),

  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT,                         -- текст отзыва
  photo_url   TEXT,                         -- фото результата (загружается в Supabase Storage)

  is_visible  BOOLEAN DEFAULT true,         -- мастер может скрыть отзыв (но не удалить)

  created_at  TIMESTAMPTZ DEFAULT now(),

  -- Один клиент = один отзыв на одну запись
  UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_master ON reviews(master_id) WHERE is_visible = true;


-- =============================================================================
-- 10. ПОДПИСКИ / ИСТОРИЯ ПЛАТЕЖЕЙ (subscriptions)
-- =============================================================================
-- Каждый платёж за Pro-план = одна строка. История хранится вечно.
-- Метафора: «квитанция об оплате».

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id             UUID NOT NULL REFERENCES masters(id),

  plan                  TEXT NOT NULL DEFAULT 'pro',
  amount                INTEGER NOT NULL         -- сумма в КОПЕЙКАХ (YooKassa работает в копейках)
                        CHECK (amount > 0),
  currency              TEXT DEFAULT 'RUB',

  -- Данные платёжной системы (YooKassa)
  yookassa_payment_id   TEXT UNIQUE,             -- ID платежа в YooKassa
  yookassa_status       TEXT                     -- 'pending' | 'succeeded' | 'canceled'
                        CHECK (yookassa_status IN ('pending', 'succeeded', 'canceled')),

  -- Период подписки
  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_master ON subscriptions(master_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
  ON subscriptions(master_id, period_end)
  WHERE yookassa_status = 'succeeded';


-- =============================================================================
-- 11. АВТООБНОВЛЕНИЕ updated_at
-- =============================================================================
-- Триггер автоматически обновляет поле updated_at при любом изменении строки.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем к таблицам с полем updated_at
CREATE TRIGGER trg_masters_updated_at
  BEFORE UPDATE ON masters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS — это как «замок на папке»: даже если кто-то получит прямой доступ к БД,
-- он увидит только то, на что у него есть права.
-- Наш API использует service_role_key (обходит RLS), поэтому изоляция данных
-- реализована в коде API. RLS здесь — дополнительный слой защиты.

-- Включаем RLS на всех таблицах
ALTER TABLE masters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;

-- Публичное чтение для данных мастера (профиль, услуги, фото видны всем клиентам)
-- Запись — только через API (service_role)

CREATE POLICY "public can read services"
  ON services FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "public can read service_photos"
  ON service_photos FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "public can read portfolio_photos"
  ON portfolio_photos FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "public can read reviews"
  ON reviews FOR SELECT
  USING (is_visible = true);

-- Профиль мастера: показываем только безопасные поля (bot_token и webhook_secret скрыты)
-- ВАЖНО: bot_token и webhook_secret НИКОГДА не должны попасть клиенту.
-- В API-роутах явно исключать эти поля из SELECT:
--   .select('id, name, specialty, city, bio, address, theme, app_name, show_branding, rating')

CREATE POLICY "public can read master profile"
  ON masters FOR SELECT
  USING (true);
-- Примечание: поля bot_token и webhook_secret защищены на уровне API (не выбираем их).
-- В production стоит создать отдельную VIEW masters_public без этих полей.


-- =============================================================================
-- 13. НАЧАЛЬНЫЕ ДАННЫЕ (seed) — только для тестирования
-- =============================================================================
-- Раскомментируй для локального тестирования:

/*
INSERT INTO masters (telegram_id, bot_token, bot_username, name, specialty, city, plan)
VALUES (
  123456789,                          -- замени на свой telegram_id
  'encrypted:...',                    -- в реальности хранится зашифрованный токен
  'oz_beauty_bot',
  'Мастер Тест',
  'Маникюр',
  'Москва',
  'free'
);
*/


-- =============================================================================
-- ГОТОВО
-- =============================================================================
-- Все таблицы созданы. Следующий шаг: настроить Supabase Storage (бакеты для фото).
-- Инструкции в BACKEND-PLAN.md раздел 4.
