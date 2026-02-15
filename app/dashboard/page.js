'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchOrgs = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const orgIds = userData.organizations || [];

          const orgs = [];
          for (const orgId of orgIds) {
            const orgRef = doc(db, 'organizations', orgId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
              orgs.push({ id: orgSnap.id, ...orgSnap.data() });
            }
          }
          setOrganizations(orgs);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
      setLoading(false);
    };

    fetchOrgs();
  }, [user]);

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Selamat datang, {user?.displayName || 'User'}! 👋</p>
        </div>

        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={() => router.push('/create-org')}>
            ➕ Buat Organisasi
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/join')}>
            🔗 Gabung Organisasi
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className="loading-spinner" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <h3 className="empty-state-title">Belum Ada Organisasi</h3>
            <p className="empty-state-text">
              Buat organisasi baru atau gabung ke organisasi yang sudah ada untuk mulai mengelola kas bersama.
            </p>
          </div>
        ) : (
          <div className={styles.orgGrid}>
            {organizations.map((org, i) => (
              <div
                key={org.id}
                className={`glass-card ${styles.orgCard} stagger-${i + 1}`}
                onClick={() => router.push(`/org/${org.id}`)}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className={styles.orgHeader}>
                  <span className={styles.orgIcon}>🏦</span>
                  <div>
                    <h3 className={styles.orgName}>{org.name}</h3>
                    <p className={styles.orgDesc}>{org.description || 'Organisasi'}</p>
                  </div>
                </div>
                <div className={styles.orgStats}>
                  <div className={styles.orgStat}>
                    <span className={styles.orgStatLabel}>Saldo</span>
                    <span className={styles.orgStatValue}>
                      Rp {(org.balance || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className={styles.orgStat}>
                    <span className={styles.orgStatLabel}>Anggota</span>
                    <span className={styles.orgStatValue}>{org.memberCount || 0}</span>
                  </div>
                </div>
                <div className={styles.orgFooter}>
                  <span className={styles.orgCode}>Kode: {org.inviteCode}</span>
                  <span className={styles.orgArrow}>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
