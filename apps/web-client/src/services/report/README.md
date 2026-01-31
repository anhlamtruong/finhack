# Report Service

## Overview

Provides summary and reporting queries used by the dashboard and charts.

## Architecture

- `procedures/`: summary endpoints for charts and cards.
- `hooks/`: query parameter helpers.

## User flow

1. User selects date range/account.
2. Client fetches summary data.
3. Dashboard renders charts and cards.
