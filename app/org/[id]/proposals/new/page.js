'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { BANK_LIST } from '@/lib/payout-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './new-proposal.module.css';

export default function NewProposalPage() {
  return (
    <ProtectedRoute>
      <NewProposalContent />
    </ProtectedRoute>
  );
}

function NewProposalContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id;

  const [type, setType] = useState('expense');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [duration, setDuration] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify user is member
      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists() || !orgSnap.data().members.includes(user.uid)) {
        setError('Anda bukan anggota organisasi ini');
        setLoading(false);
        return;
      }

      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + duration * 60 * 60 * 1000)
      );

      const proposalData = {
        title,
        description,
        type,
        amount: type !== 'delete_org' ? amount : '0',
        amountRaw: type !== 'delete_org' ? Number(amount) : 0,
        recipientName: type === 'transfer' ? recipientName : null,
        recipientBank: type === 'transfer' ? recipientBank : null,
        recipientAccount: type === 'transfer' ? recipientAccount : null,
        proposedBy: user.uid,
        proposerName: user.displayName || 'User',
        status: 'voting',
        votesFor: 0,
        votesAgainst: 0,
        voters: {},
        expiresAt,
        createdAt: serverTimestamp(),
        executedAt: null,
      };

      await addDoc(
        collection(db, 'organizations', orgId, 'proposals'),
        proposalData
      );

      router.push(`/org/${orgId}`);
    } catch (err) {
      setError('Gagal membuat proposal: ' + err.message);
    }

    setLoading(false);
  };

  const typeOptions = [
    { value: 'income', label: '📥 Pemasukan', desc: 'Dana masuk ke kas' },
    { value: 'expense', label: '📤 Pengeluaran', desc: 'Dana keluar dari kas' },
    { value: 'transfer', label: '↗️ Transfer', desc: 'Transfer ke bank/e-wallet' },
    { value: 'delete_org', label: '🗑️ Hapus Organisasi', desc: 'Hapus organisasi (butuh vote)' },
  ];

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <button className={styles.backBtn} onClick={() => router.push(`/org/${orgId}`)}>
            ← Kembali
          </button>
          <h1 className="page-title">Buat Proposal Baru</h1>
          <p className="page-subtitle">Ajukan transaksi untuk disetujui oleh anggota</p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(255,69,58,0.1)',
            border: '1px solid rgba(255,69,58,0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-red)',
            fontSize: '14px',
            marginBottom: '16px',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Type Selection */}
          <div className={styles.typeGrid}>
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`glass-card ${styles.typeCard} ${type === opt.value ? styles.typeActive : ''}`}
                onClick={() => setType(opt.value)}
              >
                <span className={styles.typeIcon}>{opt.label.split(' ')[0]}</span>
                <span className={styles.typeLabel}>{opt.label.split(' ').slice(1).join(' ')}</span>
                <span className={styles.typeDesc}>{opt.desc}</span>
              </button>
            ))}
          </div>

          <div className="input-group">
            <label className="input-label">Judul Proposal</label>
            <input
              type="text"
              className="input-field"
              placeholder={type === 'delete_org' ? 'Alasan penghapusan organisasi' : 'contoh: Beli alat tulis rapat'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Deskripsi</label>
            <textarea
              className="input-field"
              placeholder="Jelaskan detail proposal ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {type !== 'delete_org' && (
            <div className="input-group">
              <label className="input-label">Nominal (Rp)</label>
              <input
                type="number"
                className="input-field"
                placeholder="100000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                required
              />
              {amount && (
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  = Rp {Number(amount).toLocaleString('id-ID')}
                </span>
              )}
            </div>
          )}

          {type === 'transfer' && (
            <>
              <div className="input-group">
                <label className="input-label">Bank / E-Wallet Tujuan</label>
                <select
                  className="input-field"
                  value={recipientBank}
                  onChange={(e) => setRecipientBank(e.target.value)}
                  required
                >
                  <option value="">Pilih Bank / E-Wallet</option>
                  {BANK_LIST.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Nomor Rekening / Akun</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="1234567890"
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Nama Penerima</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nama sesuai rekening"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label className="input-label">Durasi Voting (Jam)</label>
            <select
              className="input-field"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={1}>1 Jam</option>
              <option value={6}>6 Jam</option>
              <option value={12}>12 Jam</option>
              <option value={24}>24 Jam</option>
              <option value={48}>48 Jam</option>
              <option value={72}>72 Jam (3 Hari)</option>
              <option value={168}>168 Jam (1 Minggu)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Memproses...' : '🗳️ Ajukan Proposal'}
          </button>
        </form>
      </div>
    </>
  );
}
