.PHONY: build run-backend run-frontend

build:
	go build -o server cmd/server/main.go

run-backend: build
	./server

run-frontend:
	cd frontend && npm run dev

all: build
