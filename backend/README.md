# Backend (Go)

## Overview

This Go backend implements a complete blockchain system with:
- ✅ Ed25519 keypair generation
- ✅ UTXO model with coin selection
- ✅ Transaction creation and signature verification
- ✅ Proof-of-Work mining (adjustable difficulty)
- ✅ Automatic Zakat scheduler (2.5% monthly)
- ✅ REST API with CORS support
- ✅ Comprehensive logging system
- ✅ Supabase database integration
- ✅ Double-spend prevention
- ✅ Balance calculation and reporting

## Quick Start

### Prerequisites
- Go 1.20 or higher
- (Optional) Supabase account

### Installation

1. Navigate to backend directory:
```powershell
cd backend
```

2. Install dependencies:
```powershell
go mod download
```

3. (Optional) Configure environment:
```powershell
# Copy example env
cp .env.example .env

# Edit .env with your settings
```

4. Run the server:
```powershell
go run .
```

The server starts on `http://localhost:8080`

## Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=8080
DIFFICULTY_PREFIX=00000
SUPABASE_DB_URL=postgresql://user:pass@host:5432/db
ZAKAT_POOL_WALLET=ZAKAT_POOL
```

### In-Memory Mode

If `SUPABASE_DB_URL` is not set, the backend runs in in-memory mode (data lost on restart).

### Database Mode

Set `SUPABASE_DB_URL` to enable persistent storage. Tables are auto-created on first run.

## API Endpoints

### Wallet Operations
- `POST /api/generate-keypair` - Generate new keypair
- `POST /api/create-wallet` - Create wallet
- `GET /api/wallet/{id}` - Get wallet info
- `GET /api/balance/{id}` - Get balance

### Transactions
- `POST /api/send` - Send transaction
- `GET /api/transactions` - All transactions
- `GET /api/pending` - Pending transactions
- `GET /api/utxos/{wallet}` - Wallet UTXOs

### Blockchain
- `POST /api/mine` - Mine block
- `GET /api/blocks` - All blocks
- `GET /api/block/{index}` - Specific block

### Analytics
- `GET /api/logs/system` - System logs
- `GET /api/logs/transactions` - TX logs
- `GET /api/reports/wallet/{id}` - Wallet report
- `GET /api/reports/system` - System stats

See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for detailed API docs.

## Project Structure

```
backend/
├── main.go                     # Entry point
├── go.mod                      # Dependencies
├── blockchain/
│   └── blockchain.go          # Core blockchain
├── wallet/
│   └── wallet.go              # Wallet & crypto
├── services/
│   ├── transaction_service.go # TX handling
│   ├── zakat_service.go       # Zakat scheduler
│   └── logging_service.go     # Event logging
├── api/
│   └── server.go              # HTTP handlers
└── database/
    └── supabase.go            # DB integration
```

## Development

### Run Tests
```powershell
go test ./... -v
```

### Build Binary
```powershell
go build -o blockchain-wallet.exe .
```

### Format Code
```powershell
go fmt ./...
```

### Lint Code
```powershell
go vet ./...
```

## Features

### Transaction Validation
- Signature verification (Ed25519)
- UTXO ownership validation
- Balance checking
- Double-spend prevention
- Input/output validation

### Mining
- SHA-256 proof-of-work
- Adjustable difficulty (leading zeros)
- Merkle tree computation
- Block linking and validation

### Zakat Scheduler
- Runs every 5 minutes (configurable)
- Auto-calculates 2.5% of balance
- Creates system transactions
- Mines Zakat blocks
- Full transaction logging

### Logging
- System event logs
- Transaction logs
- IP address tracking
- Timestamp tracking
- Action tracking

## Troubleshooting

### Port Already in Use
```powershell
# Change PORT in .env
PORT=8081
```

### Database Connection Failed
- Verify `SUPABASE_DB_URL` format
- Check network connectivity
- Ensure database is running
- Backend falls back to in-memory mode

### Mining Too Slow
- Reduce difficulty: `DIFFICULTY_PREFIX=0000` (4 zeros)
- Upgrade hardware
- Consider parallel mining

## Security

### Current Implementation
- ✅ Digital signatures
- ✅ Hash verification
- ✅ UTXO validation
- ✅ CORS configured
- ⚠️ Private keys stored as-is (encrypt for production)

### Production Recommendations
- Implement TLS/HTTPS
- Add rate limiting
- Use JWT authentication
- Encrypt private keys (AES-256-GCM)
- Add request validation middleware
- Implement audit logging
- Use secrets manager

## Performance

### Current Metrics
- Block mining: ~30 seconds (5 zeros difficulty)
- Transaction validation: <10ms
- Balance calculation: <5ms
- API response: <50ms

### Optimization Tips
- Enable database connection pooling
- Add Redis caching for balances
- Implement UTXO indexing
- Use parallel transaction validation
- Add API response caching

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

Educational project for blockchain learning.
