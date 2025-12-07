import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';

export default function Navbar({ currentPage, setCurrentPage }) {
  const { currentWallet, isAdmin, logout } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profile', label: 'Profile' },
    { id: 'send', label: 'Send Money' },
    { id: 'beneficiaries', label: 'Beneficiaries' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'explorer', label: 'Block Explorer' },
    { id: 'reports', label: 'Reports' },
    { id: 'logs', label: 'Logs' },
  ];

  // Add admin panel only for admin users
  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel' });
  }

  return (
    <nav className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 text-white shadow-xl border-b border-indigo-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
              Blockchain Wallet
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-white text-indigo-700 shadow-lg'
                    : 'text-white hover:bg-indigo-500 hover:bg-opacity-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="hidden lg:flex items-center space-x-4">
            {currentWallet && (
              <>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-indigo-200">Wallet ID</span>
                  <span className="text-sm font-mono font-semibold">
                    {currentWallet.wallet_id.substring(0, 12)}...
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-white hover:bg-indigo-500 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-indigo-500 bg-indigo-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-white text-indigo-700 shadow-lg'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                {item.label}
              </button>
            ))}
            {currentWallet && (
              <div className="pt-4 border-t border-indigo-500">
                <div className="px-4 py-2">
                  <p className="text-xs text-indigo-200">Wallet ID</p>
                  <p className="text-sm font-mono font-semibold text-white">
                    {currentWallet.wallet_id.substring(0, 16)}...
                  </p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full mx-4 mt-2 px-5 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-semibold text-sm transition-all duration-200"
                  style={{ width: 'calc(100% - 2rem)' }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
