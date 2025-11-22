# Seal Access Policies User Guide

## Overview

Seal Access Policies allow you to control who can access your encrypted emotion records. Once enabled, you can:
- **Share records**: Authorize specific addresses to access your private records
- **Manage permissions**: View, add, and revoke authorizations
- **On-chain verification**: All permission operations are recorded on the Sui blockchain, publicly verifiable and auditable

## Usage Flow

### 1. Enable Seal Access Policies

When recording emotions:
1. Ensure wallet is connected
2. Enable "Mint as NFT" option
3. Enable "Enable Seal Access Policies" option
4. Complete recording and mint NFT

### 2. Share Records (Authorize Access)

#### 📍 Location 1: Record Page (Share immediately after recording)

**Path**: `/record` page → After recording completes

**Steps**:
1. After completing emotion record and successfully minting NFT
2. Below the "Storage Settings" area in the right sidebar, a **"Share Record"** button will appear
3. Click the "Share Record" button
4. In the popup dialog:
   - Select the person to share with (Therapist, Partner, Family, Doctor, Friend, or custom address)
   - Enter the recipient's wallet address (66 characters, starting with `0x`)
   - Click "Share" button
5. Confirm wallet transaction

**Use case**: Share immediately after recording

#### 📍 Location 2: Timeline Page (Manage permissions anytime)

**Path**: `/timeline` page → Click record → Detail dialog

**Steps**:
1. Go to "Timeline" page (click "View Timeline" on homepage or navigate to `/timeline`)
2. Find the record to share (must be a record minted as NFT)
3. Click the record card to open detail dialog
4. At the bottom of the detail dialog, find the **"Access Permission Management"** section
5. Click the **"Authorize Access"** button
6. In the popup dialog:
   - Select role (optional): Partner, Family, Therapist, Doctor, AI Agent, Friend, Other
   - Enter wallet address
   - Click "Authorize" button
7. Confirm wallet transaction

**Use case**: Manage access permissions for recorded emotions anytime

### 3. Manage Authorizations (On Timeline Page)

**Path**: `/timeline` page → Click record → Detail dialog → "Access Permission Management" section

In the timeline record details, you can:

#### View Authorization List
- View all addresses that have been granted access
- View role labels for each address (e.g., Partner, Therapist, etc.)
- View authorization time

#### Authorize New Address
1. In the "Access Permission Management" section, click the **"Authorize Access"** button
2. Select role (optional):
   - Partner
   - Family
   - Therapist
   - Doctor
   - AI Agent
   - Friend
   - Other
3. Enter wallet address (66 characters, starting with 0x)
4. Click "Authorize" button
5. Confirm wallet transaction

#### Revoke Authorization
1. Find the address to revoke in the authorization list
2. Click the "Revoke" button (UserMinus icon) next to that address
3. Confirm wallet transaction

**Note**: After revoking authorization, that address will no longer be able to access the record.

#### View Authorization History
1. In the "Access Permission Management" section, click the **"History"** button
2. View history of all authorization/revocation operations
3. Includes operation time, address, and transaction hash

### 4. Access Shared Records

When someone authorizes you to access a record:
1. Ensure you're connected with the authorized wallet address
2. In the timeline, you should be able to see the record
3. Click the record to view details
4. System will automatically decrypt content using your wallet key

## Features

### ✅ On-Chain Verification
- All authorization operations are recorded on the Sui blockchain
- Anyone can verify if an address has access permissions
- Complete operation history is auditable

### ✅ Role Management
- Set role labels for each authorized address
- Easy to identify and manage different authorized parties
- Role information saved locally for easy management

### ✅ Flexible Control
- Can authorize new addresses anytime
- Can revoke authorization anytime
- Supports multiple addresses accessing simultaneously

### ✅ Privacy Protection
- Only authorized addresses can decrypt records
- Authorization operations themselves are public, but record content remains encrypted
- Record owner can always access their own records

## Important Notes

1. **PolicyRegistry Must Exist**
   - If you see "PolicyRegistry not found" warning, need to deploy Seal Access Policies contract first
   - After deployment, PolicyRegistry ID will be automatically configured

2. **Wallet Connection Required**
   - All authorization/revocation operations require wallet signature
   - Ensure wallet has sufficient SUI tokens to pay Gas fees

3. **Address Format**
   - Sui wallet address must be 66 characters
   - Must start with `0x`

4. **Network Matching**
   - Ensure authorizer and authorized use the same network (testnet/mainnet)
   - Authorizations on different networks won't take effect

## Quick Navigation

### Share Record Locations

1. **Share immediately after recording**:
   - Page: `/record` (Record page)
   - Location: After recording completes, below right sidebar
   - Button: **"Share Record"**

2. **Manage permissions anytime**:
   - Page: `/timeline` (Timeline page)
   - Location: Click record → Detail dialog → Bottom
   - Section: **"Access Permission Management"**
   - Button: **"Authorize Access"** (Add new authorization)

## FAQ

### Q: How do I know who can access my records?
A: Go to the timeline page (`/timeline`), click a record to open details, and you can see all authorized addresses in the "Access Permission Management" section.

### Q: Don't see "Share Record" button after recording?
A: Ensure:
1. "Mint as NFT" option is enabled
2. "Enable Seal Access Policies" option is enabled
3. NFT was successfully minted (`lastMintedNftId` exists)

### Q: Can the other party still see the record after revoking authorization?
A: No. After revoking authorization, that address will no longer be able to decrypt and access the record.

### Q: Can I authorize multiple addresses?
A: Yes. You can authorize any number of addresses to access the same record.

### Q: Do authorization operations cost fees?
A: Yes, each authorization/revocation operation requires paying Sui network Gas fees.

### Q: Where can I view authorization records?
A: All authorization operations are recorded on the Sui blockchain, and can be viewed via Sui Explorer transaction details.

## Technical Details

- **Contract Module**: `seal_access_policies`
- **PolicyRegistry**: Shared object storing all access policies
- **Access Policy**: Each EntryNFT corresponds to one access policy
- **Authorization Events**: `AccessGrantedEvent` and `AccessRevokedEvent`
