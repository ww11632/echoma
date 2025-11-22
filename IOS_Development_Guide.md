# iOS App Development Guide

## 📱 Overview

Echoma is now configured to use **Capacitor** to package as a native iOS app. Capacitor allows your React Web app to run on iOS devices while retaining all existing functionality, including Web3 wallet connections.

## ✅ Completed Configuration

1. ✅ Installed Capacitor core dependencies and iOS platform
2. ✅ Created `capacitor.config.ts` configuration file
3. ✅ Updated `index.html` to add mobile support
4. ✅ Added npm scripts for iOS development

## 🔧 Prerequisites

### 1. Node.js Version

**Important**: Capacitor CLI requires **Node.js >= 20.0.0**

Check current version:
```bash
node --version
```

If version is below 20.0.0, upgrade:
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or using Homebrew (macOS)
brew install node@20
```

### 2. Xcode and iOS Development Tools

- **Xcode 14+** (install from App Store)
- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```
- **CocoaPods** (iOS dependency management tool):
  ```bash
  sudo gem install cocoapods
  ```

### 3. Apple Developer Account

- For testing on real devices
- For publishing to App Store
- Free account can also be used for development and testing

## 🚀 Initialize iOS Platform

### Step 1: Build Web App

```bash
npm run build
```

### Step 2: Add iOS Platform

```bash
npm run cap:add:ios
```

Or manually:
```bash
npx cap add ios
```

This creates the `ios/` directory containing the complete Xcode project.

### Step 3: Sync Resources

After each build, need to sync to iOS project:

```bash
npm run cap:sync
```

Or use shortcut command (build + sync + open Xcode):
```bash
npm run cap:build:ios
```

## 📱 Development in Xcode

### Open Project

```bash
npm run cap:open:ios
```

Or manually:
```bash
npx cap open ios
```

This opens `ios/App/App.xcworkspace` in Xcode.

### Configure Project

1. **Select Development Team**:
   - Select project in Xcode
   - Go to "Signing & Capabilities"
   - Select your Apple Developer team

2. **Configure Bundle Identifier**:
   - Default is `com.echoma.app`
   - Can modify `appId` in `capacitor.config.ts`

3. **Select Simulator or Device**:
   - Select target device at top of Xcode
   - Can be iOS simulator or connected real device

### Run App

Click the ▶️ button in Xcode, or press `Cmd + R`.

## 🔐 Web3 Wallet Connection Notes

### Mobile Wallet Connection

On iOS, Web3 wallet connections require special handling:

1. **Use Deep Linking**:
   - Sui wallets (e.g., Sui Wallet) support `suiwallet://` protocol
   - Need to configure URL Schemes in `Info.plist`

2. **Universal Links**:
   - Can configure Universal Links to handle wallet callbacks
   - Need to configure Associated Domains in Apple Developer portal

3. **WebView Compatibility**:
   - Capacitor uses WKWebView
   - Ensure wallet SDK supports WKWebView

### Recommended Wallet Connection Solutions

1. **Use WalletConnect**:
   - If Sui wallet supports WalletConnect protocol
   - Can connect via QR code scanning

2. **Use Deep Link**:
   - Configure `suiwallet://` URL Scheme
   - Open external wallet app when connecting wallet

3. **Built-in Wallet**:
   - Consider integrating wallet SDK that supports iOS
   - Such as `@mysten/dapp-kit` mobile support

## 📝 Development Workflow

### Daily Development

1. **Modify Code**:
   ```bash
   npm run dev  # Test in browser
   ```

2. **Build and Sync**:
   ```bash
   npm run build
   npm run cap:sync
   ```

3. **Run in Xcode**:
   ```bash
   npm run cap:open:ios
   # Then click run in Xcode
   ```

### Shortcut Commands

```bash
# One-click build, sync, and open Xcode
npm run cap:build:ios
```

## 🎨 Mobile Adaptation

### Responsive Design

Your app already uses Tailwind CSS, should have basic responsive support. But may need:

1. **Touch Optimization**:
   - Ensure button size is at least 44x44 points (iOS recommendation)
   - Increase touch target spacing

2. **Safe Area**:
   - Use `viewport-fit=cover` (already configured in `index.html`)
   - Use CSS `safe-area-inset-*` to handle notch

3. **Status Bar**:
   - Status bar style already set in Capacitor config
   - Can dynamically adjust via `@capacitor/status-bar`

### Native Feature Integration

Capacitor provides many native plugins:

- **@capacitor/app** - App lifecycle, back button
- **@capacitor/haptics** - Haptic feedback
- **@capacitor/keyboard** - Keyboard events
- **@capacitor/status-bar** - Status bar control

Can use in code:

```typescript
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Haptic feedback
await Haptics.impact({ style: ImpactStyle.Medium });

// Listen to app state
App.addListener('appStateChange', ({ isActive }) => {
  console.log('App state changed. Is active?', isActive);
});
```

## 🚢 Publishing to App Store

### Preparation

1. **Update Version Number**:
   - Update version in `package.json`
   - Update `CFBundleShortVersionString` in Xcode

2. **Configure App Store Connect**:
   - Create App Store Connect record
   - Prepare app screenshots and description
   - Configure privacy policy URL

3. **Build Archive**:
   - In Xcode, select "Product" > "Archive"
   - Upload to App Store Connect

### Review Notes

1. **Web3 Feature Description**:
   - In App Store description, explain need for external wallet
   - Explain blockchain-related features

2. **Privacy Policy**:
   - Must provide privacy policy URL
   - Explain data encryption and storage methods

3. **Feature Limitations**:
   - Some Web3 features may need special explanation
   - Ensure compliance with App Store Review Guidelines

## 🐛 Common Issues

### Issue 1: Node.js Version Too Low

**Error**: `The Capacitor CLI requires NodeJS >=20.0.0`

**Solution**: Upgrade Node.js to 20.0.0 or higher

### Issue 2: CocoaPods Installation Failed

**Error**: `pod install` fails

**Solution**:
```bash
sudo gem install cocoapods
cd ios/App
pod install
```

### Issue 3: Build Failed

**Error**: Xcode build error

**Solution**:
1. Clean build: `Product` > `Clean Build Folder` (Shift + Cmd + K)
2. Update CocoaPods: `cd ios/App && pod update`
3. Check signing configuration

### Issue 4: Web3 Wallet Cannot Connect

**Solution**:
1. Check URL Schemes configuration
2. Ensure wallet app is installed
3. Check network connection (Testnet/Mainnet)

## 📚 Related Resources

- [Capacitor Official Documentation](https://capacitorjs.com/docs)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Xcode Documentation](https://developer.apple.com/documentation/xcode)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## 🎯 Next Steps

1. ✅ Upgrade Node.js to 20.0.0+
2. ✅ Install Xcode and CocoaPods
3. ✅ Run `npm run cap:add:ios`
4. ✅ Configure and run in Xcode
5. ✅ Test Web3 wallet connection
6. ✅ Optimize mobile UI/UX
7. ✅ Prepare App Store release

---

**Tip**: If you encounter issues, please check Capacitor official documentation or submit an Issue.
