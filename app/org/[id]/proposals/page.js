'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { checkExpiredProposals } from '@/lib/voting-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProposalCard from '@/components/ProposalCard';
import styles from './proposals.module.css';

export default function ProposalsPage() {
  return (
    <ProtectedRoute>
      <ProposalsContent />
    </ProtectedRoute>
  );
}

function ProposalsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id;

  const [proposals, setProposals] = useState([]);
  const [org, setOrg] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    getDoc(doc(db, 'organizations', orgId)).then((snap) => {
      if (snap.exists()) setOrg({ id: snap.id, ...snap.data() });
    });

    checkExpiredProposals(orgId);

    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'proposals'), orderBy('createdAt', 'desc')),
      (snap) => {
        setProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orgId]);

  const filtered = filter === 'all' ? proposals : proposals.filter((p) => p.status === filter);

  const filters = [
    { key: 'all', label: 'Semua', count: proposals.length },
    { key: 'voting', label: 'Voting', count: proposals.filter((p) => p.status === 'voting').length },
    { key: 'approved', label: 'Disetujui', count: proposals.filter((p) => p.status === 'approved').length },
    { key: 'rejected', label: 'Ditolak', count: proposals.filter((p) => p.status === 'rejected').length },
    { key: 'expired', label: 'Expired', count: proposals.filter((p) => p.status === 'expired').length },
  ];

  return (
    <>
      <div className="page-container">
        <button className={styles.backBtn} onClick={() => router.push(`/org/${orgId}`)}>
          ← Kembali
        </button>

        <div className={styles.headerRow}>
          <div>
            <h1 className="page-title">Proposal</h1>
            <p className="page-subtitle">Semua proposal transaksi untuk {org?.name || 'organisasi'}</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push(`/org/${orgId}/proposals/new`)}>
            ➕ Buat Proposal
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={styles.filterCount}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">Tidak Ada Proposal</h3>
            <p className="empty-state-text">
              {filter === 'all'
                ? 'Belum ada proposal. Buat proposal pertama!'
                : `Tidak ada proposal dengan status "${filter}"`}
            </p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                memberCount={org?.memberCount || 1}
                onClick={() => router.push(`/org/${orgId}/proposals/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
