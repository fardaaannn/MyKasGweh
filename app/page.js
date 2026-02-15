'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import styles from './page.module.css';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Transparan & Demokratis
          </div>
          <h1 className={styles.heroTitle}>
            Kelola Kas Bersama<br />
            <span className={styles.heroGradient}>Tanpa Otoritas Tunggal</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Sistem treasury management mirip DAO untuk organisasi. 
            Setiap transaksi harus disetujui melalui voting, dilindungi hash chain, 
            dan dienkripsi AES-256.
          </p>
          <div className={styles.heroCta}>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/register')}>
              Mulai Sekarang →
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => router.push('/login')}>
              Sudah Punya Akun
            </button>
          </div>
        </div>

        {/* Floating Elements */}
        <div className={styles.floatingElements}>
          <div className={`${styles.floatCard} ${styles.float1}`}>
            <span>🗳️</span>
            <div>
              <strong>Voting</strong>
              <small>Mayoritas &gt;50%</small>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.float2}`}>
            <span>🔗</span>
            <div>
              <strong>Hash Chain</strong>
              <small>SHA-256</small>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.float3}`}>
            <span>🔐</span>
            <div>
              <strong>Enkripsi</strong>
              <small>AES-256</small>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Fitur Utama</h2>
        <div className={styles.featureGrid}>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🗳️</div>
            <h3>Voting Demokratis</h3>
            <p>Setiap transaksi membutuhkan persetujuan &gt;50% anggota. Tidak ada satu pun yang bisa memindahkan uang sendirian.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🔗</div>
            <h3>Hash Chain</h3>
            <p>Setiap transaksi memiliki hash unik yang terhubung ke transaksi sebelumnya. Manipulasi data langsung terdeteksi.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🔐</div>
            <h3>Enkripsi AES-256</h3>
            <p>Data sensitif seperti nominal dan rekening bank dienkripsi dengan standar militer. Zero Trust Architecture.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>💸</div>
            <h3>Transfer Otomatis</h3>
            <p>Setelah voting disetujui, transfer ke bank atau e-wallet manapun dieksekusi secara otomatis via Midtrans.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>👥</div>
            <h3>Hak Setara</h3>
            <p>Tidak ada admin. Semua anggota memiliki hak yang sama untuk mengajukan dan menyetujui transaksi.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🛡️</div>
            <h3>Zero Trust</h3>
            <p>Setiap aksi diverifikasi. Tidak ada yang dipercaya secara default — bahkan anggota yang sudah login.</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>Bagaimana Cara Kerjanya?</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <h3>Buat Organisasi</h3>
            <p>Buat organisasi dan undang anggota dengan kode undangan unik.</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <h3>Ajukan Proposal</h3>
            <p>Siapa saja bisa mengajukan transaksi — pemasukan, pengeluaran, atau transfer.</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <h3>Vote &amp; Eksekusi</h3>
            <p>Jika &gt;50% setuju, transaksi otomatis dieksekusi dan tercatat di hash chain.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerBrand}>🏦 My Kas Gweh</span>
          <span className={styles.footerText}>Lightweight DAO for Fiat Treasury</span>
        </div>
      </footer>
    </div>
  );
}
