import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function SendMoney() {
  const { currentWallet, privateKey } = useWallet();
  const [formData, setFormData] = useState({
    receiverId: '',
    amount: '',
    note: '',
  });

  // Pre-fill receiver from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receiverFromUrl = params.get('to');
    const nameFromUrl = params.get('name');
    if (receiverFromUrl) {
      setFormData(prev => ({
        ...prev,
        receiverId: receiverFromUrl,
        note: nameFromUrl ? `Payment to ${nameFromUrl}` : ''
      }));
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await api.sendTransaction({
        sender_id: currentWallet.wallet_id,
        receiver_id: formData.receiverId,
        amount: parseInt(formData.amount),
        note: formData.note,
        private_key: privateKey,
      });
      setResult(response);
      setFormData({ receiverId: '', amount: '', note: '' });
    } catch (err) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
          Send Money
        </h2>
        <p className="text-gray-600 mt-2 text-lg">Transfer funds to another wallet</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Receiver Wallet ID *
            </label>
            <input
              type="text"
              value={formData.receiverId}
              onChange={(e) =>
                setFormData({ ...formData, receiverId: e.target.value })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 font-mono text-sm"
              placeholder="Enter receiver's wallet ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Amount *
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 text-lg font-semibold"
                placeholder="0.00"
                min="1"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                COINS
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Note (optional)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
              placeholder="Add a note to this transaction"
              rows="4"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-5 bg-green-50 border-2 border-green-400 rounded-xl">
              <p className="font-bold text-lg text-green-900 mb-2">Transaction Created Successfully!</p>
              <p className="text-sm text-green-800">
                Transaction ID:{' '}
                <code className="bg-green-200 px-3 py-1 rounded-lg font-mono text-xs">
                  {result.txid}
                </code>
              </p>
              <p className="text-sm mt-3 text-green-700 font-semibold">
                Status: Pending (waiting to be mined)
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? 'Processing Transaction...' : 'Send Transaction'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p className="font-bold mb-2">ℹ️ Important Notes:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Transaction will be added to the pending pool</li>
            <li>It must be mined to be confirmed</li>
            <li>Make sure receiver wallet ID is valid</li>
            <li>You need sufficient balance and UTXOs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
