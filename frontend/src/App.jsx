import React from 'react'
import { WalletProvider, useWallet } from './context/WalletContext'
import { NavigationProvider, useNavigation } from './context/NavigationContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SendMoney from './pages/SendMoney'
import Transactions from './pages/Transactions'
import BlockExplorer from './pages/BlockExplorer'
import Reports from './pages/Reports'
import Logs from './pages/Logs'
import Profile from './pages/Profile'
import Beneficiaries from './pages/Beneficiaries'
import AdminPanel from './pages/AdminPanel'

function AppContent() {
  const { currentWallet } = useWallet()
  const { currentPage, setCurrentPage } = useNavigation()

  if (!currentWallet) {
    return <Login />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'send':
        return <SendMoney />
      case 'transactions':
        return <Transactions />
      case 'explorer':
        return <BlockExplorer />
      case 'reports':
        return <Reports />
      case 'logs':
        return <Logs />
      case 'profile':
        return <Profile />
      case 'beneficiaries':
        return <Beneficiaries />
      case 'admin':
        return <AdminPanel />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="max-w-7xl mx-auto p-6">
        {renderPage()}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </WalletProvider>
  )
}
