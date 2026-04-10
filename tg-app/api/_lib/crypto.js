/**
 * AES-256-GCM шифрование/дешифрование токенов ботов
 * Токены мастеров хранятся в БД в зашифрованном виде.
 * Ключ шифрования — ENCRYPTION_KEY из .env (32 байта hex = 64 символа)
 */

const crypto = require('crypto');

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Шифрует строку (например, токен бота)
 * Возвращает строку вида: iv_hex:authTag_hex:ciphertext_hex
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV для GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag(); // 16 байт

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Дешифрует строку вида iv_hex:authTag_hex:ciphertext_hex
 */
function decrypt(ciphertext) {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
