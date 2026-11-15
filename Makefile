COMPOSE ?= docker compose

.PHONY: build-backend build-web build up down logs ps status migrate s3-init check check-backend check-flutter check-gates loadtest clean

## Sequential low-memory builds (prevents Flutter Web & TypeScript OOM spikes on 8 GiB hosts)
build-backend:
	$(COMPOSE) build s3-init migrate api worker

build-web:
	$(COMPOSE) build web

build: build-backend build-web

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps -a

status: ps

migrate:
	$(COMPOSE) run --rm migrate

s3-init:
	$(COMPOSE) run --rm s3-init

check-gates:
	./scripts/check_all.sh all

check-backend:
	$(COMPOSE) --profile tools run --rm backend-check

check-flutter:
	$(COMPOSE) --profile tools run --rm flutter-check

check: check-gates check-backend check-flutter

loadtest:
	$(COMPOSE) --profile loadtest run --rm k6

clean:
	$(COMPOSE) down --remove-orphans
