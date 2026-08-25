# ── Stage 1: Build Go binary ──────────────────────────────────────────────────
FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

ENV GOTOOLCHAIN=auto

COPY . .

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

# ── Stage 2: Minimal Runtime ──────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server /app/server

EXPOSE 8080

CMD ["/app/server"]
