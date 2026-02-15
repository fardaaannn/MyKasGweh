import CryptoJS from 'crypto-js';
import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Generate SHA-256 hash dari data transaksi
 * @param {object} data - Data transaksi
 * @param {string} previousHash - Hash dari block sebelumnya
 * @param {number} timestamp - Waktu pembuatan block
 * @param {number} nonce - Nonce unik
 * @returns {string} - SHA-256 hash
 */
export function generateHash(data, previousHash, timestamp, nonce) {
  const rawString = JSON.stringify(data) + previousHash + timestamp + nonce;
  return CryptoJS.SHA256(rawString).toString();
}

/**
 * Buat Genesis Block (block pertama) untuk organisasi baru
 * @param {string} orgId - ID organisasi
 * @returns {object} - Genesis block data
 */
export async function createGenesisBlock(orgId) {
  const timestamp = Date.now();
  const nonce = 0;
  const data = {
    type: 'genesis',
    description: 'Blok pertama - Organisasi dibuat',
    amount: 0,
  };
  const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const currentHash = generateHash(data, previousHash, timestamp, nonce);

  const blockRef = await addDoc(
    collection(db, 'organizations', orgId, 'transactions'),
    {
      ...data,
      previousHash,
      currentHash,
      nonce,
      timestamp,
      createdAt: serverTimestamp(),
      proposalId: null,
      payoutStatus: null,
      payoutId: null,
    }
  );

  return {
    id: blockRef.id,
    ...data,
    previousHash,
    currentHash,
    nonce,
    timestamp,
  };
}

/**
 * Tambah block baru ke chain
 * @param {string} orgId - ID organisasi
 * @param {object} transactionData - Data transaksi dari proposal yang disetujui
 * @returns {object} - Block baru
 */
export async function addBlock(orgId, transactionData) {
  // Ambil block terakhir untuk mendapatkan currentHash sebagai previousHash
  const lastBlockQuery = query(
    collection(db, 'organizations', orgId, 'transactions'),
    orderBy('timestamp', 'desc'),
    limit(1)
  );
  const lastBlockSnap = await getDocs(lastBlockQuery);

  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  if (!lastBlockSnap.empty) {
    previousHash = lastBlockSnap.docs[0].data().currentHash;
  }

  const timestamp = Date.now();
  const nonce = Math.floor(Math.random() * 1000000);
  const currentHash = generateHash(transactionData, previousHash, timestamp, nonce);

  const blockRef = await addDoc(
    collection(db, 'organizations', orgId, 'transactions'),
    {
      ...transactionData,
      previousHash,
      currentHash,
      nonce,
      timestamp,
      createdAt: serverTimestamp(),
    }
  );

  return {
    id: blockRef.id,
    ...transactionData,
    previousHash,
    currentHash,
    nonce,
    timestamp,
  };
}

/**
 * Ambil seluruh chain untuk organisasi
 * @param {string} orgId - ID organisasi
 * @returns {Array} - Array of blocks, ordered by timestamp
 */
export async function getChain(orgId) {
  const chainQuery = query(
    collection(db, 'organizations', orgId, 'transactions'),
    orderBy('timestamp', 'asc')
  );
  const chainSnap = await getDocs(chainQuery);
  return chainSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Verifikasi integritas seluruh chain
 * @param {string} orgId - ID organisasi
 * @returns {object} - { valid: boolean, invalidBlockIndex: number|null, details: string }
 */
export async function verifyChain(orgId) {
  const chain = await getChain(orgId);

  if (chain.length === 0) {
    return { valid: true, invalidBlockIndex: null, details: 'Chain kosong', chain: [] };
  }

  // Verify genesis block
  const genesis = chain[0];
  if (genesis.previousHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
    return {
      valid: false,
      invalidBlockIndex: 0,
      details: 'Genesis block memiliki previousHash yang tidak valid',
      chain,
    };
  }

  // Verify each block
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    const { currentHash, previousHash, nonce, timestamp, id, createdAt, ...data } = block;

    // Recompute hash
    const computedHash = generateHash(data, previousHash, timestamp, nonce);

    if (computedHash !== currentHash) {
      return {
        valid: false,
        invalidBlockIndex: i,
        details: `Block #${i} memiliki hash yang tidak valid. Data mungkin telah dimanipulasi!`,
        chain,
      };
    }

    // Verify chain link (kecuali genesis)
    if (i > 0) {
      const prevBlock = chain[i - 1];
      if (block.previousHash !== prevBlock.currentHash) {
        return {
          valid: false,
          invalidBlockIndex: i,
          details: `Block #${i} tidak terhubung dengan benar ke Block #${i - 1}. Chain terputus!`,
          chain,
        };
      }
    }
  }

  return {
    valid: true,
    invalidBlockIndex: null,
    details: `Semua ${chain.length} block terverifikasi. Chain valid! ✅`,
    chain,
  };
}
