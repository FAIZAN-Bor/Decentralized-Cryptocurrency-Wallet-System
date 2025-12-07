package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// EncryptPrivateKey encrypts a private key using AES-256-GCM
func EncryptPrivateKey(plaintext, passphrase string) (string, error) {
	// Derive a 32-byte key from passphrase (in production, use PBKDF2 or scrypt)
	key := deriveKey(passphrase)
	
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptPrivateKey decrypts a private key using AES-256-GCM
func DecryptPrivateKey(encryptedText, passphrase string) (string, error) {
	key := deriveKey(passphrase)
	
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// deriveKey derives a 32-byte key from a passphrase
// In production, use PBKDF2, scrypt, or argon2
func deriveKey(passphrase string) []byte {
	// Simple key derivation - pad or truncate to 32 bytes
	key := []byte(passphrase)
	if len(key) < 32 {
		// Pad with zeros
		paddedKey := make([]byte, 32)
		copy(paddedKey, key)
		return paddedKey
	}
	// Truncate to 32 bytes
	return key[:32]
}
