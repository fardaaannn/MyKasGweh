import { NextResponse } from 'next/server';
import { createSnapToken, PAYMENT_MODE } from '@/lib/payment-service';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { orgId, amount, description, userId, userName, userEmail } = await request.json();

    if (!orgId || !amount || !userId) {
      return NextResponse.json(
        { error: 'orgId, amount, dan userId wajib diisi' },
        { status: 400 }
      );
    }

    if (amount < 1000) {
      return NextResponse.json(
        { error: 'Minimal pembayaran Rp 1.000' },
        { status: 400 }
      );
    }

    // Get org name
    const orgSnap = await getDoc(doc(db, 'organizations', orgId));
    if (!orgSnap.exists()) {
      return NextResponse.json({ error: 'Organisasi tidak ditemukan' }, { status: 404 });
    }
    const orgName = orgSnap.data().name;

    const orderId = `MKG-${orgId.slice(0, 6)}-${Date.now()}`;

    const result = await createSnapToken({
      orderId,
      amount: Number(amount),
      customerName: userName || 'User',
      customerEmail: userEmail || 'user@mykasgweh.app',
      orgName,
      description: description || `Iuran ${orgName}`,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Save payment record to Firestore
    await setDoc(doc(db, 'payments', orderId), {
      orderId,
      orgId,
      userId,
      userName: userName || 'User',
      amount: Number(amount),
      description: description || `Iuran ${orgName}`,
      status: PAYMENT_MODE === 'mock' ? 'settlement' : 'pending',
      mode: PAYMENT_MODE,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      orderId,
      token: result.token,
      redirectUrl: result.redirect_url,
      mode: PAYMENT_MODE,
    });
  } catch (error) {
    console.error('Payment create error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
