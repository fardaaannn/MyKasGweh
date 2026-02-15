'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from '../login/auth.module.css';
import verifyStyles from './verify-email.module.css';

function VerifyEmailContent() {
  const [countdown, setCountdown] = useState(60); // Mulai dengan cooldown 60 detik
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendPassword, setResendPassword] = useState('');
  const [showResendForm, setShowResendForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, resendVerification } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (email) setResendEmail(email);
  }, [email]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!resendEmail || !resendPassword) {
      setMessage('❌ Masukkan email dan password untuk kirim ulang');
      return;
    }

    setLoading(true);
    setMessage('');

    const result = await resendVerification(resendEmail, resendPassword);

    if (result.success) {
      if (result.alreadyVerified) {
        setMessage('✅ Email sudah terverifikasi! Silakan masuk.');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setMessage('✅ Email verifikasi berhasil dikirim ulang! Cek inbox dan folder spam.');
        setCountdown(60); // Reset cooldown
      }
    } else {
      setMessage('❌ Gagal: ' + (result.error === 'Firebase: Error (auth/invalid-credential).'
        ? 'Email atau password salah'
        : result.error));
    }

    setLoading(false);
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authGlow} />
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <span className={verifyStyles.emailIcon}>✉️</span>
          <h1 className={styles.authTitle}>Verifikasi Email</h1>
          <p className={styles.authSubtitle}>
            Kami sudah mengirim link verifikasi ke
          </p>
          {email && (
            <p className={verifyStyles.emailAddress}>{email}</p>
          )}
        </div>

        <div className={verifyStyles.instructions}>
          <div className={verifyStyles.step}>
            <span className={verifyStyles.stepNum}>1</span>
            <span>Buka email Anda <strong>(cek juga folder Spam/Junk)</strong></span>
          </div>
          <div className={verifyStyles.step}>
            <span className={verifyStyles.stepNum}>2</span>
            <span>Klik link verifikasi dari <strong>noreply@my-kas-gweh.firebaseapp.com</strong></span>
          </div>
          <div className={verifyStyles.step}>
            <span className={verifyStyles.stepNum}>3</span>
            <span>Kembali ke sini dan klik &quot;Masuk&quot;</span>
          </div>
        </div>

        <div className={verifyStyles.spamNote}>
          💡 <strong>Tidak menemukan email?</strong> Cek folder <strong>Spam</strong> atau <strong>Junk</strong>. Email dikirim dari <em>noreply@my-kas-gweh.firebaseapp.com</em>
        </div>

        {message && (
          <div className={message.includes('✅') ? verifyStyles.success : styles.error}>
            {message}
          </div>
        )}

        <div className={verifyStyles.actions}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => router.push('/login')}
          >
            Sudah Verifikasi? Masuk →
          </button>

          <div className={styles.divider}>
            <span>atau</span>
          </div>

          {!showResendForm ? (
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => {
                if (countdown <= 0) setShowResendForm(true);
              }}
              disabled={countdown > 0}
            >
              {countdown > 0
                ? `Kirim Ulang (tunggu ${countdown}s)`
                : 'Kirim Ulang Email Verifikasi'
              }
            </button>
          ) : (
            <div className={verifyStyles.resendForm}>
              <p className={verifyStyles.resendLabel}>
                Masukkan kredensial untuk kirim ulang:
              </p>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="email@contoh.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={resendPassword}
                  onChange={(e) => setResendPassword(e.target.value)}
                />
              </div>
              <button
                className="btn btn-ghost btn-lg"
                onClick={handleResend}
                disabled={loading || countdown > 0}
              >
                {loading
                  ? 'Mengirim...'
                  : countdown > 0
                    ? `Tunggu ${countdown}s`
                    : 'Kirim Ulang'
                }
              </button>
            </div>
          )}
        </div>

        <p className={styles.authSwitch}>
          Sudah punya akun? <a href="/login">Masuk</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
      }}>
        <div className="loading-spinner" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
