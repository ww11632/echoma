#[test_only]
module nft_mint_test::seal_access_policies_tests {
    use nft_mint_test::seal_access_policies::{Self, PolicyRegistry};
    use 0x2::object;
    use 0x2::tx_context;
    use 0x2::test_scenario::{Self as scenario, Scenario};

    const ADMIN: address = @0xADMIN;
    const USER1: address = @0xUSER1;
    const USER2: address = @0xUSER2;

    #[test]
    fun test_init_registry() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        let registry_id = seal_access_policies::init(ctx);
        
        // Verify registry was created
        assert!(object::id_to_address(registry_id) != @0x0, 0);
        
        scenario::end(scenario_val);
    }

    #[test]
    fun test_create_public_policy() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY1);
        
        // Create public policy
        seal_access_policies::create_policy(entry_nft_id, USER1, true, &mut registry, ctx);
        
        // Verify policy exists and is public
        assert!(seal_access_policies::policy_exists(entry_nft_id, &registry), 1);
        assert!(seal_access_policies::is_public_seal(entry_nft_id, &registry), 2);
        
        // Verify anyone has access
        assert!(seal_access_policies::has_access(entry_nft_id, USER1, &registry), 3);
        assert!(seal_access_policies::has_access(entry_nft_id, USER2, &registry), 4);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }

    #[test]
    fun test_create_private_policy() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY2);
        
        // Create private policy
        seal_access_policies::create_policy(entry_nft_id, USER1, false, &mut registry, ctx);
        
        // Verify policy exists and is private
        assert!(seal_access_policies::policy_exists(entry_nft_id, &registry), 1);
        assert!(!seal_access_policies::is_public_seal(entry_nft_id, &registry), 2);
        
        // Verify only owner has access
        assert!(seal_access_policies::has_access(entry_nft_id, USER1, &registry), 3);
        assert!(!seal_access_policies::has_access(entry_nft_id, USER2, &registry), 4);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }

    #[test]
    fun test_grant_access() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY3);
        
        // Create private policy
        seal_access_policies::create_policy(entry_nft_id, USER1, false, &mut registry, ctx);
        
        // Switch to USER1 context
        scenario::next_tx(&mut scenario_val, USER1);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Grant access to USER2
        seal_access_policies::grant_access(entry_nft_id, USER2, &mut registry, ctx);
        
        // Verify USER2 now has access
        assert!(seal_access_policies::has_access(entry_nft_id, USER2, &registry), 1);
        
        // Verify authorized addresses list
        let authorized = seal_access_policies::get_authorized_addresses(entry_nft_id, &registry);
        assert!(std::vector::length(&authorized) == 1, 2);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = seal_access_policies::E_NOT_OWNER)]
    fun test_grant_access_not_owner() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY4);
        
        // Create private policy owned by USER1
        seal_access_policies::create_policy(entry_nft_id, USER1, false, &mut registry, ctx);
        
        // Switch to USER2 context (not the owner)
        scenario::next_tx(&mut scenario_val, USER2);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Try to grant access (should fail)
        seal_access_policies::grant_access(entry_nft_id, USER2, &mut registry, ctx);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }

    #[test]
    fun test_revoke_access() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY5);
        
        // Create private policy
        seal_access_policies::create_policy(entry_nft_id, USER1, false, &mut registry, ctx);
        
        // Switch to USER1 context
        scenario::next_tx(&mut scenario_val, USER1);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Grant access to USER2
        seal_access_policies::grant_access(entry_nft_id, USER2, &mut registry, ctx);
        
        // Verify USER2 has access
        assert!(seal_access_policies::has_access(entry_nft_id, USER2, &registry), 1);
        
        // Revoke access
        seal_access_policies::revoke_access(entry_nft_id, USER2, &mut registry, ctx);
        
        // Verify USER2 no longer has access
        assert!(!seal_access_policies::has_access(entry_nft_id, USER2, &registry), 2);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = seal_access_policies::E_INVALID_SEAL_TYPE)]
    fun test_grant_access_public_seal() {
        let scenario_val = scenario::begin(ADMIN);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Initialize registry
        let registry_id = seal_access_policies::init(ctx);
        let registry = scenario::take_shared<PolicyRegistry>(&scenario_val);
        
        // Create a test EntryNFT ID
        let entry_nft_id = object::id_from_address(@0xENTRY6);
        
        // Create public policy
        seal_access_policies::create_policy(entry_nft_id, USER1, true, &mut registry, ctx);
        
        // Switch to USER1 context
        scenario::next_tx(&mut scenario_val, USER1);
        let ctx = scenario::ctx(&mut scenario_val);
        
        // Try to grant access to public seal (should fail)
        seal_access_policies::grant_access(entry_nft_id, USER2, &mut registry, ctx);
        
        scenario::return_shared(registry);
        scenario::end(scenario_val);
    }
}

