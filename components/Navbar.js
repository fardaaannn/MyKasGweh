'use client';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Hide on public pages
  const publicPages = ['/', '/login', '/register', '/verify-email'];
  if (!user || publicPages.includes(pathname)) return null;

  // Detect if we're inside an org context
  const orgMatch = pathname.match(/\/org\/([^/]+)/);
  const orgId = orgMatch ? orgMatch[1] : null;

  const navItems = [
    {
      key: 'home',
      label: 'Beranda',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      path: '/dashboard',
      match: (p) => p === '/dashboard',
    },
    {
      key: 'org',
      label: 'Organisasi',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 3h-8l-2 4h12z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      ),
      path: orgId ? `/org/${orgId}` : '/dashboard',
      match: (p) => p.startsWith('/org/') && !p.endsWith('/chat'),
    },
    {
      key: 'chat',
      label: 'Obrolan',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      path: '/chat',
      match: (p) => p.startsWith('/chat') || p.startsWith('/friends'),
    },
    {
      key: 'profile',
      label: 'Profil',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      path: '/profile',
      match: (p) => p === '/profile',
    },
  ];

  return (
    <>
      {/* Desktop Top Bar */}
      <nav className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBrand} onClick={() => router.push('/dashboard')}>
            <span className={styles.brandIcon}>🏦</span>
            <span className={styles.brandText}>My Kas Gweh</span>
          </div>
          <div className={styles.topRight}>
            <div className={styles.topAvatar} onClick={() => router.push('/profile')}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation Bar */}
      <nav className={styles.bottomNav}>
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <button
              key={item.key}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => router.push(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {active && <span className={styles.navDot} />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
