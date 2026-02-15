'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import styles from './TransactionHistory.module.css';

export default function TransactionHistory({ orgId }) {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTx, setSearchTx] = useState('');

  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, 'organizations', orgId, 'transactions'),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [orgId]);

  const filtered = transactions.filter((t) => {
    const matchesFilter = filter === 'all' || t.type === filter;
    const matchesSearch = !searchTx.trim() || 
      (t.description || '').toLowerCase().includes(searchTx.toLowerCase()) ||
      (t.type || '').toLowerCase().includes(searchTx.toLowerCase()) ||
      (t.currentHash || '').toLowerCase().includes(searchTx.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '-';
    const formatted = Math.abs(amount).toLocaleString('id-ID');
    return `Rp ${formatted}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getTypeConfig = (type) => {
    switch (type) {
      case 'income':
        return { icon: '📥', label: 'Pemasukan', color: 'green', sign: '+' };
      case 'expense':
        return { icon: '📤', label: 'Pengeluaran', color: 'red', sign: '-' };
      case 'transfer':
        return { icon: '↗️', label: 'Transfer', color: 'blue', sign: '-' };
      case 'genesis':
        return { icon: '🏛️', label: 'Genesis', color: 'purple', sign: '' };
      default:
        return { icon: '📋', label: type, color: 'gray', sign: '' };
    }
  };

  // Group by date
  const grouped = {};
  filtered.forEach((tx) => {
    const dateKey = formatDate(tx.timestamp);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(tx);
  });

  // Calculate statistics
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense' || t.type === 'transfer')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className={styles.container}>
      {/* Summary Stats */}
      <div className={styles.summaryRow}>
        <div className={`${styles.summaryCard} ${styles.incomeCard}`}>
          <span className={styles.summaryLabel}>📥 Total Masuk</span>
          <span className={styles.summaryValue}>Rp {totalIncome.toLocaleString('id-ID')}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.expenseCard}`}>
          <span className={styles.summaryLabel}>📤 Total Keluar</span>
          <span className={styles.summaryValue}>Rp {totalExpense.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="🔍 Cari transaksi..."
          value={searchTx}
          onChange={(e) => setSearchTx(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter Tabs */}
      <div className={styles.filters}>
        {[
          { key: 'all', label: 'Semua' },
          { key: 'income', label: '📥 Masuk' },
          { key: 'expense', label: '📤 Keluar' },
          { key: 'transfer', label: '↗️ Transfer' },
        ].map((f) => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className={styles.filterCount}>
                {transactions.filter((t) => t.type === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transaction Timeline */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📭</span>
          <h3 className={styles.emptyTitle}>Belum Ada Transaksi</h3>
          <p className={styles.emptyDesc}>Buat proposal untuk mulai mencatat transaksi</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {Object.entries(grouped).map(([date, txs]) => (
            <div key={date} className={styles.dateGroup}>
              <div className={styles.dateHeader}>
                <span className={styles.dateBadge}>{date}</span>
              </div>
              {txs.map((tx) => {
                const config = getTypeConfig(tx.type);
                return (
                  <div key={tx.id} className={styles.txItem}>
                    <div className={styles.txDot} data-color={config.color} />
                    <div className={`glass-card ${styles.txCard}`}>
                      <div className={styles.txMain}>
                        <div className={styles.txLeft}>
                          <span className={styles.txIcon}>{config.icon}</span>
                          <div className={styles.txInfo}>
                            <span className={styles.txDesc}>
                              {tx.description || config.label}
                            </span>
                            <span className={styles.txMeta}>
                              {config.label} • {formatTime(tx.timestamp)}
                            </span>
                          </div>
                        </div>
                        {tx.type !== 'genesis' && (
                          <span className={`${styles.txAmount} ${styles[config.color]}`}>
                            {config.sign}{formatAmount(tx.amount)}
                          </span>
                        )}
                      </div>
                      <div className={styles.txHash}>
                        <code>#{tx.currentHash?.substring(0, 12)}...</code>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
