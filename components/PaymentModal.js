'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from './PaymentModal.module.css';

/**
 * PaymentModal — Modal untuk bayar iuran ke kas organisasi
 * Mendukung Midtrans Snap (dengan API key) atau Mock mode
 */
export default function PaymentModal({ orgId, orgName, onClose, onSuccess }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  // Quick amount buttons
  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  // Load Midtrans Snap.js if client key exists
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (clientKey) {
      const script = document.createElement('script');
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.async = true;
      document.head.appendChild(script);
      return () => document.head.removeChild(script);
    }
  }, []);

  const handlePayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1000) {
      setError('Minimal pembayaran Rp 1.000');
      return;
    }
    if (numAmount > 10000000) {
      setError('Maksimal pembayaran Rp 10.000.000');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create payment via API route
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          amount: numAmount,
          description: description || `Iuran ${orgName}`,
          userId: user.uid,
          userName: user.displayName || 'User',
          userEmail: user.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat pembayaran');
      }

      // 2. Handle based on mode
      if (data.mode === 'mock') {
        // Mock mode — langsung berhasil
        await handleMockPayment(data.orderId, numAmount);
      } else if (data.token && window.snap) {
        // Real Midtrans Snap
        window.snap.pay(data.token, {
          onSuccess: async (result) => {
            setPaymentResult(result);
            setSuccess(true);
            onSuccess?.();
          },
          onPending: (result) => {
            setPaymentResult(result);
            setSuccess(true);
          },
          onError: (result) => {
            setError('Pembayaran gagal');
            setPaymentResult(result);
          },
          onClose: () => {
            setLoading(false);
          },
        });
        return; // Don't setLoading(false) yet — Snap popup is open
      } else if (data.token) {
        // Snap.js not loaded but has token — use redirect
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank');
        }
        await handleMockPayment(data.orderId, numAmount);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  // Mock payment — update balance directly
  const handleMockPayment = async (orderId, numAmount) => {
    try {
      // Update org balance
      const orgRef = doc(db, 'organizations', orgId);
      await updateDoc(orgRef, { balance: increment(numAmount) });

      // Record in transactions (simplified — hash chain handled by webhook in real mode)
      // In mock mode we do it client-side for demo
      setSuccess(true);
      setPaymentResult({
        orderId,
        amount: numAmount,
        mode: 'mock',
        status: 'settlement',
      });
      onSuccess?.();
    } catch (err) {
      setError('Gagal memproses pembayaran: ' + err.message);
    }
  };

  const formatRupiah = (num) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  if (success) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.successState}>
            <span className={styles.successIcon}>✅</span>
            <h2 className={styles.successTitle}>Pembayaran Berhasil!</h2>
            <p className={styles.successAmount}>{formatRupiah(amount)}</p>
            <p className={styles.successDesc}>
              {paymentResult?.mode === 'mock' 
                ? '(Mode simulasi — hubungkan Midtrans untuk pembayaran real)'
                : `Order ID: ${paymentResult?.orderId || paymentResult?.order_id}`
              }
            </p>
            <button className="btn btn-primary" onClick={onClose}>Tutup</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>💳 Bayar Iuran</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.orgInfo}>
            <span className={styles.orgIcon}>🏦</span>
            <span className={styles.orgName}>{orgName}</span>
          </div>

          {error && (
            <div className={styles.error}>⚠️ {error}</div>
          )}

          {/* Amount Input */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>Jumlah Pembayaran</label>
            <div className={styles.amountInput}>
              <span className={styles.currency}>Rp</span>
              <input
                type="number"
                className={styles.input}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1000"
                max="10000000"
                disabled={loading}
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div className={styles.quickAmounts}>
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                className={`${styles.quickBtn} ${Number(amount) === qa ? styles.quickActive : ''}`}
                onClick={() => setAmount(qa.toString())}
                disabled={loading}
              >
                {qa >= 1000 ? `${qa / 1000}rb` : qa}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>Catatan (opsional)</label>
            <input
              type="text"
              className={styles.inputText}
              placeholder="Contoh: Iuran bulan Februari"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Payment Methods Info */}
          <div className={styles.methodsInfo}>
            <span className={styles.methodsLabel}>Metode pembayaran tersedia:</span>
            <div className={styles.methodsList}>
              <span>💳 Kartu</span>
              <span>🏧 VA Bank</span>
              <span>📱 QRIS</span>
              <span>💰 E-wallet</span>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.payBtn}
            onClick={handlePayment}
            disabled={loading || !amount}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span>Bayar {amount ? formatRupiah(amount) : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
