# Accounts Service

## Overview

Manages wallet/account CRUD, selection state, and UI sheets for creating or editing accounts.

## Architecture

- `schema/`: DB schema and zod input definitions.
- `procedures/`: tRPC procedures for CRUD operations.
- `hooks/`: client hooks for mutations, query invalidation, and UI state.
- `components/`: account form and sheet components.
- `provider/`: sheet state provider.

## User flow

1. User opens Accounts page.
2. User creates or edits an account via sheets.
3. Mutations update DB and invalidate account queries.
4. UI refreshes with latest account list.
