# Faucet - Test Token Acquisition Guide

> This document explains how to obtain Sui Testnet and Walrus test tokens

## 🪙 Required Tokens

Using Walrus to upload data requires two types of tokens:

1. **SUI** - Pay transaction fees (gas)
2. **WAL** - Pay storage fees

## 💧 Sui Testnet SUI Tokens

### Method 1: Official Faucet (Recommended)

**URL**: https://faucet.sui.io/

**Steps**:
1. Visit https://faucet.sui.io/
2. Connect your Sui wallet (e.g., Sui Wallet)
3. Select **Testnet** network
4. Click "Request SUI" button
5. Wait for tokens to arrive (usually seconds to minutes)

### Method 2: Community Faucet

**Blockbolt Faucet**: https://faucet.blockbolt.io/

**Steps**:
1. Visit https://faucet.blockbolt.io/
2. Enter your Sui wallet address or SuiNS name
3. Select Testnet
4. Complete verification (if required)
5. Request test tokens

### Method 3: Sui Discord

**Steps**:
1. Join [Sui Discord Server](https://discord.com/invite/sui)
2. Go to `#testnet-faucet` channel
3. Enter the following command:
   ```
   !faucet <your wallet address>
   ```
4. Example:
   ```
   !faucet 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

### Method 4: Using Sui CLI

**Steps**:
```bash
# Install Sui CLI (if not installed)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# Configure Sui client to connect to testnet
sui client

# Get test tokens from faucet
sui client faucet
```

## 🦭 Walrus WAL Tokens

### Method 1: Using Walrus CLI (Recommended)

**Steps**:
```bash
# Install Walrus CLI (if not installed)
# Please refer to Walrus official documentation

# Exchange SUI tokens for WAL tokens at 1:1 ratio
walrus get-wal

# Check WAL balance
sui client balance
```

**Notes**:
- Need to have SUI test tokens first
- Exchange SUI to WAL at 1:1 ratio
- On testnet, WAL and SUI are interchangeable

### Method 2: Stakely Faucet

**URL**: https://stakely.io/faucet/walrus-testnet-wal

**Steps**:
1. Visit https://stakely.io/faucet/walrus-testnet-wal
2. Enter your Walrus testnet address (Sui address)
3. Complete verification steps (may require Twitter share)
4. Submit request
5. Wait for tokens to arrive

**Notes**:
- May require Twitter verification
- Ensure tweet is public
- May need to wait some time

## 📝 Recommended Workflow

### First Time Use

1. **Get SUI Tokens**
   - Visit https://faucet.sui.io/
   - Connect wallet and select Testnet
   - Request SUI tokens

2. **Get WAL Tokens**
   - Use Walrus CLI: `walrus get-wal`
   - Or use Stakely faucet

3. **Check Balance**
   - View SUI and WAL balance in wallet
   - Ensure sufficient tokens (recommend at least 0.1 SUI and 0.1 WAL)

### Token Requirement Estimation

**Each upload approximately requires**:
- **SUI**: About 0.001-0.01 SUI (gas fees, depends on data size)
- **WAL**: Depends on data size and storage duration (epochs)

**Recommended Balance**:
- **SUI**: At least 0.1 SUI (enough for multiple uploads)
- **WAL**: At least 0.1 WAL (enough for multiple uploads)

## ⚠️ Important Notes

1. **Test tokens have no real value**
   - For development and testing only
   - Cannot be used on mainnet

2. **Faucet Limitations**
   - Usually has request frequency limits (e.g., once per 24 hours)
   - Don't abuse faucets

3. **Network Selection**
   - Ensure wallet is connected to **Testnet**
   - Don't use Mainnet addresses

4. **Address Format**
   - Sui address format: Starts with `0x`, 64 hexadecimal characters
   - Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## 🔗 Related Links

- [Sui Official Faucet](https://faucet.sui.io/)
- [Sui Documentation - Get Coins](https://docs.sui.io/guides/developer/getting-started/get-coins)
- [Sui Discord](https://discord.com/invite/sui)
- [Blockbolt Faucet](https://faucet.blockbolt.io/)
- [Stakely Walrus Faucet](https://stakely.io/faucet/walrus-testnet-wal)
- [Walrus Official Documentation](https://docs.wal.app/)

## 💡 FAQ

### Q: Why do I need two types of tokens?

A: 
- **SUI** is used to pay transaction fees (gas) on the Sui blockchain
- **WAL** is used to pay fees for Walrus storage service

### Q: Can I use only SUI?

A: On testnet, you can use Walrus CLI to exchange SUI for WAL (1:1 ratio).

### Q: What if faucet request fails?

A: 
1. Check network connection
2. Confirm wallet address is correct
3. Confirm Testnet network is selected
4. Wait a bit and retry
5. Try other faucets

### Q: How to check token balance?

A: 
- View in Sui Wallet
- Use Sui CLI: `sui client balance`
- View your address on Sui Explorer
