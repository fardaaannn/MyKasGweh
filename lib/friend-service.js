'use client';
import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Cek apakah username tersedia
 */
export async function checkUsernameAvailable(username) {
  if (!username || username.length < 3) return false;
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

/**
 * Set atau update username user
 */
export async function setUsername(uid, newUsername, oldUsername = null) {
  const username = newUsername.toLowerCase().trim();

  // Validasi format
  if (!/^[a-z0-9._]{3,20}$/.test(username)) {
    return { success: false, message: 'Username hanya boleh huruf kecil, angka, titik, underscore (3-20 karakter)' };
  }

  // Cek ketersediaan
  const available = await checkUsernameAvailable(username);
  if (!available) {
    return { success: false, message: 'Username sudah dipakai' };
  }

  try {
    // Hapus username lama jika ada
    if (oldUsername) {
      await deleteDoc(doc(db, 'usernames', oldUsername.toLowerCase()));
    }

    // Set username baru di lookup collection
    await setDoc(doc(db, 'usernames', username), { uid });

    // Update user doc
    await setDoc(doc(db, 'users', uid), { username }, { merge: true });

    return { success: true, message: 'Username berhasil disimpan!' };
  } catch (error) {
    console.error('Error setting username:', error);
    return { success: false, message: 'Gagal menyimpan username: ' + error.message };
  }
}

/**
 * Cari user berdasarkan username
 */
export async function searchByUsername(username) {
  const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (!usernameDoc.exists()) return null;

  const uid = usernameDoc.data().uid;
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;

  const userData = userDoc.data();
  return {
    uid,
    username: userData.username,
    displayName: userData.displayName || 'User',
    photoURL: userData.photoURL || null,
  };
}

/**
 * Kirim friend request
 */
export async function sendFriendRequest(fromUid, fromName, fromUsername, toUid) {
  // Cek apakah sudah teman
  const userDoc = await getDoc(doc(db, 'users', fromUid));
  const userData = userDoc.data() || {};
  if (userData.friends && userData.friends.includes(toUid)) {
    return { success: false, message: 'Sudah berteman!' };
  }

  // Cek apakah sudah ada request pending
  const q = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', fromUid),
    where('toUid', '==', toUid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    return { success: false, message: 'Permintaan pertemanan sudah dikirim' };
  }

  // Cek reverse request
  const reverseQ = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', toUid),
    where('toUid', '==', fromUid),
    where('status', '==', 'pending')
  );
  const reverseExisting = await getDocs(reverseQ);
  if (!reverseExisting.empty) {
    // Auto-accept
    const reqId = reverseExisting.docs[0].id;
    return await acceptFriendRequest(reqId);
  }

  const requestRef = doc(collection(db, 'friendRequests'));
  await setDoc(requestRef, {
    fromUid,
    fromName,
    fromUsername,
    toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return { success: true, message: 'Permintaan pertemanan dikirim!' };
}

/**
 * Terima friend request
 */
export async function acceptFriendRequest(requestId) {
  const reqRef = doc(db, 'friendRequests', requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return { success: false, message: 'Request tidak ditemukan' };

  const { fromUid, toUid } = reqSnap.data();

  // Add to both friends arrays
  await setDoc(doc(db, 'users', fromUid), { friends: arrayUnion(toUid) }, { merge: true });
  await setDoc(doc(db, 'users', toUid), { friends: arrayUnion(fromUid) }, { merge: true });

  // Update request status
  await updateDoc(reqRef, { status: 'accepted' });

  return { success: true, message: 'Pertemanan diterima!' };
}

/**
 * Tolak friend request
 */
export async function rejectFriendRequest(requestId) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
  return { success: true, message: 'Permintaan ditolak' };
}

/**
 * Hapus teman
 */
export async function removeFriend(uid, friendUid) {
  await updateDoc(doc(db, 'users', uid), { friends: arrayRemove(friendUid) });
  await updateDoc(doc(db, 'users', friendUid), { friends: arrayRemove(uid) });
  return { success: true, message: 'Teman dihapus' };
}

/**
 * Dapatkan daftar teman dengan profil
 */
export async function getFriends(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const userData = userDoc.data() || {};
  const friendUids = userData.friends || [];

  const friends = [];
  for (const fUid of friendUids) {
    const fDoc = await getDoc(doc(db, 'users', fUid));
    if (fDoc.exists()) {
      const fData = fDoc.data();
      friends.push({
        uid: fUid,
        displayName: fData.displayName || 'User',
        username: fData.username || '',
        photoURL: fData.photoURL || null,
      });
    }
  }
  return friends;
}

/**
 * Generate deterministic chat ID dari 2 UIDs
 */
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}
