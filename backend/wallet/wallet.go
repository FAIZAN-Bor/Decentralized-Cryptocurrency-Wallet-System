package wallet

import (
    "blockchain-backend/crypto"
    "crypto/ed25519"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "errors"
    "os"
    "sync"
)

type Wallet struct {
    WalletID   string `json:"wallet_id"`
    PublicKey  string `json:"public_key"`
    PrivateKey string `json:"private_key_encrypted"`
    FullName   string `json:"full_name,omitempty"`
    Email      string `json:"email,omitempty"`
    CNIC       string `json:"cnic,omitempty"`
}

type Store struct {
    mu sync.RWMutex
    wallets map[string]Wallet
}

func NewStore() *Store {
    return &Store{wallets: make(map[string]Wallet)}
}

func (s *Store) Save(w Wallet) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.wallets[w.WalletID] = w
}

func (s *Store) Get(walletID string) (Wallet, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w, ok := s.wallets[walletID]
	return w, ok
}

func (s *Store) GetAll() []Wallet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	wallets := make([]Wallet, 0, len(s.wallets))
	for _, w := range s.wallets {
		wallets = append(wallets, w)
	}
	return wallets
}

func GenerateKeypair() (pubHex, privHex string) {
    pub, priv, _ := ed25519.GenerateKey(nil)
    pubHex = hex.EncodeToString(pub)
    privHex = hex.EncodeToString(priv)
    return
}

func WalletIDFromPub(pubHex string) (string, error) {
    b, err := hex.DecodeString(pubHex)
    if err != nil { return "", err }
    h := sha256.Sum256(b)
    return hex.EncodeToString(h[:])[:40], nil
}

func (s *Store) CreateFromPub(pubHex, privHex, name, email, cnic string) (Wallet, error) {
    wid, err := WalletIDFromPub(pubHex)
    if err != nil { return Wallet{}, err }
    
    // Encrypt private key using AES-256
    encryptionKey := os.Getenv("ENCRYPTION_KEY")
    if encryptionKey == "" {
        encryptionKey = "DefaultKey12345678901234567890" // Fallback (32 chars)
    }
    
    encryptedPrivKey, err := crypto.EncryptPrivateKey(privHex, encryptionKey)
    if err != nil {
        return Wallet{}, err
    }
    
    w := Wallet{WalletID: wid, PublicKey: pubHex, PrivateKey: encryptedPrivKey, FullName: name, Email: email, CNIC: cnic}
    s.Save(w)
    return w, nil
}

func VerifySignature(pubHex string, message []byte, sigHex string) (bool, error) {
    pub, err := hex.DecodeString(pubHex)
    if err != nil { return false, err }
    sig, err := hex.DecodeString(sigHex)
    if err != nil { return false, err }
    ok := ed25519.Verify(pub, message, sig)
    return ok, nil
}

func SignWithPriv(privHex string, payload []byte) (string, error) {
    priv, err := hex.DecodeString(privHex)
    if err != nil { return "", err }
    if len(priv) != ed25519.PrivateKeySize { return "", errors.New("invalid private key size") }
    sig := ed25519.Sign(priv, payload)
    return hex.EncodeToString(sig), nil
}

// DecryptPrivateKey decrypts an encrypted private key
func DecryptPrivateKey(encryptedPrivKey string) (string, error) {
    encryptionKey := os.Getenv("ENCRYPTION_KEY")
    if encryptionKey == "" {
        encryptionKey = "DefaultKey12345678901234567890" // Fallback (32 chars)
    }
    return crypto.DecryptPrivateKey(encryptedPrivKey, encryptionKey)
}

func MarshalPayload(sender, receiver string, amount uint64, timestamp int64, note string) []byte {
    payload := map[string]interface{}{"sender":sender,"receiver":receiver,"amount":amount,"timestamp":timestamp,"note":note}
    b, _ := json.Marshal(payload)
    return b
}
