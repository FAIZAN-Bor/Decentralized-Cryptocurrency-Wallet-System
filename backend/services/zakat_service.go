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
	bc     *blockchain.Blockchain
	ws     *wallet.Store
	txSvc  *TransactionService
	db     *database.DB
	ticker *time.Ticker
	done   chan bool
}

func NewZakatService(bc *blockchain.Blockchain, ws *wallet.Store, txSvc *TransactionService) *ZakatService {
	return &ZakatService{
		bc:    bc,
		ws:    ws,
		txSvc: txSvc,
		db:    nil,
		done:  make(chan bool),
	}
}

func (zs *ZakatService) SetDatabase(db *database.DB) {
	zs.db = db
}

// Start begins the zakat scheduler
func (zs *ZakatService) Start() {
	// Run monthly (for demo, check every 5 minutes)
	zs.ticker = time.NewTicker(5 * time.Minute)
	
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
	
	log.Println("Zakat scheduler started")
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
	log.Println("Processing monthly Zakat deductions...")

	// Get all wallets
	wallets := zs.ws.GetAll()
	
	for _, w := range wallets {
		// Skip system wallets
		if w.WalletID == "ZAKAT_POOL" {
			continue
		}

		balance := zs.bc.GetBalance(w.WalletID)
		if balance == 0 {
			continue
		}

		// Calculate 2.5% zakat
		zakatAmount := uint64(float64(balance) * 0.025)
		if zakatAmount == 0 {
			continue
		}

		// Create zakat transaction
		tx, err := zs.txSvc.CreateZakatTransaction(w.WalletID, zakatAmount)
		if err != nil {
			log.Printf("Failed to create zakat transaction for %s: %v", w.WalletID, err)
			continue
		}

		// Add to pending transactions
		zs.bc.AddPending(*tx)
		
		// Persist zakat deduction to database
		if zs.db != nil {
			now := time.Now()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			
			if err := zs.db.SaveZakatDeduction(ctx, w.WalletID, zakatAmount, int(now.Month()), now.Year(), tx.ID); err != nil {
				log.Printf("Failed to save zakat deduction to database for %s: %v", w.WalletID, err)
			}
		}
		
		log.Printf("Zakat deduction created for wallet %s: %d", w.WalletID, zakatAmount)
	}

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
