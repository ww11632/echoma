# Threat Model and Security Design Trade-offs

## One-Sentence Version

Echoma treats "emotions" as medical-grade sensitive data: content is only decrypted on the client side, but the fact and timestamp of existence can be verified on-chain by anyone.

---

## 📋 Executive Summary (1-2 Minutes Read)

### 1. What Are We Protecting?

- **Highly personal emotional and psychological event narratives**
- **Corresponding timelines, emotional intensity, and optional on-chain proofs (NFTs)**

This data is more dangerous than typical transaction records—once leaked, it's not just "money lost," but an entire life story exposed to the world.

### 2. Who Are the Adversaries?

#### ① Users Themselves (Future Self)
- **Threats**: Accidental deletion, device change, forgotten keys
- **Mitigation**:
  - Deterministic key derivation based on user secrets (wallet signatures / login credentials) → enables cross-device recovery
  - Walrus decentralized storage → not bound to a single device
  - Sui NFT → even if local data is lost, can still prove that "emotional event" existed

#### ② External Attackers
- **Threats**: Eavesdropping, DB breaches, man-in-the-middle, brute-force attacks
- **Mitigation**:
  - Client-side AES-256-GCM encryption, data is ciphertext before leaving device
  - PBKDF2 / Argon2id key strengthening, reduces brute-force feasibility
  - GCM authentication tags automatically detect passive/active tampering
  - Walrus distributed storage reduces "take down one DB and get everything" risk

#### ③ Cloud Platforms and Infrastructure Providers
- **Threats**: Supabase administrators, cloud providers, forced data handover
- **Mitigation**:
  - Server only holds ciphertext and minimal necessary metadata, maintains "practical zero-knowledge" of content
  - Users can choose "full Walrus + wallet mode," independent of any account system
  - Anonymous mode doesn't bind to email / Web2 identity

#### ④ Governments and Regulatory Agencies
- **Threats**: Judicial subpoenas, censorship, state-level surveillance
- **Mitigation**:
  - Even if server is forced to hand over data, only ciphertext is available
  - Walrus + Sui decentralized architecture prevents single country from completely shutting down data source
  - On-chain NFTs only expose "an encrypted emotional event at a certain timestamp," not content

#### ⑤ Development Team Itself
- **Threats**: Backdoors, malicious updates, "casual viewing" of data during growth
- **Mitigation**:
  - Open-source encryption logic → auditable
  - Client-side encryption by design → team doesn't hold decryption keys
  - Threat model in README itself serves as self-constraint

#### ⑥ Future Attackers and Quantum Computers
- **Threats**: Stronger brute-force capabilities, AI-assisted cryptanalysis
- **Mitigation**:
  - Use AES-256 (still requires 2¹²⁸ level operations under Grover's model)
  - Preserve version and algorithm fields in ciphertext header → can upgrade to PQC (e.g., Kyber) in future
  - On-chain timestamps guarantee "authenticity of records at that time," even if encryption is broken decades later

### 3. Why "AES-GCM + Walrus + Sui NFT"?

**Data Flow:**
```
User Input → Client-side AES-GCM Encryption → Walrus Blob Storage → Sui NFT Proof (with Walrus blob reference)
```

**This combination simultaneously satisfies:**
- **Confidentiality**: Only key holders can see content
- **Verifiability**: Anyone can verify "this record existed at a certain time"
- **Availability and Cost**: Walrus handles long-term blob storage, chain only stores indices and proofs, gas costs are controllable
- **Evolvability**: Encryption versions, KDF parameters, storage strategies can all be rolled out incrementally

**Why Walrus is Particularly Suitable for Emotional Journals:**

Emotional journal requirements:
- **Highly sensitive content** → must be end-to-end encrypted
- **Yet must be accessible to future self / doctors / partners** → requires verifiable long-term attestation

Traditional clouds only achieve the former, blockchains usually only achieve the latter. Echoma uses Walrus to make both possible simultaneously for the first time.

### 4. Why We Deliberately Didn't Choose Other Solutions?

#### ❌ Simple DB only
- **Pros**: Fast development
- **Cons**: Everyone must trust that DB; completely insufficient for emotional data

#### ❌ IPFS
- **Pros**: Content-addressable
- **Cons**: Persistence and availability depend on pin services, effectively semi-centralized, also slow

#### ❌ EVM Chain + NFT
- **Pros**: Mature tooling
- **Cons**: Gas too expensive, throughput too low, not practical for daily emotional journaling

#### ❌ zk-Proof from the start
- **Pros**: Academically elegant
- **Cons**: Cost and complexity not worth it at MVP stage; overkill for "validate requirements first"

**Walrus + Sui's positioning hits a sweet spot:**
- Price and performance make daily use reasonable
- Decentralization sufficient to resist single-point failures and censorship
- Can serve as foundation for future zk extensions (has on-chain commitments, stable blob layer)

### 5. Future Security Upgrade Roadmap

- Make Argon2id the default KDF (currently enhanced PBKDF2)
- Add "passphrase mode" so non-wallet users can also get high-strength keys
- Add optional zk-Proof mode for specific use cases (e.g., clinical psychology integration)
- Prepare PQC upgrade path (ciphertext headers already versioned)

---

## 📖 Detailed Version

### Overview

This document outlines Echoma's threat model, security objectives, and the rationale behind our technical design choices. Echoma employs a **client-side encryption + decentralized storage + blockchain verifiability** architecture to protect privacy while providing tamper-proof attestations.

---

## Threat Source Analysis (Detailed)

### 1. Users Themselves
- **Threats**: Accidental deletion, device loss, forgotten keys
- **Mitigation**:
  - Deterministic key derivation based on user secrets (wallet signatures, login credentials), enabling cross-device recovery
  - Walrus decentralized storage, data not dependent on a single device
  - NFT on-chain proofs, allowing verification of record existence even if local data is lost

### 2. Attackers (External Threats)
- **Threats**: Man-in-the-middle attacks, server database breaches, network eavesdropping, brute-force attacks
- **Mitigation**:
  - **Client-side encryption**: Data is encrypted (AES-GCM 256-bit) before leaving the device, servers cannot see plaintext
  - **Strong key derivation**: PBKDF2 (100k-1M iterations) or Argon2id, preventing brute-force attacks
  - **AES-GCM authentication tags**: Automatically detect data tampering
  - **Decentralized storage**: Walrus distributed architecture reduces single-point attack risk

### 3. Cloud Platforms (Supabase/Service Providers)
- **Threats**: Server-side data breaches, backend administrator access, data handover under compliance requirements
- **Mitigation**:
  - **Practical zero-knowledge architecture**: Server only sees encrypted payloads, maintains "practical zero-knowledge" of content, cannot decrypt on its own
  - **Optional decentralized storage**: Users can choose Walrus over Supabase, completely independent of centralized services
  - **Anonymous mode**: No registration required, reducing identity correlation

### 4. Governments/Regulatory Agencies
- **Threats**: Legal requirements to hand over data, surveillance, censorship
- **Mitigation**:
  - **Client-side encryption**: Even if data is requested, it cannot be decrypted (unless keys are obtained)
  - **Decentralized storage**: Walrus provides stronger persistence and censorship resistance than single DB through on-chain commitments + decentralized replicators
  - **Blockchain immutability**: NFTs prove record existence and timestamps, preventing post-facto modification

### 5. Vendors/Development Team
- **Threats**: Backdoors, malicious updates, data misuse
- **Mitigation**:
  - **Open-source code**: Encryption logic is auditable
  - **Client-side encryption**: Development team cannot access plaintext data
  - **Decentralized storage**: Data stored on Walrus, independent of development team's servers

### 6. Future AI (Quantum Computing/Advanced Attacks)
- **Threats**: Quantum computing breaking current encryption, AI-assisted cryptanalysis
- **Mitigation**:
  - **AES-256**: Currently resistant to quantum attacks (Grover's algorithm requires 2^128 operations)
  - **Versioned encryption headers**: Support future upgrades to post-quantum encryption algorithms (e.g., CRYSTALS-Kyber)
  - **Blockchain timestamps**: Even if encryption is broken, blockchain proofs can still verify original record timestamps

---

## Security Model Objectives

### Core Objectives: **Confidentiality + Verifiability**

1. **Confidentiality**
   - Data is encrypted before leaving user devices
   - Servers, storage providers, and network eavesdroppers cannot see plaintext
   - Only users with correct keys can decrypt

2. **Verifiability**
   - Blockchain NFTs prove record existence and timestamps
   - Tamper-proof on-chain proofs prevent post-facto modification
   - Publicly verifiable (no trust in third parties required)

3. **Integrity**
   - AES-GCM authentication tags automatically detect data tampering
   - Blockchain hashes ensure stored data has not been modified

4. **Availability**
   - Decentralized storage (Walrus) reduces single-point-of-failure risk
   - Multiple usage modes (anonymous/authenticated/local) provide alternatives

---

## Design Trade-off Rationale (Detailed)

### Why Choose **AES-GCM + Walrus + NFT**?

#### ✅ Our Solution: AES-GCM + Walrus + Sui NFT

**Architecture Flow:**
```
User Input → Client-side AES-GCM Encryption → Walrus Decentralized Storage → Sui NFT On-chain Proof
```

**Advantages:**
1. **Confidentiality**: Client-side encryption ensures servers cannot see plaintext
2. **Verifiability**: NFTs provide tamper-proof on-chain proofs
3. **Decentralization**: No dependency on a single service provider
4. **Cost-effectiveness**: Low Walrus storage costs, controllable NFT minting fees
5. **Performance**: Fast AES-GCM encryption, suitable for real-time applications

---

### ❌ Why Not Choose Other Solutions?

#### 1. Simple DB (Traditional Database)

**Solution Description**: Store data directly in centralized databases (e.g., PostgreSQL, MongoDB)

**Reasons for Not Choosing:**
- ❌ **Single point of failure**: Database server failures lead to data loss
- ❌ **Privacy risks**: Even with server-side encryption, administrators can access data
- ❌ **Compliance risks**: Governments/regulators can request data handover
- ❌ **Lack of verifiability**: Cannot prove records haven't been tampered with
- ❌ **Vendor lock-in**: Dependency on specific service providers

**Our Solution Advantages:**
- ✅ Client-side encryption ensures servers cannot see plaintext
- ✅ Decentralized storage reduces single-point-of-failure risk
- ✅ Blockchain NFTs provide tamper-proof proofs

---

#### 2. IPFS (InterPlanetary File System)

**Solution Description**: Use IPFS to store encrypted data, use IPNS or smart contracts for indexing

**Reasons for Not Choosing:**
- ❌ **Persistence issues**: IPFS relies on voluntary node storage, data may be lost (unless using Pin services, which reintroduces centralization)
- ❌ **Performance issues**: IPFS retrieval is slow, not suitable for real-time applications
- ❌ **Cost issues**: Long-term Pin services (e.g., Pinata, Infura) require payment, costs grow with data volume
- ❌ **Insufficient verifiability**: IPFS itself doesn't provide timestamp proofs, requires additional blockchain layer

**Our Solution Advantages:**
- ✅ Walrus provides stronger persistence and censorship resistance than single DB through on-chain commitments + decentralized replicators
- ✅ Fast Walrus retrieval, suitable for real-time applications
- ✅ Controllable costs (pay per epochs, predictable)
- ✅ NFTs directly provide timestamps and existence proofs

---

#### 3. zk-Proofs (Zero-Knowledge Proofs)

**Solution Description**: Use zk-SNARKs/zk-STARKs to prove data existence without exposing data content

**Reasons for Not Choosing:**
- ❌ **High complexity**: zk-Proof generation and verification are complex, requiring expertise
- ❌ **Performance overhead**: Proof generation requires significant computational resources, not suitable for real-time applications
- ❌ **High costs**: zk-Proof gas fees are high (especially on EVM chains)
- ❌ **Over-engineering**: For emotion journaling applications, zero-knowledge proof-level verifiability is not needed
- ❌ **Poor user experience**: Long proof generation times affect user experience

**Our Solution Advantages:**
- ✅ Simple and direct: AES-GCM encryption + NFT proofs, easy to understand and audit
- ✅ Good performance: Fast encryption and minting, suitable for real-time applications
- ✅ Low costs: Sui chain gas fees are low, NFT minting costs are controllable
- ✅ Good user experience: Fast response times

**Future Consideration**: If stronger verifiability is needed in the future (e.g., proving "I recorded an emotion but don't want to expose the content"), we could consider embedding zk-Proofs in NFTs, but this is not a current priority.

---

#### 4. EVM Chain (Ethereum/EVM-Compatible Chains)

**Solution Description**: Store data or mint NFTs on Ethereum, Polygon, Arbitrum, or other EVM chains

**Reasons for Not Choosing:**
- ❌ **High gas fees**: EVM chain gas fees are high, especially for data storage (~20,000 gas per 32 bytes)
- ❌ **Slow performance**: EVM chains have low TPS, long transaction confirmation times (12-15 seconds)
- ❌ **Poor scalability**: EVM chain storage costs grow linearly with data volume, not suitable for storing large amounts of encrypted data
- ❌ **Poor user experience**: High gas fees and slow confirmation times affect user experience

**Our Solution Advantages:**
- ✅ **Excellent Sui chain performance**: High TPS (thousands+), low latency (sub-second confirmation)
- ✅ **Low costs**: Sui chain gas fees are low (typically < $0.01), suitable for frequent operations
- ✅ **Storage separation**: Data stored on Walrus (decentralized blob storage), NFTs only store metadata and proofs, costs are controllable
- ✅ **Good user experience**: Fast confirmation, low fees, suitable for daily use

**Technical Comparison:**

| Feature | EVM Chain | Sui Chain |
|---------|-----------|-----------|
| TPS | ~15-100 | Thousands+ |
| Confirmation Time | 12-15 seconds | <1 second |
| Gas Fees | High ($1-50+) | Low (<$0.01) |
| Storage Cost | High (~20k gas per 32 bytes) | Low (Walrus pay per epochs) |
| Scalability | Poor (high on-chain storage costs) | Good (off-chain storage + on-chain proofs) |

---

## Technical Selection Summary

### Encryption Layer: AES-GCM 256-bit
- **Rationale**: Industry standard, good performance, provides encryption and authentication
- **Alternative Considered**: ChaCha20-Poly1305 (similar performance, but AES-GCM has broader support)

### Key Derivation: PBKDF2 (planned upgrade to Argon2id)
- **Rationale**: PBKDF2 has broad support, Argon2id provides stronger brute-force resistance
- **Parameters**: 100k-1M iterations (adaptive to device performance)

### Storage Layer: Walrus
- **Rationale**: Decentralized, cost-controllable, good performance, native integration with Sui chain
- **Alternatives Considered**: IPFS (persistence issues), Arweave (high costs)

### Verifiability Layer: Sui NFT
- **Rationale**: High performance, low cost, tamper-proof, native timestamps
- **Alternatives Considered**: EVM NFT (high cost, slow performance), IPFS + smart contracts (high complexity)

---

## Security Guarantees

### Verifiable Security Properties

1. **Encryption Strength**: AES-256-GCM complies with NIST standards, secure against current computational capabilities
2. **Key Derivation**: PBKDF2 100k-1M iterations, complies with OWASP recommendations
3. **Data Integrity**: AES-GCM authentication tags + blockchain hashes, dual protection
4. **Immutability**: Blockchain NFTs provide undeniable existence proofs
5. **Practical Zero-Knowledge Architecture**: Servers cannot decrypt user data (unless keys are obtained)

### Audit Points

- ✅ Encryption algorithms and parameters comply with industry standards (NIST, OWASP)
- ✅ Client-side encryption ensures server practical zero-knowledge
- ✅ Decentralized storage reduces single-point-of-failure risk
- ✅ Blockchain proofs provide verifiable timestamps and existence
- ✅ Versioned encryption headers support future algorithm upgrades

---

## Future Improvement Directions

1. **Post-Quantum Encryption**: Upgrade to post-quantum encryption algorithms when quantum computing threats become reality
2. **Full Argon2id Integration**: Complete Argon2id integration after resolving WASM build issues
3. **Multi-Chain Support**: Consider supporting other high-performance chains (e.g., Aptos), but Sui is currently the best choice
4. **Optional zk-Proofs**: Provide optional zk-Proof functionality for users requiring stronger verifiability

---

## References

- **NIST SP 800-63B**: Digital Identity Guidelines
- **OWASP Cryptographic Storage Cheat Sheet**: Cryptographic Storage Best Practices
- **Sui Documentation**: https://docs.sui.io/
- **Walrus Documentation**: https://docs.walrus.space/
- **AES-GCM Specification**: NIST SP 800-38D

---

**Conclusion**: Echoma's threat model covers a wide range of threat scenarios from personal errors to future AI attacks. We chose the **AES-GCM + Walrus + Sui NFT** architecture, achieving the best balance between confidentiality, verifiability, performance, and cost. This design is verifiable, auditable, and complies with industry security standards.
