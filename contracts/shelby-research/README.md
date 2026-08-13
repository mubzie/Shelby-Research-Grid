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
aptos move publish --assume-yes
```

### 4. Test on devnet
```bash
aptos move test
```

## Deployment status (shelbynet)

- Network: **shelbynet** (Aptos-based Shelby network, chain 118, fullnode `api.shelbynet.aptoslabs.com/v1`)
- Account: `0xed8c57d7438e3a8ac788e9b166ec576c2f2ecfbd29d973815af294af4d755a4f` (see `.aptos/config.yaml` at repo root; funded via `faucet.shelbynet.shelby.xyz/mint`)
- Modules published: `access_control`, `payment`, `access_control_tests` (dev-only)
- Functions `register_dataset`, `grant_access`, `revoke_access`, `log_read`, `record_read`, `settle_dataset_payments` are `entry` functions callable by the backend; `has_valid_access` is a `#[view]` function
- Set `APTOS_MODULE_ADDRESS` and `APTOS_PRIVATE_KEY` in `.env.local` to match this account

> Note: the backend signs all on-chain transactions with the platform account, so on-chain
> dataset owners/grants resolve to that address. The original uploader address is stored in
> the DB (`datasets.uploader_addr`) and in upload metadata.
>
> Note: blob storage is handled by the `@shelby-protocol/sdk` (real blob registration,
> storage-provider upload, and merkle commitments on shelbynet). The RPC gateway
> (`shelby.shelbynet.shelby.xyz/shelby`) rate-limits anonymous requests; a geomi **server**
> key (`aptoslabs_...`, covering the shelbynet RPC upstream) lifts the limit. The backend
> proxies RPC calls via `/api/shelby-rpc` injecting `x-api-key` (the SDK sends `Authorization:
> Bearer`, which the gateway rejects). Verified end-to-end: upload → on-chain registration →
> integrity re-verification → authorized download → AES-GCM decryption → byte-exact plaintext,
> plus read logging (log_read/record_read), counters, and daily settlement cron.



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
