
module shelby_research::access_control_tests {
    use std::signer;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use shelby_research::access_control;
    use shelby_research::payment;

    #[test]
    fun test_register_and_grant_access() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        let owner = account::create_account_for_test(@shelby_research);
        let grantee = @0x1234;

        access_control::register_dataset(&owner, b"dataset-1");
        access_control::grant_access(&owner, b"dataset-1", grantee, 3600, 5);

        assert!(access_control::has_valid_access(signer::address_of(&owner), b"dataset-1", grantee), 1);

        // Access should be invalid after expiry
        timestamp::fast_forward_seconds(7200);
        assert!(!access_control::has_valid_access(signer::address_of(&owner), b"dataset-1", grantee), 2);

        // Re-grant and revoke
        access_control::grant_access(&owner, b"dataset-1", grantee, 3600, 5);
        assert!(access_control::has_valid_access(signer::address_of(&owner), b"dataset-1", grantee), 3);
        access_control::revoke_access(&owner, b"dataset-1", grantee);
        assert!(!access_control::has_valid_access(signer::address_of(&owner), b"dataset-1", grantee), 4);
    }

    #[test]
    fun test_read_limit_enforced() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        let owner = account::create_account_for_test(@shelby_research);
        let reader = @0x5678;

        access_control::register_dataset(&owner, b"dataset-2");
        access_control::grant_access(&owner, b"dataset-2", reader, 3600, 2);

        assert!(access_control::has_valid_access(signer::address_of(&owner), b"dataset-2", reader), 1);

        access_control::log_read(&owner, b"dataset-2", reader, 1024);
        access_control::log_read(&owner, b"dataset-2", reader, 2048);
        assert!(!access_control::has_valid_access(signer::address_of(&owner), b"dataset-2", reader), 2);
    }

    #[test]
    fun test_payment_events_emit() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        let uploader = account::create_account_for_test(@shelby_research);
        payment::record_read(&uploader, b"dataset-3", @0xaaaa, 5);
        payment::settle_dataset_payments(&uploader, b"dataset-3", 25);
    }
}
