# Zakat Configuration Guide

## Overview
The Zakat system automatically deducts 2.5% from eligible wallets according to Islamic finance principles.

## Configuration Constants
Located in `blockchain/blockchain.go`:

```go
const (
    ZakatNisab       = 500    // Minimum balance for eligibility
    ZakatRate        = 0.025  // 2.5% deduction rate
    ZakatIntervalDays = 30    // Deduction interval (monthly)
)
```

## Eligibility Rules

### ✅ Eligible for Zakat:
1. Balance >= 500 coins (Nisab threshold)
2. At least 30 days since last deduction
3. Not a system wallet (ZAKAT_POOL, COINBASE)

### ❌ Exempt from Zakat:
1. Balance < 500 coins
2. Already deducted within last 30 days
3. System wallets

## Scheduler Configuration
Located in `services/zakat_service.go`:

```go
// Production: Check every 24 hours
zs.ticker = time.NewTicker(24 * time.Hour)

// Testing: Check every 5 minutes (uncomment for testing)
// zs.ticker = time.NewTicker(5 * time.Minute)
```

## Example Scenarios

### Scenario 1: Eligible Wallet
- Balance: 1000 coins
- Status: ✅ Eligible
- Zakat: 25 coins (2.5% of 1000)
- Result: Balance becomes 975 coins

### Scenario 2: Below Nisab
- Balance: 400 coins
- Status: ❌ Exempt
- Reason: Below 500 coins threshold
- Result: No deduction

### Scenario 3: Recently Deducted
- Balance: 800 coins
- Last Deduction: 15 days ago
- Status: ❌ Exempt
- Reason: Must wait 30 days between deductions
- Result: No deduction

## Testing Zakat System

### 1. Quick Testing (5-minute intervals)
Edit `services/zakat_service.go`:
```go
zs.ticker = time.NewTicker(5 * time.Minute)
```

### 2. Create Test Wallets
```bash
# Create wallet with 600 coins (eligible)
curl -X POST http://localhost:8080/api/create-wallet \
  -H "Content-Type: application/json" \
  -d '{"public":"...","private":"...","name":"Test","email":"test@example.com","cnic":"12345"}'

# Create wallet with 300 coins (not eligible)
curl -X POST http://localhost:8080/api/create-wallet \
  -H "Content-Type: application/json" \
  -d '{"public":"...","private":"...","name":"Test2","email":"test2@example.com","cnic":"54321"}'
```

### 3. Monitor Logs
Watch backend logs for zakat processing:
```
🕌 Checking for Zakat eligibility...
Wallet abc123... balance (600) meets Nisab threshold (500)
✅ Zakat deduction created for wallet abc123...: 15 coins (2.5% of 600)
Wallet xyz789... balance (300) is below Nisab threshold (500), skipping zakat
📊 Zakat summary: 1 eligible wallets, 1 processed
```

## Database Tracking
Zakat deductions are stored in `zakat_deductions` table:
- Wallet ID
- Amount deducted
- Month and year
- Transaction ID
- Timestamp

## Customization

### Change Nisab Threshold
Edit `blockchain/blockchain.go`:
```go
ZakatNisab = 1000  // Increase to 1000 coins
```

### Change Zakat Rate
Edit `blockchain/blockchain.go`:
```go
ZakatRate = 0.02  // Change to 2%
```

### Change Interval
Edit `blockchain/blockchain.go`:
```go
ZakatIntervalDays = 365  // Annual zakat
```

## Important Notes
1. ⚠️ Zakat is only applied to wallets meeting ALL eligibility criteria
2. 🔒 Deductions are tracked per wallet to prevent duplicate charges
3. ⛓️ All zakat transactions are recorded on the blockchain
4. 💰 Deducted amounts go to ZAKAT_POOL wallet
5. 📊 Complete audit trail in system logs and database
