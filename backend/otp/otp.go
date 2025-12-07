package otp

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"
)

// OTPStore stores OTPs temporarily
type OTPStore struct {
	mu   sync.RWMutex
	otps map[string]OTPData
}

type OTPData struct {
	Code      string
	ExpiresAt time.Time
	Verified  bool
}

var store = &OTPStore{
	otps: make(map[string]OTPData),
}

// GenerateOTP generates a 6-digit OTP
func GenerateOTP() string {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "123456" // Fallback
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// StoreOTP stores an OTP for an email
func StoreOTP(email string) string {
	store.mu.Lock()
	defer store.mu.Unlock()

	code := GenerateOTP()
	store.otps[email] = OTPData{
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute), // Valid for 5 minutes
		Verified:  false,
	}

	log.Printf("OTP generated for %s: %s (expires in 5 minutes)", email, code)
	return code
}

// VerifyOTP verifies an OTP for an email
func VerifyOTP(email, code string) bool {
	store.mu.Lock()
	defer store.mu.Unlock()

	data, exists := store.otps[email]
	if !exists {
		return false
	}

	if time.Now().After(data.ExpiresAt) {
		delete(store.otps, email)
		return false
	}

	if data.Code != code {
		return false
	}

	// Mark as verified
	data.Verified = true
	store.otps[email] = data
	return true
}

// IsVerified checks if an email has been verified
func IsVerified(email string) bool {
	store.mu.RLock()
	defer store.mu.RUnlock()

	data, exists := store.otps[email]
	if !exists {
		return false
	}

	return data.Verified
}

// ClearOTP removes an OTP from storage
func ClearOTP(email string) {
	store.mu.Lock()
	defer store.mu.Unlock()
	delete(store.otps, email)
}

// CleanupExpired removes expired OTPs (should be run periodically)
func CleanupExpired() {
	store.mu.Lock()
	defer store.mu.Unlock()

	now := time.Now()
	for email, data := range store.otps {
		if now.After(data.ExpiresAt) {
			delete(store.otps, email)
		}
	}
}

// StartCleanupTask starts a background task to clean expired OTPs
func StartCleanupTask() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			CleanupExpired()
		}
	}()
}
