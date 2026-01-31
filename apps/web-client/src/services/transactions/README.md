# Transactions Service

## Overview

Creates, edits, and lists transactions; supports shared wallet settlement flags.

## Architecture

- `schema/`: transaction schema and validation.
- `procedures/`: get/post/patch/delete transactions.
- `hooks/`: mutation helpers and invalidation.
- `components/`: transaction form and list UI.
- `provider/`: transaction-related UI state.
- `types/`: shared transaction types.

## User flow

1. User adds or edits a transaction.
2. Server persists changes.
3. Lists and summaries refresh.
4. Shared transactions trigger notifications.
