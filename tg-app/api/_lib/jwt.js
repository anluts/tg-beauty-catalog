/**
 * JWT helpers — подписание и верификация токенов
 *
 * Payload JWT содержит:
 *   telegram_id  — ID пользователя в Telegram
 *   role         — 'master' | 'client'
 *   master_id    — UUID мастера (чей каталог открыт)
 *   plan         — 'free' | 'pro' (тариф мастера)
 */

const jwt = require('jsonwebtoken');

function getSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
}

/**
 * Подписывает payload и возвращает JWT строку
 * TTL берётся из JWT_TTL (секунды), default 86400 = 24 часа
 */
function sign(payload) {
  const ttl = parseInt(process.env.JWT_TTL || '86400', 10);
  return jwt.sign(payload, getSecret(), { expiresIn: ttl });
}

/**
 * Верифицирует JWT и возвращает payload
 * Кидает ошибку если токен просрочен или невалиден
 */
function verify(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { sign, verify };
