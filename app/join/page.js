'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, doc, updateDoc,
  arrayUnion, increment,
} from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from '../login/auth.module.css';

export default function JoinPage() {
  return (
    <ProtectedRoute>
      <JoinContent />
    </ProtectedRoute>
  );
}

function JoinContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Cari organisasi dengan invite code
      const orgQuery = query(
        collection(db, 'organizations'),
        where('inviteCode', '==', code.toUpperCase().trim())
      );
      const orgSnap = await getDocs(orgQuery);

      if (orgSnap.empty) {
        setError('Kode undangan tidak ditemukan');
        setLoading(false);
        return;
      }

      const orgDoc = orgSnap.docs[0];
      const orgData = orgDoc.data();

      // Cek apakah sudah menjadi member
      if (orgData.members.includes(user.uid)) {
        setError('Anda sudah menjadi anggota organisasi ini');
        setLoading(false);
        return;
      }

      // Tambahkan user ke organisasi
      await updateDoc(doc(db, 'organizations', orgDoc.id), {
        members: arrayUnion(user.uid),
        memberCount: increment(1),
      });

      // Tambahkan org ke list user
      await updateDoc(doc(db, 'users', user.uid), {
        organizations: arrayUnion(orgDoc.id),
      });

      router.push(`/org/${orgDoc.id}`);
    } catch (err) {
      setError('Gagal bergabung: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <>
      <div className={styles.authPage} style={{ paddingTop: 'var(--navbar-height)' }}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <span className={styles.authIcon}>🔗</span>
            <h1 className={styles.authTitle}>Gabung Organisasi</h1>
            <p className={styles.authSubtitle}>Masukkan kode undangan untuk bergabung</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleJoin} className={styles.authForm}>
            <div className="input-group">
              <label className="input-label">Kode Undangan</label>
              <input
                type="text"
                className="input-field"
                placeholder="Contoh: ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '24px', fontWeight: '800', letterSpacing: '8px' }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || code.length < 6}>
              {loading ? 'Memproses...' : '🤝 Gabung'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
