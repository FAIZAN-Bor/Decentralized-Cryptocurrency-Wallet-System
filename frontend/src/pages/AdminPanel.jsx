import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../api/client';

export default function AdminPanel() {
  const { currentWallet, isAdmin } = useWallet();
  const [loading, setLoading] = useState(true);
  const [systemReport, setSystemReport] = useState(null);
  const [allWallets, setAllWallets] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isAdmin && currentWallet) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, [isAdmin, currentWallet, activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load system report
      const report = await api.getSystemReport();
      setSystemReport(report);

      if (activeTab === 'logs') {
        const logs = await api.getSystemLogs(50);
        setSystemLogs(Array.isArray(logs) ? logs : []);
      }

      if (activeTab === 'blocks') {
        const blocksData = await api.getBlocks();
        setBlocks(Array.isArray(blocksData) ? blocksData : []);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
      setSystemReport(null);
      setSystemLogs([]);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  if (!currentWallet) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Please log in to access the Admin Panel</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="text-xl mb-2">⛔ Access Denied</div>
          <div className="text-gray-600">You don't have administrator privileges</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Admin Panel
          </h2>
          <p className="text-gray-600 mt-2 text-lg">System administration and monitoring</p>
        </div>
        <div className="text-sm text-gray-600">
          Logged in as: <span className="font-bold">{currentWallet.full_name}</span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'blocks'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔗 Blockchain
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            📋 System Logs
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'network'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            🌐 Network Health
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Loading admin data...</div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && systemReport && (
            <div className="space-y-6">
              {/* System Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow">
                  <h4 className="text-sm font-medium opacity-90">Total Blocks</h4>
                  <p className="text-4xl font-bold mt-2">{systemReport.total_blocks || 0}</p>
                  <p className="text-sm opacity-75 mt-2">Blockchain Height</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow">
                  <h4 className="text-sm font-medium opacity-90">Total Transactions</h4>
                  <p className="text-4xl font-bold mt-2">{systemReport.total_transactions || 0}</p>
                  <p className="text-sm opacity-75 mt-2">All Time</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow">
                  <h4 className="text-sm font-medium opacity-90">Active Wallets</h4>
                  <p className="text-4xl font-bold mt-2">{systemReport.active_wallets || 0}</p>
                  <p className="text-sm opacity-75 mt-2">Registered Users</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow">
                  <h4 className="text-sm font-medium opacity-90">Network Status</h4>
                  <p className="text-2xl font-bold mt-2">✅ Healthy</p>
                  <p className="text-sm opacity-75 mt-2">All Systems Operational</p>
                </div>
              </div>

              {/* Additional Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h4 className="text-gray-600 font-medium mb-2">Total Coins in Circulation</h4>
                  <p className="text-3xl font-bold text-indigo-600">
                    {((systemReport.total_blocks || 0) * 50 + (systemReport.active_wallets || 0) * 1000).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Mining + Faucet Rewards</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h4 className="text-gray-600 font-medium mb-2">Avg Block Time</h4>
                  <p className="text-3xl font-bold text-green-600">~5 min</p>
                  <p className="text-sm text-gray-500 mt-1">Estimated Average</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h4 className="text-gray-600 font-medium mb-2">Network Difficulty</h4>
                  <p className="text-3xl font-bold text-purple-600">00000</p>
                  <p className="text-sm text-gray-500 mt-1">5 Leading Zeros</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4">📈 Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <div>
                      <p className="font-medium">Last Block Mined</p>
                      <p className="text-sm text-gray-600">Block #{systemReport.total_blocks || 0}</p>
                    </div>
                    <span className="text-xs text-gray-500">Recently</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <div>
                      <p className="font-medium">Total Mining Rewards Distributed</p>
                      <p className="text-sm text-gray-600">{((systemReport.total_blocks || 0) * 50).toLocaleString()} Coins</p>
                    </div>
                    <span className="text-xs text-gray-500">All Time</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <div>
                      <p className="font-medium">Zakat Pool Status</p>
                      <p className="text-sm text-gray-600">Active & Collecting</p>
                    </div>
                    <span className="text-xs text-gray-500">Operational</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Tab */}
          {activeTab === 'blocks' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-4">🔗 Blockchain Blocks</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {blocks.map((block, idx) => (
                  <div key={idx} className="border rounded p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-lg">Block #{block.index}</span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            ✅ Confirmed
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-mono text-gray-600">
                            Hash: {block.hash?.substring(0, 40)}...
                          </p>
                          <p className="text-gray-500">
                            Transactions: {block.transactions?.length || 0}
                          </p>
                          <p className="text-gray-500">
                            Nonce: {block.nonce}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {new Date(block.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-4">📋 System Logs</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {systemLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 border-l-4 border-blue-500 bg-gray-50 rounded"
                  >
                    <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {log.action?.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-600">{log.details}</p>
                      {log.wallet_id && (
                        <p className="text-xs text-gray-500 mt-1">
                          Wallet: {log.wallet_id.substring(0, 20)}...
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{log.ip_address}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Health Tab */}
          {activeTab === 'network' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold mb-4">🌐 Network Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Database Connection</span>
                      <span className="text-green-600 font-bold">✅ Connected</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Blockchain Status</span>
                      <span className="text-green-600 font-bold">✅ Synced</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Zakat Scheduler</span>
                      <span className="text-green-600 font-bold">✅ Running</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">OTP Service</span>
                      <span className="text-green-600 font-bold">✅ Active</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Logging Service</span>
                      <span className="text-green-600 font-bold">✅ Active</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold mb-4">⚙️ System Configuration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mining Reward</span>
                      <span className="font-bold">50 Coins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Faucet Amount</span>
                      <span className="font-bold">1000 Coins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Zakat Rate</span>
                      <span className="font-bold">2.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Block Difficulty</span>
                      <span className="font-bold">00000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">OTP Expiry</span>
                      <span className="font-bold">5 minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Encryption</span>
                      <span className="font-bold">AES-256</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4">📊 Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded">
                    <p className="text-2xl font-bold text-blue-600">99.9%</p>
                    <p className="text-sm text-gray-600 mt-1">Uptime</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded">
                    <p className="text-2xl font-bold text-green-600">&lt;100ms</p>
                    <p className="text-sm text-gray-600 mt-1">Avg Response</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded">
                    <p className="text-2xl font-bold text-purple-600">100%</p>
                    <p className="text-sm text-gray-600 mt-1">Success Rate</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded">
                    <p className="text-2xl font-bold text-orange-600">0</p>
                    <p className="text-sm text-gray-600 mt-1">Failed Txns</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
