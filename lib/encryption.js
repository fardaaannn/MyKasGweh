import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.AES_ENCRYPTION_KEY || 'default-dev-key-change-in-production';

/**
 * Encrypt plaintext menggunakan AES-256
 * @param {string} plaintext - Data yang akan dienkripsi
 * @returns {string} - Ciphertext (base64)
 */
export function encrypt(plaintext) {
  if (!plaintext && plaintext !== 0) return '';
  const ciphertext = CryptoJS.AES.encrypt(
    String(plaintext),
    ENCRYPTION_KEY
  ).toString();
  return ciphertext;
}

/**
 * Decrypt ciphertext menggunakan AES-256
 * @param {string} ciphertext - Data terenkripsi
 * @returns {string} - Plaintext
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[DECRYPTION ERROR]';
  }
}

/**
 * Encrypt data sensitif di sisi client (menggunakan API route)
 * Ini adalah fallback — idealnya enkripsi dilakukan di server
 */
export function clientEncrypt(plaintext, clientKey) {
  if (!plaintext && plaintext !== 0) return '';
  return CryptoJS.AES.encrypt(String(plaintext), clientKey).toString();
}

export function clientDecrypt(ciphertext, clientKey) {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, clientKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '[DECRYPTION ERROR]';
  }
}
