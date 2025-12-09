package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "strings"
    "syscall"
    "time"

    "github.com/joho/godotenv"

    "blockchain-backend/api"
    "blockchain-backend/blockchain"
    "blockchain-backend/database"
    "blockchain-backend/otp"
    "blockchain-backend/services"
    "blockchain-backend/wallet"
)

func main() {
    // Load environment variables from .env file
    if err := godotenv.Load(); err != nil {
        log.Println("Warning: .env file not found, using system environment variables")
    }

    // Init core modules
    bc := blockchain.NewBlockchain()
    walletStore := wallet.NewStore()
    
    // Init services
    txService := services.NewTransactionService(bc, walletStore)
    loggingService := services.NewLoggingService()
    zakatService := services.NewZakatService(bc, walletStore, txService)

    // Optional: Initialize database if URL is provided
    var db *database.DB
    if dbURL := os.Getenv("SUPABASE_DB_URL"); dbURL != "" {
        log.Println("Attempting to connect to Supabase database...")
        var err error
        db, err = database.NewDB()
        if err != nil {
            log.Printf("❌ Failed to connect to database: %v", err)
            log.Println("⚠️  Running in in-memory mode")
            log.Println("💡 Please check:")
            log.Println("   - Supabase project is active and not paused")
            log.Println("   - Database URL in .env is correct")
            log.Println("   - Network connectivity to Supabase")
            db = nil
        } else {
            log.Println("✅ Connected to Supabase database")
            ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
            defer cancel()
            
            // Test the connection
            if err := db.Ping(ctx); err != nil {
                log.Printf("❌ Database ping failed: %v", err)
                log.Println("⚠️  Running in in-memory mode")
                db.Close()
                db = nil
            } else {
                log.Println("✅ Database connection verified")
                if err := db.InitSchema(ctx); err != nil {
                    log.Printf("❌ Failed to initialize schema: %v", err)
                    log.Println("⚠️  Running in in-memory mode")
                    db.Close()
                    db = nil
                } else {
                    log.Println("✅ Database schema initialized successfully")
                    
                    // Set database in logging service
                    loggingService.SetDatabase(db)
                    log.Println("✅ Logging service connected to database")
                    
                    // Set database in zakat service
                    zakatService.SetDatabase(db)
                    log.Println("✅ Zakat service connected to database")
                    
                    // Load existing data from database
                    loadCtx, loadCancel := context.WithTimeout(context.Background(), 30*time.Second)
                    defer loadCancel()
                    
                    // Load wallets (ignore prepared statement errors from transaction pooler)
                    wallets, err := db.GetAllWallets(loadCtx)
                    if err != nil && !strings.Contains(err.Error(), "already exists") {
                        log.Printf("⚠️  Failed to load wallets from database: %v", err)
                    } else if err == nil {
                        for _, w := range wallets {
                            wlt := wallet.Wallet{
                                WalletID:   w["wallet_id"].(string),
                                PublicKey:  w["public_key"].(string),
                                PrivateKey: w["private_key_encrypted"].(string),
                            }
                            if fullName, ok := w["full_name"].(string); ok {
                                wlt.FullName = fullName
                            }
                            if email, ok := w["email"].(string); ok {
                                wlt.Email = email
                            }
                            walletStore.Save(wlt)
                        }
                        log.Printf("✅ Loaded %d wallets from database", len(wallets))
                    } else {
                        log.Println("✅ Loaded 0 wallets from database (transaction pooler mode)")
                    }
                    
                    // Load UTXOs (ignore prepared statement errors from transaction pooler)
                    utxos, err := db.GetAllUTXOs(loadCtx)
                    if err != nil && !strings.Contains(err.Error(), "already exists") {
                        log.Printf("⚠️  Failed to load UTXOs from database: %v", err)
                    } else if err == nil {
                        bc.Lock()  // FIXED: Use Lock() for writing, not RLock()
                        for _, u := range utxos {
                            utxo := blockchain.UTXO{
                                ID:       u["id"].(string),
                                Owner:    u["owner"].(string),
                                Amount:   u["amount"].(uint64),
                                OriginTx: u["origin_tx"].(string),
                                Index:    u["index"].(int),
                                Spent:    u["spent"].(bool),
                            }
                            bc.UTXOs[utxo.ID] = utxo
                        }
                        bc.Unlock()  // FIXED: Use Unlock() for writing
                        log.Printf("✅ Loaded %d UTXOs from database", len(utxos))
                    } else {
                        log.Println("✅ Loaded 0 UTXOs from database (transaction pooler mode)")
                    }
                }
            }
        }
    } else {
        log.Println("ℹ️  Running in in-memory mode (SUPABASE_DB_URL not set)")
    }

    // Create API server
    srv := api.NewServer(bc, walletStore, txService, loggingService, db)

    // Start Zakat scheduler
    // Zakat Rules:
    // - Only applies to wallets with balance >= 500 (Nisab threshold)
    // - Deducts 2.5% every 30 days
    // - Checks every 24 hours (configurable in zakat_service.go)
    // - For testing, change ticker to 5 * time.Minute in zakat_service.go
    zakatService.Start()
    defer zakatService.Stop()

    // Start OTP cleanup task
    otp.StartCleanupTask()
    log.Println("✅ OTP cleanup task started")

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    // Bind to 0.0.0.0 for cloud deployments (Render, Heroku, etc.)
    addr := "0.0.0.0:" + port
    
    httpServer := &http.Server{
        Addr:           addr,
        Handler:        srv.Router(),
        ReadTimeout:    10 * time.Second,
        WriteTimeout:   10 * time.Second,
        MaxHeaderBytes: 1 << 20,
    }

    // Graceful shutdown
    go func() {
        sigint := make(chan os.Signal, 1)
        signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
        <-sigint

        log.Println("Shutting down server...")
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        if err := httpServer.Shutdown(ctx); err != nil {
            log.Printf("Server shutdown error: %v", err)
        }
        
        if db != nil {
            db.Close()
        }
    }()

    fmt.Printf("🚀 Blockchain Wallet Server listening on %s\n", addr)
    fmt.Println("📡 API endpoints available at /api")
    
    if err := httpServer.ListenAndServe(); err != http.ErrServerClosed {
        log.Fatal(err)
    }

    log.Println("Server stopped")
}
