'use client';
import styles from './BlockCard.module.css';

export default function BlockCard({ block, index, isValid }) {
  const isGenesis = index === 0;

  return (
    <div className={styles.wrapper}>
      {index > 0 && (
        <div className={styles.connector}>
          <div className={styles.connectorLine} />
          <span className={styles.connectorArrow}>🔗</span>
          <div className={styles.connectorLine} />
        </div>
      )}
      <div className={`${styles.block} ${isGenesis ? styles.genesis : ''} ${isValid === false ? styles.invalid : ''}`}>
        <div className={styles.header}>
          <span className={styles.blockNum}>Block #{index}</span>
          <span className={`${styles.status} ${isValid === false ? styles.statusInvalid : styles.statusValid}`}>
            {isValid === false ? '❌ Invalid' : '✅ Valid'}
          </span>
        </div>

        <div className={styles.body}>
          {isGenesis ? (
            <div className={styles.genesisContent}>
              <span className={styles.genesisIcon}>🏛️</span>
              <span className={styles.genesisText}>Genesis Block</span>
            </div>
          ) : (
            <>
              <div className={styles.dataRow}>
                <span className={styles.label}>Tipe</span>
                <span className={`badge ${block.type === 'income' ? 'badge-income' : block.type === 'transfer' ? 'badge-transfer' : 'badge-expense'}`}>
                  {block.type === 'income' ? '📥 Pemasukan' : block.type === 'transfer' ? '↗️ Transfer' : '📤 Pengeluaran'}
                </span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.label}>Deskripsi</span>
                <span className={styles.value}>{block.description || '-'}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.hashSection}>
          <div className={styles.hashRow}>
            <span className={styles.hashLabel}>Previous Hash</span>
            <code className={styles.hash}>
              {block.previousHash ? block.previousHash.substring(0, 16) + '...' : 'N/A'}
            </code>
          </div>
          <div className={styles.hashRow}>
            <span className={styles.hashLabel}>Current Hash</span>
            <code className={`${styles.hash} ${styles.currentHash}`}>
              {block.currentHash ? block.currentHash.substring(0, 16) + '...' : 'N/A'}
            </code>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={styles.timestamp}>
            {block.timestamp ? new Date(block.timestamp).toLocaleString('id-ID') : '-'}
          </span>
          <span className={styles.nonce}>Nonce: {block.nonce}</span>
        </div>
      </div>
    </div>
  );
}
