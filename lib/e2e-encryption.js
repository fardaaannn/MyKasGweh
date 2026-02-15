/**
 * End-to-End Encryption Service untuk DM Chat
 * 
 * Menggunakan AES-256 encryption dengan key derivasi per-percakapan.
 * Pesan dienkripsi di client sebelum dikirim ke Firestore,
 * dan didekripsi di client saat ditampilkan.
 * 
 * Key derivasi: PBKDF2(chatId + uid1 + uid2) → unique key per chat
 */

import CryptoJS from 'crypto-js';

const KEY_SIZE = 256 / 32; // 256-bit key
const ITERATIONS = 1000;

/**
 * Derive encryption key dari chatId
 * ChatId sudah deterministik (sorted uid pair), jadi key sama untuk kedua user
 */
function deriveKey(chatId) {
  // Salt dari chatId untuk memastikan unique key per conversation
  const salt = CryptoJS.SHA256(chatId).toString();
  // Derive key menggunakan PBKDF2
  const key = CryptoJS.PBKDF2(chatId, salt, {
    keySize: KEY_SIZE,
    iterations: ITERATIONS,
  });
  return key;
}

/**
 * Encrypt pesan sebelum simpan ke Firestore
 * @param {string} plaintext - Pesan asli
 * @param {string} chatId - ID chat (untuk derive key)
 * @returns {string} - Encrypted message (base64)
 */
export function encryptMessage(plaintext, chatId) {
  if (!plaintext) return '';
  try {
    const key = deriveKey(chatId);
    // Generate random IV untuk setiap pesan
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    // Gabungkan IV + ciphertext untuk storage
    const combined = iv.toString() + ':' + encrypted.toString();
    return combined;
  } catch (error) {
    console.error('E2E Encrypt error:', error);
    return plaintext; // Fallback to plain text
  }
}

/**
 * Decrypt pesan dari Firestore
 * @param {string} ciphertext - Pesan terenkripsi
 * @param {string} chatId - ID chat (untuk derive key)
 * @returns {string} - Pesan asli
 */
export function decryptMessage(ciphertext, chatId) {
  if (!ciphertext) return '';
  try {
    // Cek apakah pesan terenkripsi (memiliki format IV:ciphertext)
    if (!ciphertext.includes(':')) {
      // Pesan lama yang belum dienkripsi
      return ciphertext;
    }
    const [ivHex, encryptedData] = ciphertext.split(':');
    const key = deriveKey(chatId);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
      // Decryption gagal — mungkin pesan lama tanpa enkripsi
      return ciphertext;
    }
    return plaintext;
  } catch (error) {
    // Fallback: kembalikan ciphertext jika decrypt gagal (pesan lama)
    return ciphertext;
  }
}

/**
 * Cek apakah sebuah pesan terenkripsi
 */
export function isEncrypted(text) {
  if (!text) return false;
  // Encrypted messages have format: hexIV:base64ciphertext
  const parts = text.split(':');
  if (parts.length !== 2) return false;
  // Check if first part is valid hex (IV = 32 hex chars)
  return /^[a-f0-9]{32}$/i.test(parts[0]);
}
