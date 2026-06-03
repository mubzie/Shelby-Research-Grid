# Shelby Research Data Platform - Move Smart Contracts

## Overview
This Move package contains the smart contracts for the Shelby Medical Research Data Platform on Aptos:

- **access_control.move**: Manages dataset access grants, time-limited permissions, and read tracking
- **payment.move**: Records read events and settles micropayments

## Prerequisites
- Aptos CLI installed: `curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3`
- Aptos account with devnet APT tokens (faucet at https://faucet.devnet.aptos.dev)

## Build & Deploy

### 1. Build the contract
```bash
cd contracts/shelby-research
aptos move compile
```

### 2. Create devnet account (if needed)
```bash
aptos init --network devnet
# Follow prompts to create/import account
```

### 3. Deploy to devnet
```bash
aptos move publish --network devnet
```

Save the module address from deployment output to APTOS_MODULE_ADDRESS in .env.local

### 4. Test on devnet
```bash
aptos move test --network devnet
```

## Contract Functions

### access_control module
- `initialize(account)` - Initialize access control manager
- `register_dataset(account, dataset_id)` - Register dataset ownership
- `grant_access(owner, dataset_id, grantee, duration_secs, read_limit)` - Grant time-limited read access
- `revoke_access(owner, dataset_id, grantee)` - Revoke access
- `has_valid_access(owner, dataset_id, reader) -> bool` - Check if access is valid
- `log_read(owner, dataset_id, reader, bytes_read)` - Log a read event

### payment module
- `record_read(uploader, dataset_id, reader, amount_milliapt)` - Record a read with payment amount
- `settle_dataset_payments(uploader, dataset_id, total_milliapt)` - Settle batch payments

## Events Emitted
- `AccessGrantedEvent`: When access is granted
- `AccessRevokedEvent`: When access is revoked
- `DatasetReadEvent`: When a dataset is read
- `ReadPaymentEvent`: When a read payment is recorded
- `PaymentSettled`: When payments are settled

## Integration with Backend
The backend AptosClient will:
1. Call `register_dataset` after upload to Shelby
2. Call `grant_access` when user requests access
3. Call `log_read` when dataset is downloaded
4. Listen to `DatasetReadEvent` to trigger payments
5. Call `settle_dataset_payments` daily via cron
