# BUGS.md — Журнал ошибок и их исправлений

**Проект:** Beauty Master Platform  
**Как пользоваться:** нашёл баг → записал сюда → исправил → отметил ✅

---

## Где смотреть логи (быстрый справочник)

### Фронтенд (Mini App)
```
Telegram на телефоне → открыть Mini App → потрясти телефон → появится консоль
Или: открыть в браузере → F12 → Console
```

### API (Vercel)
```
vercel.com → проект beauty-catalog → вкладка Functions → нажать на функцию → Logs
Или: npx vercel logs --prod
```

### Platform Bot (VPS)
```bash
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175
pm2 logs beauty-bot --lines 50    # последние 50 строк
pm2 logs beauty-bot               # в реальном времени (Ctrl+C для выхода)
```

### База данных (Supabase)
```
supabase.com → проект ktmblxavaieujivguemc → Logs → API / Database
```

---

## Шаблон для записи бага

Копируй этот блок и заполняй:

```
### БАГ-XXX — [Короткое название]
**Дата:** ГГГГ-ММ-ДД  
**Компонент:** Фронтенд / API / Platform Bot / БД  
**Статус:** 🔴 Открыт / 🟡 В работе / ✅ Исправлен  

**Что происходит:**  
(опиши что пошло не так)

**Как воспроизвести:**  
1. ...
2. ...

**Ошибка в логах:**  
```
вставь текст ошибки
```

**Причина:**  
(что оказалось не так)

**Исправление:**  
(что сделал, какой файл/строка)

**Коммит:** git hash или PR
```

---

## Активные баги

*(пусто — всё работает)*

---

## Исправленные баги

### БАГ-001 — Mini App показывает чёрный экран на Telegram Desktop
**Дата:** 2026-04-17  
**Компонент:** Фронтенд  
**Статус:** ✅ Исправлен (обходное решение)

**Что происходит:**  
При открытии Mini App через Telegram Desktop (Mac/Windows) — чёрный экран.

**Причина:**  
Telegram Desktop плохо поддерживает Mini Apps. Это ограничение клиента, не нашего кода.

**Исправление:**  
Тестировать только через мобильный Telegram (iOS / Android).  
Ссылка для теста: `t.me/oz_beauty_bot?startapp=55849bef-cc4a-4c56-8528-7c56f6a50d3e`

---

### БАГ-002 — Platform Bot не запускался (PLATFORM_BOT_TOKEN пустой)
**Дата:** 2026-04-16  
**Компонент:** Platform Bot (VPS)  
**Статус:** ✅ Исправлен

**Что происходит:**  
```
❌ Invalid PLATFORM_BOT_TOKEN
```
PM2 показывал статус `errored`, бот не отвечал на сообщения.

**Причина:**  
В файле `/root/tg-beauty-catalog/backend/.env` переменная `PLATFORM_BOT_TOKEN` была пустой — токен не был создан.

**Исправление:**  
1. Создали бота `@beauty_masters_platform_bot` через @BotFather
2. Обновили `.env` на сервере через SSH
3. Запустили: `pm2 start ecosystem.config.js && pm2 save`

---

### БАГ-003 — seed-скрипт падал с ошибкой duplicate key
**Дата:** 2026-04-16  
**Компонент:** БД / Scripts  
**Статус:** ✅ Исправлен

**Что происходит:**  
```
❌ Ошибка создания мастера: duplicate key value violates unique constraint "masters_telegram_id_key"
```

**Причина:**  
Старый скрипт пытался создать нового мастера с `telegram_id: 999999999`, который уже был в БД.

**Исправление:**  
Переписал `seed-test-master.js` — теперь скрипт **обновляет** существующего мастера через `PATCH` вместо `POST`.

---

## Частые ошибки и быстрые решения

| Ошибка | Где | Решение |
|--------|-----|---------|
| `Invalid initData signature` | API /auth/init | Норма при тесте через curl. В Telegram работает. |
| `Master not found` | API /auth/init | Проверь master_id: `55849bef-cc4a-4c56-8528-7c56f6a50d3e` |
| `Missing env var: PLATFORM_BOT_TOKEN` | Bot | Заполни `.env` на сервере, `pm2 restart beauty-bot` |
| `Failed to decrypt bot token` | API /master | `ENCRYPTION_KEY` на Vercel и VPS должен совпадать |
| PM2 status: `errored` | VPS | `pm2 logs beauty-bot --lines 30` — смотри причину |
| Vercel deploy fail | Vercel | `npx vercel logs --prod` — смотри что сломалось |
| Суpabase 403 | API | Проверь `SUPABASE_SERVICE_ROLE_KEY` в Vercel env vars |
| Чёрный экран в Mini App | Telegram | Тестируй на мобильном, не на Desktop |

---

## Команды для быстрой диагностики

```bash
# Проверить что Platform Bot живой
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175 "pm2 status"

# Последние ошибки бота
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175 "tail -30 /root/logs/beauty-bot.err.log"

# Проверить API (должен вернуть 404 Master not found)
curl -s -X POST https://beauty-catalog-azure.vercel.app/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{"initData":"test","master_id":"55849bef-cc4a-4c56-8528-7c56f6a50d3e"}'

# Перезапустить бота после изменений
ssh -i ~/.ssh/id_vps_beauty root@84.54.31.175 \
  "cd /root/tg-beauty-catalog && git pull && pm2 restart beauty-bot"
```
