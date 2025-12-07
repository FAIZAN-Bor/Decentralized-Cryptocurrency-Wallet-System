import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function Dashboard() {
  const { currentWallet } = useWallet();
  const [balance, setBalance] = useState(0);
  const [utxos, setUtxos] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (currentWallet) {
      loadData();
      if (autoRefresh) {
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
      }
    } else {
      setLoading(false);
    }
  }, [currentWallet, autoRefresh]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading dashboard data for wallet:', currentWallet.wallet_id);
      const [balData, utxoData, reportData] = await Promise.all([
        api.getBalance(currentWallet.wallet_id),
        api.getUTXOs(currentWallet.wallet_id),
        api.getWalletReport(currentWallet.wallet_id),
      ]);
      console.log('Balance:', balData);
      console.log('UTXOs:', utxoData);
      console.log('Report:', reportData);
      
      setBalance(balData.balance || 0);
      setUtxos(Array.isArray(utxoData) ? utxoData : []);
      setReport(reportData || {});
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      console.error('Error details:', err.message);
      setBalance(0);
      setUtxos([]);
      setReport({});
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const netBalance = (report?.total_received || 0) - (report?.total_sent || 0);

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Welcome to Your Dashboard
          </h1>
          <p className="text-gray-600 mt-2 text-lg">Manage your cryptocurrency wallet</p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md ${
            autoRefresh
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-200'
              : 'bg-white text-gray-700 border-2 border-gray-300'
          }`}
        >
          {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
        </button>
      </div>

      {/* Balance Card - Large */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        <div className="relative z-10">
          <p className="text-xl opacity-90 font-semibold uppercase tracking-wide">Total Balance</p>
          <p className="text-6xl font-bold mt-4 tabular-nums">{balance.toLocaleString()}</p>
          <p className="text-base opacity-80 mt-2">Blockchain Units</p>
          <div className="mt-6 pt-6 border-t border-white border-opacity-30">
            <p className="text-base opacity-90 mb-2">Net Balance (Received - Sent)</p>
            <p className="text-3xl font-bold">{netBalance.toLocaleString()} units</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border-2 border-green-200 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-bold uppercase tracking-wide">Total Received</p>
              <p className="text-4xl font-bold text-green-900 mt-3">
                {(report?.total_received || 0).toLocaleString()}
              </p>
              <p className="text-sm text-green-600 mt-2">{report?.received_count || 0} transactions</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-red-200 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm font-bold uppercase tracking-wide">Total Sent</p>
              <p className="text-4xl font-bold text-red-900 mt-3">
                {(report?.total_sent || 0).toLocaleString()}
              </p>
              <p className="text-sm text-red-600 mt-2">{report?.sent_count || 0} transactions</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-blue-200 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 text-sm font-bold uppercase tracking-wide">UTXOs Available</p>
              <p className="text-4xl font-bold text-blue-900 mt-3">
                {Array.isArray(utxos) ? utxos.length : 0}
              </p>
              <p className="text-sm text-blue-600 mt-2">Unspent outputs</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-purple-200 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 text-sm font-bold uppercase tracking-wide">Average TX Value</p>
              <p className="text-4xl font-bold text-purple-900 mt-3">
                {report?.sent_count ? ((report?.total_sent || 0) / (report?.sent_count || 1)).toFixed(2) : '0'}
              </p>
              <p className="text-sm text-purple-600 mt-2">Per transaction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Information Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-200">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent mb-8">
          Wallet Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentWallet.full_name && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600 mb-1">👤 Full Name</p>
              <p className="text-lg text-gray-900 font-semibold">{currentWallet.full_name}</p>
            </div>
          )}
          {currentWallet.email && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600 mb-1">📧 Email</p>
              <p className="text-lg text-gray-900 font-semibold break-all">{currentWallet.email}</p>
            </div>
          )}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 md:col-span-2">
            <p className="text-sm font-semibold text-gray-600 mb-2">🔐 Wallet ID</p>
            <code className="block bg-gray-100 p-3 rounded text-sm break-all font-mono text-blue-600">
              {currentWallet.wallet_id}
            </code>
          </div>
          {currentWallet.public_key && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 md:col-span-2">
              <p className="text-sm font-semibold text-gray-600 mb-2">🔑 Public Key</p>
              <code className="block bg-gray-100 p-3 rounded text-xs break-all font-mono text-blue-600">
                {currentWallet.public_key}
              </code>
            </div>
          )}
          {currentWallet.cnic && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600 mb-1">📋 CNIC</p>
              <p className="text-lg text-gray-900 font-semibold">{currentWallet.cnic}</p>
            </div>
          )}
          {currentWallet.is_admin && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm font-semibold text-yellow-700 mb-1">👑 Role</p>
              <span className="inline-block bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Admin
              </span>
            </div>
          )}
        </div>
      </div>

      {/* UTXOs List */}
      {Array.isArray(utxos) && utxos.length > 0 && (
        <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            🔓 Your UTXOs ({utxos.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Transaction</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Index</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {utxos.map((utxo, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-blue-600">
                        {utxo.origin_tx?.substring(0, 16)}...
                      </code>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">#{utxo.index}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      {utxo.amount || 0} 💰
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Total UTXO Value: <span className="font-bold text-green-600">{balance} units</span>
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!Array.isArray(utxos) || utxos.length === 0) && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 rounded-lg border border-gray-200 text-center">
          <p className="text-6xl mb-4">📭</p>
          <p className="text-lg text-gray-600 mb-2">No UTXOs yet</p>
          <p className="text-sm text-gray-500">
            Get started by receiving coins or using the faucet to claim your initial 1000 coins!
          </p>
        </div>
      )}

      {/* Refresh Info */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
        <p className="font-semibold">ℹ️ Auto Refresh Status</p>
        <p className="mt-1">
          {autoRefresh 
            ? 'Dashboard data refreshes automatically every 10 seconds.'
            : 'Auto refresh is disabled. Click the button above to enable it.'}
        </p>
      </div>
    </div>
  );
}
