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

**Frontend:** React 18, TypeScript, Vite  
**UI:** shadcn/ui, Tailwind CSS, Radix UI  
**Web3:** @mysten/dapp-kit, @mysten/sui, @mysten/walrus  
**Backend:** Supabase (auth + storage), Supabase Edge Functions (AI API)  
**Key Libraries:** TanStack Query/Virtual, React Router, React Hook Form, Zod, i18next, Capacitor  
**Performance:** Code splitting, lazy loading, virtualized scrolling

## 📁 Project Structure

```
echoma/
├── src/
│   ├── components/    # UI components (shadcn/ui, wallet, theme, etc.)
│   ├── pages/         # Route pages (Record, Timeline, Auth, MVP)
│   ├── lib/           # Core logic (encryption, storage, walrus, minting)
│   ├── hooks/         # Custom React hooks
│   ├── i18n/          # Internationalization (EN/ZH)
│   └── integrations/  # Supabase integration
├── supabase/          # Edge functions and migrations
├── nft_mint_test/     # Sui Move contract
└── public/            # Static assets
```

See the codebase for detailed file structure.

## 🔐 Security Features

Echoma layers multiple defenses to keep data private and verifiable:

- **Client-side encryption** – AES-GCM 256-bit encryption before data leaves your device
- **Key derivation** – PBKDF2 (Argon2id planned) with auto-scaling iterations
- **Seal permission model** – public/private record separation with smart decryption
- **AI safeguards** – prompt injection controls, crisis detection, audit logging
- **Security test suite** – end-to-end cryptographic validation (reproducible/measurable/auditable)
- **Backward compatibility** – automatic migration of legacy formats

**Data Flow:** Record → Encrypt → Store (Walrus) → Verify (Sui NFT)

📖 **Detailed documentation:**
- [SECURITY_FEATURES.md](./SECURITY_FEATURES.md) – comprehensive security overview
- [SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md) – security audit checklist
- [Security_Test_Guide.md](./Security_Test_Guide.md) – security test suite guide

## 🌐 Network Configuration

**Default network: Sui Mainnet**

- Switch between Testnet and Mainnet via the UI (top-right corner)
- Network preference persists across sessions and syncs across tabs
- Automatic Walrus endpoint switching (testnet/mainnet)
- Network-aware data handling with cross-network record access

⚠️ **Note:** Walrus aggregator on testnet may occasionally fail to serve downloads (data remains on-chain and visible on SuiScan).

📖 See [WALRUS_SETUP.md](./WALRUS_SETUP.md) for Walrus storage duration (epochs) details.

## 💧 Test Tokens

Walrus uploads require **SUI** and **WAL** tokens on testnet.

📖 See [Faucet Test Token Guide](./Faucet_Test_Token_Guide.md) for faucet links and walkthroughs.

## 📝 Usage Guide

### Three Modes

Echoma offers three flows tailored to different needs.

#### 1. Anonymous Mode (Wallet Mode)
- **Routes:** `/record`, `/timeline`
- **Best for:** Decentralized storage without accounts
- **Quick steps:** Connect wallet → Record emotion → Choose Walrus storage (select epochs) → Enable "Mint as NFT" → Record & Mint
- **Features:**
  - Optional AI emotion analysis (3 requests/min, no login)
  - Walrus storage with configurable retention (1–1000 epochs, ~1 day each)
  - NFT minting: **Testnet** - 1/day per journal; **Mainnet** - unlimited
  - Automatic Journal creation, transaction tracking, Timeline badges

#### 2. Authenticated Mode (Secure Mode)
- **Routes:** `/auth-record`, `/auth-timeline`
- **Best for:** Multi-device access and AI-powered journaling
- **Features:** Supabase login, cloud backup, AI analysis (10 requests/min), realtime sync across devices

#### 3. MVP Mode (Local Mode)
- **Routes:** `/mvp`, `/mvp-timeline`
- **Best for:** Quick demos, offline use, no wallet/login required
- **Features:** Fully local storage, AES-GCM 256 encryption, automatic key management

### Timeline Experience

**Features:**
- Search, filter (tags, dates, storage), and sort entries
- Bulk operations (export/delete)
- Data export (CSV/JSON/PDF/Markdown) with custom fields and date formats
- Emotion analytics (distribution, trends, forecasts, correlation, calendar)
- Virtualized scrolling (smooth with 1000+ entries)
- Auto-decrypt for local and public Walrus entries
- Manual decrypt retry for private entries
- Supabase Realtime sync (authenticated mode only)

### AI Emotion Analysis

Available in both Anonymous and Authenticated modes.

- Warm, empathetic responses in English or Traditional Chinese
- Rate limits: 3/min (anonymous), 10/min (authenticated)
- Safety features: prompt injection controls, crisis detection, audit logging

## 🚧 Roadmap

### ✅ Recently Completed
- **NFT Minting on Sui** – Deployed to testnet and mainnet
  - Daily mint limit: **Testnet** - one NFT per day per journal; **Mainnet** - unlimited mints per day
  - **Testnet Package ID**: `0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71`
  - **Mainnet Package ID**: `0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9`
  - Auto-migration from old package IDs, CORS fixes
  - See [nft_mint_test/README.md](./nft_mint_test/README.md) for contract details

### ✅ Key Features Shipped
- Client-side AES-GCM 256 encryption, Walrus storage, Sui NFT minting
- Supabase auth + cloud sync, AI emotion analysis (anonymous + authenticated)
- Bilingual UI (ZH/EN), iOS support, network switching
- Virtualized timeline, emotion analytics, data export (CSV/JSON/PDF/Markdown)
- Security test suite, comprehensive error handling

### 🚧 In Progress / Planned
- Full Argon2id support (currently enhanced PBKDF2 fallback)
- User password/phrase input UI for stronger keys
- Realtime security monitoring alerts

## 🧪 Testing

📖 See [Functional_Test_Guide.md](./Functional_Test_Guide.md) for detailed testing steps.

**Quick test:** Run `npm run dev`, open DevTools Console, paste `Quick_Test_Script.js` and execute.

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

Required for auth + AI features:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
LOVABLE_API_KEY=your_lovable_api_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # optional, for key rotation + audit logs
```

📖 See [SECURITY_FEATURES.md](./SECURITY_FEATURES.md) for detailed configuration, CI safety checks, and database migrations.

---

**Heads-up:** the project is still in active development. Core features including NFT minting are fully functional. The MVP experience is production-ready for testnet use.
