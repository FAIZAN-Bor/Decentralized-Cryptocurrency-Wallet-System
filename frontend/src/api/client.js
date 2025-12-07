const API_BASE = '/api';

export const api = {
  // Wallet operations
  generateKeypair: async () => {
    const res = await fetch(`${API_BASE}/generate-keypair`, { method: 'POST' });
    return res.json();
  },

  createWallet: async (data) => {
    const res = await fetch(`${API_BASE}/create-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  getWallet: async (walletId) => {
    const res = await fetch(`${API_BASE}/wallet/${walletId}`);
    return res.json();
  },

  getBalance: async (walletId) => {
    const res = await fetch(`${API_BASE}/balance/${walletId}`);
    return res.json();
  },

  // Transaction operations
  sendTransaction: async (data) => {
    const res = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  getTransactions: async () => {
    const res = await fetch(`${API_BASE}/transactions`);
    return res.json();
  },

  getPending: async () => {
    const res = await fetch(`${API_BASE}/pending`);
    return res.json();
  },

  // Blockchain operations
  mine: async (minerWalletId) => {
    const res = await fetch(`${API_BASE}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ miner_wallet_id: minerWalletId }),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  getBlocks: async () => {
    const res = await fetch(`${API_BASE}/blocks`);
    return res.json();
  },

  getBlock: async (index) => {
    const res = await fetch(`${API_BASE}/block/${index}`);
    return res.json();
  },

  // UTXO operations
  getUTXOs: async (walletId) => {
    const res = await fetch(`${API_BASE}/utxos/${walletId}`);
    return res.json();
  },

  // Logs and reports
  getSystemLogs: async (limit = 100) => {
    const res = await fetch(`${API_BASE}/logs/system?limit=${limit}`);
    return res.json();
  },

  getTransactionLogs: async (limit = 100) => {
    const res = await fetch(`${API_BASE}/logs/transactions?limit=${limit}`);
    return res.json();
  },

  getWalletTransactionLogs: async (walletId, limit = 100) => {
    const res = await fetch(`${API_BASE}/logs/transactions/${walletId}?limit=${limit}`);
    return res.json();
  },

  getWalletReport: async (walletId) => {
    const res = await fetch(`${API_BASE}/reports/wallet/${walletId}`);
    return res.json();
  },

  getSystemReport: async () => {
    const res = await fetch(`${API_BASE}/reports/system`);
    return res.json();
  },

  // Beneficiary operations
  getBeneficiaries: async (userId) => {
    const res = await fetch(`${API_BASE}/beneficiaries/${userId}`);
    return res.json();
  },

  verifyWalletExists: async (walletId) => {
    const res = await fetch(`${API_BASE}/wallet/${walletId}`);
    if (!res.ok) {
      return { exists: false };
    }
    const data = await res.json();
    return { exists: !!data.wallet_id, data };
  },

  addBeneficiary: async (data) => {
    const res = await fetch(`${API_BASE}/beneficiaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  removeBeneficiary: async (userId, beneficiaryId) => {
    const res = await fetch(`${API_BASE}/beneficiaries/${userId}/${beneficiaryId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  // Profile management
  updateProfile: async (walletId, data) => {
    const res = await fetch(`${API_BASE}/profile/${walletId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  // OTP operations
  sendOTP: async (email) => {
    const res = await fetch(`${API_BASE}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  verifyOTP: async (email, code) => {
    const res = await fetch(`${API_BASE}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  },

  // Admin operations
  checkAdmin: async (walletId) => {
    const res = await fetch(`${API_BASE}/admin/check/${walletId}`);
    return res.json();
  },
};

export default api;
