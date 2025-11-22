---
title: Echoma_WhitePaper

---

# Abstract
Echoma is an emotional journaling app that combines empathetic AI feedback with NFT-based on-chain memories, allowing each user’s emotions to be preserved, understood, and owned.
As the first reference application of the **Echoma Protocol** (with EmoVault Protocol as the long-term interoperability vision), Echoma focuses on validating user needs in the short term, while aiming to establish a cross-platform emotional ecosystem in the long term.
Echoma follows a four-layer privacy defense (client-side Argon2id→AES-GCM encryption, Walrus encrypted blobs, Sui NFT proof-of-existence, and on-chain Seal grant/revoke governance), achieving a **platform-zero-knowledge (E2EE) archive** where the system never learns user plaintext emotions.

This application merges Web3 technology, AI analysis, and emotional journaling into an intelligent experience:

- Empathic AI Engine — Understands your emotions through natural language and non-verbal cues.
- Emotional Vault — Provides private, encrypted storage for secure emotional preservation.
- Emotional NFT — Mints your significant emotional moments into reviewable and displayable digital assets.
- Built on Sui Network — Leveraging its object-based NFT standard to ensure uniqueness for each emotional asset.
# Overview
## 1. What is Echoma
- Echoma is an AI-powered emotional journaling app that transforms fleeting feelings into lasting digital memories.
- It combines **empathetic AI feedback** with **NFT-based emotional anchors**, allowing users to **own** their emotions in the decentralized web.
- Built atop the shipped **Echoma Protocol** and aligned with the long-term **EmoVault Protocol** vision, Echoma is the first reference app to explore *empathy as protocol* — a framework where emotional data becomes self-sovereign and interoperable.

## 2. Vision & Philosophy
In an era of information overload and social anxiety, Echoma creates a safe space where users can express, be understood, and own their emotions.
The product merges empathetic AI technology with Web3 digital ownership, transforming fleeting emotions into preserved, verifiable life moments.

Echoma serves as the first reference application of the Echoma Protocol, while EmoVault Protocol represents the long-term emotional interoperability layer.

- Empathic AI Engine — Understands emotions through natural language and non-verbal cues.
- Emotional Vault — Provides private storage and encrypted access for secure emotional preservation.
- Emotional NFT — Mints significant emotional moments into reviewable and displayable digital assets.

### Ultimate Impact 🌍

Echoma aims to establish an Emotional Data Layer, serving as the foundational protocol for humanity and empathy in the Web3 ecosystem.

It fosters the development of Digital Selfhood and Empathic AI Agents, enabling individuals to interact with AI in a context-aware, emotionally intelligent manner.

### Core Beliefs

- Emotions should be owned and preserved.
- Empathy as Protocol — building a framework for human-AI emotional interaction.
- Digital Memory Anchors — transforming each emotional moment into an immutable, reviewable NFT.

### Long-term Vision
To become the foundational protocol for understanding human emotions in Web3.

Just as Lens Protocol serves as the social layer, EmoVault will serve as the emotional layer of the decentralized web.

## 3. Architecture Overview
### Architecture diagram
![Walrus_Hackthon (2)](https://hackmd.io/_uploads/B1A81VyWbx.png)


### 3.1 Application Layer (Echoma)  
Echoma is an emotion tracking application designed for personal users, aiming to provide warm feedback while safeguarding user privacy. The frontend uses React 18 + TypeScript + Vite, along with components like shadcn/ui, Tailwind CSS, and Radix UI, to build an intuitive yet professional interface. It supports multiple modes: anonymous mode includes local storage, direct uploads to the browser, or using a wallet to store data on-chain and mint NFTs; secure mode allows users to register an account, receive cloud backup, and enhanced security, suitable for quick trials. These flexible modes encourage users to choose the appropriate privacy and functionality based on their needs.  
The core features provided by the application include:  
* Emotion record and timeline view — Users can choose the type and intensity of their emotions, write a description, submit it, and view past records on the timeline.  
* Client-side encryption — All emotional data is encrypted with AES-GCM-256 before leaving the device.  
  Keys are primarily derived via **Argon2id (memory-hard)** with automatic fallback to enhanced PBKDF2 (≥300k iterations) for unsupported devices, ensuring strong resistance against GPU/ASIC cracking.
* AI emotional analysis — In authenticated mode, the system sends the user's emotional description to the Lovable API connected through Supabase Edge Functions, generating empathetic responses and suggestions.  
* Multilingual support — The interface and AI responses support both Traditional Chinese and English.  
* Cross-platform deployment — The web application is wrapped into an iOS App using Capacitor, providing a native experience.

This gives Echoma a platform-zero-knowledge (E2EE) property: servers and storage layers never see plaintext emotions.

### 3.2 Infrastructure Layer (Sui/Walrus/AI Models)  
The infrastructure layer provides secure, scalable, and verifiable support for the application, consisting primarily of the following four components: 

1. **Sui Blockchain**: Sui is a public blockchain created by Mysten Labs, using an object-oriented data model where each transaction only needs to be verified by the relevant object’s owner, enabling high concurrency processing. Through the Narwhal and Tusk consensus mechanisms, its theoretical throughput can reach up to 125,000 TPS. Sui represents storage space and data proofs as on-chain objects, which can be owned, split, transferred, and validated by smart contracts. The object types in Sui are divided into "single-owner, shared, and immutable objects," where single-owner objects can complete transactions in near-instant time.  
2. **Walrus Decentralized Storage**: Walrus is a data storage protocol built on Sui, using advanced erasure codes to shard data, saving costs and being fault-tolerant. Walrus supports writing and reading blobs, allowing anyone to prove that a blob can still be retrieved in the future. Through integration with the Sui blockchain, both storage space and blobs are represented as on-chain objects, and smart contracts can query the availability and duration of blobs. Walrus operates by staking WAL tokens through a delegated proof of stake mechanism, where selected nodes are responsible for sharding storage and issuing proofs. Walrus also provides CLI, HTTP API, and SDK interfaces, making Web2 integration easier.  
3. **Seal Data Protection Layer (with Access Policies)**:  
Seal is a confidentiality and access-control layer on top of Walrus. Beyond encryption, Echoma ships full **Seal Access Policies** to support **dynamic grant/revoke**, **time-limited sharing**, and **on-chain permission queries** via a `PolicyRegistry`.  
This enables a “publicly verifiable, privately readable” emotional data space: anyone can verify a record exists, but only authorized clients can decrypt it.
4. **AI Models and Security Mechanisms**: Echoma's emotional analysis sends user descriptions to the Lovable API via Supabase Edge Functions. The system includes protections against prompt injection (input sanitization, minimized context), keyword detection, and crisis handling, and logs every AI call. To prevent malicious use, AI responses undergo classification and risk assessments. If self-harm or harm-to-others keywords are detected, safety warnings will be returned.

Additionally, the infrastructure layer includes Supabase (for authentication and cloud storage), Walrus Aggregator (for accelerating Walrus data reads on Web2), and security testing suites. The overall design decouples the application from the infrastructure, ensuring easy future switching to other chains or storage systems.

### 3.3 Protocol Layer (EmoVault)  
The protocol layer represents Echoma’s future vision, aiming to establish a standardized emotional data protocol. Through EmoVault, each emotional record stored in Walrus will correspond to a unique NFT. This NFT does not carry plaintext data but contains the encrypted blob ID, metadata (such as emotion type and intensity), and a verifiable timestamp. The design goals of EmoVault include:  
* **Interoperability** — Other Web3 applications can recognize and reference emotional data based on a standard interface.  
* **Permission Control** — Holders can choose to authorize others to decrypt, view, or analyze their emotional records.  
* **Long-term Preservation and Privacy** — NFTs store only encrypted indices, with the actual content stored in Walrus. The encrypted header contains version information, ensuring that old data can still be decrypted with future algorithm upgrades.  
* **Revenue Model** — Future exploration of incentive-based models using emotional data, such as earning governance tokens or accessing mental health resources through anonymous sharing.

### Protocol Naming Clarification

Echoma is the reference application. The on-chain contracts are deployed under the **Echoma Protocol** package (modules: `diary`, `diary_with_policy`, `seal_access_policies`).  
**EmoVault Protocol** refers to the long-term standardization vision: a cross-app emotional data layer built on top of Echoma’s verified primitives.

- **Echoma Protocol (On-chain, shipped):** Contracts + NFT objects + Seal policies.
- **EmoVault Protocol (Roadmap):** Interoperability spec and ecosystem for emotional data across Web3 apps.

This separation mirrors how Lens provides a social data layer, while Echoma/EmoVault provides an emotional data layer.

**Mainnet Package ID:** `0x45f9ba755acaf2306525b4a5b67d32bd4905f56108499306449da7312b76330d`  
**PolicyRegistry ID:** `0xdbeb691b5d310d83646b101b72123ad2ed170c7ca834faa90fbda3be01c403e3`



# Problem Statement
In an era of information overload and pervasive social media, people’s emotions often lack an outlet, leaving them unacknowledged, fragmented, and ephemeral. Existing journaling apps or mental health tools face several challenges:

1. No empathetic feedback — Traditional journals and social platforms provide little to no real-time, emotionally-aware response. Users often feel misunderstood or judged.

1. Low engagement and motivation — Journaling can feel repetitive or meaningless, leading to short-lived adoption and a lack of continuity in emotional tracking.
1. AI lacks true empathy — Existing AI feedback tends to be formulaic or insensitive, failing to respond appropriately to the user’s emotional context.
1. Technical barriers to on-chain experience — Wallet connection and NFT minting are complex for non-Web3-native users, and even motivated users struggle if emotional content lacks perceived value.
1. Unclear data ownership and privacy concerns — Emotional data is often stored in centralized platforms, leaving users uncertain about who owns their sensitive personal records.
1. NFTs lack emotional meaning — Current digital collectibles focus on art or financial value, offering little connection to users’ lived emotional experiences.

As a result, there is no dedicated space where emotions can be safely expressed, understood, preserved, and personally owned, while integrating AI empathy and Web3 technology. 
> Echoma addresses these gaps by combining multi-modal journaling, empathic AI feedback, privacy-controlled storage, and emotional NFTs, creating a platform where users’ emotions can become digitally meaningful, secure, and collectible assets.
# Product

## 1. Module 1: Emotion Journal 
### Objective

Provide a fast, intuitive interface for daily emotional journaling with multiple input methods, lowering barriers while maintaining expressive freedom.

### User Story

As someone sensitive to emotions but not adept at expressing them in words, I want to use emojis or images to record my feelings, so I can maintain a daily journaling habit.
### Features

| Feature                    | Description                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Multi-modal Input          | Support for text, emoji, and image uploads/captures, enabling diverse self-expression.                                               |
| Custom Tags                | Users can add multiple tags per entry (#healing, #anxiety, #breakthrough).                                                           |
| Timestamping               | Automatic time logging with optional manual backfill.                                                                                |
| Guided Journaling Prompts  | Optional prompts like “What moved you today?” or “Who did you most want to talk to?”                                                 |
| Draft & Save Mechanism     | Save incomplete entries as drafts to prevent data loss.                                                                              |
| On-chain / NFT Integration | Users can choose to **save a redacted summary on-chain** or **mint an Emotional NFT** that links to the encrypted entry. Summary = proof of existence; NFT = collectible emotional anchor. |


## 2. AI Empathy Engine
### Objective

Provide gentle, empathetic AI feedback (non-medical), encouraging users to continuously journal and understand their emotions.

### User Story

As someone who often feels misunderstood, I want an AI that understands the meaning behind my emotions and gives non-judgmental guidance.

### Features
| Feature             | Description                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| Emotional NLP       | Analyze emotional tendencies of user input (positive, neutral, negative, mixed).     |
| Feedback Generation | Generate empathic text responses contextualized to the emotion.                      |
| Suggestion Module   | Provide non-medical guidance like “listen to music” or “write a letter to yourself.” |
| Historical Feedback | Users can review past AI responses as part of their emotional growth.                |
| Tone Customization  | Select AI tone: gentle, rational, playful, calm.                                     |

### Security
#### Crisis-Sensitive Input Detection and Risk Tiering

The system maintains a bilingual (Chinese/English) lexicon of high-risk phrases related to self-harm and other crises. When such phrases appear, the interaction is tagged as **high risk**, normal AI inference is stopped, and a dedicated safety path with protective handling and audit logging is triggered.

#### Input Normalization and Prompt-Injection Resistance

All incoming content is normalized and sanitized before reaching the model. Only emotionally relevant information (such as mood and intensity) is kept, while system-style instructions, markup, and excessive or irrelevant text are removed to reduce prompt-injection and privilege-escalation risks.

#### Output Risk Evaluation and Safe Crisis Responses

Model outputs are first passed through a safety review and risk-scoring layer. Responses are classified (for example, emotional support, general advice, crisis-related), and if severe-risk content is detected, the original output is replaced with a predefined safe message that is empathetic, avoids harmful detail, and directs users to professional or local emergency support.

#### Audit Logging with Privacy Preservation

Safety-relevant events are stored as structured audit records, including user identifier, endpoint, model, approximate input/output size, risk level, and triggered keyword categories. To protect privacy, only summaries of emotional state and risk are stored, and row-level security ensures users can access only their own records.

#### API Key Lifecycle and Access Management

External AI provider keys are managed by a dedicated lifecycle and rotation mechanism. Keys are stored encrypted, automatically selected when active, and rotated based on schedule or policy, reducing long-term reuse risk and simplifying response to provider or internal security changes.

#### End-to-End Secure Orchestration

All mechanisms are composed into an end-to-end secure pipeline: authenticate user, screen and sanitize input, construct the prompt, call the AI service, screen output, optionally replace it with a safe response, and log safety events. This **input → inference → output → audit** loop delivers emotional support while maintaining safety, traceability, and compliance.



## 3. NFT Memory Anchors
### Objective

Mint specific emotional events as unique NFTs, creating digital memories that can be owned, displayed, and preserved.

### User Story

When I overcome a difficult period, I want to mint that moment as a personal NFT to commemorate my effort and resilience.

### Features
| Feature                | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Minting Portal         | Users can select “mint as NFT,” guided through chain selection and wallet connection. |
| Ownership Management   | NFTs are automatically stored in user wallets, usable for personal memory display.    |
| Multi-chain Support    | Initially Sui (for native Walrus integration), with Polygon and Base planned as future deployment targets. |
| NFT Content Generation | Combine entry content, date, and emotional visuals into metadata and visual card.     |
| Visual Styles          | Provide multiple NFT themes (card, poster style) or AI art templates.                 |
| Sharing Options        | Generate shareable NFT links with configurable visibility settings.                   |


## 4. Privacy & Vault
### 4.1 Data Model & Privacy Modes

Echoma treats emotional records as highly sensitive personal data and follows a **minimum-visibility design principle**. All user-related data is categorized into three layers:

1. **Content Layer**  
   Free-form emotional text, titles, and contextual descriptions.

2. **Emotion Index / Metadata Layer**  
   Emotion category, intensity, timestamp, language, and non-identifiable tags.

3. **Identity / Account Layer**  
   Wallet address, Supabase user ID, device identifiers, etc.

Echoma offers **three privacy modes**, depending on user preference and usage context:

#### • Local Mode
All content and metadata are encrypted and stored **only on the user's device** (localStorage / IndexedDB). No data is synced to cloud or blockchain. Even if servers are compromised, **local records remain private and inaccessible**.

#### • Secure Mode (Account-Based)
Content is encrypted on the client using **AES-GCM-256** before being stored in Supabase. The server can only see encrypted payloads and limited metadata (timestamps + non-identifiable labels). **Row-Level Security (RLS)** enforces strict user boundaries.

#### • Anonymous Mode (Wallet-Based)
Users interact without traditional accounts by connecting a Sui wallet. Encrypted content is uploaded to **Walrus**, and an **Emotion NFT** is minted on Sui. Only encrypted blob references and redacted metadata are stored on-chain — **no plaintext or personal identifiers ever leave the device**.

All three modes can coexist, allowing users to shift between **100% local privacy**, **secure cloud backup**, and **on-chain proof-of-existence**.

---

### 4.2 Client-Side Encryption & Key Derivation (Updated v3.0)

Echoma uses end-to-end encryption (E2EE) for all emotional content. Encryption happens locally on the client before any data leaves the device.

- **Encryption Algorithm:** `AES-GCM-256` for confidentiality and integrity.
- **Key Derivation (KDF):** `Argon2id` (memory-hard) is used as the primary KDF to resist GPU/ASIC cracking.  
  - **Production parameters:** 3 iterations × 64 MB memory × 4 threads, 32-byte output.  
  - **Fallback:** When Argon2id is unavailable (e.g., limited devices or legacy environments), Echoma automatically falls back to enhanced PBKDF2 (≥300k iterations) **only as a compatibility path**.

This design ensures the platform never stores or accesses plaintext keys, while keeping cryptography forward-compatible through versioned headers embedded in encrypted payloads.

- **Key Storage Strategy**

| Mode         | Strategy |
|--------------|----------|
| Local Mode   | Keys only exist in memory or OS key vault; clearing browser data removes access. |
| Secure Mode  | Only encrypted key envelopes are stored server-side; servers never hold usable keys. |
| Anonymous Mode | Keys are derived from wallet-bound secrets; neither server nor protocol stores keys. |

Encryption headers include version + algorithm metadata to ensure backward compatibility.

---

### 4.3 EmoVault & Storage Vault Architecture

Echoma constructs a **verifiable yet privacy-preserving emotional storage stack** using Walrus, Seal, and Sui:

#### 1. Encrypted Blob Storage (Walrus)
Encrypted emotional payloads are stored as blobs. Walrus uses erasure coding to split data across multiple nodes for durability. Retrieval only requires the **blob ID**.

#### 2. Confidential Access Control (Seal)

Seal is Echoma’s programmable confidentiality + access-control layer for Walrus blobs.  
Echoma implements full **Seal Access Policies** on-chain, enabling:

- **Dynamic Grant / Revoke:** users can authorize and revoke specific readers at any time.
- **Time-Limited Access:** access can be granted with expiry (e.g., therapist access for 30 days).
- **On-chain Permission Queries:** policies live in a `PolicyRegistry`, so any client can verify access rights trustlessly.
- **Mainnet Ready:** Seal policies are deployed on mainnet with testnet parity.

This turns emotional records into **publicly provable yet content-confidential objects**, enabling consent-gated composability without plaintext leakage.

#### 3. Emotion NFT (Sui)
Each emotional record links to an NFT containing:

- Reference or hash of blob ID  
- Curated, non-identifiable emotional metadata  
- Timestamp + protocol version  

NFTs do **not** contain plaintext data. They serve as **Proof-of-Existence and Access Rights**.

**Benefits:**

- Emotional history is portable across apps  
- Selective access can be shared with therapists, research teams, or trusted peers  
- Smart contracts may define usage terms or incentives  

---

### 4.4 User Control, Deletion & Audit

Echoma prioritizes **meaningful self-data ownership**, not just disclosure compliance.

#### Deletion & Revocation Logic

| Mode         | Behavior |
|--------------|-------------------------------------------|
| Local        | Encrypted local data fully removed. |
| Secure       | Encrypted payload + metadata removed from Supabase; future Walrus sync will include remote revocation. |
| Anonymous    | NFT can be burned/transferred; user may request shorter Walrus retention epochs (subject to protocol). |

#### Audit Logging

Events such as AI usage, decryption attempts, wallet signatures, and authorization flows are logged with timestamps and provenance — without plaintext. Logs support:

- Access anomaly investigation  
- Permission rule verification  
- Regulatory and research-grade audit trails  

---

### 4.5 Threat Model & Known Limitations

#### Mitigated Threats
- Server-side database breaches  
- Storage node compromise or availability issues  
- Passive collection by third-party AI providers  
- Network eavesdropping or MITM attacks  

#### Known Risks (Currently Accept Acknowledgment-Based)
- Device malware or stolen physical access  
- User voluntarily shares content/screenshots  
- Low-entropy metadata inference risks on-chain  

Roadmap enhancements will explore stronger key UX, advanced privacy metadata schemas, and secure-computation-based models such as MPC and ZK-proofs.



## 5. AI x Web3 Mechanism
### 5.1 Data Flow Diagram
![Walrus_Hackthon](https://hackmd.io/_uploads/rymqdSUeWg.png)
![Walrus_Hackthon (1)](https://hackmd.io/_uploads/SyUq_HIxbg.png)
![Walrus_Hackthon (2)](https://hackmd.io/_uploads/r1_qOBIebl.png)

### 5.2 Wallet Connection  
In both anonymous and authenticated modes, users must connect a Sui wallet to access blockchain features. The Echoma frontend uses the wallet connection components and transaction signing capabilities provided by @mysten/dapp-kit and @mysten/sui.  
The basic steps are as follows:  
* The user installs a Sui wallet (such as the official Sui Wallet or Ethos Wallet), creates a new wallet, and backs up the recovery phrase.  
* In the Echoma application, click "Connect Wallet," which will trigger an authorization window in the browser; after the user confirms, the application will obtain the wallet address and public key.  
* When submitting an emotion record, the application will construct the transaction message (including the Walrus blob ID, NFT metadata, etc.) and request the wallet to sign it; once the signature is complete, the transaction will be broadcast to the Sui network.  
* Using Walrus storage requires a small amount of SUI and WAL tokens to pay for upload and storage fees. In the testnet environment, users can obtain SUI through the official Sui faucet or community faucets; WAL tokens can be acquired either through 1:1 exchange using the Walrus CLI or via the Stakely faucet.
### 5.3 NFT Minting Flow Architecture


This chapter describes how a user interaction in Echoma is turned into an on-chain NFT, from the first UI input to the final persisted state on Sui. The focus is on the end-to-end minting flow, including client-side processing, Walrus integration, and the Move smart contract execution.

#### Actors and Components

![Tech structure-2025-11-16-074913](https://hackmd.io/_uploads/S1N6dEPeZg.png)


> Fig. Tech structure
> 

#### User Device (Browser / Mobile Client)

- Renders the Echoma interface and collects the user’s emotional entry:
emotion tag, intensity slider, free-text description, and optional media (image, voice note).

#### Frontend Application (Echoma UI + TypeScript SDK)

- Validates user inputs and enforces basic constraints (required fields, length limits, emotion type).
- Builds the emotion snapshot payload and orchestrates encryption, Walrus upload, and mint transactions.

#### Encryption Layer

- Uses symmetric encryption (e.g., AES-GCM) for the emotion snapshot and media references before upload.
- Computes SHA-256 hashes for integrity checks and future on-chain verification.

#### Walrus Decentralized Storage

- Stores encrypted payloads and media blobs off-chain.
- Returns a blobId and a walrusUrl that can be embedded into NFT metadata.

#### Sui Wallet (Dapp-kit Compatible Wallet)

- Displays transaction prompts to the user and signs the mint_entry call.
- Relays the signed transaction to the Sui network.

#### Diary Move Module on Sui

- Implements the Journal and EntryNFT data models.
- Enforces the journal-level mint policy and emits events for indexing.

### 5.4 High-Level Mint Flow

At a high level, the NFT minting flow proceeds as follows:

#### 1. User input

- The user selects an emotion tag, sets an intensity value, writes a description, and optionally attaches media (image and/or audio).

#### 2. Client-side validation

- The frontend validates:
    - Emotion ∈ {joy, sadness, anger, anxiety, confusion, peace}
    - Intensity within a bounded range (e.g., 0–100)
    - Description length and basic safety checks.

#### 3. Snapshot construction and encryption

- The encryption layer builds a structured emotion snapshot including:
    - Emotion, intensity (later mapped to `mood_score`)
    - Description text
    - Wallet address (for authenticated mode)
    - Timestamp and schema version
- The snapshot is encrypted and hashed (SHA-256) on the client.

#### 4. Walrus upload

- The encrypted snapshot and media files are uploaded to Walrus.
- Walrus returns a blobId and a walrusUrl for each stored payload.

#### 5. Mint transaction preparation

- The frontend derives `mood_score` from the raw intensity value.
- It constructs a `mint_entry` call with:
    - `journal_id`
    - `mood_score`
    - `mood_text` (description)
    - `tags_csv` (emotion tags)
    - `image_url` / `image_mime` (Walrus URL + MIME)
    - Optional `audio_url` / `audio_mime` and duration.

#### 6. User signing and submission

- The Sui wallet prompts the user to review and sign the transaction.
- Upon confirmation, the wallet submits the signed transaction to the Sui network.

#### 7. On-chain execution and state update

- The diary Move module validates the call, creates an EntryNFT, updates the corresponding Journal, and records a dynamic-field index.
- A MintEvent is emitted, and the resulting objects are persisted on chain.

#### 8. Frontend confirmation

- The frontend receives the transaction digest and object IDs.
- The UI updates the user’s timeline to include the freshly minted NFT entry.

### 5.5 Walrus Storage and On-chain reference

Walrus is used as the decentralized blob storage layer due to:

### Advantages:

- Native Sui ecosystem support
- Provable storage guarantees
- Replicated, erasure-coded architecture
- Epoch-based retention (configurable)

### Storage Artifacts:

| Blob Type | Stored In Walrus | On-chain reference |
| --- | --- | --- |
| Encrypted Snapshot | ✔ |  Referenced via Walrus URL / blob ID; SHA-256 tracked off-chain by indexers |
| image | ✔ | SHA256 + URL + MIME |
| audio | ✔ | SHA256 + URL + MIME + (duration) |

### 5.6 Walrus Integration in the Mint Flow

![Untitled diagram-2025-11-16-074806](https://hackmd.io/_uploads/SkORtNPx-e.png)

### 5.7 NFT Metadata Spec

#### NFT Metadata ↔ Frontend Data Mapping Table

This section defines the precise relationship between on-chain NFT metadata stored in the Move smart contract and the off-chain encrypted emotion snapshot generated by the frontend.  
The mapping clarifies how user-generated data flows through encryption, Walrus decentralized storage, and finally into the immutable on-chain metadata of each `EntryNFT`.

The UI enforces that `mood_text` stays short and non-identifiable (caption-level only). Full emotional content is encrypted and never written on-chain.

| **Category** | **Field Name**      | **On-Chain NFT Metadata**                          | **Frontend / Off-Chain Data**                                  | **Description** |
| ------------ | ------------------- | -------------------------------------------------- | ---------------------------------------------------------------- | --------------- |
| **Identity** | `entry_id`          | Yes (auto-generated)                               | Derived from EntryNFT object ID (`object::id(&nft)`)            | Globally unique NFT identifier on Sui |
|              | `journal_id`        | Yes                                                | Stored after `create_journal`                                   | NFT belongs to a specific `Journal` object |
| **Mood & Emotion** | `mood_score`   | Yes (`u8`)                                         | From `intensity` (0–100 → 0–10)                                 | Normalized emotion intensity |
|              | `mood_text`         | Yes (string)                                       | `description` (short caption / title, non-sensitive)            | Public-facing emotion caption; full journal text remains off-chain and encrypted |
|              | `tags_csv`          | Yes (string)                                       | `selectedEmotion` or multi-tags                                 | Comma-separated emotion labels |
| **Media (Image / Audio)** | `image_url` | Yes                                             | Walrus URL from upload                                          | Content-addressed image resource URL |
|              | `image_mime`        | Yes                                                | `file.type` (e.g. `image/jpeg`)                                 | MIME type for client rendering |
|              | `image_sha256`      | Yes (`vector<u8>`)                                 | `sha256(imageFile)`                                             | Image integrity verification hash |
|              | `audio_url`         | Yes (can be empty string if no audio attached)     | Walrus URL from upload                                          | Optional voice recording URL |
|              | `audio_mime`        | Yes (can be empty string if no audio attached)     | `audioFile.type`                                                | Audio MIME format |
|              | `audio_sha256`      | Yes (`vector<u8>`)                                 | `sha256(audioFile)`                                             | Audio integrity verification hash |
|              | `audio_duration_ms` | Yes (`u64`)                                        | Extracted via `<audio>` API                                     | Duration of the voice note in milliseconds |
| **Encrypted Snapshot** | `payload_hash` | No (off-chain only)                            | Hash of encrypted JSON payload                                  | Guarantees off-chain data integrity; tracked by indexer / frontend, not stored in the Move structs |
| **Ownership** | `owner`            | Yes (via Sui object owner, not as explicit field)  | Connected wallet address                                         | NFT ownership enforced by the Sui object model |
| **Timestamp** | `timestamp_ms`     | Yes (`u64`)                                        | Derived from on-chain clock                                     | Millisecond-precision mint time stored on-chain |
|              | `timestamp`         | No (off-chain only)                                | `Date.now()` at creation                                        | Frontend-local creation time (for UX / analytics) |
|              | `day_index`         | Yes (`u64`)                                        | Derived from `timestamp_ms / 86_400_000`                        | Day-level index used for chronological grouping and future optional per-day policies |
| **Version**  | `version`           | No (off-chain / future extension)                  | `"1.0.0"`                                                       | Version of the snapshot schema (tracked in frontend / off-chain indexer) |


### 5.8 Data Integrity (SHA-256)

Each uploaded media file (image or audio) is hashed using SHA-256 on the client-side before upload.
The resulting hash is stored immutably on-chain as part of the NFT metadata.

This ensures:

- Immutability: Users and verifiers can always confirm the blob stored in Walrus has not been modified.
- Authenticity: Prevents malicious replacement of images or audio.
- Privacy: Only hashes, not raw data, are placed on-chain.

**Flow Chart:**

![image](https://hackmd.io/_uploads/SkWtWPvgbl.png)



### 5.9 Privacy-Preserving Design

The system follows a privacy-first architecture:

- Full emotional journal entries and media are never stored on-chain.  
  The NFT only stores a short, user-provided caption (`mood_text`) and hashed media references, while the full emotional content remains encrypted off-chain.
- All sensitive emotion snapshots are encrypted locally using AES-256-GCM before upload.
- Only encrypted blob **references (URLs)** and SHA-256 hashes are stored on-chain; no raw media bytes or full journal text are ever embedded directly in contract storage.

This design ensures that emotional history remains protected while preserving full verifiability and ownership guarantees through NFTs.


# Future Roadmap
### Phase 1｜MVP Validation – Emotional Recording × AI Empathy
### Feature Deliverables

#### Emotion Journal (Core)

* Multi-modal input: text, emoji, photo upload / camera capture
* Custom tags and simple taxonomy
* Drafts & autosave
* Timestamps and manual backfill
* Guided prompts (optional quick prompts)

#### Companion AI (Core)

* Basic Emotion NLP: sentiment + basic intent detection
* Single-mode empathic response generator (default gentle tone)
* History view: store & surface latest AI responses per entry
* Tone selector (simple preset choices)

#### NFT & On-chain Basics

* Lazy-mint flow prototype (metadata off-chain, mint-on-demand)
* Minting UI: wallet connect, chain selector (one primary testnet / one low-fee mainnet)
* On-chain summary option (store proof-of-existence metadata)


### Phase 2 (6–12 months) — Retention, Social Layer & Polishing

> Goal: Improve stickiness, create lightweight social interactions, and polish the experience for broader audiences.

### Feature Deliverables

#### Advanced Companion AI

* Multi-tone responses (soothing / reflective / encouraging)
* Weekly / monthly personal summaries and trend insights
* Contextual replies that reference prior entries (memory recall)


#### Social & Community Features

* Anonymous Empathy Wall (opt-in sharing): Echo / Comment / Reaction primitives
* Controlled sharing permissions for entries and NFTs (private / circles / public)
* Simple remix or reaction templates (allow users to respond empathetically)

#### NFT & Web3 UX Improvements

* One-click minting experience with UX flow abstractions (clear cost & intent)
* Multi-chain support (production-ready: Polygon, Base, SUI as options)
* On-demand IPFS/Arweave storage options and metadata schema stabilization

#### Product Quality

* Accessibility and i18n baseline (locale support)
* Improved onboarding / contextual help
* Scalable backend improvements for AI latency and storage

#### Developer & Integration

* Public metadata spec for Emotional NFT (README + example JSON)
* Webhooks or API for partners to surface EmoVault summaries
# User Journey
### 1. User Archetypes

Echoma serves several categories of users:

* Reflective Users — individuals who want a private space to express thoughts and emotions.
* AI Companion Seekers — users who value emotionally-aware feedback and personal insights.
* Memory Collectors — users who view emotional moments as digital artifacts worth preserving.
* Web3-native Users — users who want full data ownership, on-chain provenance, and NFT-based identity layers.

### 2. The Emotional Journey Lifecycle

The Echoma experience is structured into five core stages:

#### Stage 1 — Capture

Users record emotional moments through text, emojis, or images.
Echoma processes the entry, attaches metadata, and prepares it for reflection.

> Output: Raw emotional record.

#### Stage 2 — Reflect

AI provides an empathetic response, contextual understanding, and emotional insight.
This transforms a simple log into a meaningful moment of reflection.

> Output: AI-generated emotional context.

#### Stage 3 — Preserve

Users can choose to preserve the moment in one of two ways:

1. Private Off-chain Storage (default)
1. On-chain Emotional Memory NFT through Lazy Mint

This turns the emotional moment into a long-term digital “memory anchor”.

> Output: Emotional Memory Asset.

#### Stage 4 — Express

Users may optionally share selected moments through:

* The Community Emotion Wall (opt-in)
* Mirror/Zora social displays
* Personal emotional timelines

This enables soft, empathetic social interaction without compromising privacy by default.

> Output: Curated emotional expression.

#### Stage 5 — Own & Extend

The emotional data becomes part of the user’s Emotional Vault:

* Users fully own their Emotional NFTs
* Permissioned access allows sharing with apps or agents
* Third-party apps can integrate the data via the EmoVault Protocol

> Output: User-owned emotional identity layer.

# For Developers (Coming Soon…)
    - API / SDK
    - Integrations
# Community (Coming Soon…)
    - Governance (Future Plan)
    - Contribution Guide
# Team & Contact
Product Manager : Mia Chang
[Linkedin](https://www.linkedin.com/in/juitung-chang)