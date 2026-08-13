
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

    #[test]
    fun test_platform_role_controls_reads_and_payments() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        // Deployer sets itself as the platform
        let deployer = account::create_account_for_test(@shelby_research);
        access_control::initialize_platform(&deployer);
        assert!(access_control::is_platform(@shelby_research), 1);

        // Owner registers + grants (owner signs — unchanged)
        let owner = account::create_account_for_test(@0x9999);
        let reader = @0x8888;
        access_control::register_dataset(&owner, b"dataset-4");
        access_control::grant_access(&owner, b"dataset-4", reader, 3600, 5);
        assert!(access_control::has_valid_access(@0x9999, b"dataset-4", reader), 2);

        // Platform logs the read on behalf of the owner — read_count increments
        access_control::log_read_by_platform(&deployer, @0x9999, b"dataset-4", reader, 1024);
        assert!(access_control::has_valid_access(@0x9999, b"dataset-4", reader), 3);

        // Platform records + settles payments
        payment::record_read_by_platform(&deployer, @0x9999, b"dataset-4", reader, 5);
        payment::settle_dataset_payments_by_platform(&deployer, @0x9999, b"dataset-4", 25);
    }

    #[test]
    #[expected_failure]
    fun test_non_platform_cannot_log_read() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        let deployer = account::create_account_for_test(@shelby_research);
        access_control::initialize_platform(&deployer);

        let owner = account::create_account_for_test(@0x9999);
        let reader = @0x8888;
        access_control::register_dataset(&owner, b"dataset-5");
        access_control::grant_access(&owner, b"dataset-5", reader, 3600, 5);

        // An attacker (0x7777) is NOT the platform — must abort
        let attacker = account::create_account_for_test(@0x7777);
        access_control::log_read_by_platform(&attacker, @0x9999, b"dataset-5", reader, 1024);
    }

    #[test]
    #[expected_failure]
    fun test_non_platform_cannot_record_payment() {
        let core = account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&core);
        timestamp::update_global_time_for_test_secs(1000);

        let deployer = account::create_account_for_test(@shelby_research);
        access_control::initialize_platform(&deployer);

        let attacker = account::create_account_for_test(@0x7777);
        payment::record_read_by_platform(&attacker, @0x9999, b"dataset-6", @0x8888, 5);
    }
}
