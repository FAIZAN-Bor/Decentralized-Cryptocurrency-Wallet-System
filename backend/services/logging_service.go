package services

import (
	"context"
	"fmt"
	"sync"
	"time"
	
	"blockchain-backend/database"
)

type LogEntry struct {
	ID        int64     `json:"id"`
	EventType string    `json:"event_type"`
	WalletID  string    `json:"wallet_id,omitempty"`
	IPAddress string    `json:"ip_address,omitempty"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

type TransactionLog struct {
	ID            int64     `json:"id"`
	TransactionID string    `json:"transaction_id"`
	Action        string    `json:"action"`
	WalletID      string    `json:"wallet_id"`
	BlockHash     string    `json:"block_hash,omitempty"`
	Status        string    `json:"status"`
	IPAddress     string    `json:"ip_address,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type LoggingService struct {
	mu             sync.RWMutex
	systemLogs     []LogEntry
	transactionLogs []TransactionLog
	logCounter     int64
	txLogCounter   int64
	db             *database.DB
}

func NewLoggingService() *LoggingService {
	return &LoggingService{
		systemLogs:     make([]LogEntry, 0),
		transactionLogs: make([]TransactionLog, 0),
		logCounter:     1,
		txLogCounter:   1,
		db:             nil,
	}
}

func (ls *LoggingService) SetDatabase(db *database.DB) {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	ls.db = db
}

func (ls *LoggingService) LogSystem(eventType, walletID, ipAddress, details string) {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	entry := LogEntry{
		ID:        ls.logCounter,
		EventType: eventType,
		WalletID:  walletID,
		IPAddress: ipAddress,
		Details:   details,
		CreatedAt: time.Now(),
	}

	ls.systemLogs = append(ls.systemLogs, entry)
	ls.logCounter++

	// Persist to database asynchronously
	if ls.db != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			ls.db.SaveSystemLog(ctx, eventType, walletID, ipAddress, details)
		}()
	}

	// Also print to console for debugging
	fmt.Printf("[SYSTEM LOG] %s - %s: %s\n", eventType, walletID, details)
}

func (ls *LoggingService) LogTransaction(txID, action, walletID, blockHash, status, ipAddress string) {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	entry := TransactionLog{
		ID:            ls.txLogCounter,
		TransactionID: txID,
		Action:        action,
		WalletID:      walletID,
		BlockHash:     blockHash,
		Status:        status,
		IPAddress:     ipAddress,
		CreatedAt:     time.Now(),
	}

	ls.transactionLogs = append(ls.transactionLogs, entry)
	ls.txLogCounter++

	// Persist to database asynchronously
	if ls.db != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			ls.db.SaveTransactionLog(ctx, txID, action, walletID, blockHash, status, ipAddress)
		}()
	}

	fmt.Printf("[TX LOG] %s - %s: %s (Status: %s)\n", action, txID, walletID, status)
}

func (ls *LoggingService) GetSystemLogs(limit int) []LogEntry {
	ls.mu.RLock()
	defer ls.mu.RUnlock()

	if limit <= 0 || limit > len(ls.systemLogs) {
		limit = len(ls.systemLogs)
	}

	// Return last N logs
	start := len(ls.systemLogs) - limit
	if start < 0 {
		start = 0
	}

	return ls.systemLogs[start:]
}

func (ls *LoggingService) GetTransactionLogs(walletID string, limit int) []TransactionLog {
	ls.mu.RLock()
	defer ls.mu.RUnlock()

	var filtered []TransactionLog
	for _, log := range ls.transactionLogs {
		if walletID == "" || log.WalletID == walletID {
			filtered = append(filtered, log)
		}
	}

	if limit <= 0 || limit > len(filtered) {
		limit = len(filtered)
	}

	start := len(filtered) - limit
	if start < 0 {
		start = 0
	}

	return filtered[start:]
}

func (ls *LoggingService) GetAllTransactionLogs() []TransactionLog {
	ls.mu.RLock()
	defer ls.mu.RUnlock()
	return ls.transactionLogs
}
