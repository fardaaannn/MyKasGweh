'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext({});

// Action code settings — URL setelah user klik link verifikasi
const getActionCodeSettings = () => ({
  url: typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : 'http://localhost:3000/login',
  handleCodeInApp: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard: jika auth belum terinisialisasi, jangan crash
    if (!auth) {
      console.error('Firebase Auth not initialized. Check your .env.local configuration.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Jika login via email tapi belum verifikasi, jangan set user
          if (!firebaseUser.emailVerified && firebaseUser.providerData[0]?.providerId === 'password') {
            setUser(null);
            setLoading(false);
            return;
          }

          // Cek apakah user document sudah ada di Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // Buat user document baru
            await setDoc(userRef, {
              displayName: firebaseUser.displayName || '',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || '',
              emailVerified: firebaseUser.emailVerified,
              organizations: [],
              createdAt: serverTimestamp(),
            });
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userSnap?.data()?.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            emailVerified: firebaseUser.emailVerified,
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Cek apakah email sudah diverifikasi
      if (!result.user.emailVerified) {
        // Sign out user yang belum verifikasi
        await firebaseSignOut(auth);
        return {
          success: false,
          error: 'EMAIL_NOT_VERIFIED',
          email: result.user.email,
        };
      }

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signUp = async (name, email, password) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // Kirim email verifikasi dengan action code settings
      try {
        await sendEmailVerification(result.user, getActionCodeSettings());
        console.log('✅ Email verifikasi berhasil dikirim ke:', email);
      } catch (verifyError) {
        console.error('❌ Gagal mengirim email verifikasi:', verifyError);
        // Tetap lanjut meskipun email gagal kirim
      }

      // Buat user document di Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        displayName: name,
        email: email,
        photoURL: '',
        emailVerified: false,
        organizations: [],
        createdAt: serverTimestamp(),
      });

      // Sign out setelah registrasi — user harus verifikasi dulu
      await firebaseSignOut(auth);

      return { success: true, needsVerification: true, email: email };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const resendVerification = async (email, password) => {
    try {
      // Login sementara untuk kirim ulang verifikasi
      const result = await signInWithEmailAndPassword(auth, email, password);

      if (result.user.emailVerified) {
        await firebaseSignOut(auth);
        return { success: true, alreadyVerified: true };
      }

      try {
        await sendEmailVerification(result.user, getActionCodeSettings());
        console.log('✅ Email verifikasi berhasil dikirim ulang ke:', email);
      } catch (verifyError) {
        console.error('❌ Gagal mengirim ulang verifikasi:', verifyError);
        await firebaseSignOut(auth);
        return {
          success: false,
          error: verifyError.code === 'auth/too-many-requests'
            ? 'Terlalu banyak permintaan. Tunggu beberapa menit dan coba lagi.'
            : verifyError.message
        };
      }

      // Sign out lagi
      await firebaseSignOut(auth);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Google sign-in sudah terverifikasi — langsung masuk
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateUserProfile = async ({ displayName, email, currentPassword, newPassword }) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Tidak ada user yang login' };

      // Jika mengubah email atau password, perlu re-authenticate
      if ((email && email !== currentUser.email) || newPassword) {
        if (!currentPassword) {
          return { success: false, error: 'Masukkan password saat ini untuk mengubah email atau password' };
        }
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Update display name
      if (displayName && displayName !== currentUser.displayName) {
        await updateProfile(currentUser, { displayName });
      }

      // Update email
      if (email && email !== currentUser.email) {
        await firebaseUpdateEmail(currentUser, email);
        await sendEmailVerification(currentUser, getActionCodeSettings());
      }

      // Update password
      if (newPassword) {
        await firebaseUpdatePassword(currentUser, newPassword);
      }

      // Update Firestore user document
      const updates = {};
      if (displayName) updates.displayName = displayName;
      if (email) updates.email = email;
      updates.updatedAt = serverTimestamp();

      await updateDoc(doc(db, 'users', currentUser.uid), updates);

      // Update local user state
      setUser((prev) => ({
        ...prev,
        displayName: displayName || prev.displayName,
        email: email || prev.email,
      }));

      return { success: true };
    } catch (error) {
      const msg = error.code === 'auth/wrong-password'
        ? 'Password saat ini salah'
        : error.code === 'auth/requires-recent-login'
          ? 'Sesi kedaluwarsa. Silakan login ulang.'
          : error.message;
      return { success: false, error: msg };
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut: signOutUser,
        resendVerification,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
