import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../api/client';

export default function Beneficiaries() {
  const { currentWallet } = useWallet();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBeneficiary, setNewBeneficiary] = useState({
    name: '',
    wallet_id: '',
    relationship: '',
  });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => {
    if (currentWallet && currentWallet.wallet_id) {
      loadBeneficiaries();
    } else {
      setLoading(false);
    }
  }, [currentWallet]);

  const loadBeneficiaries = async () => {
    setLoading(true);
    try {
      const data = await api.getBeneficiaries(currentWallet.wallet_id);
      setBeneficiaries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load beneficiaries', err);
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWallet = async () => {
    if (!newBeneficiary.wallet_id) {
      setError('Please enter a wallet ID to verify');
      return;
    }

    setVerifying(true);
    setVerificationResult(null);
    setError('');

    try {
      const result = await api.verifyWalletExists(newBeneficiary.wallet_id);
      setVerificationResult(result);
      
      if (!result.exists) {
        setError('⚠️ Wallet ID not found. Please check and try again.');
      }
    } catch (err) {
      setError('Failed to verify wallet: ' + err.message);
      setVerificationResult({ exists: false });
    } finally {
      setVerifying(false);
    }
  };

  const handleAddBeneficiary = async (e) => {
    e.preventDefault();
    setError('');

    if (!newBeneficiary.name || !newBeneficiary.wallet_id) {
      setError('Name and Wallet ID are required');
      return;
    }

    // Verify wallet exists before adding
    if (!verificationResult || !verificationResult.exists) {
      setError('Please verify the wallet exists before adding');
      return;
    }

    try {
      await api.addBeneficiary({
        user_id: currentWallet.wallet_id,
        beneficiary_name: newBeneficiary.name,
        beneficiary_wallet_id: newBeneficiary.wallet_id,
        relationship: newBeneficiary.relationship || 'Other',
      });

      setNewBeneficiary({ name: '', wallet_id: '', relationship: '' });
      setVerificationResult(null);
      await loadBeneficiaries();
      alert('✅ Beneficiary added successfully!');
    } catch (err) {
      setError('Failed to add beneficiary: ' + err.message);
    }
  };

  const handleRemoveBeneficiary = async (beneficiaryId) => {
    if (!confirm('Are you sure you want to remove this beneficiary?')) {
      return;
    }

    try {
      await api.removeBeneficiary(currentWallet.wallet_id, beneficiaryId);
      await loadBeneficiaries();
      alert('✅ Beneficiary removed successfully!');
    } catch (err) {
      alert('Failed to remove beneficiary: ' + err.message);
    }
  };

  const handleQuickSend = (walletId, name) => {
    window.location.href = `/send?to=${walletId}&name=${encodeURIComponent(name)}`;
  };

  // Get unique categories from beneficiaries
  const categories = ['All', ...new Set(beneficiaries.map(b => b.relationship || 'Other'))];

  // Filter and search beneficiaries
  const filteredBeneficiaries = beneficiaries.filter(ben => {
    const matchesSearch = 
      ben.beneficiary_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ben.beneficiary_wallet_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ben.relationship?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'All' || 
      (ben.relationship || 'Other') === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (!currentWallet) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">🔒</div>
          <div className="text-2xl font-bold text-gray-700">Please log in to manage beneficiaries</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
          Beneficiaries
        </h2>
        <p className="text-gray-600 mt-2 text-lg">Manage your trusted contacts for quick transfers</p>
      </div>

      {/* Add Beneficiary Form */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
        <h3 className="text-2xl font-bold mb-6 text-gray-800">Add New Beneficiary</h3>
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border-2 border-red-400">
            {error}
          </div>
        )}
        {verificationResult && verificationResult.exists && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border-2 border-green-400">
            ✅ Wallet verified! This wallet exists and can receive funds.
          </div>
        )}
        <form onSubmit={handleAddBeneficiary} className="space-y-5">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={newBeneficiary.name}
              onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter beneficiary name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Wallet ID *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBeneficiary.wallet_id}
                onChange={(e) => {
                  setNewBeneficiary({ ...newBeneficiary, wallet_id: e.target.value });
                  setVerificationResult(null);
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                placeholder="Enter beneficiary wallet ID"
                required
              />
              <button
                type="button"
                onClick={handleVerifyWallet}
                disabled={verifying || !newBeneficiary.wallet_id}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {verificationResult && verificationResult.exists && (
              <p className="mt-2 text-sm text-green-600 font-semibold">
                ✓ Verified - Owner: {verificationResult.data?.full_name || 'Unknown'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Category *</label>
            <select
              value={newBeneficiary.relationship}
              onChange={(e) => setNewBeneficiary({ ...newBeneficiary, relationship: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a category</option>
              <option value="Family">Family</option>
              <option value="Friend">Friend</option>
              <option value="Business">Business</option>
              <option value="Colleague">Colleague</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!verificationResult || !verificationResult.exists}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!verificationResult ? 'Please Verify Wallet First' : 'Add Beneficiary'}
          </button>
        </form>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Search Beneficiaries
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search by name, wallet ID, or category..."
            />
          </div>

          {/* Category Filter */}
          <div className="lg:w-64">
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredBeneficiaries.length} of {beneficiaries.length} beneficiaries
          {searchQuery && ` matching "${searchQuery}"`}
          {selectedCategory !== 'All' && ` in category "${selectedCategory}"`}
        </div>
      </div>

      {/* Beneficiaries List */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
        <h3 className="text-2xl font-bold mb-6 text-gray-800">Your Beneficiaries</h3>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : beneficiaries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4 opacity-30">👥</div>
            <p className="text-xl font-bold mb-2">No beneficiaries added yet</p>
            <p className="text-sm">Add your trusted contacts to send money quickly</p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4 opacity-30">🔍</div>
            <p className="text-xl font-bold mb-2">No matches found</p>
            <p className="text-sm">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBeneficiaries.map((ben, idx) => (
              <div
                key={idx}
                className="border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-xl text-gray-800">{ben.beneficiary_name || 'Unknown'}</h4>
                    <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg">
                      {ben.relationship || 'Other'}
                    </span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Wallet ID</p>
                  <p className="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded break-all">
                    {ben.beneficiary_wallet_id}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuickSend(ben.beneficiary_wallet_id, ben.beneficiary_name)}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition shadow-lg hover:shadow-xl"
                  >
                    Send Money
                  </button>
                  <button
                    onClick={() => handleRemoveBeneficiary(ben.id)}
                    className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition shadow-lg hover:shadow-xl"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl shadow-lg border-2 border-indigo-200">
          <h4 className="text-indigo-600 text-xs font-bold uppercase tracking-wide mb-2">Total Beneficiaries</h4>
          <p className="text-4xl font-bold text-indigo-900">{beneficiaries.length}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-lg border-2 border-green-200">
          <h4 className="text-green-600 text-xs font-bold uppercase tracking-wide mb-2">Showing</h4>
          <p className="text-4xl font-bold text-green-900">{filteredBeneficiaries.length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl shadow-lg border-2 border-purple-200">
          <h4 className="text-purple-600 text-xs font-bold uppercase tracking-wide mb-2">Categories</h4>
          <p className="text-4xl font-bold text-purple-900">{categories.length - 1}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-lg border-2 border-blue-200">
          <h4 className="text-blue-600 text-xs font-bold uppercase tracking-wide mb-2">Quick Send</h4>
          <p className="text-sm font-bold text-blue-900 mt-2">Click any card to send</p>
        </div>
      </div>
    </div>
  );
}
