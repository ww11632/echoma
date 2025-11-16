/**
 * Script to upload Echoma logo to Walrus (Mainnet)
 * 
 * Usage:
 * 1. Place your logo image file (PNG/SVG) in the project root as `echoma-logo.png` or `echoma-logo.svg`
 *    OR specify the path: npx tsx scripts/upload-logo-to-walrus.ts --file /path/to/logo.png
 *    OR use a URL: npx tsx scripts/upload-logo-to-walrus.ts --url https://example.com/logo.png
 * 
 * 2. Run: npx tsx scripts/upload-logo-to-walrus.ts
 * 
 * The script will:
 * - Upload the logo to Walrus Mainnet
 * - Output the Walrus URL
 * - You can then set VITE_MAINNET_NFT_LOGO_URL in your .env file
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Network config (inline to avoid browser dependencies)
const WALRUS_MAINNET_CONFIG = {
  walrusUploadRelay: "https://upload-relay.mainnet.walrus.space",
  walrusAggregator: "https://aggregator.mainnet.walrus.space",
};

const DEFAULT_EPOCHS = 1000; // Long storage duration for logo (1000 epochs ≈ 1000 days)

async function uploadLogoToWalrus() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let logoPath: string | null = null;
  let logoUrl: string | null = null;
  let mimeType: string = "image/png";

  // Check for --file or --url arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      logoPath = args[i + 1];
      break;
    } else if (args[i] === "--url" && args[i + 1]) {
      logoUrl = args[i + 1];
      break;
    }
  }

  let logoBytes: Uint8Array;

  // If URL provided, download it
  if (logoUrl) {
    console.log(`🌐 Downloading logo from URL: ${logoUrl}`);
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      logoBytes = new Uint8Array(arrayBuffer);
      
      // Determine MIME type from response or URL
      const contentType = response.headers.get("content-type");
      if (contentType) {
        mimeType = contentType;
      } else if (logoUrl.endsWith(".svg")) {
        mimeType = "image/svg+xml";
      } else if (logoUrl.endsWith(".png")) {
        mimeType = "image/png";
      } else if (logoUrl.endsWith(".jpg") || logoUrl.endsWith(".jpeg")) {
        mimeType = "image/jpeg";
      }
      console.log(`✅ Downloaded ${logoBytes.length} bytes`);
    } catch (error) {
      console.error("❌ Failed to download logo:", error);
      process.exit(1);
    }
  } else {
    // Try to find logo file
    if (!logoPath) {
      const possiblePaths = [
        join(process.cwd(), "echoma-logo.png"),
        join(process.cwd(), "echoma-logo.svg"),
        join(process.cwd(), "public", "echoma-logo.png"),
        join(process.cwd(), "public", "echoma-logo.svg"),
      ];

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          logoPath = path;
          break;
        }
      }
    }

    if (!logoPath || !existsSync(logoPath)) {
      console.error("❌ Logo file not found.");
      console.error("\n📋 Options:");
      console.error("   1. Place your logo as:");
      console.error("      - echoma-logo.png (or .svg) in project root, or");
      console.error("      - public/echoma-logo.png (or .svg)");
      console.error("\n   2. Specify file path:");
      console.error("      npx tsx scripts/upload-logo-to-walrus.ts --file /path/to/logo.png");
      console.error("\n   3. Use a URL:");
      console.error("      npx tsx scripts/upload-logo-to-walrus.ts --url https://example.com/logo.png");
      process.exit(1);
    }

    console.log(`📸 Found logo: ${logoPath}`);
    if (logoPath.endsWith(".svg")) {
      mimeType = "image/svg+xml";
    } else if (logoPath.endsWith(".png")) {
      mimeType = "image/png";
    } else if (logoPath.endsWith(".jpg") || logoPath.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    }

    // Read logo file
    const logoBuffer = readFileSync(logoPath);
    logoBytes = new Uint8Array(logoBuffer);
  }

  console.log(`📦 MIME type: ${mimeType}`);

  console.log(`📊 Logo size: ${logoBytes.length} bytes (${(logoBytes.length / 1024).toFixed(2)} KB)`);

  // Use Walrus Mainnet config
  const uploadUrl = `${WALRUS_MAINNET_CONFIG.walrusUploadRelay}/v1/store?epochs=${DEFAULT_EPOCHS}`;

  console.log(`🚀 Uploading to Walrus Mainnet: ${uploadUrl}`);
  console.log(`⏱️  Storage duration: ${DEFAULT_EPOCHS} epochs (~${DEFAULT_EPOCHS} days)`);

  // First, check if the endpoint is available
  console.log("🔍 Checking Walrus Mainnet endpoint availability...");
  try {
    const healthCheck = await fetch(`${WALRUS_MAINNET_CONFIG.walrusUploadRelay}/v1/tip-config`, {
      method: "GET",
    });
    if (!healthCheck.ok && healthCheck.status === 404) {
      console.warn("⚠️  Walrus Mainnet upload relay endpoint appears to be unavailable (404)");
      console.warn("💡 This might mean:");
      console.warn("   1. Walrus Mainnet service is not yet available");
      console.warn("   2. The endpoint URL has changed");
      console.warn("   3. You need to use the Walrus SDK instead of direct HTTP API");
      console.warn("\n📋 Alternative options:");
      console.warn("   1. Upload to IPFS (Pinata, Infura, etc.) and use that URL");
      console.warn("   2. Use a CDN (Cloudflare, AWS S3, etc.)");
      console.warn("   3. Use the Walrus SDK with wallet signing (requires wallet connection)");
      console.warn("\n💡 For now, you can manually set VITE_MAINNET_NFT_LOGO_URL to any public image URL");
      process.exit(1);
    }
  } catch (checkError) {
    console.warn("⚠️  Could not check endpoint availability:", checkError);
  }

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: logoBytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${response.status} ${response.statusText}`);
      if (errorText) {
        console.error(`   Error details: ${errorText.substring(0, 200)}`);
      }
      
      if (response.status === 404) {
        console.error("\n💡 The Walrus Mainnet upload endpoint is not available.");
        console.error("   You have these options:");
        console.error("   1. Upload to IPFS and use that URL");
        console.error("   2. Use a CDN service");
        console.error("   3. Use the Walrus SDK (requires wallet and signing)");
        console.error("\n   For now, you can set VITE_MAINNET_NFT_LOGO_URL to any public image URL.");
      }
      process.exit(1);
    }

    const result = await response.json();
    
    let blobId: string;
    if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
      console.log("✅ Logo already exists on Walrus (already certified)");
    } else if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
      console.log("✅ Logo uploaded successfully to Walrus");
    } else {
      console.error("❌ Unexpected response format:", result);
      process.exit(1);
    }

    const walrusUrl = `${WALRUS_MAINNET_CONFIG.walrusAggregator}/v1/${blobId}`;
    
    console.log("\n🎉 Success! Your logo is now on Walrus Mainnet:");
    console.log(`   Blob ID: ${blobId}`);
    console.log(`   URL: ${walrusUrl}`);
    console.log("\n📝 Add this to your .env file:");
    console.log(`   VITE_MAINNET_NFT_LOGO_URL=${walrusUrl}`);
    console.log("\n💡 Or update src/lib/networkConfig.ts directly:");
    console.log(`   nftLogoUrl: "${walrusUrl}",`);

  } catch (error) {
    console.error("❌ Error uploading logo:", error);
    process.exit(1);
  }
}

// Run the script
uploadLogoToWalrus().catch(console.error);

