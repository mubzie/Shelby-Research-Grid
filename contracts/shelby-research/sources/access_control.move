module shelby_research::access_control {
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use std::vector;
    use std::table::{Self, Table};

    // Dataset ownership and access grant management

    struct AccessGrant has store, drop {
        dataset_id: vector<u8>,
        grantee: address,
        granted_by: address,
        granted_at: u64,
        expires_at: u64,
        read_limit: u64,
        read_count: u64,
        is_active: bool,
    }

    struct DatasetAccessManager has key {
        access_grants: Table<vector<u8>, vector<AccessGrant>>,
        dataset_owners: Table<vector<u8>, address>,
    }

    // Events
    #[event]
    struct AccessGrantedEvent has drop, store {
        dataset_id: vector<u8>,
        grantee: address,
        expires_at: u64,
        read_limit: u64,
    }

    #[event]
    struct AccessRevokedEvent has drop, store {
        dataset_id: vector<u8>,
        grantee: address,
    }

    #[event]
    struct DatasetReadEvent has drop, store {
        dataset_id: vector<u8>,
        reader: address,
        read_at: u64,
        bytes_read: u64,
    }

    // Error codes
    const E_NOT_PLATFORM: u64 = 1;

    // The platform operator that records reads / settles payments on behalf of owners
    struct PlatformState has key {
        platform: address,
    }

    // Set the platform operator (called once by the deployer after publishing)
    public entry fun initialize_platform(admin: &signer) {
        let addr = signer::address_of(admin);
        if (!exists<PlatformState>(@shelby_research)) {
            move_to(admin, PlatformState { platform: addr });
        }
    }

    // Change the platform operator (admin = current deployer holding PlatformState)
    public entry fun set_platform(admin: &signer, new_platform: address) acquires PlatformState {
        assert!(exists<PlatformState>(@shelby_research), E_NOT_PLATFORM);
        let state = borrow_global_mut<PlatformState>(@shelby_research);
        assert!(state.platform == signer::address_of(admin), E_NOT_PLATFORM);
        state.platform = new_platform;
    }

    #[view]
    public fun is_platform(account: address): bool acquires PlatformState {
        if (!exists<PlatformState>(@shelby_research)) return false;
        borrow_global<PlatformState>(@shelby_research).platform == account
    }

    fun assert_platform(platform: &signer) acquires PlatformState {
        assert!(is_platform(signer::address_of(platform)), E_NOT_PLATFORM);
    }

    // Initialize access control manager
    public fun initialize(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<DatasetAccessManager>(addr)) {
            let manager = DatasetAccessManager {
                access_grants: table::new(),
                dataset_owners: table::new(),
            };
            move_to(account, manager);
        }
    }

    // Register dataset ownership
    public entry fun register_dataset(account: &signer, dataset_id: vector<u8>) acquires DatasetAccessManager {
        initialize(account);
        let addr = signer::address_of(account);
        let manager = borrow_global_mut<DatasetAccessManager>(addr);
        
        if (!table::contains(&manager.dataset_owners, dataset_id)) {
            table::add(&mut manager.dataset_owners, dataset_id, addr);
            if (!table::contains(&manager.access_grants, dataset_id)) {
                table::add(&mut manager.access_grants, dataset_id, vector::empty());
            }
        }
    }

    // Grant access to a collaborator
    public entry fun grant_access(
        owner: &signer,
        dataset_id: vector<u8>,
        grantee: address,
        duration_secs: u64,
        read_limit: u64,
    ) acquires DatasetAccessManager {
        let owner_addr = signer::address_of(owner);
        let manager = borrow_global_mut<DatasetAccessManager>(owner_addr);
        
        let now = timestamp::now_seconds();
        let expires_at = now + duration_secs;

        let grant = AccessGrant {
            dataset_id: dataset_id,
            grantee,
            granted_by: owner_addr,
            granted_at: now,
            expires_at,
            read_limit,
            read_count: 0,
            is_active: true,
        };

        if (!table::contains(&manager.access_grants, dataset_id)) {
            table::add(&mut manager.access_grants, dataset_id, vector::empty());
        }

        let grants = table::borrow_mut(&mut manager.access_grants, dataset_id);
        vector::push_back(grants, grant);

        event::emit(AccessGrantedEvent {
            dataset_id,
            grantee,
            expires_at,
            read_limit,
        });
    }

    // Revoke access
    public entry fun revoke_access(
        owner: &signer,
        dataset_id: vector<u8>,
        grantee: address,
    ) acquires DatasetAccessManager {
        let owner_addr = signer::address_of(owner);
        let manager = borrow_global_mut<DatasetAccessManager>(owner_addr);
        
        if (table::contains(&manager.access_grants, dataset_id)) {
            let grants = table::borrow_mut(&mut manager.access_grants, dataset_id);
            let i = 0;
            while (i < vector::length(grants)) {
                let grant = vector::borrow_mut(grants, i);
                if (grant.grantee == grantee) {
                    grant.is_active = false;
                };
                i = i + 1;
            };
        };

        event::emit(AccessRevokedEvent {
            dataset_id,
            grantee,
        });
    }

    // Check if reader has valid access
    #[view]
    public fun has_valid_access(
        owner: address,
        dataset_id: vector<u8>,
        reader: address,
    ): bool acquires DatasetAccessManager {
        if (!exists<DatasetAccessManager>(owner)) {
            return false
        };

        let manager = borrow_global<DatasetAccessManager>(owner);
        if (!table::contains(&manager.access_grants, dataset_id)) {
            return false
        };

        let grants = table::borrow(&manager.access_grants, dataset_id);
        let i = 0;
        while (i < vector::length(grants)) {
            let grant = vector::borrow(grants, i);
            if (grant.grantee == reader
                && grant.is_active
                && grant.read_count < grant.read_limit
                && timestamp::now_seconds() <= grant.expires_at) {
                return true
            };
            i = i + 1;
        };

        false
    }

    // Log a read event
    public entry fun log_read(
        owner: &signer,
        dataset_id: vector<u8>,
        reader: address,
        bytes_read: u64,
    ) acquires DatasetAccessManager {
        let owner_addr = signer::address_of(owner);
        if (exists<DatasetAccessManager>(owner_addr)) {
            let manager = borrow_global_mut<DatasetAccessManager>(owner_addr);
            if (table::contains(&manager.access_grants, dataset_id)) {
                let grants = table::borrow_mut(&mut manager.access_grants, dataset_id);
                let i = 0;
                while (i < vector::length(grants)) {
                    let grant = vector::borrow_mut(grants, i);
                    if (grant.grantee == reader && grant.is_active) {
                        grant.read_count = grant.read_count + 1;
                        break
                    };
                    i = i + 1;
                };
            };
        };

        event::emit(DatasetReadEvent {
            dataset_id,
            reader,
            read_at: timestamp::now_seconds(),
            bytes_read,
        });
    }

    // Log a read on behalf of an owner (platform operator role)
    public entry fun log_read_by_platform(
        platform: &signer,
        owner: address,
        dataset_id: vector<u8>,
        reader: address,
        bytes_read: u64,
    ) acquires DatasetAccessManager, PlatformState {
        assert_platform(platform);
        if (exists<DatasetAccessManager>(owner)) {
            let manager = borrow_global_mut<DatasetAccessManager>(owner);
            if (table::contains(&manager.access_grants, dataset_id)) {
                let grants = table::borrow_mut(&mut manager.access_grants, dataset_id);
                let i = 0;
                while (i < vector::length(grants)) {
                    let grant = vector::borrow_mut(grants, i);
                    if (grant.grantee == reader && grant.is_active) {
                        grant.read_count = grant.read_count + 1;
                        break
                    };
                    i = i + 1;
                };
            };
        };

        event::emit(DatasetReadEvent {
            dataset_id,
            reader,
            read_at: timestamp::now_seconds(),
            bytes_read,
        });
    }
}
