# Shared ledger user flows

## Goal

Validate shared wallet behavior end-to-end: invitations, membership, split math, transactions, settlements, and notifications.

## Preconditions

- Two test users (User A, User B) with verified emails.
- A shared wallet created by User A.
- `wallet_shares` contains `accepted` rows for active members.
- Resend configured for notification emails.

## User flows

### 1) Invite and accept

Steps:

1. User A opens Share Wallet.
2. User A invites User B with a split and role.
3. User B opens the app and accepts the invite.
4. User A sees User B in members; User B sees the wallet in their account list.

Expected:

- `wallet_shares.status` changes from `pending` to `accepted`.
- User B can access the shared wallet.

### 2) Pending invites affect split target

Steps:

1. User A sends an invite with a split value.
2. User A opens the split editor.

Expected:

- Total target equals $100 - \text{pendingTotal}$.
- Save is disabled unless totals equal the target.

### 3) Update contribution splits

Steps:

1. User A (or Editor) updates member splits.
2. Save when total equals target.

Expected:

- Update mutation persists new `contributionSplit` values.
- Total equals target and remains consistent on refresh.

### 4) Post shared transaction (non-settlement)

Steps:

1. In the shared wallet, create a transaction:
   - Paid by: User A
   - Amount: 100
   - Is settlement: unchecked
2. Save.

Expected:

- Transaction saved with `paidByUserId = User A`, `isSettlement = false`.
- Members receive a shared-transaction notification email.

### 5) Split summary reflects non-settlement

Steps:

1. Open the Settle Up widget.
2. Confirm the split summary includes the new transaction.

Expected:

- Owed amounts match the paid-by user and contribution splits.
- Settlement transactions do not affect the summary.

### 6) Create settlement transaction

Steps:

1. If a user owes another member, click Settle Up.
2. Confirm the settlement transaction is created.

Expected:

- New transaction saved with `isSettlement = true`.
- Settlement does not trigger shared-transaction notifications.
- Split summary updates to reflect the settlement.

### 7) Remove member (owner-only)

Steps:

1. User A opens Share Wallet.
2. User A removes a member.

Expected:

- Member is removed from the list.
- Splits redistribute across remaining accepted members.

## Quick troubleshooting

- Empty members list: confirm `wallet_shares.status = accepted`.
- No emails: verify Resend API key and sender setup.
- Split totals off: verify pending totals and member splits sum to target.
