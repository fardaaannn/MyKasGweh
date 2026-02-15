'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChatPanel from '@/components/ChatPanel';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './chat.module.css';

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}

function ChatContent() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id;
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const fetchOrg = async () => {
      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        setOrgName(orgSnap.data().name);
      }
      setLoading(false);
    };
    fetchOrg();
  }, [orgId]);

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPage}>
      <div className={styles.chatHeader}>
        <button className={styles.backBtn} onClick={() => router.push(`/org/${orgId}`)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.headerInfo}>
          <h1 className={styles.headerTitle}>{orgName || 'Obrolan'}</h1>
          <span className={styles.headerSubtitle}>💬 Group Chat</span>
        </div>
      </div>
      <div className={styles.chatBody}>
        <ChatPanel orgId={orgId} user={user} />
      </div>
    </div>
  );
}
