package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type jwtClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func extractClaims(r *http.Request, secret string) (*jwtClaims, error) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return nil, errors.New("missing bearer token")
	}
	tokenStr := strings.TrimPrefix(auth, "Bearer ")

	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*jwtClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return claims, nil
}

func extractUserID(r *http.Request, secret string) (string, string, error) {
	claims, err := extractClaims(r, secret)
	if err != nil {
		return "", "", err
	}
	return claims.UserID, claims.Username, nil
}
