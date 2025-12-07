import React, { useState } from 'react';
import { api } from '../api/client';
import { useWallet } from '../context/WalletContext';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cnic: '',
    walletId: '',
    privateKey: '',
    otp: '',
  });
  const [generatedKeys, setGeneratedKeys] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useWallet();

  const handleSendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your email first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.sendOTP(formData.email);
      setOtpSent(true);
      alert(`OTP sent to ${formData.email}. Code: ${result.code} (Check console for demo)`);
      console.log('Demo OTP Code:', result.code);
    } catch (err) {
      setError('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp) {
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.verifyOTP(formData.email, formData.otp);
      setOtpVerified(true);
      alert('Email verified successfully!');
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    if (!otpVerified) {
      setError('Please verify your email with OTP first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const keys = await api.generateKeypair();
      setGeneratedKeys(keys);
      setFormData(prev => ({
        ...prev,
        privateKey: keys.private,
      }));
    } catch (err) {
      setError('Failed to generate keypair');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!generatedKeys) {
      setError('Please generate keys first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const wallet = await api.createWallet({
        public: generatedKeys.public,
        private: generatedKeys.private,
        name: formData.name,
        email: formData.email,
        cnic: formData.cnic,
      });
      console.log('Wallet created:', wallet);
      // Ensure wallet has required fields
      const walletData = {
        ...wallet,
        full_name: formData.name,
        email: formData.email
      };
      login(walletData, generatedKeys.private);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to create wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const wallet = await api.getWallet(formData.walletId);
      login(wallet, formData.privateKey);
    } catch (err) {
      setError('Failed to login. Check wallet ID and private key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full backdrop-blur-sm bg-opacity-95">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Blockchain Wallet
          </h1>
          <p className="text-gray-600 text-sm">Secure Digital Asset Management</p>
        </div>

        <div className="flex space-x-2 mb-8 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
              mode === 'login'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
              mode === 'register'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 disabled:bg-gray-100"
                  placeholder="your.email@example.com"
                  required
                  disabled={otpSent}
                />
                {!otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading || !formData.email}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    Send OTP
                  </button>
                )}
                {otpVerified && <span className="text-green-600 text-3xl flex items-center">✓</span>}
              </div>
            </div>

            {otpSent && !otpVerified && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Enter OTP Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.otp}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                    className="flex-1 px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-center text-lg tracking-widest font-mono"
                    placeholder="000000"
                    maxLength="6"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={loading || !formData.otp}
                    className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    Verify
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2 font-medium">💡 Check browser console for demo OTP code</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">CNIC / National ID</label>
              <input
                type="text"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                placeholder="e.g., 12345-1234567-1"
                required
              />
            </div>

            {!generatedKeys ? (
              <button
                type="button"
                onClick={handleGenerateKeys}
                disabled={loading || !otpVerified}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? 'Generating Keys...' : 'Generate Wallet Keys'}
              </button>
            ) : (
              <>
                <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-xl shadow-md">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      !
                    </div>
                    <div>
                      <p className="font-bold text-lg text-amber-900">Save Your Keys Securely!</p>
                      <p className="text-sm text-amber-800 mt-1">
                        These keys are generated only once. Store them in a safe place. You'll need the private key to access your wallet.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-lg border-2 border-green-300 shadow-sm">
                      <label className="text-xs font-bold text-green-700 uppercase tracking-wide block mb-2">
                        Public Key (Wallet ID)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={generatedKeys.public}
                          readOnly
                          className="flex-1 text-xs font-mono bg-green-50 p-3 rounded-lg border border-green-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKeys.public);
                            alert('Public key copied!');
                          }}
                          className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-xs font-semibold shadow-md hover:shadow-lg"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border-2 border-red-300 shadow-sm">
                      <label className="text-xs font-bold text-red-700 uppercase tracking-wide block mb-2">
                        Private Key (Keep Secret!)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={generatedKeys.private}
                          readOnly
                          className="flex-1 text-xs font-mono bg-red-50 p-3 rounded-lg border border-red-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKeys.private);
                            alert('Private key copied! Keep it safe!');
                          }}
                          className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-xs font-semibold shadow-md hover:shadow-lg"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {loading ? 'Creating Wallet...' : 'Create Wallet & Continue'}
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Wallet ID</label>
              <input
                type="text"
                value={formData.walletId}
                onChange={(e) => setFormData({ ...formData, walletId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                placeholder="Enter your wallet ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Private Key</label>
              <input
                type="password"
                value={formData.privateKey}
                onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                placeholder="Enter your private key"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? 'Logging in...' : 'Login to Wallet'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
