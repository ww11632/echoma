/*
 * Module: seal_access_policies
 * 
 * Seal Access Policies Contract for managing access control to encrypted records.
 * 
 * This contract provides:
 * - Public Seal: Anyone can decrypt (using public seal key)
 * - Private Seal: Only owner and authorized addresses can decrypt
 * - Grant/Revoke access permissions
 * - On-chain verification of access policies
 */

#[allow(lint(public_entry))]
module nft_mint_test::seal_access_policies {
    use 0x2::event;
    use 0x2::dynamic_field as df;
    use 0x2::tx_context;
    use std::vector;

    /// Seal type: Public or Private
    public struct SealType has copy, drop, store {
        is_public: bool,
    }

    /// Access Policy for an EntryNFT
    /// Stores the seal type and authorized addresses for private records
    public struct AccessPolicy has key, store {
        id: UID,
        entry_nft_id: ID,              // Associated EntryNFT ID
        owner: address,                 // Owner of the EntryNFT
        seal_type: SealType,            // Public or Private seal
        authorized_addresses: vector<address>, // List of authorized addresses (for private seal)
    }

    /// Policy Registry: Maps EntryNFT ID -> AccessPolicy
    /// This is a shared object that can be queried by anyone
    public struct PolicyRegistry has key {
        id: UID,
    }

    /// Event: Policy created
    public struct PolicyCreatedEvent has copy, drop {
        entry_nft_id: ID,
        owner: address,
        is_public: bool,
    }

    /// Event: Access granted
    public struct AccessGrantedEvent has copy, drop {
        entry_nft_id: ID,
        grantee: address,
        granted_by: address,
    }

    /// Event: Access revoked
    public struct AccessRevokedEvent has copy, drop {
        entry_nft_id: ID,
        grantee: address,
        revoked_by: address,
    }

    /// Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_POLICY_NOT_FOUND: u64 = 2;
    const E_ALREADY_AUTHORIZED: u64 = 3;
    const E_NOT_AUTHORIZED: u64 = 4;
    const E_INVALID_SEAL_TYPE: u64 = 5;
    const E_REGISTRY_NOT_INITIALIZED: u64 = 6;

    /// Initialize the Policy Registry (one-time setup)
    /// Should be called during package deployment
    /// This is a Sui init function that automatically creates and shares the registry
    fun init(ctx: &mut tx_context::TxContext) {
        let registry = PolicyRegistry {
            id: object::new(ctx),
        };
        // Transfer to a shared object so it can be accessed by anyone
        transfer::share_object(registry);
    }

    /// Create an access policy for an EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   owner: The owner address of the EntryNFT
    ///   is_public: true for Public Seal (anyone can decrypt), false for Private Seal
    ///   registry: The PolicyRegistry shared object
    public entry fun create_policy(
        entry_nft_id: ID,
        owner: address,
        is_public: bool,
        registry: &mut PolicyRegistry,
        ctx: &mut tx_context::TxContext
    ) {
        // Check if policy already exists
        assert!(!df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id), E_ALREADY_AUTHORIZED);

        let seal_type = SealType { is_public };
        let policy = AccessPolicy {
            id: object::new(ctx),
            entry_nft_id,
            owner,
            seal_type,
            authorized_addresses: vector::empty<address>(),
        };

        // Store policy in registry
        df::add(&mut registry.id, entry_nft_id, policy);

        // Emit event
        event::emit(PolicyCreatedEvent {
            entry_nft_id,
            owner,
            is_public,
        });
    }

    /// Grant access to a specific address for a private seal EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   grantee: The address to grant access to
    ///   registry: The PolicyRegistry shared object
    public entry fun grant_access(
        entry_nft_id: ID,
        grantee: address,
        registry: &mut PolicyRegistry,
        ctx: &mut tx_context::TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Get the policy
        let policy = df::borrow_mut<ID, AccessPolicy>(&mut registry.id, entry_nft_id);
        
        // Verify sender is the owner
        assert!(sender == policy.owner, E_NOT_OWNER);
        
        // Only private seals can have authorized addresses
        assert!(!policy.seal_type.is_public, E_INVALID_SEAL_TYPE);
        
        // Check if already authorized
        let authorized = vector::contains(&policy.authorized_addresses, &grantee);
        assert!(!authorized, E_ALREADY_AUTHORIZED);
        
        // Add to authorized list
        vector::push_back(&mut policy.authorized_addresses, grantee);
        
        // Emit event
        event::emit(AccessGrantedEvent {
            entry_nft_id,
            grantee,
            granted_by: sender,
        });
    }

    /// Revoke access from a specific address for a private seal EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   grantee: The address to revoke access from
    ///   registry: The PolicyRegistry shared object
    public entry fun revoke_access(
        entry_nft_id: ID,
        grantee: address,
        registry: &mut PolicyRegistry,
        ctx: &mut tx_context::TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Get the policy
        let policy = df::borrow_mut<ID, AccessPolicy>(&mut registry.id, entry_nft_id);
        
        // Verify sender is the owner
        assert!(sender == policy.owner, E_NOT_OWNER);
        
        // Find and remove from authorized list
        let len = vector::length(&policy.authorized_addresses);
        let mut i = 0;
        let mut found = false;
        
        while (i < len) {
            let addr = *vector::borrow(&policy.authorized_addresses, i);
            if (addr == grantee) {
                vector::remove(&mut policy.authorized_addresses, i);
                found = true;
                break
            };
            i = i + 1;
        };
        
        assert!(found, E_NOT_AUTHORIZED);
        
        // Emit event
        event::emit(AccessRevokedEvent {
            entry_nft_id,
            grantee,
            revoked_by: sender,
        });
    }

    /// Check if an address has access to decrypt an EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   requester: The address requesting access
    ///   registry: The PolicyRegistry shared object
    /// 
    /// Returns:
    ///   true if the requester has access, false otherwise
    public fun has_access(
        entry_nft_id: ID,
        requester: address,
        registry: &PolicyRegistry
    ): bool {
        // Check if policy exists
        if (!df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id)) {
            return false
        };
        
        let policy = df::borrow<ID, AccessPolicy>(&registry.id, entry_nft_id);
        
        // Public seal: anyone has access
        if (policy.seal_type.is_public) {
            return true
        };
        
        // Private seal: check if requester is owner or authorized
        if (requester == policy.owner) {
            return true
        };
        
        // Check authorized addresses
        let len = vector::length(&policy.authorized_addresses);
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&policy.authorized_addresses, i);
            if (addr == requester) {
                return true
            };
            i = i + 1;
        };
        
        false
    }

    /// Get the seal type for an EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   registry: The PolicyRegistry shared object
    /// 
    /// Returns:
    ///   true if public seal, false if private seal
    ///   Returns false if policy doesn't exist
    public fun is_public_seal(
        entry_nft_id: ID,
        registry: &PolicyRegistry
    ): bool {
        if (!df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id)) {
            return false
        };
        
        let policy = df::borrow<ID, AccessPolicy>(&registry.id, entry_nft_id);
        policy.seal_type.is_public
    }

    /// Get the owner of an EntryNFT's access policy
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   registry: The PolicyRegistry shared object
    /// 
    /// Returns:
    ///   The owner address, or the zero address if policy doesn't exist
    public fun get_policy_owner(
        entry_nft_id: ID,
        registry: &PolicyRegistry
    ): address {
        if (!df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id)) {
            return @0x0
        };
        
        let policy = df::borrow<ID, AccessPolicy>(&registry.id, entry_nft_id);
        policy.owner
    }

    /// Get all authorized addresses for a private seal EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   registry: The PolicyRegistry shared object
    /// 
    /// Returns:
    ///   Vector of authorized addresses (empty if public seal or policy doesn't exist)
    public fun get_authorized_addresses(
        entry_nft_id: ID,
        registry: &PolicyRegistry
    ): vector<address> {
        if (!df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id)) {
            return vector::empty<address>()
        };
        
        let policy = df::borrow<ID, AccessPolicy>(&registry.id, entry_nft_id);
        
        // Return empty for public seals
        if (policy.seal_type.is_public) {
            return vector::empty<address>()
        };
        
        // Return copy of authorized addresses
        let len = vector::length(&policy.authorized_addresses);
        let mut result = vector::empty<address>();
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&policy.authorized_addresses, i);
            vector::push_back(&mut result, addr);
            i = i + 1;
        };
        result
    }

    /// Check if a policy exists for an EntryNFT
    /// 
    /// Args:
    ///   entry_nft_id: The ID of the EntryNFT
    ///   registry: The PolicyRegistry shared object
    /// 
    /// Returns:
    ///   true if policy exists, false otherwise
    public fun policy_exists(
        entry_nft_id: ID,
        registry: &PolicyRegistry
    ): bool {
        df::exists_with_type<ID, AccessPolicy>(&registry.id, entry_nft_id)
    }
}

