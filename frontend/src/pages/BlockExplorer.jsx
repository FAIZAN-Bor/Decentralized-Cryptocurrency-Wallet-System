import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function BlockExplorer() {
  const { currentWallet } = useWallet();
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mining, setMining] = useState(false);
  const [systemReport, setSystemReport] = useState(null);
  const [activeTab, setActiveTab] = useState('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBlocks, setFilteredBlocks] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadData();
    if (autoRefresh) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    // Ensure loading completes even if no data
    if (blocks.length >= 0) {
      // Data loaded
    }
  }, [blocks]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredBlocks(blocks);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = blocks.filter(block => 
        block.hash.toLowerCase().includes(query) ||
        block.previous_hash.toLowerCase().includes(query) ||
        block.index.toString().includes(query)
      );
      setFilteredBlocks(filtered);
    }
  }, [searchQuery, blocks]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading blockchain data...');
      const [blocksData, txData, pendingData, reportData] = await Promise.all([
        api.getBlocks(),
        api.getTransactions(),
        api.getPending(),
        api.getSystemReport(),
      ]);
      
      console.log('Blocks:', blocksData);
      console.log('Transactions:', txData);
      console.log('Pending:', pendingData);
      console.log('Report:', reportData);
      
      setBlocks(Array.isArray(blocksData) ? blocksData.reverse() : []);
      setTransactions(Array.isArray(txData) ? txData : []);
      setPendingTransactions(Array.isArray(pendingData) ? pendingData : []);
      setSystemReport(reportData || {});
    } catch (err) {
      console.error('Failed to load data:', err);
      console.error('Error details:', err.message, err.stack);
      setBlocks([]);
      setTransactions([]);
      setPendingTransactions([]);
      setSystemReport({});
    } finally {
      setLoading(false);
    }
  };

  const handleMine = async () => {
    if (!currentWallet || !currentWallet.wallet_id) {
      alert('Please log in to mine blocks');
      return;
    }
    
    // Check if there are pending transactions
    if (pendingTransactions.length === 0) {
      const confirm = window.confirm(
        '⚠️ No pending transactions to mine.\n\n' +
        'Mining will create a block with only the mining reward (50 coins).\n\n' +
        'Continue?'
      );
      if (!confirm) return;
    }
    
    setMining(true);
    try {
      console.log(`Starting mining process... (${pendingTransactions.length} pending transactions)`);
      
      // Create a timeout promise (120 seconds max for mining - increased for difficulty 00000)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Mining timeout - took too long (>2 minutes). Try reducing difficulty in .env')), 120000)
      );
      
      // Race between mining and timeout
      const result = await Promise.race([
        api.mine(currentWallet.wallet_id),
        timeoutPromise
      ]);
      
      console.log('Mining successful, reloading data...');
      await loadData();
      
      const txCount = result.transactions?.length || 0;
      alert(`🎉 Block #${result.index} mined successfully!\n\n` +
            `💰 Mining reward: 50 coins\n` +
            `📦 Transactions mined: ${txCount}\n` +
            `🔗 Block hash: ${result.hash.substring(0, 16)}...`);
    } catch (err) {
      console.error('Mining error:', err);
      alert('⚠️ Mining failed: ' + err.message);
    } finally {
      setMining(false);
    }
  };

  const formatHash = (hash, length = 12) => {
    return hash ? `${hash.substring(0, length)}...` : 'N/A';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'mining_reward':
        return 'bg-yellow-100 text-yellow-800';
      case 'zakat_deduction':
        return 'bg-purple-100 text-purple-800';
      case 'faucet':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'mining_reward':
        return 'MINING';
      case 'zakat_deduction':
        return 'ZAKAT';
      case 'faucet':
        return 'FAUCET';
      default:
        return 'TRANSFER';
    }
  };

  if (loading && blocks.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading blockchain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Blockchain Explorer
          </h1>
          <p className="text-gray-600 mt-2 text-lg">View all blocks and transactions on the network</p>
        </div>
        <button
          onClick={handleMine}
          disabled={mining}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mining ? (
            <>
              <span className="inline-block animate-spin mr-2">⛏</span> Mining...
            </>
          ) : (
            <>
              ⛏ Mine Block
              {pendingTransactions.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-white text-green-700 rounded-lg text-sm">
                  {pendingTransactions.length} pending
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* System Stats Cards */}
      {systemReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-xl border-2 border-blue-200 shadow-lg hover:shadow-xl transition">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Total Blocks</p>
            <p className="text-3xl font-bold text-blue-600">{systemReport.total_blocks || 0}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-purple-200 shadow-lg hover:shadow-xl transition">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Total Transactions</p>
            <p className="text-3xl font-bold text-purple-600">{systemReport.total_transactions || 0}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-orange-200 shadow-lg hover:shadow-xl transition">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Pending</p>
            <p className="text-3xl font-bold text-orange-600">{systemReport.pending_transactions || 0}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-green-200 shadow-lg hover:shadow-xl transition">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Difficulty</p>
            <p className="text-2xl font-bold text-green-600 font-mono">{systemReport.difficulty || '00000'}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-red-200 shadow-lg hover:shadow-xl transition">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Auto Refresh</p>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`mt-2 px-4 py-2 rounded-lg text-sm font-bold transition shadow ${
                autoRefresh
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-gray-100 p-1 rounded-xl inline-flex">
        {[
          { key: 'blocks', label: 'Blocks', count: blocks.length },
          { key: 'transactions', label: 'All Transactions', count: transactions.length },
          { key: 'pending', label: 'Pending', count: pendingTransactions.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${
              activeTab === tab.key ? 'bg-white bg-opacity-30' : 'bg-gray-300'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      {activeTab === 'blocks' && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-gray-200">
          <input
            type="text"
            placeholder="Search by block hash, previous hash, or block number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200">
        {/* Blocks View */}
        {activeTab === 'blocks' && (
          <div className="p-6">
            {filteredBlocks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No blocks found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredBlocks.map((block) => (
                  <div
                    key={block.index}
                    onClick={() => setSelectedBlock(block)}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-400 cursor-pointer transition transform hover:scale-101"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">⬜</span>
                          <div>
                            <h4 className="font-bold text-lg text-gray-900">Block #{block.index}</h4>
                            <p className="text-sm text-gray-500">
                              📅 {formatTimestamp(block.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Hash</p>
                        <code className="text-xs bg-gray-100 px-3 py-2 rounded font-mono text-blue-600 break-all max-w-xs">
                          {formatHash(block.hash, 16)}
                        </code>
                      </div>
                      <div className="bg-blue-50 px-3 py-2 rounded text-center">
                        <p className="text-xs text-gray-600">Transactions</p>
                        <p className="text-xl font-bold text-blue-600">
                          {Array.isArray(block.transactions) ? block.transactions.length : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Transactions View */}
        {activeTab === 'transactions' && (
          <div className="p-6">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {transactions.map((tx, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedTransaction(tx)}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-indigo-400 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getTransactionTypeColor(tx.type)}`}>
                          {getTransactionTypeLabel(tx.type)}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">
                            {tx.sender_id === 'System' ? 'System Reward' : 'Transaction'}
                          </p>
                          <p className="text-sm text-gray-500 font-mono">{tx.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">From</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {formatHash(tx.sender_id, 8)}
                          </code>
                        </div>
                        <div className="text-2xl">→</div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">To</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {formatHash(tx.receiver_id, 8)}
                          </code>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Amount</p>
                          <p className="font-bold text-lg text-green-600">{tx.amount} 💰</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTransactionTypeColor(tx.type)}`}>
                          {tx.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Transactions View */}
        {activeTab === 'pending' && (
          <div className="p-6">
            {pendingTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No pending transactions</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {pendingTransactions.map((tx, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedTransaction(tx)}
                    className="border border-orange-200 rounded-lg p-4 hover:shadow-lg hover:border-orange-400 cursor-pointer transition bg-orange-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⏳</span>
                        <div>
                          <p className="font-semibold text-gray-900">Pending Transaction</p>
                          <p className="text-sm text-gray-500">{tx.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">From</p>
                          <code className="text-xs bg-orange-100 px-2 py-1 rounded">
                            {formatHash(tx.sender_id, 8)}
                          </code>
                        </div>
                        <div className="text-2xl">→</div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">To</p>
                          <code className="text-xs bg-orange-100 px-2 py-1 rounded">
                            {formatHash(tx.receiver_id, 8)}
                          </code>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Amount</p>
                          <p className="font-bold text-lg text-orange-600">{tx.amount} 💰</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Detail Modal */}
      {selectedBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-4xl">⬜</span>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Block #{selectedBlock.index}</h2>
                  <p className="text-gray-500">Detailed block information</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl font-light transition"
              >
                ✕
              </button>
            </div>

            {/* Block Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-1">⏰ Timestamp</p>
                <p className="text-lg text-gray-900">{formatTimestamp(selectedBlock.timestamp)}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-1">⚙️ Nonce</p>
                <p className="text-lg font-mono text-blue-600">{selectedBlock.nonce}</p>
              </div>

              <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-2">🔐 Block Hash</p>
                <code className="block bg-gray-100 p-3 rounded text-xs break-all text-blue-600 font-mono">
                  {selectedBlock.hash}
                </code>
              </div>

              <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-2">🔗 Previous Hash</p>
                <code className="block bg-gray-100 p-3 rounded text-xs break-all text-blue-600 font-mono">
                  {selectedBlock.previous_hash}
                </code>
              </div>

              <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-2">🌳 Merkle Root</p>
                <code className="block bg-gray-100 p-3 rounded text-xs break-all text-blue-600 font-mono">
                  {selectedBlock.merkle_root || 'N/A'}
                </code>
              </div>
            </div>

            {/* Transactions in Block */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Transactions ({selectedBlock.transactions?.length || 0})
              </h3>
              
              {!selectedBlock.transactions || selectedBlock.transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No transactions in this block</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedBlock.transactions.map((tx, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">Transaction ID</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {formatHash(tx.id, 12)}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getTransactionTypeColor(tx.type)}`}>
                            {getTransactionTypeLabel(tx.type)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">From</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {formatHash(tx.sender_id, 10)}
                          </code>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">To</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {formatHash(tx.receiver_id, 10)}
                          </code>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">Amount</p>
                          <p className="text-sm font-bold text-green-600">{tx.amount} 💰</p>
                        </div>
                        {tx.note && (
                          <div>
                            <p className="text-xs text-gray-500 font-semibold">Note</p>
                            <p className="text-sm text-gray-700">{tx.note}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedBlock(null)}
              className="mt-6 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl border-2 border-gray-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-200">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Transaction Details</h2>
                <p className="text-gray-500 mt-2 font-mono text-sm">ID: {selectedTransaction.id}</p>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition px-3"
              >
                ×
              </button>
            </div>

            {/* Transaction Information */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">Type</p>
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${getTransactionTypeColor(selectedTransaction.type)}`}>
                  {getTransactionTypeLabel(selectedTransaction.type)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 font-semibold mb-2">From</p>
                  <code className="text-xs bg-gray-100 p-2 rounded block break-all font-mono">
                    {selectedTransaction.sender_id}
                  </code>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 font-semibold mb-2">To</p>
                  <code className="text-xs bg-gray-100 p-2 rounded block break-all font-mono">
                    {selectedTransaction.receiver_id}
                  </code>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-xs text-gray-500 font-semibold mb-1">Amount</p>
                <p className="text-2xl font-bold text-green-600">{selectedTransaction.amount} 💰</p>
              </div>

              {selectedTransaction.note && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500 font-semibold mb-1">Note</p>
                  <p className="text-gray-900">{selectedTransaction.note}</p>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 font-semibold mb-1">Timestamp</p>
                <p className="text-gray-900">{formatTimestamp(selectedTransaction.timestamp)}</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedTransaction(null)}
              className="mt-6 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
