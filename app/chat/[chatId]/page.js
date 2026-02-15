'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChatPanel from '@/components/ChatPanel';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './dm.module.css';

export default function DMChatPage() {
  return (
    <ProtectedRoute>
      <DMChatContent />
    </ProtectedRoute>
  );
}

function DMChatContent() {
  const { chatId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [friendName, setFriendName] = useState('Memuat...');
  const [friendPhoto, setFriendPhoto] = useState(null);

  useEffect(() => {
    const friendUid = searchParams.get('friendUid');
    if (friendUid) {
      getDoc(doc(db, 'users', friendUid)).then((snap) => {
        const data = snap.data();
        if (data) {
          setFriendName(data.displayName || 'User');
          setFriendPhoto(data.photoURL || null);
        }
      });
    }
  }, [searchParams]);

  return (
    <div className={styles.dmPage}>
      <div className={styles.dmHeader}>
        <button className={styles.backBtn} onClick={() => router.push('/chat')}>
          ←
        </button>
        <div className={styles.headerAvatar}>
          {friendPhoto ? (
            <img src={friendPhoto} alt="" />
          ) : (
            <span>{(friendName || '?')[0].toUpperCase()}</span>
          )}
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{friendName}</span>
          <span className={styles.headerStatus}>Chat Pribadi</span>
        </div>
      </div>
      <div className={styles.dmBody}>
        <ChatPanel chatId={chatId} user={user} chatType="dm" />
      </div>
    </div>
  );
}
