'use client';
import { db } from './firebase';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { addBlock } from './hash-chain';

/**
 * Hapus organisasi: hapus doc org, hapus orgId dari semua user, hapus sub-collections
 */
async function executeDeleteOrg(orgId, members) {
  const orgRef = doc(db, 'organizations', orgId);

  // Hapus orgId dari setiap member's user doc
  for (const uid of members) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        organizations: arrayRemove(orgId),
      });
    } catch (e) {
      console.error(`Failed to remove org from user ${uid}:`, e);
    }
  }

  // Hapus sub-collections (proposals, chain)
  const subCollections = ['proposals', 'chain', 'messages'];
  for (const subCol of subCollections) {
    try {
      const subSnap = await getDocs(collection(db, 'organizations', orgId, subCol));
      for (const subDoc of subSnap.docs) {
        await deleteDoc(subDoc.ref);
      }
    } catch (e) {
      console.error(`Failed to delete ${subCol}:`, e);
    }
  }

  // Hapus org document
  await deleteDoc(orgRef);
}

/**
 * Cast vote pada proposal
 * Vote hanya dicatat — keputusan baru dieksekusi saat deadline habis.
 */
export async function castVote(orgId, proposalId, uid, vote) {
  try {
    const proposalRef = doc(db, 'organizations', orgId, 'proposals', proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      return { success: false, message: 'Proposal tidak ditemukan' };
    }

    const proposal = proposalSnap.data();

    // Cek apakah proposal masih dalam status voting
    if (proposal.status !== 'voting') {
      return { success: false, message: 'Proposal sudah tidak dalam masa voting' };
    }

    // Cek apakah sudah expired
    if (proposal.expiresAt && proposal.expiresAt.toDate() < new Date()) {
      // Jangan langsung expire — biarkan checkExpiredProposals yang menangani
      return { success: false, message: 'Masa voting sudah berakhir, menunggu hasil akhir...' };
    }

    // Cek apakah user sudah vote
    if (proposal.voters && proposal.voters[uid]) {
      return { success: false, message: 'Anda sudah memberikan suara' };
    }

    // Cek apakah user adalah member organisasi
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    const orgData = orgSnap.data();

    if (!orgData.members.includes(uid)) {
      return { success: false, message: 'Anda bukan anggota organisasi ini' };
    }

    // Update vote — hanya catat, TIDAK auto-execute
    const updateData = {
      [`voters.${uid}`]: vote,
    };

    if (vote === 'for') {
      updateData.votesFor = increment(1);
    } else {
      updateData.votesAgainst = increment(1);
    }

    await updateDoc(proposalRef, updateData);

    // Baca data terbaru untuk response
    const updatedSnap = await getDoc(proposalRef);
    const updatedProposal = updatedSnap.data();
    const totalMembers = orgData.members.length;
    const majority = Math.floor(totalMembers / 2) + 1;
    const totalVotes = (updatedProposal.votesFor || 0) + (updatedProposal.votesAgainst || 0);

    let voteResult = 'voting';

    // 100% sudah vote → eksekusi langsung, abaikan deadline
    if (totalVotes >= totalMembers) {
      if (updatedProposal.votesFor >= majority) {
        // ✅ Approved
        await updateDoc(proposalRef, {
          status: 'approved',
          executedAt: serverTimestamp(),
        });
        voteResult = 'approved';

        await addBlock(orgId, {
          proposalId,
          type: updatedProposal.type,
          amount: updatedProposal.amount,
          description: updatedProposal.description,
          recipientName: updatedProposal.recipientName || null,
          recipientBank: updatedProposal.recipientBank || null,
          recipientAccount: updatedProposal.recipientAccount || null,
          payoutStatus: updatedProposal.type === 'transfer' ? 'pending' : null,
          payoutId: null,
        });

        // Eksekusi berdasarkan tipe
        if (updatedProposal.type === 'delete_org') {
          await executeDeleteOrg(orgId, orgData.members);
        } else if (updatedProposal.type === 'income') {
          await updateDoc(orgRef, { balance: increment(Number(updatedProposal.amountRaw || 0)) });
        } else {
          await updateDoc(orgRef, { balance: increment(-Number(updatedProposal.amountRaw || 0)) });
        }
      } else {
        // ❌ Rejected
        await updateDoc(proposalRef, { status: 'rejected' });
        voteResult = 'rejected';
      }
    }

    const resultMessage = voteResult === 'approved'
      ? '🎉 Semua anggota sudah vote — Proposal disetujui!'
      : voteResult === 'rejected'
        ? '❌ Semua anggota sudah vote — Proposal ditolak.'
        : vote === 'for' ? '✅ Suara setuju berhasil dicatat' : '❌ Suara tolak berhasil dicatat';

    return {
      success: true,
      message: resultMessage,
      voteResult,
      votesFor: updatedProposal.votesFor,
      votesAgainst: updatedProposal.votesAgainst,
      totalMembers,
      majority,
    };
  } catch (error) {
    console.error('Error casting vote:', error);
    return { success: false, message: 'Terjadi kesalahan: ' + error.message };
  }
}

/**
 * Cek proposal yang expired dan eksekusi keputusan.
 * Dipanggil saat halaman org dibuka.
 *
 * Logika:
 * - Jika votesFor > votesAgainst  → approved (eksekusi transaksi)
 * - Jika votesAgainst >= votesFor → rejected
 * - Minimal harus ada 1 vote, kalau tidak ada vote sama sekali → expired
 */
export async function checkExpiredProposals(orgId) {
  try {
    const proposalsRef = collection(db, 'organizations', orgId, 'proposals');
    const q = query(proposalsRef, where('status', '==', 'voting'));
    const snap = await getDocs(q);

    const now = new Date();
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    const orgData = orgSnap.data();

    // Org sudah dihapus — tidak perlu proses
    if (!orgData) return;

    const totalMembers = orgData.members.length;
    const majority = Math.floor(totalMembers / 2) + 1;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const proposalRef = doc(db, 'organizations', orgId, 'proposals', docSnap.id);

      // Hanya proses proposal yang sudah melewati deadline
      if (!data.expiresAt || data.expiresAt.toDate() >= now) {
        continue;
      }

      const votesFor = data.votesFor || 0;
      const votesAgainst = data.votesAgainst || 0;
      const totalVotes = votesFor + votesAgainst;

      // Tidak ada vote sama sekali → expired
      if (totalVotes === 0) {
        await updateDoc(proposalRef, { status: 'expired' });
        continue;
      }

      // Cek apakah setuju >= majority
      if (votesFor >= majority) {
        // ✅ APPROVED — eksekusi transaksi
        await updateDoc(proposalRef, {
          status: 'approved',
          executedAt: serverTimestamp(),
        });

        // Tambahkan ke hash chain
        await addBlock(orgId, {
          proposalId: docSnap.id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          recipientName: data.recipientName || null,
          recipientBank: data.recipientBank || null,
          recipientAccount: data.recipientAccount || null,
          payoutStatus: data.type === 'transfer' ? 'pending' : null,
          payoutId: null,
        });

        // Eksekusi berdasarkan tipe
        if (data.type === 'delete_org') {
          await executeDeleteOrg(orgId, orgData.members);
          return; // Org sudah dihapus, tidak perlu proses proposal lain
        } else if (data.type === 'income') {
          await updateDoc(orgRef, { balance: increment(Number(data.amountRaw || 0)) });
        } else {
          await updateDoc(orgRef, { balance: increment(-Number(data.amountRaw || 0)) });
        }
      } else {
        // ❌ REJECTED — tidak mencapai majority
        await updateDoc(proposalRef, { status: 'rejected' });
      }
    }
  } catch (error) {
    console.error('Error checking expired proposals:', error);
  }
}
