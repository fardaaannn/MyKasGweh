'use client';
import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import {
  collection, addDoc, onSnapshot, query,
  orderBy, limit, serverTimestamp, doc, updateDoc, getDoc, setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { encryptMessage, decryptMessage, isEncrypted } from '@/lib/e2e-encryption';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ orgId, chatId, user, chatType = 'org' }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Pin message state
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showPinBanner, setShowPinBanner] = useState(true);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, message }

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Get base path for Firestore
  const getBasePath = () => {
    return chatType === 'dm'
      ? `directMessages/${chatId}`
      : `organizations/${orgId}`;
  };

  const getMessagesPath = () => `${getBasePath()}/messages`;

  // Realtime listener untuk messages
  useEffect(() => {
    const collectionId = chatType === 'dm' ? chatId : orgId;
    if (!collectionId) return;

    const q = query(
      collection(db, getMessagesPath()),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => {
        const data = { id: d.id, ...d.data() };
        // Decrypt DM messages
        if (chatType === 'dm' && data.text && data.encrypted) {
          data.text = decryptMessage(data.text, chatId);
        }
        return data;
      });
      setMessages(msgs);
    });

    return () => unsub();
  }, [orgId, chatId, chatType]);

  // Listen to pinned message
  useEffect(() => {
    const collectionId = chatType === 'dm' ? chatId : orgId;
    if (!collectionId) return;

    const pinRef = doc(db, getBasePath(), 'meta', 'pinnedMessage');
    const unsub = onSnapshot(pinRef, (snap) => {
      if (snap.exists()) {
        setPinnedMessage(snap.data());
        setShowPinBanner(true);
      } else {
        setPinnedMessage(null);
      }
    });

    return () => unsub();
  }, [orgId, chatId, chatType]);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar yang diperbolehkan');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file) => {
    const folder = chatType === 'dm' ? `dm/${chatId}` : `chat/${orgId}`;
    const fileName = `${folder}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if ((!text && !imageFile) || sending) return;

    setSending(true);
    setUploading(!!imageFile);
    setNewMessage('');

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Encrypt text for DM chats
      const messageText = (chatType === 'dm' && text)
        ? encryptMessage(text, chatId)
        : (text || '');

      await addDoc(collection(db, getMessagesPath()), {
        text: messageText,
        senderUid: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || '',
        createdAt: serverTimestamp(),
        type: imageUrl ? 'image' : 'text',
        imageUrl: imageUrl || null,
        encrypted: chatType === 'dm' && !!text,
      });

      removeImage();
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
      setNewMessage(text);
    }

    setSending(false);
    setUploading(false);
    inputRef.current?.focus();
  };

  // Pin message
  const handlePinMessage = async (msg) => {
    try {
      const pinRef = doc(db, getBasePath(), 'meta', 'pinnedMessage');
      await setDoc(pinRef, {
        messageId: msg.id,
        text: msg.text || (msg.imageUrl ? '📷 Gambar' : ''),
        senderName: msg.senderName,
        pinnedBy: user.displayName || 'User',
        pinnedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to pin:', err);
    }
    setContextMenu(null);
  };

  // Unpin message
  const handleUnpin = async () => {
    try {
      const pinRef = doc(db, getBasePath(), 'meta', 'pinnedMessage');
      const { deleteDoc: delDoc } = await import('firebase/firestore');
      await delDoc(pinRef);
    } catch (err) {
      console.error('Failed to unpin:', err);
    }
  };

  // Scroll to pinned message
  const scrollToPinned = () => {
    if (!pinnedMessage) return;
    const el = document.getElementById(`msg-${pinnedMessage.messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.highlightMsg);
      setTimeout(() => el.classList.remove(styles.highlightMsg), 2000);
    }
  };

  // Context menu handler (long press / right click)
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const rect = chatContainerRef.current.getBoundingClientRect();
    setContextMenu({
      x: Math.min(e.clientX - rect.left, rect.width - 160),
      y: e.clientY - rect.top,
      message: msg,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 172800000) {
      return 'Kemarin ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short',
    }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  messages.forEach((msg) => {
    const date = msg.createdAt?.toDate
      ? msg.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Hari ini';
    if (date !== lastDate) {
      groupedMessages.push({ type: 'date', date });
      lastDate = date;
    }
    groupedMessages.push({ type: 'message', ...msg });
  });

  // Search logic
  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const lower = q.toLowerCase();
    const results = messages.filter(
      (m) => m.text && m.text.toLowerCase().includes(lower)
    );
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
    // Scroll to last match
    if (results.length > 0) {
      scrollToMessage(results[results.length - 1].id);
    }
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.highlightMsg);
      setTimeout(() => el.classList.remove(styles.highlightMsg), 2000);
    }
  };

  const navigateSearch = (dir) => {
    if (searchResults.length === 0) return;
    let next = searchIndex + dir;
    if (next < 0) next = searchResults.length - 1;
    if (next >= searchResults.length) next = 0;
    setSearchIndex(next);
    scrollToMessage(searchResults[next].id);
  };

  // Highlight matching text in message
  const highlightText = (text, query) => {
    if (!query || !query.trim() || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className={styles.searchHighlightText}>{part}</mark>
        : part
    );
  };

  return (
    <div className={styles.chatContainer}>
      {/* E2E Encryption Banner */}
      {chatType === 'dm' && (
        <div className={styles.e2eBanner}>
          <span>🔒</span>
          <span>Pesan terenkripsi end-to-end</span>
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && showPinBanner && (
        <div className={styles.pinnedBanner} onClick={scrollToPinned}>
          <div className={styles.pinnedLeft}>
            <span className={styles.pinnedIcon}>📌</span>
            <div className={styles.pinnedContent}>
              <span className={styles.pinnedLabel}>Pesan Dipin</span>
              <span className={styles.pinnedText}>
                {pinnedMessage.text || '📷 Gambar'}
              </span>
            </div>
          </div>
          <button
            className={styles.pinnedClose}
            onClick={(e) => { e.stopPropagation(); setShowPinBanner(false); }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className={styles.searchBar}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari pesan..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span className={styles.searchCount}>
              {searchResults.length > 0
                ? `${searchIndex + 1}/${searchResults.length}`
                : '0 hasil'}
            </span>
          )}
          {searchResults.length > 1 && (
            <>
              <button className={styles.searchNav} onClick={() => navigateSearch(-1)}>▲</button>
              <button className={styles.searchNav} onClick={() => navigateSearch(1)}>▼</button>
            </>
          )}
          <button
            className={styles.searchClose}
            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
          >
            ✕
          </button>
        </div>
      )}

      <div className={styles.chatMessages} ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>
            <span className={styles.emptyChatIcon}>💬</span>
            <h3 className={styles.emptyChatTitle}>Belum Ada Pesan</h3>
            <p className={styles.emptyChatDesc}>
              Mulai percakapan dengan anggota organisasi
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${idx}`} className={styles.dateDivider}>
                    <span>{item.date}</span>
                  </div>
                );
              }

              const isOwn = item.senderUid === user?.uid;
              const showAvatar =
                idx === 0 ||
                groupedMessages[idx - 1]?.senderUid !== item.senderUid ||
                groupedMessages[idx - 1]?.type === 'date';
              const isPinned = pinnedMessage?.messageId === item.id;

              return (
                <div
                  key={item.id}
                  id={`msg-${item.id}`}
                  className={`${styles.messageRow} ${isOwn ? styles.messageOwn : styles.messageOther} ${isPinned ? styles.pinnedMsg : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  {!isOwn && (
                    <div className={styles.avatar} style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
                      {item.senderPhoto ? (
                        <img src={item.senderPhoto} alt="" />
                      ) : (
                        <span>{(item.senderName || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    {showAvatar && !isOwn && (
                      <span className={styles.senderName}>{item.senderName}</span>
                    )}
                    <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
                      {isPinned && <span className={styles.pinIndicator}>📌</span>}
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt="Lampiran"
                          className={styles.chatImage}
                          onClick={() => setLightboxImg(item.imageUrl)}
                        />
                      )}
                      {item.text && (
                        <p className={styles.messageText}>
                          {searchQuery ? highlightText(item.text, searchQuery) : item.text}
                        </p>
                      )}
                      <span className={styles.messageTime}>
                        {item.encrypted && <span className={styles.lockIcon}>🔒</span>}
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {pinnedMessage?.messageId === contextMenu.message.id ? (
              <button className={styles.contextItem} onClick={handleUnpin}>
                📌 Lepas Pin
              </button>
            ) : (
              <button className={styles.contextItem} onClick={() => handlePinMessage(contextMenu.message)}>
                📌 Pin Pesan
              </button>
            )}
            <button
              className={styles.contextItem}
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.message.text || '');
                setContextMenu(null);
              }}
            >
              📋 Salin Teks
            </button>
          </div>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className={styles.imagePreview}>
          <img src={imagePreview} alt="Preview" />
          <button className={styles.removePreview} onClick={removeImage}>✕</button>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className={styles.uploadingBar}>
          <div className="loading-spinner" style={{ width: 16, height: 16 }} />
          <span>Mengunggah gambar...</span>
        </div>
      )}

      <form className={styles.chatInput} onSubmit={sendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => setShowSearch(!showSearch)}
          title="Cari pesan"
        >
          🔍
        </button>
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <input
          type="text"
          className={styles.inputField}
          placeholder="Tulis pesan..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          ref={inputRef}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={(!newMessage.trim() && !imageFile) || sending}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>

      {/* Lightbox */}
      {lightboxImg && (
        <div className={styles.lightbox} onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Full" />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </div>
  );
}
