/**
 * Midtrans Iris Payout Service (Sandbox + Mock Mode)
 * 
 * Karena user belum punya akun Midtrans, service ini beroperasi dalam mode:
 * 1. MOCK: Simulasi payout tanpa API call
 * 2. SANDBOX: Gunakan Midtrans Iris Sandbox API
 * 3. PRODUCTION: Gunakan Midtrans Iris Production API
 */

const IRIS_BASE_URL = process.env.MIDTRANS_IRIS_BASE_URL || 'https://app.sandbox.midtrans.com/iris/api/v1';
const IRIS_API_KEY = process.env.MIDTRANS_IRIS_API_KEY || '';

const MODE = IRIS_API_KEY && IRIS_API_KEY !== 'sandbox-iris-key-placeholder' ? 'sandbox' : 'mock';

/**
 * Buat payout request ke bank/e-wallet
 * @param {object} params
 * @param {string} params.bankCode - Kode bank (bca, bni, mandiri, gopay, dll)
 * @param {string} params.accountNumber - Nomor rekening/akun
 * @param {string} params.accountName - Nama penerima
 * @param {number} params.amount - Jumlah dalam Rupiah
 * @param {string} params.notes - Catatan transfer
 * @returns {object} - { success, payoutId, status, mode }
 */
export async function createPayout({ bankCode, accountNumber, accountName, amount, notes }) {
  if (MODE === 'mock') {
    // Mock mode: simulasi payout
    const mockPayoutId = 'MOCK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    return {
      success: true,
      payoutId: mockPayoutId,
      status: 'completed',
      mode: 'mock',
      message: `[MOCK] Transfer Rp ${amount.toLocaleString('id-ID')} ke ${accountName} (${bankCode} - ${accountNumber}) berhasil disimulasikan.`,
      data: {
        bankCode,
        accountNumber,
        accountName,
        amount,
        notes,
        createdAt: new Date().toISOString(),
      },
    };
  }

  // Sandbox/Production mode: actual API call
  try {
    const response = await fetch(`${IRIS_BASE_URL}/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(IRIS_API_KEY + ':')}`,
        'X-Idempotency-Key': `payout-${Date.now()}`,
      },
      body: JSON.stringify({
        payouts: [
          {
            beneficiary_name: accountName,
            beneficiary_account: accountNumber,
            beneficiary_bank: bankCode,
            amount: amount.toString(),
            notes: notes || 'Payout dari My Kas Gweh',
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        payoutId: data.payouts?.[0]?.reference_no || 'unknown',
        status: data.payouts?.[0]?.status || 'queued',
        mode: MODE,
        message: 'Payout berhasil dibuat',
        data: data.payouts?.[0],
      };
    } else {
      return {
        success: false,
        payoutId: null,
        status: 'failed',
        mode: MODE,
        message: data.error_message || 'Payout gagal',
        data,
      };
    }
  } catch (error) {
    return {
      success: false,
      payoutId: null,
      status: 'error',
      mode: MODE,
      message: 'Error: ' + error.message,
    };
  }
}

/**
 * Cek status payout
 * @param {string} payoutId - ID payout dari Midtrans
 * @returns {object} - { success, status, data }
 */
export async function checkPayoutStatus(payoutId) {
  if (payoutId.startsWith('MOCK-')) {
    return {
      success: true,
      status: 'completed',
      mode: 'mock',
      message: '[MOCK] Payout sudah completed',
    };
  }

  try {
    const response = await fetch(`${IRIS_BASE_URL}/payouts/${payoutId}`, {
      headers: {
        'Authorization': `Basic ${btoa(IRIS_API_KEY + ':')}`,
      },
    });

    const data = await response.json();
    return {
      success: response.ok,
      status: data.status || 'unknown',
      mode: MODE,
      data,
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: 'Error: ' + error.message,
    };
  }
}

/** Daftar kode bank yang didukung Midtrans Iris */
export const BANK_LIST = [
  { code: 'bca', name: 'Bank BCA' },
  { code: 'bni', name: 'Bank BNI' },
  { code: 'bri', name: 'Bank BRI' },
  { code: 'mandiri', name: 'Bank Mandiri' },
  { code: 'cimb', name: 'Bank CIMB Niaga' },
  { code: 'danamon', name: 'Bank Danamon' },
  { code: 'permata', name: 'Bank Permata' },
  { code: 'bsi', name: 'Bank Syariah Indonesia' },
  { code: 'gopay', name: 'GoPay' },
  { code: 'ovo', name: 'OVO' },
  { code: 'dana', name: 'DANA' },
  { code: 'shopeepay', name: 'ShopeePay' },
  { code: 'linkaja', name: 'LinkAja' },
];
