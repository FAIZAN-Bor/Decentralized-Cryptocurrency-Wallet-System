package blockchain

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "sort"
    "strings"
    "sync"
    "time"
)

const (
    MiningReward = 50   // Coins rewarded for mining a block
    FaucetAmount = 1000 // Initial coins for new wallets
)

type Transaction struct {
    ID          string            `json:"id"`
    SenderID    string            `json:"sender_id"`
    ReceiverID  string            `json:"receiver_id"`
    Amount      uint64            `json:"amount"`
    Note        string            `json:"note,omitempty"`
    Timestamp   int64             `json:"timestamp"`
    PubKey      string            `json:"pubkey"`
    Signature   string            `json:"signature"`
    Inputs      []UTXORef         `json:"inputs"`
    Outputs     []UTXO            `json:"outputs"`
    Type        string            `json:"type"`
}

type UTXORef struct {
    TxID  string `json:"txid"`
    Index int    `json:"index"`
}

type UTXO struct {
    ID        string `json:"id"`
    Owner     string `json:"owner"`
    Amount    uint64 `json:"amount"`
    OriginTx  string `json:"origin_tx"`
    Index     int    `json:"index"`
    Spent     bool   `json:"spent"`
}

type Block struct {
    Index       int64         `json:"index"`
    Timestamp   int64         `json:"timestamp"`
    Transactions []Transaction `json:"transactions"`
    PreviousHash string       `json:"previous_hash"`
    Nonce        int64        `json:"nonce"`
    Hash         string       `json:"hash"`
    MerkleRoot   string       `json:"merkle_root"`
}

type Blockchain struct {
	mu             sync.RWMutex
	Chain          []Block
	Pending        []Transaction
	UTXOs          map[string]UTXO
	DifficultyPref string
}

func (bc *Blockchain) RLock() {
	bc.mu.RLock()
}

func (bc *Blockchain) RUnlock() {
	bc.mu.RUnlock()
}

func (bc *Blockchain) Lock() {
	bc.mu.Lock()
}

func (bc *Blockchain) Unlock() {
	bc.mu.Unlock()
}

func (bc *Blockchain) GetPending() []Transaction {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return bc.Pending
}

func NewBlockchain() *Blockchain {
    bc := &Blockchain{
        Chain: make([]Block, 0),
        Pending: make([]Transaction, 0),
        UTXOs: make(map[string]UTXO),
        DifficultyPref: "00000",
    }
    // create genesis
    genesis := Block{
        Index: 0,
        Timestamp: time.Now().Unix(),
        Transactions: []Transaction{},
        PreviousHash: "0",
        Nonce: 0,
    }
    genesis.MerkleRoot = bc.computeMerkle(genesis.Transactions)
    genesis.Hash = bc.hashBlock(genesis)
    bc.Chain = append(bc.Chain, genesis)
    return bc
}

func (bc *Blockchain) computeMerkle(txs []Transaction) string {
    if len(txs) == 0 {
        return ""
    }
    var hashes []string
    for _, t := range txs {
        h := sha256.Sum256([]byte(t.ID))
        hashes = append(hashes, hex.EncodeToString(h[:]))
    }
    for len(hashes) > 1 {
        var next []string
        for i := 0; i < len(hashes); i += 2 {
            if i+1 < len(hashes) {
                a := hashes[i]
                b := hashes[i+1]
                h := sha256.Sum256([]byte(a + b))
                next = append(next, hex.EncodeToString(h[:]))
            } else {
                next = append(next, hashes[i])
            }
        }
        hashes = next
    }
    return hashes[0]
}

func (bc *Blockchain) hashBlock(b Block) string {
    // deterministic hash of block
    var parts []string
    parts = append(parts, string(b.Index))
    parts = append(parts, string(b.Timestamp))
    // collect tx ids
    var txs []string
    for _, t := range b.Transactions {
        txs = append(txs, t.ID)
    }
    sort.Strings(txs)
    parts = append(parts, strings.Join(txs, ","))
    parts = append(parts, b.PreviousHash)
    parts = append(parts, string(b.Nonce))
    joined := strings.Join(parts, "|")
    h := sha256.Sum256([]byte(joined))
    return hex.EncodeToString(h[:])
}

func (bc *Blockchain) AddPending(tx Transaction) {
    bc.mu.Lock()
    defer bc.mu.Unlock()
    bc.Pending = append(bc.Pending, tx)
}

func (bc *Blockchain) Mine(nonceStart int64, minerWalletID string) Block {
    bc.mu.Lock()
    defer bc.mu.Unlock()
    b := Block{}
    b.Index = int64(len(bc.Chain))
    b.Timestamp = time.Now().Unix()
    
    // Create coinbase transaction (mining reward)
    coinbaseTx := Transaction{
        ID:         fmt.Sprintf("coinbase-%d-%d", b.Index, b.Timestamp),
        SenderID:   "COINBASE",
        ReceiverID: minerWalletID,
        Amount:     MiningReward,
        Note:       fmt.Sprintf("Mining reward for block #%d", b.Index),
        Timestamp:  b.Timestamp,
        PubKey:     "SYSTEM",
        Signature:  "COINBASE",
        Inputs:     []UTXORef{}, // No inputs - coins created from nothing
        Outputs: []UTXO{
            {
                Owner:    minerWalletID,
                Amount:   MiningReward,
                OriginTx: fmt.Sprintf("coinbase-%d-%d", b.Index, b.Timestamp),
                Index:    0,
                Spent:    false,
            },
        },
        Type: "mining_reward",
    }
    
    // Add coinbase transaction first, then pending transactions
    b.Transactions = append([]Transaction{coinbaseTx}, bc.Pending...)
    b.PreviousHash = bc.Chain[len(bc.Chain)-1].Hash
    b.MerkleRoot = bc.computeMerkle(b.Transactions)

    nonce := nonceStart
    maxIterations := int64(10000000) // Prevent infinite loop - 10 million attempts
    for i := int64(0); i < maxIterations; i++ {
        b.Nonce = nonce
        h := bc.hashBlock(b)
        if strings.HasPrefix(h, bc.DifficultyPref) {
            b.Hash = h
            break
        }
        nonce++
    }
    
    // If we didn't find a valid hash, use what we have (shouldn't happen with 00000 difficulty)
    if b.Hash == "" {
        b.Hash = bc.hashBlock(b)
    }

    // commit
    bc.Chain = append(bc.Chain, b)
    // mark UTXOs with correct key format
    for _, tx := range b.Transactions {
        for _, in := range tx.Inputs {
            key := fmt.Sprintf("%s:%d", in.TxID, in.Index)
            if ut, ok := bc.UTXOs[key]; ok {
                ut.Spent = true
                bc.UTXOs[key] = ut
            }
        }
        for idx, out := range tx.Outputs {
            key := fmt.Sprintf("%s:%d", tx.ID, idx)
            out.ID = key
            bc.UTXOs[key] = out
        }
    }
    // clear pending
    bc.Pending = []Transaction{}
    return b
}

func (bc *Blockchain) GetBalance(walletID string) uint64 {
    bc.mu.RLock()
    defer bc.mu.RUnlock()
    var sum uint64 = 0
    for _, ut := range bc.UTXOs {
        if ut.Owner == walletID && !ut.Spent {
            sum += ut.Amount
        }
    }
    return sum
}

// CreateFaucetUTXO gives new wallets initial balance
func (bc *Blockchain) CreateFaucetUTXO(walletID string) UTXO {
    bc.mu.Lock()
    defer bc.mu.Unlock()
    
    timestamp := time.Now().Unix()
    utxoID := fmt.Sprintf("faucet-%s-%d:0", walletID, timestamp)
    
    faucetUTXO := UTXO{
        ID:       utxoID,
        Owner:    walletID,
        Amount:   FaucetAmount,
        OriginTx: fmt.Sprintf("faucet-%s-%d", walletID, timestamp),
        Index:    0,
        Spent:    false,
    }
    
    bc.UTXOs[utxoID] = faucetUTXO
    return faucetUTXO
}
