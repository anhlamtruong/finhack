# Shared Wallet Service

## Overview

Shared wallet membership, invites, splits, and settlement-related UI.

## Architecture

- `procedures/`: invite/accept/decline, split summary, split updates, member removal.
- `components/`: sharing UI, pending invites, split editor, member accounting.
- `hooks/`: mutation/query helpers.
- `types/` and `utils/`: split math and shared types.

## User flow

1. Owner invites members.
2. Members accept invitations.
3. Splits are updated and shared transactions are recorded.
4. Settle-up summary reflects shared balances.
