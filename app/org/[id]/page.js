'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, collection, query, where,
  getDocs, orderBy, limit, onSnapshot,
  updateDoc, arrayRemove, increment,
} from 'firebase/firestore';
import { checkExpiredProposals } from '@/lib/voting-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProposalCard from '@/components/ProposalCard';
import TransactionHistory from '@/components/TransactionHistory';
import PaymentModal from '@/components/PaymentModal';
import { getChatId } from '@/lib/friend-service';
import styles from './org.module.css';

export default function OrgPage() {
  return (
    <ProtectedRoute>
      <OrgContent />
    </ProtectedRoute>
  );
}

function OrgContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id;

  const [org, setOrg] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!orgId || !user) return;

    // Realtime listener untuk organisasi
    const orgUnsub = onSnapshot(doc(db, 'organizations', orgId), (snap) => {
      if (snap.exists()) {
        setOrg({ id: snap.id, ...snap.data() });
      }
    });

    // Realtime listener untuk proposals
    const proposalsUnsub = onSnapshot(
      query(
        collection(db, 'organizations', orgId, 'proposals'),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    // Fetch transactions (hash chain)
    const fetchTx = async () => {
      const txQuery = query(
        collection(db, 'organizations', orgId, 'transactions'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const txSnap = await getDocs(txQuery);
      setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    // Fetch members
    const fetchMembers = async () => {
      const orgSnap = await getDoc(doc(db, 'organizations', orgId));
      if (orgSnap.exists()) {
        const memberIds = orgSnap.data().members || [];
        const memberData = [];
        for (const uid of memberIds) {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            memberData.push({ uid, ...userSnap.data() });
          }
        }
        setMembers(memberData);
      }
    };

    // Check expired proposals
    checkExpiredProposals(orgId);

    Promise.all([fetchTx(), fetchMembers()]).then(() => setLoading(false));

    return () => {
      orgUnsub();
      proposalsUnsub();
    };
  }, [orgId, user]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(org?.inviteCode || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const activeProposals = proposals.filter((p) => p.status === 'voting');
  const recentProposals = proposals.slice(0, 5);

  if (loading || !org) {
    return (
      <>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '200px' }}>
          <div className="loading-spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{org.name}</h1>
          <p className="page-subtitle">{org.description || 'Organisasi'}</p>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={`glass-card stat-card ${styles.balanceCard}`}>
            <span className="stat-label">💰 Saldo Kas</span>
            <span className={`stat-value ${(org.balance || 0) >= 0 ? 'positive' : 'negative'}`}>
              Rp {(org.balance || 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="glass-card stat-card">
            <span className="stat-label">👥 Anggota</span>
            <span className="stat-value">{org.memberCount || 0}</span>
          </div>
          <div className="glass-card stat-card">
            <span className="stat-label">🗳️ Voting Aktif</span>
            <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>{activeProposals.length}</span>
          </div>
          <div className="glass-card stat-card">
            <span className="stat-label">🔗 Blok Chain</span>
            <span className="stat-value">{transactions.length}+</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: 'var(--gradient-green)', fontWeight: 700 }}
            onClick={() => setShowPayment(true)}
          >
            💳 Bayar Iuran
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => router.push(`/org/${orgId}/proposals/new`)}
          >
            ➕ Proposal
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: 'var(--gradient-blue)' }}
            onClick={() => router.push(`/org/${orgId}/chat`)}
          >
            💬 Chat
          </button>
        </div>

        {/* Invite Code */}
        <div className={`glass-card ${styles.inviteCard}`}>
          <div className={styles.inviteLeft}>
            <span className={styles.inviteLabel}>Kode Undangan</span>
            <code className={styles.inviteCode}>{org.inviteCode}</code>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={copyInviteCode}>
            {copiedCode ? '✅ Tersalin!' : '📋 Salin'}
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {['overview', 'proposals', 'history', 'members'].map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '📊 Ringkasan'}
              {tab === 'proposals' && '🗳️ Proposal'}
              {tab === 'history' && '📜 Riwayat'}
              {tab === 'members' && '👥 Anggota'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Proposal Aktif</h2>
              <button className="btn btn-primary btn-sm" onClick={() => router.push(`/org/${orgId}/proposals/new`)}>
                ➕ Buat Proposal
              </button>
            </div>
            {activeProposals.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px' }}>
                <p className="empty-state-text">Tidak ada proposal voting aktif saat ini</p>
              </div>
            ) : (
              <div className={styles.proposalList}>
                {activeProposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    memberCount={org.memberCount}
                    onClick={() => router.push(`/org/${orgId}/proposals/${p.id}`)}
                  />
                ))}
              </div>
            )}

            <div className={styles.quickLinks}>
              <button className="btn btn-ghost" onClick={() => router.push(`/org/${orgId}/proposals`)}>
                📋 Semua Proposal
              </button>
              <button className="btn btn-ghost" onClick={() => router.push(`/org/${orgId}/verify`)}>
                🔗 Verifikasi Chain
              </button>
            </div>
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Semua Proposal</h2>
              <button className="btn btn-primary btn-sm" onClick={() => router.push(`/org/${orgId}/proposals/new`)}>
                ➕ Buat Proposal
              </button>
            </div>
            {proposals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3 className="empty-state-title">Belum Ada Proposal</h3>
                <p className="empty-state-text">Buat proposal pertama untuk mulai mengelola kas</p>
              </div>
            ) : (
              <div className={styles.proposalList}>
                {proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    memberCount={org.memberCount}
                    onClick={() => router.push(`/org/${orgId}/proposals/${p.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Anggota ({members.length})</h2>
            <p className={styles.equalRights}>
              ⚖️ Semua anggota memiliki hak yang setara — tidak ada admin atau perbedaan otoritas
            </p>
            <div className={styles.memberList}>
              {members.map((m) => (
                <div key={m.uid} className={`glass-card ${styles.memberCard}`}>
                  <div className={styles.memberAvatar}>
                    {m.photoURL ? (
                      <img src={m.photoURL} alt="" />
                    ) : (
                      <span>{(m.displayName || m.email || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{m.displayName || 'User'}</span>
                    <span className={styles.memberEmail}>{m.email}</span>
                  </div>
                  {m.uid === user?.uid ? (
                    <span className="badge badge-voting">Anda</span>
                  ) : (
                    <button
                      className={styles.chatMemberBtn}
                      onClick={() => {
                        const chatId = getChatId(user.uid, m.uid);
                        router.push(`/chat/${chatId}?friendUid=${m.uid}`);
                      }}
                    >
                      💬
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Leave Organization */}
            <div className={`glass-card ${styles.leaveSection}`}>
              {!leaveConfirm ? (
                <button
                  className={`btn ${styles.leaveBtn}`}
                  onClick={() => setLeaveConfirm(true)}
                >
                  🚪 Keluar dari Organisasi
                </button>
              ) : (
                <div className={styles.leaveConfirm}>
                  <p className={styles.leaveWarning}>
                    ⚠️ Yakin ingin keluar? Anda harus menggunakan kode undangan untuk bergabung kembali.
                  </p>
                  <div className={styles.leaveActions}>
                    <button
                      className={`btn ${styles.leaveBtnDanger}`}
                      disabled={leaveLoading}
                      onClick={async () => {
                        setLeaveLoading(true);
                        try {
                          await updateDoc(doc(db, 'organizations', orgId), {
                            members: arrayRemove(user.uid),
                            memberCount: increment(-1),
                          });
                          await updateDoc(doc(db, 'users', user.uid), {
                            organizations: arrayRemove(orgId),
                          });
                          router.push('/dashboard');
                        } catch (err) {
                          alert('Gagal keluar: ' + err.message);
                          setLeaveLoading(false);
                        }
                      }}
                    >
                      {leaveLoading ? 'Memproses...' : '✅ Ya, Keluar'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setLeaveConfirm(false)}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className={styles.tabContent}>
            <TransactionHistory orgId={orgId} />
          </div>
        )}

      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          orgId={orgId}
          orgName={org.name}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
