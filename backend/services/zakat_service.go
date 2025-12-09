package services

import (
	"context"
	"log"
	"time"

	"blockchain-backend/blockchain"
	"blockchain-backend/database"
	"blockchain-backend/wallet"
)

type ZakatService struct {
	bc              *blockchain.Blockchain
	ws              *wallet.Store
	txSvc           *TransactionService
	db              *database.DB
	ticker          *time.Ticker
	done            chan bool
	lastProcessed   map[string]time.Time // Track last zakat deduction per wallet
	nisabThreshold  uint64               // Minimum balance for zakat eligibility
}

func NewZakatService(bc *blockchain.Blockchain, ws *wallet.Store, txSvc *TransactionService) *ZakatService {
	return &ZakatService{
		bc:             bc,
		ws:             ws,
		txSvc:          txSvc,
		db:             nil,
		done:           make(chan bool),
		lastProcessed:  make(map[string]time.Time),
		nisabThreshold: blockchain.ZakatNisab, // Minimum balance required for zakat eligibility
	}
}

func (zs *ZakatService) SetDatabase(db *database.DB) {
	zs.db = db
}

// Start begins the zakat scheduler
func (zs *ZakatService) Start() {
	// Run monthly - check every 24 hours and process if 30 days have passed
	// For testing, you can change to 5 * time.Minute
	zs.ticker = time.NewTicker(24 * time.Hour)
	
	go func() {
		for {
			select {
			case <-zs.ticker.C:
				zs.ProcessMonthlyZakat()
			case <-zs.done:
				return
			}
		}
	}()
	
	log.Println("✅ Zakat scheduler started (checks every 24 hours, applies monthly if balance >= 500)")
}

// Stop stops the zakat scheduler
func (zs *ZakatService) Stop() {
	if zs.ticker != nil {
		zs.ticker.Stop()
	}
	zs.done <- true
	log.Println("Zakat scheduler stopped")
}

// ProcessMonthlyZakat processes zakat deduction for all wallets
func (zs *ZakatService) ProcessMonthlyZakat() {
	log.Println("🕌 Checking for Zakat eligibility...")

	// Get all wallets
	wallets := zs.ws.GetAll()
	now := time.Now()
	eligibleCount := 0
	processedCount := 0
	
	for _, w := range wallets {
		// Skip system wallets
		if w.WalletID == "ZAKAT_POOL" || w.WalletID == "COINBASE" {
			continue
		}

		// Check if already processed this month
		lastProcessed, exists := zs.lastProcessed[w.WalletID]
		if exists {
			// Check if required interval has passed since last deduction
			daysSinceLastDeduction := now.Sub(lastProcessed).Hours() / 24
			if daysSinceLastDeduction < blockchain.ZakatIntervalDays {
				continue
			}
		}

		balance := zs.bc.GetBalance(w.WalletID)
		
		// Check Nisab threshold (minimum balance for zakat eligibility)
		if balance < zs.nisabThreshold {
			log.Printf("Wallet %s balance (%d) is below Nisab threshold (%d), skipping zakat", 
				w.WalletID[:16], balance, zs.nisabThreshold)
			continue
		}

		eligibleCount++

		// Calculate 2.5% zakat
		zakatAmount := uint64(float64(balance) * blockchain.ZakatRate)
		if zakatAmount == 0 {
			continue
		}

		// Create zakat transaction
		tx, err := zs.txSvc.CreateZakatTransaction(w.WalletID, zakatAmount)
		if err != nil {
			log.Printf("❌ Failed to create zakat transaction for %s: %v", w.WalletID[:16], err)
			continue
		}

		// Add to pending transactions
		zs.bc.AddPending(*tx)
		
		// Update last processed time
		zs.lastProcessed[w.WalletID] = now
		
		// Persist zakat deduction to database
		if zs.db != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			
			if err := zs.db.SaveZakatDeduction(ctx, w.WalletID, zakatAmount, int(now.Month()), now.Year(), tx.ID); err != nil {
				log.Printf("❌ Failed to save zakat deduction to database for %s: %v", w.WalletID[:16], err)
			}
			cancel()
		}
		
		processedCount++
		log.Printf("✅ Zakat deduction created for wallet %s: %d coins (2.5%% of %d)", w.WalletID[:16], zakatAmount, balance)
	}
	
	log.Printf("📊 Zakat summary: %d eligible wallets, %d processed", eligibleCount, processedCount)

	// Mine a block with zakat transactions
	if len(zs.bc.GetPending()) > 0 {
		block := zs.bc.Mine(0, "ZAKAT_POOL")
		log.Printf("Mined zakat block #%d with hash %s, mining reward goes to ZAKAT_POOL", block.Index, block.Hash)
		
		// Update wallet balances in database after mining
		if zs.db != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			
			// Collect all affected wallets from the mined block
			affectedWallets := make(map[string]bool)
			for _, tx := range block.Transactions {
				if tx.SenderID != "COINBASE" && tx.SenderID != "" {
					affectedWallets[tx.SenderID] = true
				}
				if tx.ReceiverID != "" {
					affectedWallets[tx.ReceiverID] = true
				}
			}
			
			// Update balance for all affected wallets
			for walletID := range affectedWallets {
				balance := zs.bc.GetBalance(walletID)
				if err := zs.db.UpdateWalletBalance(ctx, walletID, balance); err != nil {
					log.Printf("Failed to update balance in database for %s: %v", walletID, err)
				} else {
					log.Printf("Updated database balance for %s: %d coins", walletID, balance)
				}
			}
		}
	}
}
