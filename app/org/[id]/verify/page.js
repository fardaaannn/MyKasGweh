'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { verifyChain } from '@/lib/hash-chain';
import ProtectedRoute from '@/components/ProtectedRoute';
import BlockCard from '@/components/BlockCard';
import styles from './verify.module.css';

export default function VerifyPage() {
  return (
    <ProtectedRoute>
      <VerifyContent />
    </ProtectedRoute>
  );
}

function VerifyContent() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id;

  const [chain, setChain] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setResult(null);

    // Simulasi proses verifikasi (dramatic effect)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const verificationResult = await verifyChain(orgId);
    setResult(verificationResult);
    setChain(verificationResult.chain || []);
    setVerified(true);
    setLoading(false);
  };

  return (
    <>
      <div className="page-container">
        <button className={styles.backBtn} onClick={() => router.push(`/org/${orgId}`)}>
          ← Kembali
        </button>

        <div className="page-header">
          <h1 className="page-title">🔗 Verifikasi Hash Chain</h1>
          <p className="page-subtitle">
            Periksa integritas seluruh rantai transaksi. Jika ada data yang dimanipulasi, sistem akan langsung mendeteksinya.
          </p>
        </div>

        {/* Verify Button */}
        <div className={styles.verifySection}>
          <button
            className={`btn btn-primary btn-lg ${styles.verifyBtn}`}
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                Memverifikasi...
              </>
            ) : (
              '🔍 Verifikasi Integritas Chain'
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`${styles.resultCard} ${result.valid ? styles.resultValid : styles.resultInvalid}`}>
            <div className={styles.resultIcon}>
              {result.valid ? '✅' : '❌'}
            </div>
            <div className={styles.resultText}>
              <h2>{result.valid ? 'Chain Valid!' : 'Chain Tidak Valid!'}</h2>
              <p>{result.details}</p>
            </div>
          </div>
        )}

        {/* Chain Visualization */}
        {verified && chain.length > 0 && (
          <div className={styles.chainSection}>
            <h2 className={styles.chainTitle}>
              Rantai Blok ({chain.length} blok)
            </h2>
            <div className={styles.chainList}>
              {chain.map((block, index) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  index={index}
                  isValid={result?.invalidBlockIndex === null || index < result?.invalidBlockIndex}
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {verified && chain.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">Chain Kosong</h3>
            <p className="empty-state-text">Belum ada transaksi yang tercatat di hash chain</p>
          </div>
        )}
      </div>
    </>
  );
}
