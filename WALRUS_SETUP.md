# Walrus Setup Guide

## Problem Diagnosis

The current project attempts to directly use HTTP API calls to Walrus service, but the endpoint `https://upload-relay.testnet.walrus.space` returns 404 error.

## Solution: Use @mysten/walrus SDK

The project has installed the `@mysten/walrus` SDK, but it's not being used in the code. Should use SDK instead of directly calling HTTP API.

## Usage Steps

### 1. Check Walrus Service Status

First, confirm if Walrus testnet service is available:

```bash
# Check upload relay endpoint
curl https://upload-relay.testnet.walrus.space/v1/tip-config

# Check aggregator endpoint
curl https://aggregator.testnet.walrus.space/v1/health
```

If these endpoints return 404, it means:
- Walrus testnet service may be temporarily unavailable
- Or endpoint address has changed
- Or need to use different network (mainnet)

### 2. Use @mysten/walrus SDK (Recommended)

The SDK provides two methods:

#### Method A: Use Upload Relay (Recommended, Simpler)

Upload Relay handles most upload work, reducing client requests.

```typescript
import { getFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { walrus } from '@mysten/walrus';

// Create client and extend with Walrus functionality
const client = new SuiJsonRpcClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    uploadRelay: {
      host: 'https://upload-relay.testnet.walrus.space',
      sendTip: {
        max: 1_000, // Maximum tip (MIST)
      },
    },
  }),
);

// Upload data
const { blobId } = await client.walrus.writeBlob({
  blob: new TextEncoder().encode(encryptedData),
  deletable: false,
  epochs: 5,
  signer: keypair, // Requires Sui wallet signature
});
```

#### Method B: Direct Write (Requires many requests, ~2200)

If upload relay is unavailable, can write directly, but requires more requests:

```typescript
const client = new SuiJsonRpcClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(walrus());

const { blobId } = await client.walrus.writeBlob({
  blob: new TextEncoder().encode(encryptedData),
  deletable: false,
  epochs: 5,
  signer: keypair,
});
```

### 3. Current Project Limitations

**Important**: Using Walrus SDK requires:
1. **Sui Wallet Signature**: Upload requires wallet signature and gas fee payment
2. **WAL Tokens**: Need WAL tokens to pay storage fees
3. **SUI Tokens**: Need SUI to pay transaction fees

### 4. Temporary Solution

If Walrus service is unavailable, current code has implemented a fallback:
- Data will be saved to local file (`server/data/emotions.json`)
- Application functionality is unaffected
- When Walrus service recovers, can re-upload data

### 5. Check Service Status

Run the following commands to check service:

```bash
# Check upload relay
curl -v https://upload-relay.testnet.walrus.space/v1/tip-config

# Check aggregator
curl -v https://aggregator.testnet.walrus.space/v1/health

# If both return 404, may need to:
# 1. Wait for service recovery
# 2. Use mainnet instead of testnet
# 3. Check if there are new endpoint addresses
```

### 6. Use Mainnet (If testnet unavailable)

If testnet is unavailable, can switch to mainnet:

```typescript
const client = new SuiJsonRpcClient({
  url: getFullnodeUrl('mainnet'),
  network: 'mainnet',
}).$extend(
  walrus({
    uploadRelay: {
      host: 'https://upload-relay.mainnet.walrus.space', // If exists
      sendTip: {
        max: 1_000,
      },
    },
  }),
);
```

## Next Steps

1. **Check Service Status**: Run the curl commands above to check endpoints
2. **If Service Available**: Update code to use @mysten/walrus SDK
3. **If Service Unavailable**: Continue using current local storage fallback
4. **Monitor Service Status**: Follow Walrus official documentation or Discord for service status updates

## Related Resources

- [@mysten/walrus Documentation](https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus)
- [Walrus Official Documentation](https://docs.walrus.space/)
- [Sui Network Configuration](https://docs.sui.io/guides/developer/getting-started/get-coins)
