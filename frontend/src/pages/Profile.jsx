import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../api/client';

export default function Profile() {
  const { currentWallet, privateKey, login } = useWallet();
  const [balance, setBalance] = useState(0);
  const [utxos, setUTXOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    cnic: '',
  });

  useEffect(() => {
    if (currentWallet && currentWallet.wallet_id) {
      loadProfileData();
      setFormData({
        full_name: currentWallet.full_name || '',
        email: currentWallet.email || '',
        cnic: currentWallet.cnic || '',
      });
    } else {
      setLoading(false);
    }
  }, [currentWallet]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const balanceData = await api.getBalance(currentWallet.wallet_id);
      setBalance(balanceData.balance || 0);

      const utxoData = await api.getUTXOs(currentWallet.wallet_id);
      setUTXOs(Array.isArray(utxoData) ? utxoData : []);
    } catch (err) {
      console.error('Failed to load profile data', err);
      setBalance(0);
      setUTXOs([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.updateProfile(currentWallet.wallet_id, formData);
      // Update wallet context with new data
      login({ ...currentWallet, ...formData }, privateKey);
      alert('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentWallet) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">🔒</div>
          <div className="text-2xl font-bold text-gray-700">Please log in to view your profile</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
          Wallet Profile
        </h2>
        <p className="text-gray-600 mt-2 text-lg">View and manage your wallet information</p>
      </div>

      {/* User Information Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide mb-2 opacity-90">Full Name</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-white text-gray-900 font-semibold"
                      placeholder="Full Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide mb-2 opacity-90">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-white text-gray-900 font-semibold"
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide mb-2 opacity-90">CNIC / National ID</label>
                    <input
                      type="text"
                      value={formData.cnic}
                      onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-white text-gray-900 font-semibold"
                      placeholder="CNIC"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 shadow-lg"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all duration-200 shadow-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-3xl font-bold mb-2">{currentWallet.full_name || 'Anonymous User'}</h3>
                  <p className="text-indigo-100 text-lg">{currentWallet.email || 'No email provided'}</p>
                  {currentWallet.cnic && (
                    <p className="text-indigo-100 mt-2 text-base">
                      <span className="font-semibold">CNIC:</span> {currentWallet.cnic}
                    </p>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-4 px-6 py-3 bg-white text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all duration-200 font-bold shadow-lg"
                  >
                    Edit Profile
                  </button>
                </>
              )}
            </div>
            {!editing && (
              <div className="text-right">
                <p className="text-sm text-indigo-200 uppercase tracking-wide">Current Balance</p>
                <p className="text-5xl font-bold mt-2">{balance}</p>
                <p className="text-indigo-100 mt-1">Coins</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wallet Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">🔐 Wallet Credentials</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentWallet.wallet_id}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border rounded font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(currentWallet.wallet_id, 'Wallet ID')}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Public Key
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentWallet.public_key}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border rounded font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(currentWallet.public_key, 'Public Key')}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-red-800">
              <span className="font-bold">⚠️ Security Note:</span> Never share your private key with anyone.
              Your private key is stored securely and is never displayed for security reasons.
            </p>
          </div>
        </div>
      </div>

      {/* UTXOs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">💰 Unspent Transaction Outputs (UTXOs)</h3>
        {utxos.length === 0 ? (
          <p className="text-gray-500">No UTXOs found</p>
        ) : (
          <div className="space-y-2">
            {utxos.map((utxo, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-4 bg-gray-50 rounded border"
              >
                <div>
                  <p className="font-mono text-sm text-gray-600">
                    ID: {utxo.id?.substring(0, 20)}...
                  </p>
                  <p className="text-xs text-gray-500">
                    Origin: {utxo.origin_tx?.substring(0, 20)}...
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{utxo.amount} Coins</p>
                  <p className="text-xs text-gray-500">
                    {utxo.spent ? '❌ Spent' : '✅ Unspent'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-gray-600 text-sm mb-2">Total UTXOs</h4>
          <p className="text-3xl font-bold text-indigo-600">{utxos.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-gray-600 text-sm mb-2">Unspent UTXOs</h4>
          <p className="text-3xl font-bold text-green-600">
            {utxos.filter(u => !u.spent).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-gray-600 text-sm mb-2">Account Status</h4>
          <p className="text-2xl font-bold text-blue-600">✅ Active</p>
        </div>
      </div>
    </div>
  );
}
