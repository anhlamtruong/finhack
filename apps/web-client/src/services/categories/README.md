# Categories Service

## Overview

Handles category CRUD and category management UI.

## Architecture

- `schema/`: DB schema and input validation.
- `procedures/`: CRUD procedures for categories.
- `hooks/`: mutation helpers and invalidation.
- `components/`: category form and sheets.
- `provider/`: sheet state provider.

## User flow

1. User opens Categories section.
2. User creates/edits/deletes categories.
3. Procedures persist changes and refresh queries.
