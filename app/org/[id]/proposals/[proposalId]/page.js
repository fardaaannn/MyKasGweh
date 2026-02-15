'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { castVote } from '@/lib/voting-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './proposal-detail.module.css';

export default function ProposalDetailPage() {
  return (
    <ProtectedRoute>
      <ProposalDetailContent />
    </ProtectedRoute>
  );
}

function ProposalDetailContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { id: orgId, proposalId } = params;

  const [proposal, setProposal] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voteMessage, setVoteMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  // Bukti Transfer state
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofLightbox, setProofLightbox] = useState(false);

  useEffect(() => {
    if (!orgId || !proposalId) return;

    // Fetch org data
    getDoc(doc(db, 'organizations', orgId)).then((snap) => {
      if (snap.exists()) setOrg({ id: snap.id, ...snap.data() });
    });

    // Realtime listener for proposal
    const unsub = onSnapshot(
      doc(db, 'organizations', orgId, 'proposals', proposalId),
      (snap) => {
        if (snap.exists()) {
          setProposal({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orgId, proposalId]);

  // Countdown timer
  useEffect(() => {
    if (!proposal || proposal.status !== 'voting' || !proposal.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expires = proposal.expiresAt.toDate ? proposal.expiresAt.toDate() : new Date(proposal.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Waktu habis');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}j ${minutes}m ${seconds}d`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [proposal]);

  const handleVote = async (vote) => {
    setVoting(true);
    setVoteMessage('');

    const result = await castVote(orgId, proposalId, user.uid, vote);
    setVoteMessage(result.message);

    setVoting(false);
  };

  // Upload bukti transfer
  const handleUploadProof = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar yang didukung');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setUploadingProof(true);
    try {
      const storageRef = ref(storage, `proofs/${orgId}/${proposalId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateDoc(
        doc(db, 'organizations', orgId, 'proposals', proposalId),
        {
          proofImageUrl: url,
          proofUploadedBy: user.uid,
          proofUploadedByName: user.displayName || 'User',
          proofUploadedAt: new Date().toISOString(),
        }
      );
    } catch (err) {
      alert('Gagal upload bukti: ' + err.message);
    }
    setUploadingProof(false);
  };

  if (loading || !proposal || !org) {
    return (
      <>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '200px' }}>
          <div className="loading-spinner" />
        </div>
      </>
    );
  }

  const memberCount = org.memberCount || 1;
  const majority = Math.floor(memberCount / 2) + 1;
  const progressFor = (proposal.votesFor / memberCount) * 100;
  const progressAgainst = (proposal.votesAgainst / memberCount) * 100;
  const hasVoted = proposal.voters && proposal.voters[user?.uid];
  const userVote = proposal.voters?.[user?.uid];

  const statusConfig = {
    voting: { label: '🗳️ Voting Aktif', color: 'var(--accent-blue)' },
    approved: { label: '✅ Disetujui', color: 'var(--accent-green)' },
    rejected: { label: '❌ Ditolak', color: 'var(--accent-red)' },
    expired: { label: '⏰ Expired', color: 'var(--text-tertiary)' },
    executed: { label: '⚡ Dieksekusi', color: 'var(--accent-purple)' },
  };

  const status = statusConfig[proposal.status] || statusConfig.voting;

  return (
    <>
      <div className="page-container">
        <button className={styles.backBtn} onClick={() => router.push(`/org/${orgId}`)}>
          ← Kembali
        </button>

        <div className={`glass-card ${styles.detailCard}`}>
          {/* Header */}
          <div className={styles.header}>
            <div>
              <span className={`badge ${proposal.type === 'income' ? 'badge-income' : proposal.type === 'transfer' ? 'badge-transfer' : 'badge-expense'}`}>
                {proposal.type === 'income' ? '📥 Pemasukan' : proposal.type === 'transfer' ? '↗️ Transfer' : proposal.type === 'delete_org' ? '🗑️ Hapus Organisasi' : '📤 Pengeluaran'}
              </span>
              <h1 className={styles.title}>{proposal.title}</h1>
              <p className={styles.proposer}>Diajukan oleh <strong>{proposal.proposerName}</strong></p>
            </div>
            <div className={styles.statusBadge} style={{ color: status.color }}>
              {status.label}
            </div>
          </div>

          {/* Description */}
          {proposal.description && (
            <div className={styles.section}>
              <h3 className={styles.sectionLabel}>Deskripsi</h3>
              <p className={styles.descText}>{proposal.description}</p>
            </div>
          )}

          {/* Amount */}
          {proposal.type !== 'delete_org' && (
            <div className={styles.amountDisplay}>
              <span className={styles.amountLabel}>Nominal</span>
              <span className={styles.amountValue}>
                Rp {Number(proposal.amountRaw || 0).toLocaleString('id-ID')}
              </span>
            </div>
          )}

          {/* Transfer Details */}
          {proposal.type === 'transfer' && proposal.recipientBank && (
            <div className={styles.transferDetails}>
              <h3 className={styles.sectionLabel}>Detail Transfer</h3>
              <div className={styles.detailRow}>
                <span>Bank</span>
                <strong>{proposal.recipientBank?.toUpperCase()}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>No. Rekening</span>
                <strong>{proposal.recipientAccount}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>Nama Penerima</span>
                <strong>{proposal.recipientName}</strong>
              </div>
            </div>
          )}

          {/* Voting Progress */}
          <div className={styles.votingSection}>
            <h3 className={styles.sectionLabel}>Hasil Voting</h3>

            {proposal.status === 'voting' && (
              <div className={styles.timer}>
                ⏱️ Sisa waktu: <strong>{timeLeft}</strong>
              </div>
            )}

            <div className={styles.voteStats}>
              <div className={styles.voteStat}>
                <span className={styles.voteCount} style={{ color: 'var(--accent-green)' }}>
                  {proposal.votesFor}
                </span>
                <span className={styles.voteLabel}>Setuju</span>
              </div>
              <div className={styles.voteCenter}>
                <span className={styles.voteThreshold}>
                  Butuh {majority} dari {memberCount}
                </span>
                <div className="progress-bar">
                  <div className="progress-fill for" style={{ width: `${progressFor}%` }} />
                </div>
                <div className="progress-bar" style={{ marginTop: '4px' }}>
                  <div className="progress-fill against" style={{ width: `${progressAgainst}%` }} />
                </div>
              </div>
              <div className={styles.voteStat}>
                <span className={styles.voteCount} style={{ color: 'var(--accent-red)' }}>
                  {proposal.votesAgainst}
                </span>
                <span className={styles.voteLabel}>Tolak</span>
              </div>
            </div>

            {/* Vote Buttons */}
            {proposal.status === 'voting' && !hasVoted && (
              <div className={styles.voteActions}>
                <button
                  className="btn btn-success"
                  onClick={() => handleVote('for')}
                  disabled={voting}
                >
                  {voting ? '...' : '✅ Setuju'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleVote('against')}
                  disabled={voting}
                >
                  {voting ? '...' : '❌ Tolak'}
                </button>
              </div>
            )}

            {hasVoted && (
              <div className={styles.votedInfo}>
                Anda sudah memilih: <strong>{userVote === 'for' ? '✅ Setuju' : '❌ Tolak'}</strong>
              </div>
            )}

            {voteMessage && (
              <div className={styles.voteMessage}>{voteMessage}</div>
            )}
          </div>

          {/* Voter List */}
          {proposal.voters && Object.keys(proposal.voters).length > 0 && (
            <div className={styles.voterList}>
              <h3 className={styles.sectionLabel}>Daftar Voter</h3>
              {Object.entries(proposal.voters).map(([uid, vote]) => (
                <div key={uid} className={styles.voterRow}>
                  <span className={styles.voterName}>
                    {uid === user?.uid ? 'Anda' : uid.substring(0, 8) + '...'}
                  </span>
                  <span className={vote === 'for' ? styles.voteFor : styles.voteAgainst}>
                    {vote === 'for' ? '✅ Setuju' : '❌ Tolak'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bukti Transfer */}
          {proposal.type === 'transfer' && ['approved', 'executed'].includes(proposal.status) && (
            <div className={styles.proofSection}>
              <h3 className={styles.sectionLabel}>📷 Bukti Transfer</h3>
              {proposal.proofImageUrl ? (
                <div className={styles.proofDisplay}>
                  <img
                    src={proposal.proofImageUrl}
                    alt="Bukti Transfer"
                    className={styles.proofImage}
                    onClick={() => setProofLightbox(true)}
                  />
                  <span className={styles.proofMeta}>
                    Diunggah oleh {proposal.proofUploadedByName || 'User'}
                  </span>
                </div>
              ) : (
                <div className={styles.proofUpload}>
                  <p className={styles.proofDesc}>Unggah bukti transfer untuk dokumentasi</p>
                  <label className={styles.proofBtn}>
                    {uploadingProof ? (
                      <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Mengunggah...</>
                    ) : (
                      <>📷 Pilih Gambar</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadProof}
                      style={{ display: 'none' }}
                      disabled={uploadingProof}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Proof Lightbox */}
      {proofLightbox && proposal.proofImageUrl && (
        <div className={styles.lightbox} onClick={() => setProofLightbox(false)}>
          <img src={proposal.proofImageUrl} alt="Bukti Transfer" />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </>
  );
}
