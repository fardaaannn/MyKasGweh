'use client';
import { useState, useEffect } from 'react';
import styles from './ProposalCard.module.css';

export default function ProposalCard({ proposal, memberCount, onClick }) {
  const [timeLeft, setTimeLeft] = useState('');

  const majority = Math.floor(memberCount / 2) + 1;
  const progressFor = memberCount > 0 ? (proposal.votesFor / memberCount) * 100 : 0;
  const progressAgainst = memberCount > 0 ? (proposal.votesAgainst / memberCount) * 100 : 0;

  useEffect(() => {
    if (proposal.status !== 'voting' || !proposal.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expires = proposal.expiresAt.toDate ? proposal.expiresAt.toDate() : new Date(proposal.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}j ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}d`);
      } else {
        setTimeLeft(`${seconds}d`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [proposal.expiresAt, proposal.status]);

  const statusConfig = {
    voting: { label: 'Voting', className: 'badge-voting' },
    approved: { label: 'Disetujui', className: 'badge-approved' },
    rejected: { label: 'Ditolak', className: 'badge-rejected' },
    expired: { label: 'Expired', className: 'badge-expired' },
    executed: { label: 'Dieksekusi', className: 'badge-executed' },
  };

  const typeConfig = {
    transfer: { label: 'Transfer', className: 'badge-transfer', icon: '↗️' },
    expense: { label: 'Pengeluaran', className: 'badge-expense', icon: '📤' },
    income: { label: 'Pemasukan', className: 'badge-income', icon: '📥' },
    delete_org: { label: 'Hapus Organisasi', className: 'badge-expense', icon: '🗑️' },
  };

  const status = statusConfig[proposal.status] || statusConfig.voting;
  const type = typeConfig[proposal.type] || typeConfig.expense;

  return (
    <div className={`glass-card ${styles.card}`} onClick={onClick}>
      <div className={styles.cardHeader}>
        <div className={styles.badges}>
          <span className={`badge ${type.className}`}>{type.icon} {type.label}</span>
          <span className={`badge ${status.className}`}>{status.label}</span>
        </div>
        {proposal.status === 'voting' && timeLeft && (
          <span className={styles.timer}>⏱️ {timeLeft}</span>
        )}
      </div>

      <h3 className={styles.title}>{proposal.title}</h3>
      <p className={styles.description}>{proposal.description}</p>

      {proposal.type !== 'delete_org' && (
        <div className={styles.amount}>
          <span className={styles.amountLabel}>Nominal</span>
          <span className={styles.amountValue}>
            Rp {Number(proposal.amountRaw || 0).toLocaleString('id-ID')}
          </span>
        </div>
      )}

      <div className={styles.voteSection}>
        <div className={styles.voteInfo}>
          <span className={styles.voteFor}>✅ {proposal.votesFor} Setuju</span>
          <span className={styles.voteNeeded}>
            Butuh {majority} dari {memberCount}
          </span>
          <span className={styles.voteAgainst}>❌ {proposal.votesAgainst} Tolak</span>
        </div>
        <div className={styles.voteBar}>
          <div className={styles.voteBarFor} style={{ width: `${progressFor}%` }} />
          <div className={styles.voteBarAgainst} style={{ width: `${progressAgainst}%` }} />
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.proposer}>Oleh {proposal.proposerName}</span>
      </div>
    </div>
  );
}
