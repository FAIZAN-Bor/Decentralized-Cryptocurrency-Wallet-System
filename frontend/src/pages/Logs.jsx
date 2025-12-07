import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Logs() {
  const [systemLogs, setSystemLogs] = useState([]);
  const [transactionLogs, setTransactionLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [system, txLogs] = await Promise.all([
        api.getSystemLogs(100),
        api.getTransactionLogs(100),
      ]);
      setSystemLogs(Array.isArray(system) ? system : []);
      setTransactionLogs(Array.isArray(txLogs) ? txLogs : []);
    } catch (err) {
      console.error('Failed to load logs', err);
      setSystemLogs([]);
      setTransactionLogs([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            System Logs
          </h2>
          <p className="text-gray-600 mt-2 text-lg">Monitor system activity and transactions</p>
        </div>
        <button
          onClick={loadLogs}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition font-bold shadow-lg hover:shadow-xl"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-gray-100 p-1 rounded-xl inline-flex">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-6 py-3 rounded-lg transition font-bold ${
            activeTab === 'system'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          System Logs ({Array.isArray(systemLogs) ? systemLogs.length : 0})
        </button>
        <button
          onClick={() => setActiveTab('transaction')}
          className={`px-6 py-3 rounded-lg transition font-bold ${
            activeTab === 'transaction'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          Transaction Logs ({Array.isArray(transactionLogs) ? transactionLogs.length : 0})
        </button>
      </div>

      {/* System Logs */}
      {activeTab === 'system' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200">
          {systemLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No system logs</div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {systemLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                        {log.event_type}
                      </span>
                      {log.wallet_id && (
                        <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                          {log.wallet_id.substring(0, 12)}...
                        </code>
                      )}
                      <p className="text-sm mt-2 text-gray-700">{log.details}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                        {log.ip_address && ` • IP: ${log.ip_address}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction Logs */}
      {activeTab === 'transaction' && (
        <div className="bg-white rounded-lg shadow">
          {transactionLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transaction logs
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {transactionLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            log.action === 'mined'
                              ? 'bg-green-100 text-green-700'
                              : log.action === 'created'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            log.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p className="text-sm mt-2">
                        TX:{' '}
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {log.transaction_id}
                        </code>
                      </p>
                      <p className="text-sm">
                        Wallet:{' '}
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {log.wallet_id}
                        </code>
                      </p>
                      {log.block_hash && (
                        <p className="text-xs text-gray-500 mt-1">
                          Block: {log.block_hash.substring(0, 16)}...
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
