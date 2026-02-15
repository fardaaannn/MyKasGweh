/**
 * Midtrans Snap Payment Service
 * Untuk pembayaran masuk (iuran anggota ke kas organisasi)
 * 
 * Mode:
 * - MOCK: Tanpa API key → simulasi pembayaran langsung berhasil
 * - SANDBOX/PRODUCTION: Dengan API key → Midtrans Snap popup
 */

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const SNAP_BASE_URL = MIDTRANS_SERVER_KEY.startsWith('Mid-server-')
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

export const PAYMENT_MODE = MIDTRANS_SERVER_KEY ? 'sandbox' : 'mock';

/**
 * Buat Snap token untuk pembayaran
 * Dipanggil dari API route (server-side only)
 */
export async function createSnapToken({ orderId, amount, customerName, customerEmail, orgName, description }) {
  if (PAYMENT_MODE === 'mock') {
    return {
      success: true,
      mode: 'mock',
      token: `MOCK-TOKEN-${orderId}`,
      redirect_url: null,
      message: 'Mock mode — gunakan MIDTRANS_SERVER_KEY di .env.local untuk mode real',
    };
  }

  try {
    const auth = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');

    const response = await fetch(`${SNAP_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          first_name: customerName,
          email: customerEmail,
        },
        item_details: [
          {
            id: 'iuran',
            price: amount,
            quantity: 1,
            name: description || `Iuran ${orgName}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        mode: PAYMENT_MODE,
        token: data.token,
        redirect_url: data.redirect_url,
      };
    } else {
      return {
        success: false,
        mode: PAYMENT_MODE,
        message: data.error_messages?.join(', ') || 'Gagal membuat transaksi',
      };
    }
  } catch (error) {
    return {
      success: false,
      mode: PAYMENT_MODE,
      message: 'Error: ' + error.message,
    };
  }
}

/**
 * Verifikasi signature Midtrans notification
 */
export function verifySignature(orderId, statusCode, grossAmount, serverKey) {
  const crypto = require('crypto');
  const payload = orderId + statusCode + grossAmount + serverKey;
  return crypto.createHash('sha512').update(payload).digest('hex');
}
