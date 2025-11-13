module emotion_metadata::emotion_metadata;

use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;

/// Emotion metadata stored on-chain
/// Contains minimal public information: blobId, hash, emotion, timestamp
public struct EmotionMetadata has key, store {
    id: UID,
    blob_id: vector<u8>,      // Walrus blob ID
    payload_hash: vector<u8>, // SHA-256 hash of encrypted data
    emotion: u8,               // Emotion type: 0=joy, 1=sadness, 2=anger, 3=anxiety, 4=confusion, 5=peace
    timestamp: u64,            // Unix timestamp in milliseconds
}

/// Create and transfer EmotionMetadata to the sender
public fun create_metadata(
    blob_id: vector<u8>,
    payload_hash: vector<u8>,
    emotion: u8,
    timestamp: u64,
    ctx: &mut TxContext
): EmotionMetadata {
    let metadata = EmotionMetadata {
        id: sui::object::new(ctx),
        blob_id,
        payload_hash,
        emotion,
        timestamp,
    };
    
    transfer::transfer(metadata, tx_context::sender(ctx));
    metadata
}

/// Get blob ID from metadata
public fun blob_id(metadata: &EmotionMetadata): vector<u8> {
    metadata.blob_id
}

/// Get payload hash from metadata
public fun payload_hash(metadata: &EmotionMetadata): vector<u8> {
    metadata.payload_hash
}

/// Get emotion from metadata
public fun emotion(metadata: &EmotionMetadata): u8 {
    metadata.emotion
}

/// Get timestamp from metadata
public fun timestamp(metadata: &EmotionMetadata): u64 {
    metadata.timestamp
}

