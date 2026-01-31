# Notifications Service

## Overview

Email notification utilities for shared wallet activity.

## Architecture

- `resend.ts`: Resend email client helpers.
- `shared-transactions.ts`: shared transaction notification workflow.

## User flow

1. A shared transaction is created.
2. Notification helper sends emails to other members.
