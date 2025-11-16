# Echoma - Emotional Encryption Chain

<div align="center">
  <img src="public/echoma-logo.png" alt="Echoma Logo" width="200">
</div>

> Your emotions are encrypted and preserved on-chain forever.

[中文版本](./README.zh.md)

Echoma is a Web3-native emotion journaling app that combines client-side encryption, decentralized storage, and blockchain attestations so your emotional data stays private yet permanently verifiable.

## ⚠️ Important Notice

**Echoma only offers journaling and general emotional support. It is NOT a substitute for professional medical advice.**

The app helps you track how you feel, but it does not provide medical diagnoses, treatment plans, or emergency services. Please contact qualified healthcare professionals whenever you have mental-health or medical needs.

## ✨ Core Features

- 🔒 **Client-side encryption** – AES-GCM encrypts entries before they ever leave your device
- 🌊 **Walrus storage** – decentralized, tamper-evident blob storage
- ⛓️ **Sui blockchain** – NFT proofs certify every record on-chain (implemented with daily minting and transaction tracking)
- 🤖 **AI-assisted analysis** – empathetic emotional insights in English or Traditional Chinese for both anonymous and authenticated users
- 📊 **Timeline view** – highly optimized virtualized scrolling (1000+ entries stay smooth)
  - Full visualization suite (emotion distribution, trends, forecasts, correlation, mood calendar)
  - Powerful search, filtering, and sorting
  - Bulk actions plus CSV/JSON/PDF/Markdown export
- 🏷️ **Tagging system** – multi-tag support with filtering
- 📤 **Data export** – configurable fields and date formats across CSV/JSON/PDF/Markdown
- 🔄 **Realtime sync (authenticated mode)** – Supabase Realtime keeps multiple devices updated automatically
- 🌍 **Multi-language UI** – switch between Traditional Chinese and English
- 🌓 **Theme switcher** – light/dark/system themes (light by default)
- 👤 **Multiple usage modes** – Anonymous, Authenticated, and MVP Local modes
- 🛡️ **Error boundary** – graceful error handling everywhere
- 📱 **Responsive design** – tailored layouts for desktop and mobile

## 📱 iOS App Support

Echoma ships as a native iOS app via **Capacitor**. Wrap the web app and deploy directly to devices.

### Quick iOS Setup

1. **Upgrade Node.js (>= 20.0.0)**
   ```bash
   nvm install 20
   nvm use 20
   ```
2. **Build and add the iOS platform**
   ```bash
   npm run build
   npm run cap:add:ios
   ```
3. **Open the project in Xcode**
   ```bash
   npm run cap:open:ios
   ```

See the [iOS Development Guide](./IOS_Development_Guide.md) for full details.

## 🚀 Quick Start

### First Launch

- **Medical disclaimer** – shown once and must be acknowledged before continuing
- **Onboarding flow** – highlights key features on the first visit (can be skipped)

### Requirements

- Node.js 18+ with npm (install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Sui wallet (Sui Wallet, Ethos Wallet, etc.)
- iOS builds need Node.js 20+, Xcode 14+, and CocoaPods

### Installation

```sh
# 1. Clone
git clone <YOUR_GIT_URL>
cd echoma

# 2. Install deps
npm install

# 3. Run the dev server
npm run dev
```

The app runs on `http://localhost:5173`.

### Optional Local API Server

Some API flows expect a local server:

```sh
npm run server
```

It listens on `http://localhost:3001`. Production deployments typically don't need it.

### Production Build

```sh
npm run build
npm run preview
```

### iOS Commands

```sh
# Add iOS platform (first run)
npm run cap:add:ios

# Sync web build -> native project
npm run cap:sync

# Open Xcode
npm run cap:open:ios

# Build + sync + open in one go
npm run cap:build:ios
```

## 🛠️ Tech Stack

### Frontend
- **React 18** – UI framework
- **TypeScript** – type safety
- **Vite** – dev server and build tool

### UI
- **shadcn/ui** – component library
- **Tailwind CSS** – utility-first styling
- **Radix UI** – accessible primitives
- **Lucide React** – icon set

### Web3
- **@mysten/dapp-kit** – Sui integration
- **@mysten/sui** – Sui SDK
- **@mysten/walrus** – Walrus storage SDK

### Backend Services
- **Supabase** – auth + cloud storage
- **Supabase Edge Functions** – AI emotion analysis API
- **Express** – optional local dev server

### Other Tooling
- **React Router** – routing
- **TanStack Query** – data fetching/state
- **TanStack Virtual** – high-perf virtualization (@tanstack/react-virtual)
- **React Hook Form** – form handling
- **Zod** – validation
- **i18next** – localization
- **Capacitor** – native bridge
- **date-fns** – date utilities
- **react-day-picker** – calendar for range filtering
- **jsPDF** – PDF export
- **next-themes** – theme manager
- **sonner** – toast notifications
- **recharts** – charts for analytics

### Performance
- **Code splitting** – React.lazy + Suspense at route level
- **Lazy loading** – load page bundles on demand
- **Virtual scrolling** – @tanstack/react-virtual for the Timeline

## 📁 Project Structure

```
echoma/
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── WalletConnect.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Onboarding.tsx        # first-run walkthrough
│   │   ├── MedicalDisclaimer.tsx
│   │   ├── TagInput.tsx
│   │   └── ThemeToggle.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx        # device detection
│   │   └── use-toast.ts          # toast hook
│   ├── lib/
│   │   ├── encryption.ts         # client encryption
│   │   ├── securityTests.ts      # security test suite
│   │   ├── securityTests.worker.ts
│   │   ├── walrus.ts             # Walrus integration
│   │   ├── storageService.ts     # storage abstraction
│   │   ├── localIndex.ts         # local index service
│   │   ├── anonymousIdentity.ts  # anonymous ID generation
│   │   ├── api.ts               # local server API calls
│   │   ├── validation.ts         # Zod schemas
│   │   ├── dataSchema.ts
│   │   ├── storage.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Index.tsx             # landing page
│   │   ├── Record.tsx            # anonymous recording
│   │   ├── Timeline.tsx          # anonymous timeline
│   │   ├── Auth.tsx              # auth screen
│   │   ├── AuthRecord.tsx        # authenticated recording
│   │   ├── AuthTimeline.tsx      # authenticated timeline
│   │   ├── MvpRecord.tsx         # MVP local recording
│   │   ├── MvpTimeline.tsx       # MVP local timeline
│   │   ├── SecurityTests.tsx     # dev-only security page
│   │   └── NotFound.tsx
│   ├── i18n/
│   │   ├── config.ts
│   │   └── locales/
│   ├── integrations/
│   │   └── supabase/
│   └── App.tsx
├── server/
│   └── index.js                  # local API server
├── supabase/
│   ├── functions/
│   │   ├── ai-emotion-response/
│   │   ├── get-emotions/
│   │   └── upload-emotion/
│   └── migrations/
├── benchmarks/
│   └── schema/
│       └── security.v1.json
└── public/
```

## 🔐 Security Features

Echoma layers multiple defenses to keep data private and verifiable.

### Client-side Encryption

All emotional data is encrypted locally with **AES-GCM 256-bit** using industry-standard hardening:

#### Algorithm
- **AES-GCM 256-bit** for authenticated encryption
- **Versioned headers** to enable future upgrades and backward compatibility
- **Strict validation** for salt (≥16 bytes) and IV (12 bytes per GCM spec)

#### Key Derivation (KDF)
- **PBKDF2** (current default)
  - Iterations auto-scale from 100k–1M depending on hardware
  - Manual override supported
  - Uses SHA-256
- **Argon2id** (interface ready)
  - Memory-hard, GPU/ASIC resistant
  - Temporarily falls back to enhanced PBKDF2 due to build limits
  - Planned for full integration

#### Key Material Safety
- ⚠️ Wallet address alone is not sufficient entropy
- ✅ Recommended: user password/phrase + deterministic salt
- ✅ Salt management
  - Unique random salt (≥16 bytes) per record for encryption
  - Deterministic salt (app + user ID) for key generation so identical inputs re-derive the same key
- ✅ Domain separation: addresses only scope the domain, never act as full entropy sources

#### Error Handling
- Clear error taxonomy (bad key, corrupted data, incompatible version, etc.)
- AES-GCM auth tag verification for integrity
- User-friendly, localized error messages (EN/ZH)
- Storage quota monitoring with actionable remediation tips

#### Seal Permission Model
- **Public records** – encrypted with shared public seal keys so anyone can verify proofs and decrypt
- **Private records** – encrypted per user, only authorized keys can decrypt
- **Smart decryption** – automatically tries public + private keys for compatibility
- **Access control** via encryption keys (no separate ACL system)
- **Data segregation** – public/private records live under distinct localStorage keys
- **Auto-decrypt optimization** – public Walrus blobs decrypt automatically

#### Encrypted Local Storage
- AES-GCM 256 encryption across every mode (anonymous/auth/MVP)
- Smart key management
  - Wallet mode → derive from wallet address
  - Auth mode → derive from Supabase user ID
  - Anonymous mode → derive from anonymous UUID
- Data integrity protections
  - Validate decryptability before persisting; reject corrupt payloads
  - Automatic migrations when switching accounts
  - Key caching to avoid recomputation
  - Separate stores for public/private entries
- Backward compatible – migrates legacy plaintext data into encrypted storage

### Data Flow

1. **Record** – user writes emotions and descriptions
2. **Encrypt** – client encrypts with AES-GCM + version header
3. **Store** – encrypted payload goes to Walrus decentralized storage
4. **Verify** – mint an NFT on Sui as the proof of storage

### Backward Compatibility

- Legacy formats migrate automatically
- Versioned headers ensure future algorithm swaps still read old data
- Users never need to take action to read historical entries

### AI Safeguards

The AI response pipeline ships with defense-in-depth:

#### Prompt Injection Controls
- ✅ Input scrubbing removes common injection patterns
- ✅ Minimal context sharing to avoid leaking sensitive fields
- ✅ Output classification labels responses (supportive text, suggestions, crisis alerts)

#### Crisis Detection & Guardrails
- ✅ Keyword scanning for self-harm/violence (EN/ZH)
- ✅ On-device guardrails block risky payloads before sending to the model
- ✅ Safe fallback responses offering professional resources

#### Audit Logging
- ✅ Logs every AI call (timestamp, user, token usage, truncation)
- ✅ Records safety verdicts, risk levels, matched keywords
- ✅ Stores only summaries (emotion type/intensity), never full text

#### API Key Management
- ✅ Key rotation (default 90 days)
- ✅ Encrypted key storage
- ✅ Automatic rotation checks with reminders

See [SECURITY_FEATURES.md](./SECURITY_FEATURES.md) for a deeper dive.

### Security Test Suite

A dedicated suite validates the cryptographic pipeline end-to-end.

#### Coverage
- ✅ Crypto vector tests (tag tampering, IV reuse, header and AAD validation, timing checks)
- ✅ Parameter replay tests (cross-device encrypt/decrypt compatibility)
- ✅ UTF-8 edge cases (Unicode normalization, surrogate pairs)
- ✅ Rate-limit tests (429 headers, replay defense)
- ✅ JWT refresh smoothness

#### Properties
- 🔄 Reproducible (SEED parameter)
- 📊 Measurable (standardized JSON output for CI)
- 🔍 Auditable (error code mapping, acceptance criteria, statistical metrics)
- 🛡️ Production-grade realism with boundary coverage and schema validation

#### Accessing the Suite
- **Development** – `/security-tests` route enabled automatically
- **Production** – set `VITE_ENABLE_SECURITY_TESTS=true` and `VITE_FORCE_ENABLE_SECURITY_TESTS=true`

Full details live in [Security_Test_Guide.md](./Security_Test_Guide.md).

### Security Audit

See [SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md) for the full checklist.

- ✅ Controls aligned with NIST/OWASP guidance
- ✅ Core crypto follows industry standards
- ✅ Robust error handling + backward compatibility
- ✅ Comprehensive AI safety controls
- ✅ Full security test suite (reproducible/measurable/auditable)
- ⚠️ Argon2id integration underway (enhanced PBKDF2 is the interim fallback)

## 🌐 Network Configuration

Default network: **Sui Testnet**

- **Network switcher** – UI component in the top-right corner allows switching between Testnet and Mainnet
- **Persistent preference** – network selection is saved to localStorage and persists across sessions
- **Cross-tab sync** – network changes automatically sync across all browser tabs
- **Auto cache cleanup** – React Query cache is cleared when switching networks to prevent stale data
- **Supported networks** – Testnet + Mainnet (pre-configured)
- **Sui RPC** – automatically uses `getFullnodeUrl("testnet")` or `getFullnodeUrl("mainnet")` based on selection
- **Walrus endpoints** – automatically switches between testnet/mainnet Walrus services:
  - Testnet: `https://upload-relay.testnet.walrus.space` / `https://aggregator.testnet.walrus.space`
  - Mainnet: `https://upload-relay.mainnet.walrus.space` / `https://aggregator.mainnet.walrus.space`
- **Wallet auto-connect** – enabled so approved wallets reconnect on load
- **Network-aware data handling**:
  - Records are stored with network information embedded in `walrus_url`
  - Decryption automatically uses the record's original network (extracted from `walrus_url`)
  - Deduplication logic considers network information (`blob_id + network` as unique identifier)
  - All upload paths (SDK, Supabase Function, Server API) respect the selected network
  - Network-specific error messages (testnet warnings only shown on testnet)
- **Cross-network data access**:
  - Records created on one network can be viewed when switched to another network
  - Decryption automatically uses the correct network endpoint based on the record's `walrus_url`
  - Timeline queries only fetch on-chain data from the current network (database records show all networks)

The network switcher is available in the `GlobalControls` component (top-right corner) on all pages.

### ⚠️ Walrus Aggregator Heads-up

Data is successfully on-chain (visible on SuiScan) but the Walrus aggregator sometimes cannot serve downloads on testnet. Anonymous Timeline entries show a banner whenever decrypt fails for this reason.

### 📅 Walrus Storage Duration (Epochs)

When recording in Anonymous mode you can select how long Walrus keeps the blob:

- **Epoch ≈ 1 day** on testnet
- **Range** – 1 to 1000 epochs
- **Default** – 200 epochs (~200 days)
- **Quick picks** – 5 / 200 / 365 epochs
- **Slider** – choose any value in between

Longer durations require more tokens. Pick what fits your needs.

## 💧 Test Tokens

Walrus uploads need **SUI** and **WAL** on testnet.

### SUI Faucets
- Official: https://faucet.sui.io/ (recommended)
- Community: https://faucet.blockbolt.io/
- Sui Discord: use `!faucet <address>` in `#testnet-faucet`

### WAL Faucets
- Walrus CLI: `walrus get-wal` (1:1 swap from SUI)
- Stakely: https://stakely.io/faucet/walrus-testnet-wal

See [Faucet Test Token Guide](./Faucet_Test_Token_Guide.md) for walkthroughs.

## 📝 Usage Guide

### Three Modes

Echoma offers three flows tailored to different needs.

#### 1. Anonymous Mode (Wallet Mode)
- **Routes** – `/record`, `/timeline`
- **Highlights** – connect a Sui wallet, encrypt entries, upload to Walrus, optional AI replies
- **Best for** – decentralized storage without accounts
- **Steps**
  1. Connect your Sui wallet
  2. Pick emotion type and intensity
  3. Describe how you feel
  4. *(Optional)* Add tags (work, family, health, ...)
  5. *(Optional)* Click **Get AI Emotion Response** for an empathetic reply
     - English & Traditional Chinese supported
     - Rate limited to 3 requests/minute
     - No login needed
  6. Choose Walrus storage instead of local storage
  7. Select retention **epochs** (1–1000, ~1 day each)
     - Default 200 epochs (~200 days)
     - Quick buttons: 5, 200, 365
     - Or use the slider
  8. Enable **"Mint as NFT"** toggle (requires wallet connection)
  9. Click **Record & Mint NFT**
- **NFT Features:**
  - Daily mint limit: one NFT per day per journal
  - Automatic Journal creation on first mint
  - View minting transaction on Sui Scan
  - NFT records appear in Timeline with special badges
- **Note** – if decryption fails the UI clarifies that data still lives on-chain but the testnet aggregator cannot serve it.

#### 2. Authenticated Mode (Secure Mode)
- **Routes** – `/auth-record`, `/auth-timeline`
- **Highlights** – Supabase login, cloud backup, AI analysis, realtime sync
- **Best for** – multi-device access and AI-powered journaling
- **Steps**
  1. Click **Login / Sign Up** on the home page
  2. Create or sign in with Supabase
  3. Record emotions and retrieve AI replies
  4. Data syncs to the cloud
  5. Timeline updates propagate in realtime (create/update/delete)

#### 3. MVP Mode (Local Mode)
- **Routes** – `/mvp`, `/mvp-timeline`
- **Highlights** – fully local storage, no wallet or login, perfect for quick demos/offline use
- **Steps**
  1. Visit `/mvp`
  2. Choose an emotion + description
  3. Data is AES-GCM encrypted and stored locally
- **Security**
  - AES-GCM 256 for everything
  - Automatic key management (wallet address, Supabase user ID, or anonymous ID)
  - Data integrity safeguards
  - Smart key recovery when switching accounts

### Timeline Experience

Every entry shows:
- Emotion + intensity
- Timestamp
- Description (shown after decrypt)
- Tags (badges)
- Walrus ID (anonymous mode)
- Blockchain proof status
- Sui reference link (opens SuiScan)
- AI response (if available)
- Storage type badge (local/database/Walrus)
- Privacy flag (public/private)
- Decryption status (decrypted / needs decrypt / failed)

**Performance** – @tanstack/react-virtual keeps scrolling smooth even with 1000+ rows.

#### Timeline Features

*Shared between Anonymous and Authenticated modes*
- Search emotions/descriptions/dates/tags with live result counts
- Tag filtering with multi-tag AND logic and quick clear
- Date-range filtering with dual-month calendar
- Storage filters
  - Anonymous: All / Local / Walrus
  - Authenticated: All / Database / Walrus
- Sort by date, intensity, or emotion (asc/desc)
- One-click filter reset
- Stats cards (total records, local/db count, Walrus count, average intensity)
- Bulk mode
  - Toggle bulk select
  - Select all / clear
  - Export or delete selected entries
  - Show selected count
- Data export
  - CSV / JSON / PDF / Markdown
  - Custom field selection (date, emotion, intensity, description, storage type, privacy, status, Sui ref)
  - Custom date formats (locale, ISO 8601, custom pattern)
  - Export all or only selected records
- Detail dialog per record
  - Emotion + intensity bar
  - Timestamp
  - Description
  - AI reply
  - Storage & privacy info
  - Blob ID + Sui reference link
- Single-record actions
  - View details
  - Manual decrypt retry
  - Delete (with confirmation)
  - Open Sui reference
  - Re-hide decrypted text
- Emotion analytics
  - Emotion distribution pie chart
  - Storage distribution pie chart
  - Time-series chart (week/month/year views + avg intensity)
  - Trend forecasting (linear regression for top 3 emotions)
  - Correlation analysis for emotion pairs
  - Emotion calendar view
- Virtualized list for performance
- Offline indicator
- Testnet warning banner whenever Walrus entries exist

*Authenticated-only*
- Supabase Realtime sync
  - Auto-insert new entries
  - Auto-refresh edits
  - Auto-remove deletes
  - Gracefully falls back to polling every 30s if realtime fails
  - Shows logged-in email + user ID
  - Logout button

#### Decryption Workflow

- **Automatic**
  - Local records decrypt immediately
  - Public Walrus records decrypt automatically (since anyone can)
  - Failed attempts are flagged to prevent infinite retries
- **Decrypt All** button for private Walrus entries
  - Detects which entries require decryption
  - Shows progress and success/failure counts
  - Handles partial success gracefully
- **Manual retry** per record clears failure flags
- **Hide text** to re-mask decrypted private entries
- **Smart guidance**
  - Friendly error messages with remediation steps
  - Unified error presentation for public & private blobs
  - Error details include type, status, blob ID, SuiScan link, timestamp, suggestions
  - Walrus status banner when the aggregator is flaky
  - Clear badges for decrypted / needs decrypt / failed

### AI Emotion Analysis

Available in Anonymous *and* Authenticated modes.

#### Capabilities
- Warm, empathetic responses
- Personalization based on emotion type/intensity
- English + Traditional Chinese support
- Powered by the Lovable API

#### How to Use
- **Anonymous** – press **Get AI Emotion Response**
  - No login
  - 3 requests/minute
  - Anonymous ID stored locally
- **Authenticated** – same button after logging in
  - Supabase auth required
  - 10 requests/minute
  - Cloud backup + multi-device access

#### Safety
- ✅ Input validation removes prompt-injection attempts
- ✅ Crisis keywords detected (EN/ZH)
  - High-risk content triggers safe responses
- ✅ Rate limiting prevents abuse
- ✅ Audit logging tracks every call (anonymous users get a special marker)

## 🚧 Roadmap

### ✅ Shipped
- MVP core (local mode)
- Client-side AES-GCM 256
- Encrypted storage across all modes
- Data integrity protections
- Smart key management with account migration
- One-click decrypt for Walrus
- Localized error handling
- Seal permission controls (public/private separation)
- Auto-decrypt for public Walrus entries
- Consistent error UI for public/private records
- Segregated storage for public/private entries
- Versioned encryption headers + backward compatibility
- Configurable PBKDF2 iteration counts
- Enhanced salt/IV validation
- Improved error UX
- Walrus storage integration
- Supabase auth + cloud sync
- AI emotion analysis (auth mode)
- AI emotion analysis (anonymous mode)
- Prompt-injection and crisis safeguards
- Anonymous rate limiting & audit logging
- Full audit log system for AI calls
- API key rotation
- Bilingual UI (ZH/EN)
- Capacitor iOS support
- Multiple usage modes
- End-to-end security test suite (reproducible/measurable/auditable)
- **7 high-priority logic fixes** (intensity persistence, key selection, storage fallback, timeline dedupe, unmount safety, localStorage race locks, timestamp normalization)
- Advanced data export (PDF/Markdown, custom fields, date formats)
- Tagging system with filtering/search
- Virtualized timeline (1000+ records)
- Feature parity between anonymous/auth timelines (filtering, search, tags, bulk ops, export)
- Supabase Realtime sync with fallback
- Emotion analytics (distribution, storage split, time-series, forecast, correlation, calendar)
- Complete decrypt + viewing UX (auto decrypt, batch decrypt, manual retry, detail dialog, hide content)
- **Network switching UI** – dynamic network switcher with persistent preferences, cross-tab sync, and automatic cache cleanup

### ✅ Recently Completed
- **NFT Minting on Sui** – Fully implemented and deployed to testnet
  - Daily mint limit (one NFT per day per journal)
  - Automatic Journal creation and management
  - Transaction digest tracking and Sui Scan links
  - NFT records visible in Timeline with special badges
  - Contract Package ID: `0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71`
  - See [nft_mint_test/README.md](./nft_mint_test/README.md) for contract details

### 🚧 In Progress / Planned
- Full Argon2id support (currently falls back to enhanced PBKDF2)
- User password/phrase input UI for stronger keys
  - `generateUserKey` already accepts `userPassword`; needs front-end controls
- Realtime security monitoring alerts
- Dynamic keyword updates for crisis detection

## 🧪 Testing

### Functional Testing

- **Functional_Test_Guide.md** – detailed manual steps (Traditional Chinese)
- **Quick_Test_Script.js** – browser-console automation script

#### Quick Start

```bash
npm run dev
```

1. Launch the app.
2. Open DevTools → Console.
3. Paste the contents of `Quick_Test_Script.js` and run it.
4. Follow `Functional_Test_Guide.md` for the full checklist.

#### Verified Fixes

- Consistent ISO timestamps
- Safe component unmounting (no memory leaks)
- localStorage concurrency locking
- Improved dedupe logic (ID as primary key)
- Intensity values persist correctly
- Accurate key selection for public/private records
- Better wallet-connection error UX

## 🤝 Contributing

Issues and PRs are welcome!

## 📄 License

Hackathon project for Haulout Hackathon.

## 🔗 Resources

- [Sui Docs](https://docs.sui.io/)
- [Walrus Docs](https://docs.walrus.space/)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Security Features](./SECURITY_FEATURES.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Security Test Guide](./Security_Test_Guide.md)
- [Functional Test Guide](./Functional_Test_Guide.md)

## 🔧 Environment Variables

Set these for auth + AI features:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Supabase Edge Functions
LOVABLE_API_KEY=your_lovable_api_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # optional, needed for key rotation + audit logs
```

Notes:
- `LOVABLE_API_KEY` can be read directly from env for backward compatibility
- `SUPABASE_SERVICE_ROLE_KEY` is required for key rotation
- Audit logs need the database migrations (see below)
- **Security Test Page** – enabled by default in dev; in prod set `VITE_ENABLE_SECURITY_TESTS=true` and `VITE_FORCE_ENABLE_SECURITY_TESTS=true`

### CI Safety Checks

`npm run ci:check-security-flags` prevents leaking test-only env flags.

It scans:
- `.env.example` for `VITE_*SECURITY_TESTS*`
- `Dockerfile`/`docker-compose.yml`
- Production build scripts

GitHub Actions (`.github/workflows/security-check.yml`) runs it on every PR/push. Details live in [Security_Test_Guide.md](./Security_Test_Guide.md).

### Database Migrations

Audit logs and API key rotation require:

```bash
supabase migration up 20250116000000_create_audit_logs
supabase migration up 20250116000001_create_api_keys_table
```

Configuration details are in [SECURITY_FEATURES.md](./SECURITY_FEATURES.md).

---

**Heads-up:** the project is still in active development. Core features including NFT minting are fully functional. The MVP experience is production-ready for testnet use.
