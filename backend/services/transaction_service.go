package services

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"blockchain-backend/blockchain"
	"blockchain-backend/wallet"
)

type TransactionService struct {
	bc *blockchain.Blockchain
	ws *wallet.Store
}

func NewTransactionService(bc *blockchain.Blockchain, ws *wallet.Store) *TransactionService {
	return &TransactionService{bc: bc, ws: ws}
}

// SelectUTXOs selects UTXOs for a transaction using a greedy algorithm
func (ts *TransactionService) SelectUTXOs(walletID string, amount uint64) ([]blockchain.UTXO, uint64, error) {
	ts.bc.RLock()
	defer ts.bc.RUnlock()

	var available []blockchain.UTXO
	for _, utxo := range ts.bc.UTXOs {
		if utxo.Owner == walletID && !utxo.Spent {
			available = append(available, utxo)
		}
	}

	// Sort by amount descending for greedy selection
	sort.Slice(available, func(i, j int) bool {
		return available[i].Amount > available[j].Amount
	})

	var selected []blockchain.UTXO
	var total uint64 = 0

	for _, utxo := range available {
		if total >= amount {
			break
		}
		selected = append(selected, utxo)
		total += utxo.Amount
	}

	if total < amount {
		return nil, 0, errors.New("insufficient balance")
	}

	return selected, total, nil
}

// CreateTransaction creates a properly structured transaction with UTXOs
func (ts *TransactionService) CreateTransaction(senderID, receiverID string, amount uint64, note, pubKey, privKey string) (*blockchain.Transaction, error) {
	// Validate sender wallet exists
	_, exists := ts.ws.Get(senderID)
	if !exists {
		return nil, errors.New("sender wallet does not exist")
	}

	// Validate receiver wallet exists
	_, exists = ts.ws.Get(receiverID)
	if !exists {
		return nil, errors.New("receiver wallet does not exist")
	}

	// Select UTXOs
	selectedUTXOs, total, err := ts.SelectUTXOs(senderID, amount)
	if err != nil {
		return nil, err
	}

	// Create transaction ID
	txID := fmt.Sprintf("tx-%d", time.Now().UnixNano())
	timestamp := time.Now().Unix()

	// Build inputs
	var inputs []blockchain.UTXORef
	for _, utxo := range selectedUTXOs {
		inputs = append(inputs, blockchain.UTXORef{
			TxID:  utxo.OriginTx,
			Index: utxo.Index,
		})
	}

	// Build outputs
	var outputs []blockchain.UTXO
	
	// Output to receiver
	outputs = append(outputs, blockchain.UTXO{
		Owner:    receiverID,
		Amount:   amount,
		OriginTx: txID,
		Index:    0,
		Spent:    false,
	})

	// Change output to sender
	change := total - amount
	if change > 0 {
		outputs = append(outputs, blockchain.UTXO{
			Owner:    senderID,
			Amount:   change,
			OriginTx: txID,
			Index:    1,
			Spent:    false,
		})
	}

	// Create signature payload
	payload := wallet.MarshalPayload(senderID, receiverID, amount, timestamp, note)
	signature, err := wallet.SignWithPriv(privKey, payload)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %v", err)
	}

	tx := &blockchain.Transaction{
		ID:         txID,
		SenderID:   senderID,
		ReceiverID: receiverID,
		Amount:     amount,
		Note:       note,
		Timestamp:  timestamp,
		PubKey:     pubKey,
		Signature:  signature,
		Inputs:     inputs,
		Outputs:    outputs,
		Type:       "transfer",
	}

	return tx, nil
}

// ValidateTransaction validates a transaction signature and inputs
func (ts *TransactionService) ValidateTransaction(tx *blockchain.Transaction) error {
	// Verify signature
	payload := wallet.MarshalPayload(tx.SenderID, tx.ReceiverID, tx.Amount, tx.Timestamp, tx.Note)
	valid, err := wallet.VerifySignature(tx.PubKey, payload, tx.Signature)
	if err != nil {
		return fmt.Errorf("signature verification error: %v", err)
	}
	if !valid {
		return errors.New("invalid signature")
	}

	// Verify sender's public key matches wallet
	expectedWalletID, err := wallet.WalletIDFromPub(tx.PubKey)
	if err != nil {
		return err
	}
	if expectedWalletID != tx.SenderID {
		return errors.New("public key does not match sender wallet ID")
	}

	// Verify UTXOs are unspent and owned by sender
	ts.bc.RLock()
	defer ts.bc.RUnlock()

	for _, input := range tx.Inputs {
		utxoKey := fmt.Sprintf("%s:%d", input.TxID, input.Index)
		utxo, exists := ts.bc.UTXOs[utxoKey]
		if !exists {
			return fmt.Errorf("UTXO %s not found", utxoKey)
		}
		if utxo.Spent {
			return fmt.Errorf("UTXO %s already spent (double-spend attempt)", utxoKey)
		}
		if utxo.Owner != tx.SenderID {
			return fmt.Errorf("UTXO %s not owned by sender", utxoKey)
		}
	}

	// Verify input amounts match output amounts
	var inputTotal uint64 = 0
	for _, input := range tx.Inputs {
		utxoKey := fmt.Sprintf("%s:%d", input.TxID, input.Index)
		utxo := ts.bc.UTXOs[utxoKey]
		inputTotal += utxo.Amount
	}

	var outputTotal uint64 = 0
	for _, output := range tx.Outputs {
		outputTotal += output.Amount
	}

	if inputTotal != outputTotal {
		return fmt.Errorf("input total (%d) does not match output total (%d)", inputTotal, outputTotal)
	}

	return nil
}

// CreateZakatTransaction creates a system zakat deduction transaction
func (ts *TransactionService) CreateZakatTransaction(walletID string, zakatAmount uint64) (*blockchain.Transaction, error) {
	zakatPoolWallet := "ZAKAT_POOL"
	
	// Select UTXOs for zakat
	selectedUTXOs, total, err := ts.SelectUTXOs(walletID, zakatAmount)
	if err != nil {
		return nil, err
	}

	txID := fmt.Sprintf("zakat-%d", time.Now().UnixNano())
	timestamp := time.Now().Unix()

	var inputs []blockchain.UTXORef
	for _, utxo := range selectedUTXOs {
		inputs = append(inputs, blockchain.UTXORef{
			TxID:  utxo.OriginTx,
			Index: utxo.Index,
		})
	}

	var outputs []blockchain.UTXO
	
	// Output to zakat pool
	outputs = append(outputs, blockchain.UTXO{
		Owner:    zakatPoolWallet,
		Amount:   zakatAmount,
		OriginTx: txID,
		Index:    0,
		Spent:    false,
	})

	// Change back to wallet
	change := total - zakatAmount
	if change > 0 {
		outputs = append(outputs, blockchain.UTXO{
			Owner:    walletID,
			Amount:   change,
			OriginTx: txID,
			Index:    1,
			Spent:    false,
		})
	}

	tx := &blockchain.Transaction{
		ID:         txID,
		SenderID:   walletID,
		ReceiverID: zakatPoolWallet,
		Amount:     zakatAmount,
		Note:       "Monthly Zakat Deduction (2.5%)",
		Timestamp:  timestamp,
		PubKey:     "system",
		Signature:  "system",
		Inputs:     inputs,
		Outputs:    outputs,
		Type:       "zakat_deduction",
	}

	return tx, nil
}
