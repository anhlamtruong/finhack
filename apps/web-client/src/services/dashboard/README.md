# Dashboard Service

## Overview

Renders analytics cards, charts, and shared-wallet settlement summary UI.

## Architecture

- `components/`: data cards, charts, settle-up card, and dialogs.
- Relies on report/summary queries and transaction data.

## User flow

1. User opens dashboard.
2. Summary data renders cards/charts.
3. User can open income/expense detail dialog.
4. Shared-wallet users see settle-up summary and actions.
