module shelby_research::payment {
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;

    struct ReadPaymentEvent has drop, store {
        dataset_id: vector<u8>,
        reader: address,
        uploader: address,
        amount_milliapt: u64,
        timestamp: u64,
    }

    struct PaymentSettled has drop, store {
        dataset_id: vector<u8>,
        uploader: address,
        total_milliapt: u64,
        settled_at: u64,
    }

    // Record a read and queue payment
    public fun record_read(
        uploader: &signer,
        dataset_id: vector<u8>,
        reader: address,
        amount_milliapt: u64,
    ) {
        let uploader_addr = signer::address_of(uploader);
        event::emit(ReadPaymentEvent {
            dataset_id,
            reader,
            uploader: uploader_addr,
            amount_milliapt,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Settle pending payments (batch operation)
    public fun settle_dataset_payments(
        uploader: &signer,
        dataset_id: vector<u8>,
        total_milliapt: u64,
    ) {
        let uploader_addr = signer::address_of(uploader);
        event::emit(PaymentSettled {
            dataset_id,
            uploader: uploader_addr,
            total_milliapt,
            settled_at: timestamp::now_seconds(),
        });
    }
}
