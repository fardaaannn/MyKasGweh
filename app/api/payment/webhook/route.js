import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { addBlock } from '@/lib/hash-chain';

/**
 * Midtrans Notification Webhook
 * Dipanggil oleh Midtrans setelah status pembayaran berubah
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, transaction_status, fraud_status, gross_amount, status_code, signature_key } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // Verify signature (if server key is set)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (serverKey) {
      const crypto = require('crypto');
      const payload = order_id + status_code + gross_amount + serverKey;
      const expectedSig = crypto.createHash('sha512').update(payload).digest('hex');
      if (signature_key !== expectedSig) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Get payment record
    const paymentRef = doc(db, 'payments', order_id);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const payment = paymentSnap.data();

    // Determine new status
    let newStatus = transaction_status;
    if (transaction_status === 'capture') {
      newStatus = fraud_status === 'accept' ? 'settlement' : 'fraud';
    }

    // Update payment status
    await updateDoc(paymentRef, {
      status: newStatus,
      midtransData: body,
      updatedAt: serverTimestamp(),
    });

    // If payment is successful, update org balance and add to hash chain
    if (['settlement', 'capture'].includes(newStatus) || (transaction_status === 'capture' && fraud_status === 'accept')) {
      const amount = Number(payment.amount);
      const orgRef = doc(db, 'organizations', payment.orgId);

      // Update saldo
      await updateDoc(orgRef, { balance: increment(amount) });

      // Add to hash chain
      await addBlock(payment.orgId, {
        proposalId: null,
        type: 'payment',
        amount: `Rp ${amount.toLocaleString('id-ID')}`,
        description: payment.description || 'Pembayaran iuran',
        paymentOrderId: order_id,
        paidBy: payment.userName,
        paidByUid: payment.userId,
      });
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
