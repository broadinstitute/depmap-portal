.PHONY: help dev dev-elara test lint typecheck

help:
	@echo "Available commands:"
	@echo "  make dev         - Start all services for local Portal development"
	@echo "  make dev-elara   - Start Breadbox and Elara frontend for local Elara development"
	@echo "  make test        - Run tests across backend and frontend"
	@echo "  make lint        - Run linters across backend"
	@echo "  make typecheck   - Run frontend TypeScript type checking (tsc --build --noEmit)"

dev:
	@bash scripts/dev.sh

dev-elara:
	@bash scripts/dev.sh --elara

test:
	cd breadbox && poetry run pytest
	cd portal-backend && poetry run pytest
	cd frontend && yarn test

lint:
	cd breadbox && poetry run pyright
	cd portal-backend && poetry run mypy . && poetry run lint-imports

typecheck:
	cd frontend && yarn typecheck
