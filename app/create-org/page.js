'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { createGenesisBlock } from '@/lib/hash-chain';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from '../login/auth.module.css';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CreateOrgPage() {
  return (
    <ProtectedRoute>
      <CreateOrgContent />
    </ProtectedRoute>
  );
}

function CreateOrgContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const inviteCode = generateInviteCode();

      // Buat organisasi baru
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name,
        description,
        inviteCode,
        balance: 0,
        members: [user.uid],
        memberCount: 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Tambahkan org ke list user
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        organizations: arrayUnion(orgRef.id),
      });

      // Buat Genesis Block
      await createGenesisBlock(orgRef.id);

      router.push(`/org/${orgRef.id}`);
    } catch (err) {
      setError('Gagal membuat organisasi: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <>
      <div className={styles.authPage} style={{ paddingTop: 'var(--navbar-height)' }}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <span className={styles.authIcon}>🏢</span>
            <h1 className={styles.authTitle}>Buat Organisasi</h1>
            <p className={styles.authSubtitle}>Buat organisasi baru dan mulai kelola kas bersama</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleCreate} className={styles.authForm}>
            <div className="input-group">
              <label className="input-label">Nama Organisasi</label>
              <input
                type="text"
                className="input-field"
                placeholder="contoh: Kas RT 05"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Deskripsi</label>
              <textarea
                className="input-field"
                placeholder="Deskripsi singkat tentang organisasi ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Membuat...' : '🏦 Buat Organisasi'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
