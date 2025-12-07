import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [currentWallet, setCurrentWallet] = useState(null);
  const [privateKey, setPrivateKey] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('currentWallet');
    const savedKey = localStorage.getItem('privateKey');
    if (saved) {
      const wallet = JSON.parse(saved);
      setCurrentWallet(wallet);
      
      // Check admin status
      checkAdminStatus(wallet.wallet_id);
    }
    if (savedKey) {
      setPrivateKey(savedKey);
    }
  }, []);

  const checkAdminStatus = async (walletId) => {
    try {
      const response = await api.checkAdmin(walletId);
      setIsAdmin(response.is_admin || false);
      localStorage.setItem('isAdmin', response.is_admin ? 'true' : 'false');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const login = (wallet, privKey) => {
    setCurrentWallet(wallet);
    setPrivateKey(privKey);
    localStorage.setItem('currentWallet', JSON.stringify(wallet));
    localStorage.setItem('privateKey', privKey);
    
    // Check admin status after login
    checkAdminStatus(wallet.wallet_id);
  };

  const logout = () => {
    setCurrentWallet(null);
    setPrivateKey('');
    setIsAdmin(false);
    localStorage.removeItem('currentWallet');
    localStorage.removeItem('privateKey');
    localStorage.removeItem('isAdmin');
  };

  return (
    <WalletContext.Provider value={{ currentWallet, privateKey, isAdmin, login, logout }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
