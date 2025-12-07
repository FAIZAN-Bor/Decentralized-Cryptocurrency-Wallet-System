import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function Reports() {
  const { currentWallet } = useWallet();
  const [walletReport, setWalletReport] = useState(null);
  const [systemReport, setSystemReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWallet) {
      loadReports();
    } else {
      setLoading(false);
    }
  }, [currentWallet]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [wallet, system] = await Promise.all([
        api.getWalletReport(currentWallet.wallet_id),
        api.getSystemReport(),
      ]);
      setWalletReport(wallet);
      setSystemReport(system);
    } catch (err) {
      console.error('Failed to load reports', err);
      setWalletReport(null);
      setSystemReport(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
          Financial Reports
        </h2>
        <p className="text-gray-600 mt-2 text-lg">View your transaction history and analytics</p>
      </div>

      {/* Wallet Report */}
      <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-200">
        <h3 className="text-2xl font-bold mb-6 text-gray-800">My Wallet Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Current Balance</h4>
            <p className="text-3xl font-bold text-blue-600">
              {walletReport?.balance?.toLocaleString() || 0}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Total Sent</h4>
            <p className="text-3xl font-bold text-red-600">
              {walletReport?.total_sent?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {walletReport?.sent_count || 0} transactions
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Total Received</h4>
            <p className="text-3xl font-bold text-green-600">
              {walletReport?.total_received?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {walletReport?.received_count || 0} transactions
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded">
          <h4 className="font-bold text-purple-800 mb-2">🕌 Zakat Information</h4>
          <p className="text-sm text-purple-700">
            Monthly Zakat Deduction: 2.5% of balance
          </p>
          <p className="text-sm text-purple-700">
            Next deduction amount: ~{' '}
            {Math.floor((walletReport?.balance || 0) * 0.025).toLocaleString()} units
          </p>
        </div>
      </div>

      {/* System Report */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">🌐 System-Wide Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Total Blocks</h4>
            <p className="text-3xl font-bold">{systemReport?.total_blocks || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Total Transactions</h4>
            <p className="text-3xl font-bold">
              {systemReport?.total_transactions || 0}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Pending Transactions</h4>
            <p className="text-3xl font-bold text-orange-600">
              {systemReport?.pending_transactions || 0}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-gray-600 text-sm mb-1">Total UTXOs</h4>
            <p className="text-3xl font-bold">{systemReport?.total_utxos || 0}</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded">
          <h4 className="font-bold text-indigo-800 mb-2">⚙️ Blockchain Settings</h4>
          <p className="text-sm text-indigo-700">
            Proof-of-Work Difficulty: {systemReport?.difficulty || 'N/A'}
          </p>
          <p className="text-sm text-indigo-700">
            Average transactions per block:{' '}
            {systemReport?.total_blocks > 0
              ? (
                  systemReport.total_transactions / systemReport.total_blocks
                ).toFixed(2)
              : 0}
          </p>
        </div>
      </div>
    </div>
  );
}
