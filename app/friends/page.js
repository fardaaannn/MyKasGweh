'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  searchByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriends,
  getChatId,
} from '@/lib/friend-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './friends.module.css';

export default function FriendsPage() {
  return (
    <ProtectedRoute>
      <FriendsContent />
    </ProtectedRoute>
  );
}

function FriendsContent() {
  const { user } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [myUsername, setMyUsername] = useState('');

  // Load data
  useEffect(() => {
    if (!user) return;

    // Get my username
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      const data = snap.data();
      if (data?.username) setMyUsername(data.username);
    });

    // Load friends
    loadFriends();

    // Listen to incoming friend requests
    const inQ = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubIn = onSnapshot(inQ, async (snap) => {
      const reqs = [];
      for (const d of snap.docs) {
        const data = d.data();
        // Get sender info
        const senderDoc = await getDoc(doc(db, 'users', data.fromUid));
        const senderData = senderDoc.data() || {};
        reqs.push({
          id: d.id,
          ...data,
          fromName: senderData.displayName || data.fromName || 'User',
          fromUsername: senderData.username || data.fromUsername || '',
          fromPhoto: senderData.photoURL || null,
        });
      }
      setIncomingRequests(reqs);
    });

    // Listen to outgoing friend requests
    const outQ = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubOut = onSnapshot(outQ, async (snap) => {
      const reqs = [];
      for (const d of snap.docs) {
        const data = d.data();
        const toDoc = await getDoc(doc(db, 'users', data.toUid));
        const toData = toDoc.data() || {};
        reqs.push({
          id: d.id,
          ...data,
          toName: toData.displayName || 'User',
          toUsername: toData.username || '',
          toPhoto: toData.photoURL || null,
        });
      }
      setOutgoingRequests(reqs);
    });

    setLoading(false);
    return () => { unsubIn(); unsubOut(); };
  }, [user]);

  const loadFriends = async () => {
    const list = await getFriends(user.uid);
    setFriends(list);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchMessage('');

    const result = await searchByUsername(searchQuery.trim());
    if (!result) {
      setSearchMessage('User tidak ditemukan');
    } else if (result.uid === user.uid) {
      setSearchMessage('Ini username kamu sendiri 😄');
    } else {
      setSearchResult(result);
    }
    setSearching(false);
  };

  const handleSendRequest = async (toUid) => {
    setActionLoading(toUid);
    const result = await sendFriendRequest(
      user.uid,
      user.displayName || 'User',
      myUsername,
      toUid
    );
    setSearchMessage(result.message);
    if (result.success) {
      setSearchResult(null);
      loadFriends();
    }
    setActionLoading('');
  };

  const handleAccept = async (requestId) => {
    setActionLoading(requestId);
    await acceptFriendRequest(requestId);
    loadFriends();
    setActionLoading('');
  };

  const handleReject = async (requestId) => {
    setActionLoading(requestId);
    await rejectFriendRequest(requestId);
    setActionLoading('');
  };

  const handleRemove = async (friendUid) => {
    if (!confirm('Hapus teman ini?')) return;
    setActionLoading(friendUid);
    await removeFriend(user.uid, friendUid);
    loadFriends();
    setActionLoading('');
  };

  const openChat = (friendUid) => {
    const chatId = getChatId(user.uid, friendUid);
    router.push(`/chat/${chatId}?friendUid=${friendUid}`);
  };

  return (
    <>
      <div className="page-container">
        <div className={styles.friendsWrapper}>
          <button className={styles.backBtn} onClick={() => router.push('/profile')}>
            ← Kembali
          </button>

          <h1 className={styles.pageTitle}>👥 Teman</h1>

          {/* Search */}
          <div className={`glass-card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>🔍 Cari Teman</h2>
            <div className={styles.searchRow}>
              <div className={styles.searchInputWrap}>
                <span className={styles.searchAt}>@</span>
                <input
                  type="text"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder="username_teman"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={searching}>
                {searching ? '...' : 'Cari'}
              </button>
            </div>

            {searchMessage && (
              <p className={styles.searchMsg}>{searchMessage}</p>
            )}

            {searchResult && (
              <div className={styles.userCard}>
                <div className={styles.userAvatar}>
                  {searchResult.photoURL ? (
                    <img src={searchResult.photoURL} alt="" />
                  ) : (
                    <span>{(searchResult.displayName || '?')[0].toUpperCase()}</span>
                  )}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{searchResult.displayName}</span>
                  <span className={styles.userUsername}>@{searchResult.username}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSendRequest(searchResult.uid)}
                  disabled={actionLoading === searchResult.uid}
                >
                  {actionLoading === searchResult.uid ? '...' : '➕ Tambah'}
                </button>
              </div>
            )}
          </div>

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div className={`glass-card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>
                📩 Permintaan Masuk
                <span className={styles.badge}>{incomingRequests.length}</span>
              </h2>
              {incomingRequests.map((req) => (
                <div key={req.id} className={styles.userCard}>
                  <div className={styles.userAvatar}>
                    {req.fromPhoto ? (
                      <img src={req.fromPhoto} alt="" />
                    ) : (
                      <span>{(req.fromName || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{req.fromName}</span>
                    <span className={styles.userUsername}>@{req.fromUsername}</span>
                  </div>
                  <div className={styles.requestActions}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleAccept(req.id)}
                      disabled={actionLoading === req.id}
                    >
                      ✅
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleReject(req.id)}
                      disabled={actionLoading === req.id}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Outgoing Requests */}
          {outgoingRequests.length > 0 && (
            <div className={`glass-card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>📤 Permintaan Terkirim</h2>
              {outgoingRequests.map((req) => (
                <div key={req.id} className={styles.userCard}>
                  <div className={styles.userAvatar}>
                    {req.toPhoto ? (
                      <img src={req.toPhoto} alt="" />
                    ) : (
                      <span>{(req.toName || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{req.toName}</span>
                    <span className={styles.userUsername}>@{req.toUsername}</span>
                  </div>
                  <span className={styles.pendingLabel}>Menunggu...</span>
                </div>
              ))}
            </div>
          )}

          {/* Friend List */}
          <div className={`glass-card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>
              💚 Daftar Teman
              {friends.length > 0 && <span className={styles.badge}>{friends.length}</span>}
            </h2>
            {friends.length === 0 ? (
              <p className={styles.emptyText}>Belum ada teman. Cari username teman di atas!</p>
            ) : (
              friends.map((friend) => (
                <div key={friend.uid} className={styles.userCard}>
                  <div className={styles.userAvatar}>
                    {friend.photoURL ? (
                      <img src={friend.photoURL} alt="" />
                    ) : (
                      <span>{(friend.displayName || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{friend.displayName}</span>
                    <span className={styles.userUsername}>@{friend.username}</span>
                  </div>
                  <div className={styles.friendActions}>
                    <button className="btn btn-primary btn-sm" onClick={() => openChat(friend.uid)}>
                      💬
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRemove(friend.uid)}
                      disabled={actionLoading === friend.uid}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
