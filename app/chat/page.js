'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, collection, query, where,
  orderBy, limit, onSnapshot, getDocs,
} from 'firebase/firestore';
import { getFriends, getChatId } from '@/lib/friend-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './chat.module.css';

export default function ChatHubPage() {
  return (
    <ProtectedRoute>
      <ChatHubContent />
    </ProtectedRoute>
  );
}

function ChatHubContent() {
  const { user } = useAuth();
  const router = useRouter();

  const [orgChats, setOrgChats] = useState([]);
  const [dmChats, setDmChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all'); // 'all', 'org', 'dm'

  useEffect(() => {
    if (!user) return;
    loadChats();
  }, [user]);

  const loadChats = async () => {
    setLoading(true);

    // Load org chats
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data() || {};
    const orgIds = userData.organizations || [];

    const orgs = [];
    for (const orgId of orgIds) {
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      if (!orgDoc.exists()) continue;
      const orgData = orgDoc.data();

      // Get last message
      const msgQ = query(
        collection(db, 'organizations', orgId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const msgSnap = await getDocs(msgQ);
      const lastMsg = msgSnap.docs[0]?.data() || null;

      orgs.push({
        id: orgId,
        name: orgData.name,
        memberCount: orgData.members?.length || 0,
        lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? '📷 Gambar' : null),
        lastMessageTime: lastMsg?.createdAt?.toDate() || null,
        lastSender: lastMsg?.senderName || null,
        type: 'org',
      });
    }
    setOrgChats(orgs);

    // Load DM chats
    const friends = await getFriends(user.uid);
    const dms = [];
    for (const friend of friends) {
      const chatId = getChatId(user.uid, friend.uid);
      const msgQ = query(
        collection(db, 'directMessages', chatId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const msgSnap = await getDocs(msgQ);
      const lastMsg = msgSnap.docs[0]?.data() || null;

      dms.push({
        id: chatId,
        friendUid: friend.uid,
        name: friend.displayName,
        username: friend.username,
        photoURL: friend.photoURL,
        lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? '📷 Gambar' : null),
        lastMessageTime: lastMsg?.createdAt?.toDate() || null,
        lastSender: lastMsg?.senderName || null,
        type: 'dm',
      });
    }
    setDmChats(dms);
    setLoading(false);
  };

  const allChats = [...orgChats, ...dmChats].sort((a, b) => {
    const tA = a.lastMessageTime?.getTime() || 0;
    const tB = b.lastMessageTime?.getTime() || 0;
    return tB - tA;
  });

  const filteredChats = tab === 'all' ? allChats
    : tab === 'org' ? orgChats.sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0))
    : dmChats.sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const openChat = (chat) => {
    if (chat.type === 'org') {
      router.push(`/org/${chat.id}/chat`);
    } else {
      router.push(`/chat/${chat.id}?friendUid=${chat.friendUid}`);
    }
  };

  return (
    <>
      <div className="page-container">
        <div className={styles.chatHubWrapper}>
          <div className={styles.hubHeader}>
            <h1 className={styles.pageTitle}>💬 Obrolan</h1>
            <button className={styles.friendsBtn} onClick={() => router.push('/friends')}>
              👥 Teman
            </button>
          </div>

          {/* Filter Tabs */}
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${tab === 'all' ? styles.filterActive : ''}`}
              onClick={() => setTab('all')}
            >
              Semua
            </button>
            <button
              className={`${styles.filterTab} ${tab === 'org' ? styles.filterActive : ''}`}
              onClick={() => setTab('org')}
            >
              🏦 Organisasi
            </button>
            <button
              className={`${styles.filterTab} ${tab === 'dm' ? styles.filterActive : ''}`}
              onClick={() => setTab('dm')}
            >
              👤 Pribadi
            </button>
          </div>

          {/* Chat List */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div className="loading-spinner" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <p>{tab === 'dm' ? 'Belum ada chat pribadi' : tab === 'org' ? 'Belum ada organisasi' : 'Belum ada obrolan'}</p>
              {tab !== 'org' && (
                <button className="btn btn-primary btn-sm" onClick={() => router.push('/friends')}>
                  Cari Teman
                </button>
              )}
            </div>
          ) : (
            <div className={styles.chatList}>
              {filteredChats.map((chat) => (
                <div
                  key={`${chat.type}-${chat.id}`}
                  className={styles.chatItem}
                  onClick={() => openChat(chat)}
                >
                  <div className={styles.chatAvatar}>
                    {chat.type === 'org' ? (
                      <span className={styles.orgIcon}>🏦</span>
                    ) : chat.photoURL ? (
                      <img src={chat.photoURL} alt="" />
                    ) : (
                      <span>{(chat.name || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.chatInfo}>
                    <div className={styles.chatTop}>
                      <span className={styles.chatName}>{chat.name}</span>
                      {chat.lastMessageTime && (
                        <span className={styles.chatTime}>{formatTime(chat.lastMessageTime)}</span>
                      )}
                    </div>
                    <div className={styles.chatPreview}>
                      {chat.lastMessage ? (
                        <span>
                          {chat.lastSender && chat.type === 'org' ? `${chat.lastSender.split(' ')[0]}: ` : ''}
                          {chat.lastMessage}
                        </span>
                      ) : (
                        <span className={styles.noMsg}>Belum ada pesan</span>
                      )}
                    </div>
                  </div>
                  <span className={styles.chatTypeTag}>
                    {chat.type === 'org' ? '🏦' : '👤'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
