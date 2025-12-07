# 🔐 Decentralized Cryptocurrency Wallet System

A fully functional blockchain-based cryptocurrency wallet with UTXO model, Proof-of-Work mining, digital signatures, automatic Zakat deduction, and comprehensive transaction management.

## 📋 Project Overview

This project implements a complete decentralized cryptocurrency wallet system with:

- **Custom Blockchain**: SHA-256 hashing, block linking, Merkle trees
- **UTXO Model**: Bitcoin-style unspent transaction outputs
- **Digital Signatures**: Ed25519 cryptographic signing and verification
- **Proof-of-Work Mining**: Adjustable difficulty mining algorithm
- **Zakat System**: Automatic 2.5% monthly deduction with blockchain recording
- **Full Transaction Lifecycle**: Creation, validation, mining, and confirmation
- **Real-time Analytics**: Wallet reports, system statistics, and logging
- **Modern UI**: React + Tailwind CSS responsive interface

## 🛠️ Tech Stack

### Backend
- **Language**: Go 1.20+
- **Framework**: Gorilla Mux (HTTP routing)
- **Database**: Supabase (PostgreSQL) with in-memory fallback
- **Cryptography**: Ed25519 (digital signatures)
- **Hashing**: SHA-256

### Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS 3
- **Build Tool**: Vite 5
- **State Management**: React Context API

### Features Implemented
✅ Wallet generation with public/private keypairs  
✅ UTXO-based transaction model with coin selection  
✅ Digital signature creation and verification  
✅ Proof-of-Work mining with configurable difficulty  
✅ Automatic Zakat deduction scheduler (2.5% monthly)  
✅ Double-spend prevention  
✅ Transaction validation engine  
✅ System and transaction logging  
✅ Block explorer with full chain visualization  
✅ Real-time balance calculation  
✅ Comprehensive reports and analytics  
✅ RESTful API with CORS support  

## 🚀 Quick Start

### Prerequisites
- Go 1.20 or higher
- Node.js 16+ and npm
- (Optional) Supabase account for database

### Backend Setup

1. Navigate to backend directory:
```powershell
cd backend
```

2. Install Go dependencies:
```powershell
go mod download
```

3. (Optional) Configure Supabase:
```powershell
# Copy environment template
cp .env.example .env

# Edit .env and add your Supabase connection string
# SUPABASE_DB_URL=postgresql://user:pass@host:port/database
```

4. Run the backend:
```powershell
go run .
```

The server will start on `http://localhost:8080`

### Frontend Setup

1. Navigate to frontend directory:
```powershell
cd frontend
```

2. Install dependencies:
```powershell
npm install
```

3. Run development server:
```powershell
npm run dev
```

The frontend will start on `http://localhost:3000`

## 📡 API Endpoints

### Wallet Operations
- `POST /api/generate-keypair` - Generate new keypair
- `POST /api/create-wallet` - Create wallet from public key
- `GET /api/wallet/{id}` - Get wallet details
- `GET /api/balance/{id}` - Get wallet balance

### Transaction Operations
- `POST /api/send` - Create and submit transaction
- `GET /api/transactions` - Get all transactions
- `GET /api/pending` - Get pending transactions
- `GET /api/utxos/{wallet}` - Get wallet UTXOs

### Blockchain Operations
- `POST /api/mine` - Mine pending transactions
- `GET /api/blocks` - Get all blocks
- `GET /api/block/{index}` - Get specific block

### Analytics & Logs
- `GET /api/logs/system` - System event logs
- `GET /api/logs/transactions` - Transaction logs
- `GET /api/reports/wallet/{id}` - Wallet report
- `GET /api/reports/system` - System statistics

## 🏗️ Architecture

### Backend Structure
```
backend/
├── main.go                 # Application entry point
├── blockchain/
│   └── blockchain.go       # Core blockchain logic
├── wallet/
│   └── wallet.go          # Wallet and cryptography
├── services/
│   ├── transaction_service.go  # Transaction handling
│   ├── zakat_service.go        # Zakat scheduler
│   └── logging_service.go      # Event logging
├── api/
│   └── server.go          # HTTP API handlers
└── database/
    └── supabase.go        # Database integration
```

### Frontend Structure
```
frontend/
├── src/
│   ├── pages/
│   │   ├── Login.jsx           # Authentication
│   │   ├── Dashboard.jsx       # Wallet overview
│   │   ├── SendMoney.jsx       # Send transactions
│   │   ├── Transactions.jsx    # Transaction history
│   │   ├── BlockExplorer.jsx   # Blockchain viewer
│   │   ├── Reports.jsx         # Analytics
│   │   └── Logs.jsx            # System logs
│   ├── components/
│   │   └── Navbar.jsx          # Navigation
│   ├── context/
│   │   └── WalletContext.jsx   # Global state
│   ├── api/
│   │   └── client.js           # API client
│   └── App.jsx                 # Main component
```

## 🔒 Security Features

- **Ed25519 Signatures**: Industry-standard elliptic curve cryptography
- **Private Key Encryption**: Keys stored encrypted (implement AES-256 for production)
- **Signature Verification**: Every transaction validated before acceptance
- **Double-Spend Prevention**: UTXO tracking prevents reuse
- **Wallet ID Generation**: SHA-256 hash of public key
- **CORS Protection**: Configured CORS middleware
- **Input Validation**: Comprehensive request validation

## 📊 Database Schema

### Users Table
- `id`, `email`, `full_name`, `cnic`, `created_at`, `updated_at`

### Wallets Table
- `wallet_id` (PK), `user_id` (FK), `public_key`, `private_key_encrypted`, `balance`, `created_at`

### Blocks Table
- `idx` (PK), `timestamp`, `previous_hash`, `hash`, `nonce`, `merkle_root`, `created_at`

### Transactions Table
- `id` (PK), `sender_id`, `receiver_id`, `amount`, `note`, `timestamp`, `pubkey`, `signature`, `tx_type`, `block_index` (FK), `status`, `created_at`

### UTXOs Table
- `id` (PK), `owner`, `amount`, `origin_tx`, `idx`, `spent`, `created_at`

### Additional Tables
- `beneficiaries`, `zakat_deductions`, `system_logs`, `transaction_logs`

## 🕌 Zakat System

The system automatically:
1. Calculates 2.5% of each wallet's balance monthly
2. Creates system transaction to ZAKAT_POOL wallet
3. Mines transaction to blockchain
4. Logs deduction for transparency
5. Updates wallet balances via UTXO model

## 🧪 Testing

### Test Wallet Creation
```powershell
curl -X POST http://localhost:8080/api/generate-keypair
```

### Test Transaction
```powershell
curl -X POST http://localhost:8080/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "wallet1",
    "receiver_id": "wallet2",
    "amount": 100,
    "private_key": "your_private_key"
  }'
```

### Mine Block
```powershell
curl -X POST http://localhost:8080/api/mine
```

## 📈 Future Enhancements

- [ ] Email/OTP authentication integration
- [ ] Google OAuth login
- [ ] Beneficiary management UI
- [ ] Advanced analytics dashboard
- [ ] Mobile responsive improvements
- [ ] WebSocket for real-time updates
- [ ] Transaction fee system
- [ ] Multi-signature wallets
- [ ] Smart contract support

## 📝 License

This project is for educational purposes as part of a blockchain course project.

## 👥 Contributors

Built as a comprehensive blockchain wallet implementation demonstrating:
- Cryptocurrency fundamentals
- Distributed ledger technology
- Cryptographic security
- Full-stack development
- Islamic finance integration (Zakat)

## 🔗 Links

- Backend API: `http://localhost:8080/api`
- Frontend UI: `http://localhost:3000`
- Health Check: `http://localhost:8080/api/health`

---

**Note**: This is a development implementation. For production use, implement additional security measures including:
- TLS/HTTPS encryption
- Rate limiting
- Advanced authentication (JWT, OAuth)
- Key management system (KMS)
- Audit logging
- Backup and recovery systems
