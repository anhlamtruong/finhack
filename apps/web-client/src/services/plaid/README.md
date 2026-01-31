# Plaid Service

## Overview

Integrates Plaid for linking and syncing bank accounts.

## Architecture

- `procedures/`: Plaid API calls and token exchange.
- `components/`: Plaid link UI.
- `hooks/`: client helpers.
- `schema/` and `types/`: validations and types.

## User flow

1. User connects a bank account.
2. Client requests Plaid link token.
3. Server exchanges token and stores account data.
