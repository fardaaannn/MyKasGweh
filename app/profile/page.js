'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { checkUsernameAvailable, setUsername } from '@/lib/friend-service';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './profile.module.css';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user, updateUserProfile, signOut } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Username state
  const [username, setUsernameVal] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(''); // '', 'checking', 'available', 'taken', 'invalid', 'saved'
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      // Load username from Firestore
      getDoc(doc(db, 'users', user.uid)).then((snap) => {
        const data = snap.data();
        if (data?.username) {
          setUsernameVal(data.username);
          setSavedUsername(data.username);
          setUsernameStatus('saved');
        }
      });
    }
  }, [user]);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username === savedUsername) {
      if (username === savedUsername && savedUsername) setUsernameStatus('saved');
      else setUsernameStatus('');
      return;
    }

    // Validate format
    if (!/^[a-z0-9._]{3,20}$/.test(username.toLowerCase())) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);

    return () => clearTimeout(timer);
  }, [username, savedUsername]);

  const handleSaveUsername = async () => {
    if (usernameStatus !== 'available') return;
    setUsernameSaving(true);
    const result = await setUsername(user.uid, username, savedUsername || null);
    if (result.success) {
      setSavedUsername(username.toLowerCase());
      setUsernameStatus('saved');
      setMessage({ type: 'success', text: '✅ Username berhasil disimpan!' });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    setUsernameSaving(false);
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(savedUsername);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    const updates = {};
    if (displayName !== user.displayName) updates.displayName = displayName;
    if (email !== user.email) {
      updates.email = email;
      updates.currentPassword = currentPassword;
    }

    if (Object.keys(updates).length === 0) {
      setMessage({ type: 'info', text: 'Tidak ada perubahan' });
      setLoading(false);
      return;
    }

    if (updates.email && !currentPassword) {
      setMessage({ type: 'error', text: 'Masukkan password saat ini untuk mengubah email' });
      setLoading(false);
      return;
    }

    const result = await updateUserProfile(updates);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ Profil berhasil diperbarui!' });
      setEditMode(false);
      setCurrentPassword('');
      if (updates.email) {
        setMessage({
          type: 'success',
          text: '✅ Profil diperbarui! Email verifikasi telah dikirim ke email baru.',
        });
      }
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password baru minimal 6 karakter' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok' });
      return;
    }

    setLoading(true);
    const result = await updateUserProfile({
      newPassword,
      currentPassword,
    });

    if (result.success) {
      setMessage({ type: 'success', text: '✅ Password berhasil diubah!' });
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const isGoogleUser = user?.photoURL && !user?.photoURL.includes('firebasestorage');

  const usernameStatusIcon = {
    checking: '⏳',
    available: '✅',
    taken: '❌',
    invalid: '⚠️',
    saved: '✅',
  };

  const usernameStatusText = {
    checking: 'Memeriksa...',
    available: 'Tersedia!',
    taken: 'Sudah dipakai',
    invalid: 'Huruf kecil, angka, titik, _ (3-20 karakter)',
    saved: 'Username Anda',
  };

  return (
    <>
      <div className="page-container">
        <div className={styles.profileWrapper}>
          {/* Profile Header */}
          <div className={styles.profileHeader}>
            <div className={styles.avatarLarge}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>{(user?.displayName || user?.email || '?')[0].toUpperCase()}</span>
              )}
            </div>
            <h1 className={styles.profileName}>{user?.displayName || 'User'}</h1>
            <p className={styles.profileEmail}>{user?.email}</p>
            {savedUsername && (
              <div className={styles.usernameBadge} onClick={handleCopyUsername}>
                <span>@{savedUsername}</span>
                <span className={styles.copyIcon}>{copiedUsername ? '✓' : '📋'}</span>
              </div>
            )}
            {user?.emailVerified && (
              <span className={styles.verifiedBadge}>✅ Email Terverifikasi</span>
            )}
          </div>

          {/* Messages */}
          {message.text && (
            <div className={`${styles.alert} ${styles[message.type]}`}>
              {message.text}
            </div>
          )}

          {/* Username Section */}
          <div className={`glass-card ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>🏷️ Username</h2>
              {savedUsername && (
                <button className="btn btn-ghost btn-sm" onClick={() => router.push('/friends')}>
                  👥 Teman
                </button>
              )}
            </div>

            <div className={styles.usernameField}>
              <div className={styles.usernameInputWrap}>
                <span className={styles.usernameAt}>@</span>
                <input
                  type="text"
                  className={styles.usernameInput}
                  value={username}
                  onChange={(e) => setUsernameVal(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder="pilih_username"
                  maxLength={20}
                />
                {usernameStatus && usernameStatus !== 'saved' && (
                  <span className={`${styles.usernameStatusIcon} ${styles[`status_${usernameStatus}`]}`}>
                    {usernameStatusIcon[usernameStatus]}
                  </span>
                )}
              </div>
              {usernameStatus && usernameStatus !== 'saved' && (
                <p className={`${styles.usernameHint} ${styles[`status_${usernameStatus}`]}`}>
                  {usernameStatusText[usernameStatus]}
                </p>
              )}
              {usernameStatus === 'available' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveUsername}
                  disabled={usernameSaving}
                  style={{ marginTop: '8px' }}
                >
                  {usernameSaving ? 'Menyimpan...' : '💾 Simpan Username'}
                </button>
              )}
              {usernameStatus === 'saved' && !username && (
                <p className={styles.usernameHint}>Belum ada username. Pilih username unik Anda!</p>
              )}
            </div>
          </div>

          {/* Profile Info Section */}
          <div className={`glass-card ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>👤 Informasi Profil</h2>
              {!editMode && (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}>
                  ✏️ Edit
                </button>
              )}
            </div>

            {!editMode ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nama</span>
                  <span className={styles.infoValue}>{user?.displayName || '-'}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{user?.email}</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className={styles.editForm}>
                <div className="input-group">
                  <label className="input-label">Nama Lengkap</label>
                  <input
                    type="text"
                    className="input-field"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nama Anda"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@contoh.com"
                  />
                  {email !== user?.email && (
                    <p className={styles.fieldNote}>
                      ⚠️ Mengubah email memerlukan verifikasi ulang
                    </p>
                  )}
                </div>
                {email !== user?.email && (
                  <div className="input-group">
                    <label className="input-label">Password Saat Ini (wajib untuk ubah email)</label>
                    <input
                      type="password"
                      className="input-field"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                )}
                <div className={styles.formActions}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditMode(false);
                      setDisplayName(user?.displayName || '');
                      setEmail(user?.email || '');
                      setCurrentPassword('');
                      setMessage({ type: '', text: '' });
                    }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Password Section */}
          {!isGoogleUser && (
            <div className={`glass-card ${styles.section}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>🔒 Keamanan</h2>
              </div>

              {!showPasswordForm ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowPasswordForm(true)}
                >
                  🔑 Ubah Password
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className={styles.editForm}>
                  <div className="input-group">
                    <label className="input-label">Password Saat Ini</label>
                    <input
                      type="password"
                      className="input-field"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Password Baru</label>
                    <input
                      type="password"
                      className="input-field"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      className="input-field"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      required
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Ubah Password'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setMessage({ type: '', text: '' });
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Danger Zone */}
          <div className={`glass-card ${styles.section} ${styles.dangerSection}`}>
            <button className={`btn ${styles.dangerBtn}`} onClick={handleSignOut}>
              🚪 Keluar dari Akun
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
