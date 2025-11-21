/*
/// Module: nft_mint_test
module nft_mint_test::nft_mint_test;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions
#[allow(lint(public_entry))]
module nft_mint_test::diary {
    use std::string::String;
    use std::vector;
    use 0x2::clock;
    use 0x2::event;
    use 0x2::dynamic_field as df;

    /// 只用來索引 EntryNFT 的 ID（不改變所有權）
    public struct EntryRef has store {
        id: object::ID,                      // ✅ 加上 object:: 命名空間
        day_index: u64,                      // 記錄日期索引方便查詢
    }

    /// 使用者的情緒日誌（父物件）
    /// Dynamic Field：parent = journal.id, key = day_index (u64), value = EntryRef
    public struct Journal has key {
        id: object::UID,                     // ✅ 加上 object:: 命名空間
        owner: address,
        count: u64,
    }

    public struct EntryNFT has key, store {
        id: object::UID,                     // ✅
        journal_id: object::ID,              // ✅
        timestamp_ms: u64,
        day_index: u64,
        mood_score: u8,
        mood_text: String,
        tags_csv: String,
        image_url: String,
        image_mime: String,
        image_sha256: vector<u8>,
        audio_url: String, //https://i.pinimg.com/736x/59/69/c5/5969c5fd58b525660535b44f403cfc56.jpg
        audio_mime: String,
        audio_sha256: vector<u8>,
        audio_duration_ms: u64,
    }

    public struct MintEvent has copy, drop {
        owner: address,
        day_index: u64,
        mood_score: u8,
    }

    public entry fun create_journal(ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        let j = Journal {
            id: object::new(ctx),
            owner,
            count: 0,
        };
        transfer::transfer(j, owner);
    }

    public entry fun mint_entry(
        journal: &mut Journal,
        mood_score: u8,
        mood_text: String,
        tags_csv: String,
        image_url: String,
        image_mime: String,
        image_sha256: vector<u8>,
        audio_url: String,
        audio_mime: String,
        audio_sha256: vector<u8>,
        audio_duration_ms: u64,
        clk: &clock::Clock,
        ctx: &mut TxContext
    ) {
        // 只允許 journal 擁有者鑄造
        let sender = tx_context::sender(ctx);
        assert!(sender == journal.owner, 0);

        let now = clock::timestamp_ms(clk);        // ✅ 新版 API
        let day_index = now / 86400000;

        // 更新計數器
        journal.count = journal.count + 1;

        // 鑄造 NFT（所有權給使用者）
        let nft = EntryNFT {
            id: object::new(ctx),
            journal_id: object::id(journal),       // ✅ 由 UID 取 ID
            timestamp_ms: now,
            day_index,
            mood_score,
            mood_text,
            tags_csv,
            image_url,
            image_mime,
            image_sha256,
            audio_url,
            audio_mime,
            audio_sha256,
            audio_duration_ms,
        };

        // 在 Journal 下掛一個 Dynamic Field：使用 count 作為唯一 key
        // 這樣每個 entry 都有唯一索引，允許同一天多筆記錄
        let entry_id = object::id(&nft);            // ✅ 取 NFT 的 ID
        df::add<u64, EntryRef>(&mut journal.id, journal.count, EntryRef { 
            id: entry_id,
            day_index 
        });

        event::emit(MintEvent { owner: sender, day_index, mood_score });
        transfer::transfer(nft, sender);
    }

    /// 用 entry_index (count) 從 Journal 取得 NFT 的 ID（若不存在會 abort）
    public fun get_entry_id(journal: &Journal, entry_index: u64): object::ID {
        let r = df::borrow<u64, EntryRef>(&journal.id, entry_index);
        r.id
    }

    /// 是否存在該 entry 索引（不會 abort）
    public fun has_entry(journal: &Journal, entry_index: u64): bool {
        df::exists_with_type<u64, EntryRef>(&journal.id, entry_index) // ✅ 新版 API
    }
    
    /// 取得 Journal 的 entry 數量
    public fun get_journal_count(journal: &Journal): u64 {
        journal.count
    }

    /// Get journal owner (public accessor)
    public fun get_journal_owner(journal: &Journal): address {
        journal.owner
    }

    /// Get journal count (public accessor)
    public fun get_journal_count_for_policy(journal: &Journal): u64 {
        journal.count
    }

    /// Increment journal count (for policy module)
    public fun increment_journal_count(journal: &mut Journal) {
        journal.count = journal.count + 1;
    }

    /// Add entry ref to journal (for policy module)
    public fun add_entry_ref(journal: &mut Journal, entry_index: u64, entry_ref: EntryRef) {
        df::add<u64, EntryRef>(&mut journal.id, entry_index, entry_ref);
    }

    /// Create EntryNFT (for policy module)
    public fun create_entry_nft(
        journal_id: object::ID,
        timestamp_ms: u64,
        day_index: u64,
        mood_score: u8,
        mood_text: String,
        tags_csv: String,
        image_url: String,
        image_mime: String,
        image_sha256: vector<u8>,
        audio_url: String,
        audio_mime: String,
        audio_sha256: vector<u8>,
        audio_duration_ms: u64,
        ctx: &mut TxContext
    ): EntryNFT {
        EntryNFT {
            id: object::new(ctx),
            journal_id,
            timestamp_ms,
            day_index,
            mood_score,
            mood_text,
            tags_csv,
            image_url,
            image_mime,
            image_sha256,
            audio_url,
            audio_mime,
            audio_sha256,
            audio_duration_ms,
        }
    }

    /// Create EntryRef (for policy module)
    public fun create_entry_ref(entry_id: object::ID, day_index: u64): EntryRef {
        EntryRef { id: entry_id, day_index }
    }

    /// Emit mint event (for policy module)
    public fun emit_mint_event(owner: address, day_index: u64, mood_score: u8) {
        event::emit(MintEvent { owner, day_index, mood_score });
    }

    /// Transfer EntryNFT (for policy module)
    public fun transfer_entry_nft(nft: EntryNFT, recipient: address) {
        transfer::transfer(nft, recipient);
    }
}

/// Integration module for Seal Access Policies
/// This module provides functions to mint EntryNFTs with access policies
#[allow(lint(public_entry))]
module nft_mint_test::diary_with_policy {
    use nft_mint_test::diary::{Self, Journal, EntryNFT};
    use nft_mint_test::seal_access_policies::{Self, PolicyRegistry};
    use std::string::String;
    use std::vector;
    use 0x2::clock;
    use 0x2::event;
    use 0x2::dynamic_field as df;
    use 0x2::object::{Self, ID};
    use 0x2::transfer;
    use 0x2::tx_context;

    /// Mint an EntryNFT and create an access policy in one transaction
    /// 
    /// Args:
    ///   journal: The user's Journal
    ///   mood_score: Mood score (0-100)
    ///   mood_text: Mood description text
    ///   tags_csv: Comma-separated tags
    ///   image_url: Image URL
    ///   image_mime: Image MIME type
    ///   image_sha256: Image SHA-256 hash
    ///   audio_url: Audio URL
    ///   audio_mime: Audio MIME type
    ///   audio_sha256: Audio SHA-256 hash
    ///   audio_duration_ms: Audio duration in milliseconds
    ///   is_public: true for Public Seal, false for Private Seal
    ///   registry: The PolicyRegistry shared object
    ///   clk: Clock object
    public entry fun mint_entry_with_policy(
        journal: &mut Journal,
        mood_score: u8,
        mood_text: String,
        tags_csv: String,
        image_url: String,
        image_mime: String,
        image_sha256: vector<u8>,
        audio_url: String,
        audio_mime: String,
        audio_sha256: vector<u8>,
        audio_duration_ms: u64,
        is_public: bool,
        registry: &mut PolicyRegistry,
        clk: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Verify sender is the owner
        assert!(sender == diary::get_journal_owner(journal), 0);
        
        let now = clock::timestamp_ms(clk);
        let day_index = now / 86400000;
        
        // Increment count
        diary::increment_journal_count(journal);
        let entry_index = diary::get_journal_count_for_policy(journal);
        
        // Create NFT using diary module function
        let nft = diary::create_entry_nft(
            object::id(journal),
            now,
            day_index,
            mood_score,
            mood_text,
            tags_csv,
            image_url,
            image_mime,
            image_sha256,
            audio_url,
            audio_mime,
            audio_sha256,
            audio_duration_ms,
            ctx
        );
        
        let entry_id = object::id(&nft);
        
        // Add entry ref
        diary::add_entry_ref(journal, entry_index, diary::create_entry_ref(entry_id, day_index));
        
        // Emit event
        diary::emit_mint_event(sender, day_index, mood_score);
        
        // Transfer NFT to owner
        diary::transfer_entry_nft(nft, sender);
        
        // Create access policy for the EntryNFT
        seal_access_policies::create_policy(
            entry_id,
            sender,
            is_public,
            registry,
            ctx
        );
    }
}
