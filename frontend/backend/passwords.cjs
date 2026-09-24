const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
const PREFIX = 'scrypt$';

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${PREFIX}${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (!stored.startsWith(PREFIX)) {
    // Compatibility with the plaintext accounts supplied in the initial SQL.
    // A successful login immediately replaces the legacy value with a hash.
    const digest = value => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(password), digest(stored));
  }
  const [, salt, encoded] = stored.split('$');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(encoded || '')) return false;
  const key = await derive(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(encoded, 'hex'));
}

module.exports = { hashPassword, verifyPassword, PREFIX };
