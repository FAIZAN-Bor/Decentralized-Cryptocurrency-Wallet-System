import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function Transactions() {
  const { currentWallet } = useWallet();
  const [allTransactions, setAllTransactions] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'sent', 'received', 'pending'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [all, pending] = await Promise.all([
        api.getTransactions(),
        api.getPending(),
      ]);
      setAllTransactions(Array.isArray(all) ? all : []);
      setPendingTransactions(Array.isArray(pending) ? pending : []);
    } catch (err) {
      console.error('Failed to load transactions', err);
      setAllTransactions([]);
      setPendingTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransactions = () => {
    if (filter === 'pending') return Array.isArray(pendingTransactions) ? pendingTransactions : [];

    let txs = Array.isArray(allTransactions) ? allTransactions : [];
    if (filter === 'sent') {
      txs = txs.filter((tx) => tx.sender_id === currentWallet?.wallet_id);
    } else if (filter === 'received') {
      txs = txs.filter((tx) => tx.receiver_id === currentWallet?.wallet_id);
    }
    return txs;
  };

  const filteredTxs = getFilteredTransactions();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Transaction History
          </h2>
          <p className="text-gray-600 mt-2 text-lg">View all blockchain transactions</p>
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2">
        {['all', 'sent', 'received', 'pending'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded transition capitalize ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f}
            {f === 'pending' && Array.isArray(pendingTransactions) && pendingTransactions.length > 0 && (
              <span className="ml-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs">
                {pendingTransactions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow">
        {filteredTxs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions found
          </div>
        ) : (
          <div className="divide-y">
            {filteredTxs.map((tx, idx) => {
              const isSent = tx.sender_id === currentWallet.wallet_id;
              const isReceived = tx.receiver_id === currentWallet.wallet_id;
              const isZakat = tx.type === 'zakat_deduction';

              return (
                <div key={idx} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            isSent
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {isSent ? '📤 SENT' : '📥 RECEIVED'}
                        </span>
                        {isZakat && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                            🕌 ZAKAT
                          </span>
                        )}
                        {filter === 'pending' && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                            ⏳ PENDING
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600">
                        {isSent ? 'To: ' : 'From: '}
                        <code className="bg-gray-100 px-2 py-0.5 rounded">
                          {isSent ? tx.receiver_id : tx.sender_id}
                        </code>
                      </p>

                      {tx.note && (
                        <p className="text-sm text-gray-500 mt-1">
                          Note: {tx.note}
                        </p>
                      )}

                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(tx.timestamp * 1000).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${
                          isSent ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {isSent ? '-' : '+'}
                        {tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        TX: {tx.id.substring(0, 12)}...
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
