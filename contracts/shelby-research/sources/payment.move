module shelby_research::payment {
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use shelby_research::access_control;

    const E_NOT_PLATFORM: u64 = 1;

    #[event]
    struct ReadPaymentEvent has drop, store {
        dataset_id: vector<u8>,
        reader: address,
        uploader: address,
        amount_milliapt: u64,
        timestamp: u64,
    }

    #[event]
    struct PaymentSettled has drop, store {
        dataset_id: vector<u8>,
        uploader: address,
        total_milliapt: u64,
        settled_at: u64,
    }

    // Record a read and queue payment
    public entry fun record_read(
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
    public entry fun settle_dataset_payments(
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

    // Record a read and queue payment on behalf of an owner (platform operator role)
    public entry fun record_read_by_platform(
        platform: &signer,
        uploader: address,
        dataset_id: vector<u8>,
        reader: address,
        amount_milliapt: u64,
    ) {
        assert!(access_control::is_platform(signer::address_of(platform)), E_NOT_PLATFORM);
        event::emit(ReadPaymentEvent {
            dataset_id,
            reader,
            uploader,
            amount_milliapt,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Settle pending payments on behalf of an uploader (platform operator role)
    public entry fun settle_dataset_payments_by_platform(
        platform: &signer,
        uploader: address,
        dataset_id: vector<u8>,
        total_milliapt: u64,
    ) {
        assert!(access_control::is_platform(signer::address_of(platform)), E_NOT_PLATFORM);
        event::emit(PaymentSettled {
            dataset_id,
            uploader,
            total_milliapt,
            settled_at: timestamp::now_seconds(),
        });
    }
}
