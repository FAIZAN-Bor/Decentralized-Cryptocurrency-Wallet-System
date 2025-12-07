package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func NewDB() (*DB, error) {
	dbURL := os.Getenv("SUPABASE_DB_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("SUPABASE_DB_URL not set")
	}

	// Configure connection pool with appropriate timeouts for Supabase
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database URL: %v", err)
	}

	// Adjusted settings for Supabase transaction pooler
	config.ConnConfig.ConnectTimeout = 10 * time.Second
	config.MaxConns = 5  // Lower for transaction pooler
	config.MinConns = 1  // Minimum connections
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute
	
	// CRITICAL: Disable statement caching for transaction pooler
	// Transaction poolers reuse connections, causing "prepared statement already exists" errors
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Create context with reasonable timeout
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %v", err)
	}

	// Test the connection immediately
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %v", err)
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

func (db *DB) Ping(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}

// InitSchema creates all necessary tables
// Note: For transaction pooler, we can't use multi-statement execution
func (db *DB) InitSchema(ctx context.Context) error {
	// Execute each CREATE TABLE statement separately for transaction pooler compatibility
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			full_name VARCHAR(255) NOT NULL,
			cnic VARCHAR(50),
			is_admin BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS wallets (
			wallet_id VARCHAR(100) PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			public_key TEXT NOT NULL,
			private_key_encrypted TEXT NOT NULL,
			full_name VARCHAR(255),
			email VARCHAR(255),
			is_admin BOOLEAN DEFAULT FALSE,
			balance BIGINT DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS utxos (
			id VARCHAR(200) PRIMARY KEY,
			owner VARCHAR(100) NOT NULL,
			amount BIGINT NOT NULL,
			origin_tx VARCHAR(200) NOT NULL,
			idx INTEGER NOT NULL,
			spent BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS blocks (
			idx BIGINT PRIMARY KEY,
			timestamp BIGINT NOT NULL,
			previous_hash TEXT NOT NULL,
			hash TEXT NOT NULL,
			nonce BIGINT NOT NULL,
			merkle_root TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS transactions (
			id VARCHAR(200) PRIMARY KEY,
			sender_id VARCHAR(100) NOT NULL,
			receiver_id VARCHAR(100) NOT NULL,
			amount BIGINT NOT NULL,
			note TEXT,
			timestamp BIGINT NOT NULL,
			pubkey TEXT NOT NULL,
			signature TEXT NOT NULL,
			tx_type VARCHAR(50) DEFAULT 'transfer',
			block_index BIGINT REFERENCES blocks(idx),
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS beneficiaries (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			wallet_id VARCHAR(100) NOT NULL,
			name VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS zakat_deductions (
			id SERIAL PRIMARY KEY,
			wallet_id VARCHAR(100) NOT NULL,
			amount BIGINT NOT NULL,
			month INTEGER NOT NULL,
			year INTEGER NOT NULL,
			transaction_id VARCHAR(200),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS system_logs (
			id SERIAL PRIMARY KEY,
			event_type VARCHAR(100) NOT NULL,
			wallet_id VARCHAR(100),
			ip_address VARCHAR(50),
			details TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS transaction_logs (
			id SERIAL PRIMARY KEY,
			transaction_id VARCHAR(200) NOT NULL,
			action VARCHAR(50) NOT NULL,
			wallet_id VARCHAR(100) NOT NULL,
			block_hash TEXT,
			status VARCHAR(50),
			ip_address VARCHAR(50),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_utxos_owner ON utxos(owner)`,
		`CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id)`,
		`CREATE INDEX IF NOT EXISTS idx_system_logs_wallet ON system_logs(wallet_id)`,
	}

	// Execute each statement separately
	for _, stmt := range statements {
		if _, err := db.Pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("failed to execute schema statement: %v", err)
		}
	}

	// Migrations: Add missing columns if they don't exist
	migrations := []string{
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
		`CREATE INDEX IF NOT EXISTS idx_wallets_is_admin ON wallets(is_admin)`,
	}
	
	for _, migration := range migrations {
		if _, err := db.Pool.Exec(ctx, migration); err != nil {
			return fmt.Errorf("failed to execute migration: %v", err)
		}
	}

	return nil
}

// User persistence methods

func (db *DB) CreateUser(ctx context.Context, email, fullName, cnic string) (int64, error) {
	if db == nil || db.Pool == nil {
		return 0, nil
	}
	
	var userID int64
	query := `
		INSERT INTO users (email, full_name, cnic)
		VALUES ($1, $2, $3)
		ON CONFLICT (email) DO UPDATE
		SET full_name = EXCLUDED.full_name,
		    cnic = EXCLUDED.cnic,
		    updated_at = NOW()
		RETURNING id
	`
	err := db.Pool.QueryRow(ctx, query, email, fullName, cnic).Scan(&userID)
	return userID, err
}

func (db *DB) GetUserByEmail(ctx context.Context, email string) (map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	
	query := `SELECT id, email, full_name, cnic, created_at, updated_at FROM users WHERE email = $1`
	
	var id int64
	var emailVal, fullName, cnic string
	var createdAt, updatedAt time.Time
	
	err := db.Pool.QueryRow(ctx, query, email).Scan(&id, &emailVal, &fullName, &cnic, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	
	return map[string]interface{}{
		"id":         id,
		"email":      emailVal,
		"full_name":  fullName,
		"cnic":       cnic,
		"created_at": createdAt,
		"updated_at": updatedAt,
	}, nil
}

func (db *DB) UpdateUserProfile(ctx context.Context, walletID, fullName, email, cnic string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	// Update user table via wallet's user_id
	query := `
		UPDATE users 
		SET full_name = $1, email = $2, cnic = $3, updated_at = NOW()
		WHERE id = (SELECT user_id FROM wallets WHERE wallet_id = $4)
	`
	_, err := db.Pool.Exec(ctx, query, fullName, email, cnic, walletID)
	if err != nil {
		return err
	}
	
	// Also update wallet table
	walletQuery := `
		UPDATE wallets
		SET full_name = $1, email = $2
		WHERE wallet_id = $3
	`
	_, err = db.Pool.Exec(ctx, walletQuery, fullName, email, walletID)
	return err
}

// CheckEmailExists checks if an email is already registered in the system
func (db *DB) CheckEmailExists(ctx context.Context, email string) (bool, error) {
	if db == nil || db.Pool == nil {
		return false, fmt.Errorf("no database connection")
	}
	
	if email == "" {
		return false, nil
	}
	
	// Check in wallets table
	var count int
	query := `SELECT COUNT(*) FROM wallets WHERE LOWER(email) = LOWER($1)`
	err := db.Pool.QueryRow(ctx, query, email).Scan(&count)
	if err != nil {
		return false, err
	}
	
	return count > 0, nil
}

// Admin role methods

func (db *DB) IsAdmin(ctx context.Context, walletID string) (bool, error) {
	if db == nil || db.Pool == nil {
		return false, fmt.Errorf("no database connection")
	}
	
	var isAdmin bool
	query := `SELECT COALESCE(is_admin, FALSE) FROM wallets WHERE wallet_id = $1`
	err := db.Pool.QueryRow(ctx, query, walletID).Scan(&isAdmin)
	if err != nil {
		return false, err
	}
	return isAdmin, nil
}

func (db *DB) SetAdmin(ctx context.Context, email string, isAdmin bool) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	// Update user table
	userQuery := `UPDATE users SET is_admin = $1 WHERE email = $2`
	_, err := db.Pool.Exec(ctx, userQuery, isAdmin, email)
	if err != nil {
		return err
	}
	
	// Update wallet table
	walletQuery := `UPDATE wallets SET is_admin = $1 WHERE email = $2`
	_, err = db.Pool.Exec(ctx, walletQuery, isAdmin, email)
	return err
}

// Wallet persistence methods

func (db *DB) SaveWallet(ctx context.Context, walletID, publicKey, privateKeyEncrypted, fullName, email, cnic string) error {
	if db == nil || db.Pool == nil {
		return nil // Skip if no database connection
	}
	
	// Check if this is the designated admin email
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@blockchain.com" // Default admin email
	}
	isAdmin := (email == adminEmail)
	
	// First, create or update user
	var userID *int64
	if email != "" {
		uid, err := db.CreateUser(ctx, email, fullName, cnic)
		if err != nil {
			return fmt.Errorf("failed to create user: %v", err)
		}
		userID = &uid
		
		// Set admin status if this is the admin email
		if isAdmin {
			db.SetAdmin(ctx, email, true)
		}
	}
	
	query := `
		INSERT INTO wallets (wallet_id, user_id, public_key, private_key_encrypted, full_name, email, is_admin, balance)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
		ON CONFLICT (wallet_id) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    public_key = EXCLUDED.public_key,
		    private_key_encrypted = EXCLUDED.private_key_encrypted,
		    full_name = EXCLUDED.full_name,
		    email = EXCLUDED.email,
		    is_admin = EXCLUDED.is_admin
	`
	_, err := db.Pool.Exec(ctx, query, walletID, userID, publicKey, privateKeyEncrypted, fullName, email, isAdmin)
	return err
}

// Wallet persistence methods (old version removed)

func (db *DB) GetWallet(ctx context.Context, walletID string) (map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	
	query := `SELECT wallet_id, public_key, private_key_encrypted, full_name, email, COALESCE(is_admin, FALSE), balance, created_at FROM wallets WHERE wallet_id = $1`
	
	var wid, pubKey, privKey, fullName, email string
	var isAdmin bool
	var balance int64
	var createdAt time.Time
	
	err := db.Pool.QueryRow(ctx, query, walletID).Scan(&wid, &pubKey, &privKey, &fullName, &email, &isAdmin, &balance, &createdAt)
	if err != nil {
		return nil, err
	}
	
	return map[string]interface{}{
		"wallet_id":             wid,
		"public_key":            pubKey,
		"private_key_encrypted": privKey,
		"full_name":             fullName,
		"email":                 email,
		"is_admin":              isAdmin,
		"balance":               balance,
		"created_at":            createdAt,
	}, nil
}

func (db *DB) GetAllWallets(ctx context.Context) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT wallet_id, public_key, private_key_encrypted, full_name, email, COALESCE(is_admin, FALSE), balance, created_at FROM wallets ORDER BY created_at DESC`
	
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var wallets []map[string]interface{}
	for rows.Next() {
		var wid, pubKey, privKey, fullName, email string
		var isAdmin bool
		var balance int64
		var createdAt time.Time
		
		if err := rows.Scan(&wid, &pubKey, &privKey, &fullName, &email, &isAdmin, &balance, &createdAt); err != nil {
			continue
		}
		
		wallets = append(wallets, map[string]interface{}{
			"wallet_id":             wid,
			"public_key":            pubKey,
			"private_key_encrypted": privKey,
			"full_name":             fullName,
			"email":                 email,
			"is_admin":              isAdmin,
			"balance":               balance,
			"created_at":            createdAt,
		})
	}
	
	return wallets, nil
}

// Block persistence methods

func (db *DB) SaveBlock(ctx context.Context, idx, timestamp int64, previousHash, hash string, nonce int64, merkleRoot string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `
		INSERT INTO blocks (idx, timestamp, previous_hash, hash, nonce, merkle_root)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (idx) DO NOTHING
	`
	_, err := db.Pool.Exec(ctx, query, idx, timestamp, previousHash, hash, nonce, merkleRoot)
	return err
}

func (db *DB) GetAllBlocks(ctx context.Context) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT idx, timestamp, previous_hash, hash, nonce, merkle_root, created_at FROM blocks ORDER BY idx ASC`
	
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var blocks []map[string]interface{}
	for rows.Next() {
		var idx, timestamp, nonce int64
		var previousHash, hash, merkleRoot string
		var createdAt time.Time
		
		if err := rows.Scan(&idx, &timestamp, &previousHash, &hash, &nonce, &merkleRoot, &createdAt); err != nil {
			continue
		}
		
		blocks = append(blocks, map[string]interface{}{
			"idx":           idx,
			"timestamp":     timestamp,
			"previous_hash": previousHash,
			"hash":          hash,
			"nonce":         nonce,
			"merkle_root":   merkleRoot,
			"created_at":    createdAt,
		})
	}
	
	return blocks, nil
}

// Transaction persistence methods

func (db *DB) SaveTransaction(ctx context.Context, id, senderID, receiverID string, amount uint64, note string, timestamp int64, pubkey, signature string, txType string, blockIndex *int64, status string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `
		INSERT INTO transactions (id, sender_id, receiver_id, amount, note, timestamp, pubkey, signature, tx_type, block_index, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE
		SET block_index = EXCLUDED.block_index,
		    status = EXCLUDED.status
	`
	_, err := db.Pool.Exec(ctx, query, id, senderID, receiverID, amount, note, timestamp, pubkey, signature, txType, blockIndex, status)
	return err
}

func (db *DB) GetAllTransactions(ctx context.Context) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT id, sender_id, receiver_id, amount, note, timestamp, pubkey, signature, tx_type, block_index, status, created_at FROM transactions ORDER BY timestamp DESC`
	
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var txs []map[string]interface{}
	for rows.Next() {
		var id, senderID, receiverID, note, pubkey, signature, txType, status string
		var amount uint64
		var timestamp int64
		var blockIndex *int64
		var createdAt time.Time
		
		if err := rows.Scan(&id, &senderID, &receiverID, &amount, &note, &timestamp, &pubkey, &signature, &txType, &blockIndex, &status, &createdAt); err != nil {
			continue
		}
		
		txs = append(txs, map[string]interface{}{
			"id":          id,
			"sender_id":   senderID,
			"receiver_id": receiverID,
			"amount":      amount,
			"note":        note,
			"timestamp":   timestamp,
			"pubkey":      pubkey,
			"signature":   signature,
			"tx_type":     txType,
			"block_index": blockIndex,
			"status":      status,
			"created_at":  createdAt,
		})
	}
	
	return txs, nil
}

// UTXO persistence methods

func (db *DB) SaveUTXO(ctx context.Context, id, owner string, amount uint64, originTx string, idx int, spent bool) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `
		INSERT INTO utxos (id, owner, amount, origin_tx, idx, spent)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE
		SET spent = EXCLUDED.spent
	`
	_, err := db.Pool.Exec(ctx, query, id, owner, amount, originTx, idx, spent)
	return err
}

func (db *DB) GetAllUTXOs(ctx context.Context) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	// Use simple query mode for transaction pooler compatibility
	query := `SELECT id, owner, amount::bigint, origin_tx, idx, spent, created_at FROM utxos ORDER BY created_at DESC`
	
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var utxos []map[string]interface{}
	for rows.Next() {
		var id, owner, originTx string
		var amount uint64
		var idx int
		var spent bool
		var createdAt time.Time
		
		if err := rows.Scan(&id, &owner, &amount, &originTx, &idx, &spent, &createdAt); err != nil {
			continue
		}
		
		utxos = append(utxos, map[string]interface{}{
			"id":         id,
			"owner":      owner,
			"amount":     amount,
			"origin_tx":  originTx,
			"index":      idx,
			"spent":      spent,
			"created_at": createdAt,
		})
	}
	
	return utxos, nil
}

// Logging persistence methods

func (db *DB) SaveSystemLog(ctx context.Context, eventType, walletID, ipAddress, details string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `INSERT INTO system_logs (event_type, wallet_id, ip_address, details) VALUES ($1, $2, $3, $4)`
	_, err := db.Pool.Exec(ctx, query, eventType, walletID, ipAddress, details)
	return err
}

func (db *DB) SaveTransactionLog(ctx context.Context, transactionID, action, walletID, blockHash, status, ipAddress string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `INSERT INTO transaction_logs (transaction_id, action, wallet_id, block_hash, status, ip_address) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := db.Pool.Exec(ctx, query, transactionID, action, walletID, blockHash, status, ipAddress)
	return err
}

func (db *DB) GetSystemLogs(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT id, event_type, wallet_id, ip_address, details, created_at FROM system_logs ORDER BY created_at DESC LIMIT $1`
	
	rows, err := db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var logs []map[string]interface{}
	for rows.Next() {
		var id int64
		var eventType, walletID, ipAddress, details string
		var createdAt time.Time
		
		if err := rows.Scan(&id, &eventType, &walletID, &ipAddress, &details, &createdAt); err != nil {
			continue
		}
		
		logs = append(logs, map[string]interface{}{
			"id":         id,
			"event_type": eventType,
			"wallet_id":  walletID,
			"ip_address": ipAddress,
			"details":    details,
			"created_at": createdAt,
		})
	}
	
	return logs, nil
}

func (db *DB) GetTransactionLogs(ctx context.Context, walletID string, limit int) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	var query string
	var rows interface{ Close() }
	var err error
	
	if walletID == "" {
		query = `SELECT id, transaction_id, action, wallet_id, block_hash, status, ip_address, created_at FROM transaction_logs ORDER BY created_at DESC LIMIT $1`
		rows, err = db.Pool.Query(ctx, query, limit)
	} else {
		query = `SELECT id, transaction_id, action, wallet_id, block_hash, status, ip_address, created_at FROM transaction_logs WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2`
		rows, err = db.Pool.Query(ctx, query, walletID, limit)
	}
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var logs []map[string]interface{}
	pgxRows := rows.(interface {
		Next() bool
		Scan(...interface{}) error
	})
	
	for pgxRows.Next() {
		var id int64
		var transactionID, action, wid, blockHash, status, ipAddress string
		var createdAt time.Time
		
		if err := pgxRows.Scan(&id, &transactionID, &action, &wid, &blockHash, &status, &ipAddress, &createdAt); err != nil {
			continue
		}
		
		logs = append(logs, map[string]interface{}{
			"id":             id,
			"transaction_id": transactionID,
			"action":         action,
			"wallet_id":      wid,
			"block_hash":     blockHash,
			"status":         status,
			"ip_address":     ipAddress,
			"created_at":     createdAt,
		})
	}
	
	return logs, nil
}

// Beneficiary persistence methods

// GetUserIDByWalletID retrieves the numeric user_id from wallets table using wallet_id
func (db *DB) GetUserIDByWalletID(ctx context.Context, walletID string) (int64, error) {
	if db == nil || db.Pool == nil {
		return 0, fmt.Errorf("database not connected")
	}
	
	query := `SELECT user_id FROM wallets WHERE wallet_id = $1`
	var userID int64
	err := db.Pool.QueryRow(ctx, query, walletID).Scan(&userID)
	if err != nil {
		return 0, fmt.Errorf("wallet not found or user_id not set: %v", err)
	}
	
	return userID, nil
}

func (db *DB) AddBeneficiary(ctx context.Context, userID int64, walletID, name, relationship string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `INSERT INTO beneficiaries (user_id, wallet_id, name, relationship) VALUES ($1, $2, $3, $4)`
	_, err := db.Pool.Exec(ctx, query, userID, walletID, name, relationship)
	return err
}

func (db *DB) GetBeneficiaries(ctx context.Context, userID int64) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT id, wallet_id, name, relationship, created_at FROM beneficiaries WHERE user_id = $1 ORDER BY created_at DESC`
	
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var beneficiaries []map[string]interface{}
	for rows.Next() {
		var id int64
		var walletID, name, relationship string
		var createdAt time.Time
		
		if err := rows.Scan(&id, &walletID, &name, &relationship, &createdAt); err != nil {
			continue
		}
		
		beneficiaries = append(beneficiaries, map[string]interface{}{
			"id":           id,
			"wallet_id":    walletID,
			"name":         name,
			"relationship": relationship,
			"created_at":   createdAt,
		})
	}
	
	return beneficiaries, nil
}

func (db *DB) RemoveBeneficiary(ctx context.Context, userID int64, beneficiaryID int64) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `DELETE FROM beneficiaries WHERE id = $1 AND user_id = $2`
	_, err := db.Pool.Exec(ctx, query, beneficiaryID, userID)
	return err
}

// Zakat deduction persistence methods

func (db *DB) SaveZakatDeduction(ctx context.Context, walletID string, amount uint64, month, year int, transactionID string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `INSERT INTO zakat_deductions (wallet_id, amount, month, year, transaction_id) VALUES ($1, $2, $3, $4, $5)`
	_, err := db.Pool.Exec(ctx, query, walletID, amount, month, year, transactionID)
	return err
}

func (db *DB) GetZakatDeductions(ctx context.Context, walletID string) ([]map[string]interface{}, error) {
	if db == nil || db.Pool == nil {
		return []map[string]interface{}{}, nil
	}
	
	query := `SELECT id, wallet_id, amount, month, year, transaction_id, created_at FROM zakat_deductions WHERE wallet_id = $1 ORDER BY created_at DESC`
	
	rows, err := db.Pool.Query(ctx, query, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var deductions []map[string]interface{}
	for rows.Next() {
		var id int64
		var wid, transactionID string
		var amount uint64
		var month, year int
		var createdAt time.Time
		
		if err := rows.Scan(&id, &wid, &amount, &month, &year, &transactionID, &createdAt); err != nil {
			continue
		}
		
		deductions = append(deductions, map[string]interface{}{
			"id":             id,
			"wallet_id":      wid,
			"amount":         amount,
			"month":          month,
			"year":           year,
			"transaction_id": transactionID,
			"created_at":     createdAt,
		})
	}
	
	return deductions, nil
}

// Update wallet balance in database

func (db *DB) UpdateWalletBalance(ctx context.Context, walletID string, balance uint64) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	
	query := `UPDATE wallets SET balance = $1 WHERE wallet_id = $2`
	_, err := db.Pool.Exec(ctx, query, balance, walletID)
	return err
}