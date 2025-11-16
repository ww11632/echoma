# 🧠 Emotion Journal NFT (Sui Move)

A **decentralized emotion journal** built on the **Sui blockchain**, allowing users to mint daily emotion records (text, image, and voice) as NFTs.  
Each user owns a `Journal` object, and every day’s record becomes a unique `EntryNFT` stored on-chain.

---

## 📦 Package Information

### Testnet
| Item | Value |
|------|-------|
| **Package ID** | `0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71` |
| **UpgradeCap ID** | `0xf7b8509d980301b3cf6e94f2336b86115ec5f6ca6e46522ddf52098c127eb7f5` |
| **Module Name** | `diary` |
| **Deployer** | `0x439bfbeeeecd537d47d4f09f63f53ea318962611ce4e26cbf140503728e4691d` |
| **Network** | Testnet |

### Mainnet
| Item | Value |
|------|-------|
| **Package ID** | `0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9` |
| **Module Name** | `diary` |
| **Network** | Mainnet |
| **Transaction** | `BSFreoSf5M38J8QkNgNhLJ6cnYpfAGNTroU5ULFCpLSS` |
| **Explorer** | [View on Sui Explorer](https://suiexplorer.com/?network=mainnet&object=0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9) |

---

## 🪙 Overview

### Objects
| Object | Description |
|--------|--------------|
| `Journal` | A parent object representing the user’s emotional diary. |
| `EntryNFT` | A child NFT representing one daily record (text, image, audio). |
| `EntryRef` | A dynamic-field index that links day → NFT ID for efficient lookup. |

### Flow
1. User calls `create_journal()` to create a personal Journal.
2. Each day, user calls `mint_entry()` to record mood, text, image, and audio.
3. Each entry becomes an independent NFT transferred to the user.
4. Journal stores a lightweight index (dynamic field) for on-chain lookup.

---

## 🧱 1️⃣ Build

```bash
sui move build

--- 

## Create Journal

### Testnet
```bash
sui client call \
  --package 0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71 \
  --module diary \
  --function create_journal \
  --gas-budget 10000000
```

### Mainnet
```bash
sui client call \
  --package 0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9 \
  --module diary \
  --function create_journal \
  --gas-budget 10000000
```

## Mint NFT

### Testnet
```bash
sui client call \
  --package 0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71 \
  --module diary \
  --function mint_entry \
  --args \
    0x<JOURNAL_ID> \
    5 \
    "今天感覺很放鬆" \
    "relax, weekend" \
    "https://ipfs.io/ipfs/<image_hash>" \
    "image/png" \
    0x1234 \
    "https://ipfs.io/ipfs/<audio_hash>" \
    "audio/mpeg" \
    0x5678 \
    10000 \
  --gas-budget 10000000
```

### Mainnet
```bash
sui client call \
  --package 0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9 \
  --module diary \
  --function mint_entry \
  --args \
    0x<JOURNAL_ID> \
    5 \
    "今天感覺很放鬆" \
    "relax, weekend" \
    "https://ipfs.io/ipfs/<image_hash>" \
    "image/png" \
    0x1234 \
    "https://ipfs.io/ipfs/<audio_hash>" \
    "audio/mpeg" \
    0x5678 \
    10000 \
  --gas-budget 10000000
```

Parameter Explanation
    Arg	Description
    0x<JOURNAL_ID>	The user’s Journal object ID
    5	Mood score (1–10)
    "今天感覺很放鬆"	Mood text
    "relax, weekend"	Tags (CSV)
    image_url / audio_url	IPFS links
    image_mime, audio_mime	MIME type
    image_sha256, audio_sha256	SHA-256 hashes (vector<u8>)
    audio_duration_ms	Duration in ms