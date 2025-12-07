package api

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/gorilla/mux"
    "github.com/rs/cors"

    "blockchain-backend/blockchain"
    "blockchain-backend/database"
    "blockchain-backend/otp"
    "blockchain-backend/services"
    "blockchain-backend/wallet"
)

type Server struct {
    bc      *blockchain.Blockchain
    ws      *wallet.Store
    txSvc   *services.TransactionService
    logSvc  *services.LoggingService
    db      *database.DB
    r       *mux.Router
}

func NewServer(bc *blockchain.Blockchain, ws *wallet.Store, txSvc *services.TransactionService, logSvc *services.LoggingService, db *database.DB) *Server {
    s := &Server{
        bc:     bc,
        ws:     ws,
        txSvc:  txSvc,
        logSvc: logSvc,
        db:     db,
    }
    s.r = mux.NewRouter()
    s.routes()
    return s
}

func (s *Server) Router() http.Handler {
    // Add CORS middleware
    c := cors.New(cors.Options{
        AllowedOrigins: []string{"*"},
        AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders: []string{"*"},
    })
    return c.Handler(s.r)
}

func (s *Server) routes() {
    a := s.r.PathPrefix("/api").Subrouter()
    
    // Wallet operations
    a.HandleFunc("/generate-keypair", s.handleGenerateKeypair).Methods("POST", "OPTIONS")
    a.HandleFunc("/create-wallet", s.handleCreateWallet).Methods("POST", "OPTIONS")
    a.HandleFunc("/wallet/{wallet}", s.handleGetWallet).Methods("GET", "OPTIONS")
    a.HandleFunc("/balance/{wallet}", s.handleGetBalance).Methods("GET", "OPTIONS")
    
    // Transaction operations
    a.HandleFunc("/send", s.handleSend).Methods("POST", "OPTIONS")
    a.HandleFunc("/transactions", s.handleGetTransactions).Methods("GET", "OPTIONS")
    a.HandleFunc("/pending", s.handleGetPending).Methods("GET", "OPTIONS")
    
    // Blockchain operations
    a.HandleFunc("/mine", s.handleMine).Methods("POST", "OPTIONS")
    a.HandleFunc("/blocks", s.handleBlocks).Methods("GET", "OPTIONS")
    a.HandleFunc("/block/{index}", s.handleGetBlock).Methods("GET", "OPTIONS")
    
    // UTXO operations
    a.HandleFunc("/utxos/{wallet}", s.handleGetUTXOs).Methods("GET", "OPTIONS")
    
    // Logging and analytics
    a.HandleFunc("/logs/system", s.handleGetSystemLogs).Methods("GET", "OPTIONS")
    a.HandleFunc("/logs/transactions", s.handleGetTransactionLogs).Methods("GET", "OPTIONS")
    a.HandleFunc("/logs/transactions/{wallet}", s.handleGetWalletTransactionLogs).Methods("GET", "OPTIONS")
    
    // Reports
    a.HandleFunc("/reports/wallet/{wallet}", s.handleWalletReport).Methods("GET", "OPTIONS")
    a.HandleFunc("/reports/system", s.handleSystemReport).Methods("GET", "OPTIONS")
    
    // Beneficiaries
    a.HandleFunc("/beneficiaries/{user_id}", s.handleGetBeneficiaries).Methods("GET", "OPTIONS")
    a.HandleFunc("/beneficiaries", s.handleAddBeneficiary).Methods("POST", "OPTIONS")
    a.HandleFunc("/beneficiaries/{user_id}/{beneficiary_id}", s.handleRemoveBeneficiary).Methods("DELETE", "OPTIONS")
    
    // Zakat
    a.HandleFunc("/zakat/{wallet}", s.handleGetZakatDeductions).Methods("GET", "OPTIONS")
    
    // Profile management
    a.HandleFunc("/profile/{wallet}", s.handleUpdateProfile).Methods("PUT", "OPTIONS")
    
    // OTP operations
    a.HandleFunc("/otp/send", s.handleSendOTP).Methods("POST", "OPTIONS")
    a.HandleFunc("/otp/verify", s.handleVerifyOTP).Methods("POST", "OPTIONS")
    
    // Admin operations
    a.HandleFunc("/admin/check/{wallet}", s.handleCheckAdmin).Methods("GET", "OPTIONS")
    
    // Health check
    a.HandleFunc("/health", s.handleHealth).Methods("GET", "OPTIONS")
}

func (s *Server) handleGenerateKeypair(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    pub, priv := wallet.GenerateKeypair()
    
    s.logSvc.LogSystem("keypair_generated", "", r.RemoteAddr, "New keypair generated")
    
    resp := map[string]string{
        "public": pub,
        "private": priv,
        "warning": "Store private key securely. Never share it.",
    }
    json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleCreateWallet(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        Public  string `json:"public"`
        Private string `json:"private"`
        Name    string `json:"name"`
        Email   string `json:"email"`
        CNIC    string `json:"cnic"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    // Validate email is provided
    if req.Email == "" {
        s.logSvc.LogSystem("wallet_creation_failed", "", r.RemoteAddr, "Email is required")
        http.Error(w, "Email is required", 400)
        return
    }
    
    // Check if email already exists in database
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        
        emailExists, err := s.db.CheckEmailExists(ctx, req.Email)
        if err != nil {
            s.logSvc.LogSystem("email_check_failed", "", r.RemoteAddr, err.Error())
            http.Error(w, "Failed to verify email", 500)
            return
        }
        
        if emailExists {
            s.logSvc.LogSystem("wallet_creation_failed", "", r.RemoteAddr, "Email already registered: "+req.Email)
            http.Error(w, "Email already registered. Please use a different email or login with existing wallet.", 409)
            return
        }
    }
    
    wobj, err := s.ws.CreateFromPub(req.Public, req.Private, req.Name, req.Email, req.CNIC)
    if err != nil {
        s.logSvc.LogSystem("wallet_creation_failed", "", r.RemoteAddr, err.Error())
        http.Error(w, err.Error(), 400)
        return
    }
    
    // Give new wallet initial faucet balance
    faucetUTXO := s.bc.CreateFaucetUTXO(wobj.WalletID)
    s.logSvc.LogSystem("faucet_granted", wobj.WalletID, r.RemoteAddr, fmt.Sprintf("Initial balance of %d coins granted", faucetUTXO.Amount))
    
    // Persist to database if available
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        
        if err := s.db.SaveWallet(ctx, wobj.WalletID, wobj.PublicKey, wobj.PrivateKey, wobj.FullName, wobj.Email, wobj.CNIC); err != nil {
            s.logSvc.LogSystem("wallet_db_save_failed", wobj.WalletID, r.RemoteAddr, err.Error())
            // Continue anyway - wallet is in memory
        } else {
            s.logSvc.LogSystem("wallet_persisted", wobj.WalletID, r.RemoteAddr, "Wallet saved to database")
        }
        
        // Save faucet UTXO to database
        if err := s.db.SaveUTXO(ctx, faucetUTXO.ID, faucetUTXO.Owner, faucetUTXO.Amount, faucetUTXO.OriginTx, faucetUTXO.Index, faucetUTXO.Spent); err != nil {
            s.logSvc.LogSystem("faucet_utxo_db_save_failed", wobj.WalletID, r.RemoteAddr, err.Error())
        }
        
        // Update wallet balance in database
        balance := s.bc.GetBalance(wobj.WalletID)
        if err := s.db.UpdateWalletBalance(ctx, wobj.WalletID, balance); err != nil {
            s.logSvc.LogSystem("balance_update_failed", wobj.WalletID, r.RemoteAddr, err.Error())
        }
    }
    
    s.logSvc.LogSystem("wallet_created", wobj.WalletID, r.RemoteAddr, fmt.Sprintf("Wallet created for %s", req.Name))
    
    json.NewEncoder(w).Encode(wobj)
}

func (s *Server) handleGetWallet(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    wobj, exists := s.ws.Get(wid)
    if !exists {
        http.Error(w, "Wallet not found", 404)
        return
    }
    
    // Don't expose private key in response
    wobj.PrivateKey = "***ENCRYPTED***"
    json.NewEncoder(w).Encode(wobj)
}

func (s *Server) handleGetBalance(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    bal := s.bc.GetBalance(wid)
    json.NewEncoder(w).Encode(map[string]interface{}{"balance": bal, "wallet_id": wid})
}

func (s *Server) handleSend(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        SenderID   string `json:"sender_id"`
        ReceiverID string `json:"receiver_id"`
        Amount     uint64 `json:"amount"`
        Note       string `json:"note"`
        PrivateKey string `json:"private_key"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    // Get sender wallet to get public key
    sender, exists := s.ws.Get(req.SenderID)
    if !exists {
        s.logSvc.LogSystem("send_failed", req.SenderID, r.RemoteAddr, "Sender wallet not found")
        http.Error(w, "Sender wallet not found", 404)
        return
    }
    
    // Decrypt private key if it's encrypted
    privateKey := req.PrivateKey
    // Check if private key is encrypted (contains non-hex characters or is too long)
    if len(privateKey) > 128 || !isHexString(privateKey) {
        decryptedKey, err := wallet.DecryptPrivateKey(privateKey)
        if err != nil {
            s.logSvc.LogSystem("send_failed", req.SenderID, r.RemoteAddr, "Failed to decrypt private key: "+err.Error())
            http.Error(w, "Invalid private key", 400)
            return
        }
        privateKey = decryptedKey
    }
    
    // Create transaction with full UTXO logic
    tx, err := s.txSvc.CreateTransaction(req.SenderID, req.ReceiverID, req.Amount, req.Note, sender.PublicKey, privateKey)
    if err != nil {
        s.logSvc.LogSystem("send_failed", req.SenderID, r.RemoteAddr, err.Error())
        http.Error(w, err.Error(), 400)
        return
    }
    
    // Validate transaction
    if err := s.txSvc.ValidateTransaction(tx); err != nil {
        s.logSvc.LogSystem("transaction_validation_failed", req.SenderID, r.RemoteAddr, err.Error())
        http.Error(w, "Transaction validation failed: "+err.Error(), 400)
        return
    }
    
    // Add to pending
    s.bc.AddPending(*tx)
    s.logSvc.LogTransaction(tx.ID, "created", req.SenderID, "", "pending", r.RemoteAddr)
    
    // Persist pending transaction to database
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        
        if err := s.db.SaveTransaction(ctx, tx.ID, tx.SenderID, tx.ReceiverID, tx.Amount, tx.Note, tx.Timestamp, tx.PubKey, tx.Signature, tx.Type, nil, "pending"); err != nil {
            s.logSvc.LogSystem("transaction_db_save_failed", req.SenderID, r.RemoteAddr, err.Error())
        }
        
        if err := s.db.SaveTransactionLog(ctx, tx.ID, "created", req.SenderID, "", "pending", r.RemoteAddr); err != nil {
            s.logSvc.LogSystem("txlog_db_save_failed", req.SenderID, r.RemoteAddr, err.Error())
        }
    }
    
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status": "success",
        "txid": tx.ID,
        "message": "Transaction added to pending pool",
    })
}

func (s *Server) handleGetTransactions(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var allTxs []blockchain.Transaction
    for _, block := range s.bc.Chain {
        allTxs = append(allTxs, block.Transactions...)
    }
    
    json.NewEncoder(w).Encode(allTxs)
}

func (s *Server) handleGetPending(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(s.bc.GetPending())
}

func (s *Server) handleMine(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        MinerWalletID string `json:"miner_wallet_id"`
        Start         int64  `json:"start,omitempty"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    if req.MinerWalletID == "" {
        http.Error(w, "Miner wallet ID is required", 400)
        return
    }
    
    // Verify miner wallet exists
    if _, exists := s.ws.Get(req.MinerWalletID); !exists {
        http.Error(w, "Miner wallet not found", 404)
        return
    }
    
    ns := req.Start
    if ns == 0 {
        ns = 0 // Default nonce start
    }
    
    blk := s.bc.Mine(ns, req.MinerWalletID)
    
    // Collect all wallet IDs that need balance updates
    affectedWallets := make(map[string]bool)
    for _, tx := range blk.Transactions {
        if tx.SenderID != "COINBASE" && tx.SenderID != "" {
            affectedWallets[tx.SenderID] = true
        }
        if tx.ReceiverID != "" {
            affectedWallets[tx.ReceiverID] = true
        }
    }
    
    // Persist block to database
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()
        
        if err := s.db.SaveBlock(ctx, blk.Index, blk.Timestamp, blk.PreviousHash, blk.Hash, blk.Nonce, blk.MerkleRoot); err != nil {
            s.logSvc.LogSystem("block_db_save_failed", "", r.RemoteAddr, err.Error())
        }
        
        // Persist all transactions in the block
        for _, tx := range blk.Transactions {
            blockIdx := blk.Index
            if err := s.db.SaveTransaction(ctx, tx.ID, tx.SenderID, tx.ReceiverID, tx.Amount, tx.Note, tx.Timestamp, tx.PubKey, tx.Signature, tx.Type, &blockIdx, "confirmed"); err != nil {
                s.logSvc.LogSystem("transaction_db_save_failed", tx.SenderID, r.RemoteAddr, err.Error())
            }
        }
        
        // Persist UTXOs
        s.bc.RLock()
        for _, utxo := range s.bc.UTXOs {
            if err := s.db.SaveUTXO(ctx, utxo.ID, utxo.Owner, utxo.Amount, utxo.OriginTx, utxo.Index, utxo.Spent); err != nil {
                s.logSvc.LogSystem("utxo_db_save_failed", "", r.RemoteAddr, err.Error())
            }
        }
        s.bc.RUnlock()
        
        // Update wallet balances in database for all affected wallets
        for walletID := range affectedWallets {
            balance := s.bc.GetBalance(walletID)
            if err := s.db.UpdateWalletBalance(ctx, walletID, balance); err != nil {
                s.logSvc.LogSystem("balance_update_failed", walletID, r.RemoteAddr, err.Error())
            }
        }
    }
    
    // Log all transactions in the mined block
    for _, tx := range blk.Transactions {
        s.logSvc.LogTransaction(tx.ID, "mined", tx.SenderID, blk.Hash, "confirmed", r.RemoteAddr)
        
        // Persist transaction log to database
        if s.db != nil {
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            s.db.SaveTransactionLog(ctx, tx.ID, "mined", tx.SenderID, blk.Hash, "confirmed", r.RemoteAddr)
            cancel()
        }
    }
    
    s.logSvc.LogSystem("block_mined", "", r.RemoteAddr, fmt.Sprintf("Block #%d mined with %d transactions", blk.Index, len(blk.Transactions)))
    
    // Persist system log to database
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        s.db.SaveSystemLog(ctx, "block_mined", "", r.RemoteAddr, fmt.Sprintf("Block #%d mined with %d transactions", blk.Index, len(blk.Transactions)))
        cancel()
    }
    
    json.NewEncoder(w).Encode(blk)
}

func (s *Server) handleBlocks(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(s.bc.Chain)
}

func (s *Server) handleGetBlock(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    indexStr := vars["index"]
    
    index, err := strconv.ParseInt(indexStr, 10, 64)
    if err != nil {
        http.Error(w, "Invalid block index", 400)
        return
    }
    
    if index < 0 || int(index) >= len(s.bc.Chain) {
        http.Error(w, "Block not found", 404)
        return
    }
    
    json.NewEncoder(w).Encode(s.bc.Chain[index])
}

func (s *Server) handleGetUTXOs(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    var utxos []blockchain.UTXO
    for _, utxo := range s.bc.UTXOs {
        if utxo.Owner == wid && !utxo.Spent {
            utxos = append(utxos, utxo)
        }
    }
    
    json.NewEncoder(w).Encode(utxos)
}

func (s *Server) handleGetSystemLogs(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    limitStr := r.URL.Query().Get("limit")
    limit := 100
    if limitStr != "" {
        if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
            limit = l
        }
    }
    
    logs := s.logSvc.GetSystemLogs(limit)
    json.NewEncoder(w).Encode(logs)
}

func (s *Server) handleGetTransactionLogs(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    limitStr := r.URL.Query().Get("limit")
    limit := 100
    if limitStr != "" {
        if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
            limit = l
        }
    }
    
    logs := s.logSvc.GetTransactionLogs("", limit)
    json.NewEncoder(w).Encode(logs)
}

func (s *Server) handleGetWalletTransactionLogs(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    limitStr := r.URL.Query().Get("limit")
    limit := 100
    if limitStr != "" {
        if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
            limit = l
        }
    }
    
    logs := s.logSvc.GetTransactionLogs(wid, limit)
    json.NewEncoder(w).Encode(logs)
}

func (s *Server) handleWalletReport(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    balance := s.bc.GetBalance(wid)
    
    var sent, received uint64 = 0, 0
    var sentCount, receivedCount int = 0, 0
    
    for _, block := range s.bc.Chain {
        for _, tx := range block.Transactions {
            if tx.SenderID == wid {
                sent += tx.Amount
                sentCount++
            }
            if tx.ReceiverID == wid {
                received += tx.Amount
                receivedCount++
            }
        }
    }
    
    report := map[string]interface{}{
        "wallet_id":       wid,
        "balance":         balance,
        "total_sent":      sent,
        "total_received":  received,
        "sent_count":      sentCount,
        "received_count":  receivedCount,
    }
    
    json.NewEncoder(w).Encode(report)
}

func (s *Server) handleSystemReport(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    totalBlocks := len(s.bc.Chain)
    var totalTxs int
    for _, block := range s.bc.Chain {
        totalTxs += len(block.Transactions)
    }
    
    report := map[string]interface{}{
        "total_blocks":       totalBlocks,
        "total_transactions": totalTxs,
        "pending_transactions": len(s.bc.GetPending()),
        "total_utxos":        len(s.bc.UTXOs),
        "difficulty":         s.bc.DifficultyPref,
    }
    
    json.NewEncoder(w).Encode(report)
}

func (s *Server) handleSendOTP(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        Email string `json:"email"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    if req.Email == "" {
        http.Error(w, "Email is required", 400)
        return
    }
    
    code := otp.StoreOTP(req.Email)
    s.logSvc.LogSystem("otp_sent", "", r.RemoteAddr, fmt.Sprintf("OTP sent to %s", req.Email))
    
    // In production, send email here using SendGrid, AWS SES, etc.
    // For now, we'll just return the code in the response (DEMO ONLY)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status":  "success",
        "message": "OTP sent to email",
        "code":    code, // Remove this in production!
    })
}

func (s *Server) handleVerifyOTP(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        Email string `json:"email"`
        Code  string `json:"code"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    if req.Email == "" || req.Code == "" {
        http.Error(w, "Email and code are required", 400)
        return
    }
    
    if otp.VerifyOTP(req.Email, req.Code) {
        s.logSvc.LogSystem("otp_verified", "", r.RemoteAddr, fmt.Sprintf("OTP verified for %s", req.Email))
        json.NewEncoder(w).Encode(map[string]interface{}{
            "status":   "success",
            "verified": true,
            "message":  "OTP verified successfully",
        })
    } else {
        s.logSvc.LogSystem("otp_verification_failed", "", r.RemoteAddr, fmt.Sprintf("OTP verification failed for %s", req.Email))
        http.Error(w, "Invalid or expired OTP", 400)
    }
}

func (s *Server) handleCheckAdmin(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    walletID := vars["wallet"]
    
    if s.db == nil {
        json.NewEncoder(w).Encode(map[string]interface{}{"is_admin": false})
        return
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    isAdmin, err := s.db.IsAdmin(ctx, walletID)
    if err != nil {
        json.NewEncoder(w).Encode(map[string]interface{}{"is_admin": false})
        return
    }
    
    json.NewEncoder(w).Encode(map[string]interface{}{"is_admin": isAdmin})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    walletID := vars["wallet"]
    
    var req struct {
        FullName string `json:"full_name"`
        Email    string `json:"email"`
        CNIC     string `json:"cnic"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    // Verify wallet exists
    wobj, exists := s.ws.Get(walletID)
    if !exists {
        http.Error(w, "Wallet not found", 404)
        return
    }
    
    // Update wallet in memory
    wobj.FullName = req.FullName
    wobj.Email = req.Email
    wobj.CNIC = req.CNIC
    s.ws.Save(wobj)
    
    // Update in database
    if s.db != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        
        if err := s.db.UpdateUserProfile(ctx, walletID, req.FullName, req.Email, req.CNIC); err != nil {
            s.logSvc.LogSystem("profile_update_failed", walletID, r.RemoteAddr, err.Error())
            http.Error(w, "Failed to update profile", 500)
            return
        }
    }
    
    s.logSvc.LogSystem("profile_updated", walletID, r.RemoteAddr, "Profile updated successfully")
    
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status": "success",
        "message": "Profile updated successfully",
        "wallet": wobj,
    })
}

func (s *Server) handleGetBeneficiaries(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    walletID := vars["user_id"] // Actually wallet_id from frontend
    
    if s.db == nil {
        json.NewEncoder(w).Encode([]map[string]interface{}{})
        return
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // Get user_id from wallet_id
    userID, err := s.db.GetUserIDByWalletID(ctx, walletID)
    if err != nil {
        // If wallet not found in DB, return empty list (user hasn't synced to DB yet)
        json.NewEncoder(w).Encode([]map[string]interface{}{})
        return
    }
    
    beneficiaries, err := s.db.GetBeneficiaries(ctx, userID)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    
    json.NewEncoder(w).Encode(beneficiaries)
}

func (s *Server) handleAddBeneficiary(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    
    var req struct {
        UserID              string `json:"user_id"`                // wallet_id from frontend
        BeneficiaryName     string `json:"beneficiary_name"`
        BeneficiaryWalletID string `json:"beneficiary_wallet_id"`
        Relationship        string `json:"relationship"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", 400)
        return
    }
    
    if s.db == nil {
        http.Error(w, "Database not connected", 503)
        return
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // Get numeric user_id from wallet_id
    userID, err := s.db.GetUserIDByWalletID(ctx, req.UserID)
    if err != nil {
        http.Error(w, "User not found: "+err.Error(), 404)
        return
    }
    
    // Default relationship to "Other" if empty
    relationship := req.Relationship
    if relationship == "" {
        relationship = "Other"
    }
    
    if err := s.db.AddBeneficiary(ctx, userID, req.BeneficiaryWalletID, req.BeneficiaryName, relationship); err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    
    s.logSvc.LogSystem("beneficiary_added", req.BeneficiaryWalletID, r.RemoteAddr, fmt.Sprintf("User %s added beneficiary %s", req.UserID, req.BeneficiaryWalletID))
    
    json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Beneficiary added"})
}

func (s *Server) handleRemoveBeneficiary(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    walletID := vars["user_id"] // Actually wallet_id from frontend
    beneficiaryIDStr := vars["beneficiary_id"]
    
    beneficiaryID, err := strconv.ParseInt(beneficiaryIDStr, 10, 64)
    if err != nil {
        http.Error(w, "Invalid beneficiary ID", 400)
        return
    }
    
    if s.db == nil {
        http.Error(w, "Database not connected", 503)
        return
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // Get numeric user_id from wallet_id
    userID, err := s.db.GetUserIDByWalletID(ctx, walletID)
    if err != nil {
        http.Error(w, "User not found: "+err.Error(), 404)
        return
    }
    
    if err := s.db.RemoveBeneficiary(ctx, userID, beneficiaryID); err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    
    s.logSvc.LogSystem("beneficiary_removed", "", r.RemoteAddr, fmt.Sprintf("User %s removed beneficiary %d", walletID, beneficiaryID))
    
    json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Beneficiary removed"})
}

func (s *Server) handleGetZakatDeductions(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    vars := mux.Vars(r)
    wid := vars["wallet"]
    
    if s.db == nil {
        json.NewEncoder(w).Encode([]map[string]interface{}{})
        return
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    deductions, err := s.db.GetZakatDeductions(ctx, wid)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    
    json.NewEncoder(w).Encode(deductions)
}

// Helper function to check if a string is valid hexadecimal
func isHexString(s string) bool {
    for _, c := range s {
        if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
            return false
        }
    }
    return len(s) > 0
}
