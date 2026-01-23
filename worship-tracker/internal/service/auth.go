package service

import (
	"errors"
	"time"
	"worship-tracker/internal/domain"
	"worship-tracker/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var secretKey = []byte("secret-key-internal-use")

type AuthService struct {
	Store *repository.Store
}

func (s *AuthService) Register(username, password, timezone string, lat, long float64) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	user := &domain.User{
		Username:  username,
		Password:  string(hash),
		Latitude:  lat,
		Longitude: long,
		Timezone:  timezone,
	}

	if err := s.Store.CreateUser(user); err != nil {
		return "", err
	}

	return s.generateToken(user.ID)
}

func (s *AuthService) Login(username, password string) (string, error) {
	user, err := s.Store.GetUserByUsername(username)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", errors.New("invalid credentials")
	}

	return s.generateToken(user.ID)
}

func (s *AuthService) generateToken(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(72 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secretKey)
}

func (s *AuthService) ValidateToken(tokenString string) (int64, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secretKey, nil
	})

	if err != nil || !token.Valid {
		return 0, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid claims")
	}

	userID := int64(claims["user_id"].(float64))
	return userID, nil
}
