// src/lib/mintContract.ts
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import { getClientForNetwork } from "./suiClient";
import { getCurrentNetwork, type SuiNetwork } from "./networkConfig";
import { extractBlobIdFromUrl } from "./walrus";

// 合約常數
// Testnet Package ID
const TESTNET_PACKAGE_ID =
  "0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47";
// Mainnet Package ID (with Seal Access Policies support - deployed 2025-11-22)
// 可以通過環境變數 MAINNET_PACKAGE_ID 覆蓋
const MAINNET_PACKAGE_ID =
  typeof window !== "undefined" && (window as any).MAINNET_PACKAGE_ID
    ? (window as any).MAINNET_PACKAGE_ID
    : "0x45f9ba755acaf2306525b4a5b67d32bd4905f56108499306449da7312b76330d";

const MODULE = "diary";
const POLICY_MODULE = "seal_access_policies";
const POLICY_WITH_MINT_MODULE = "diary_with_policy";
const CLOCK_ID = "0x6"; // Sui Clock object ID
const POLICY_VERIFICATION_RETRIES = 2;
const POLICY_VERIFICATION_DELAY_MS = 2000;

// PolicyRegistry 存储键（基于网络）
const getPolicyRegistryStorageKey = (network: SuiNetwork) => 
  `sui_policy_registry_${network}`;

/**
 * 獲取指定網絡的 Package ID
 */
export function getPackageId(network?: SuiNetwork): string {
  const targetNetwork = network || getCurrentNetwork();
  return targetNetwork === "mainnet" ? MAINNET_PACKAGE_ID : TESTNET_PACKAGE_ID;
}

/**
 * 檢查合約是否已部署到指定網絡
 * 使用 tryMoveCall 來驗證合約是否可訪問
 */
export async function checkContractDeployed(network?: SuiNetwork): Promise<boolean> {
  const targetNetwork = network || getCurrentNetwork();
  const packageId = getPackageId(targetNetwork);
  
  try {
    console.log(`[mintContract] Checking contract deployment on ${targetNetwork}...`);
    console.log(`[mintContract] Package ID: ${packageId}`);
    
    // 方法1: 嘗試獲取 Package 對象
    try {
      const packageObject = await getClientForNetwork(targetNetwork).getObject({
        id: packageId,
        options: {
          showContent: true,
          showType: true,
        },
      });
      
      if (packageObject.data) {
        console.log(`[mintContract] ✅ Contract is deployed on ${targetNetwork} (verified via getObject):`, packageId);
        return true;
      }
    } catch (getObjectError: any) {
      console.warn(`[mintContract] getObject failed on ${targetNetwork}, trying alternative method:`, getObjectError.message);
    }
    
    // 方法2: 嘗試 dry run 一個簡單的調用來驗證合約
    // 注意：這只是一個檢查，不會實際執行交易
    try {
      const tx = new Transaction();
      tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000"); // 使用零地址作為檢查
      tx.moveCall({
        target: `${packageId}::${MODULE}::create_journal`,
        arguments: [],
      });
      
      // 嘗試構建交易（這會驗證合約是否存在）
      await tx.build({ client: getClientForNetwork(targetNetwork) });
      console.log(`[mintContract] ✅ Contract is deployed on ${targetNetwork} (verified via transaction build):`, packageId);
      return true;
    } catch (buildError: any) {
      // 如果錯誤是關於合約不存在的，返回 false
      if (buildError.message?.includes("Could not find the package") || 
          buildError.message?.includes("Package not found")) {
        console.error(`[mintContract] ❌ Contract not found on ${targetNetwork}:`, packageId);
        return false;
      }
      // 其他錯誤（如參數錯誤）說明合約存在
      console.log(`[mintContract] ✅ Contract is deployed on ${targetNetwork} (verified via transaction build error type):`, packageId);
      return true;
    }
  } catch (error: any) {
    console.error(`[mintContract] ❌ Error checking contract deployment on ${targetNetwork}:`, error.message);
    return false;
  }
}

/**
 * 專門檢查 Mainnet 合約是否已部署
 */
export async function checkMainnetContract(): Promise<{
  deployed: boolean;
  packageId: string;
  details?: any;
}> {
  const packageId = getPackageId("mainnet");
  const deployed = await checkContractDeployed("mainnet");
  
  let details: any = null;
  if (deployed) {
    try {
      const packageObject = await getClientForNetwork("mainnet").getObject({
        id: packageId,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
        },
      });
      details = {
        objectId: packageObject.data?.objectId,
        version: (packageObject.data?.content as any)?.fields?.version,
        publisher: (packageObject.data?.content as any)?.fields?.publisher,
        explorerUrl: `https://suiexplorer.com/?network=mainnet&object=${packageId}`,
      };
    } catch (error) {
      console.warn("[mintContract] Failed to get contract details:", error);
    }
  }
  
  return {
    deployed,
    packageId,
    details,
  };
}

// Journal ID 存儲鍵（基於錢包地址）
const getJournalStorageKey = (walletAddress: string) => 
  `sui_journal_${walletAddress}`;

/**
 * 獲取用戶的 Journal ID（從本地存儲）
 * 支持按網絡存儲，避免 testnet 和 mainnet 的 Journal ID 混淆
 */
export function getJournalId(walletAddress: string, network?: SuiNetwork): string | null {
  if (!walletAddress) return null;
  if (typeof window === "undefined") return null;
  
  try {
    const targetNetwork = network || getCurrentNetwork();
    // 使用網絡特定的存儲鍵，避免 testnet 和 mainnet 混淆
    const key = `${getJournalStorageKey(walletAddress)}_${targetNetwork}`;
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[mintContract] Failed to read Journal ID from localStorage:", error);
    return null;
  }
}

/**
 * 保存 Journal ID 到本地存儲
 * 支持按網絡存儲
 */
export function saveJournalId(walletAddress: string, journalId: string, network?: SuiNetwork): void {
  if (!walletAddress || !journalId) return;
  if (typeof window === "undefined") return;
  
  try {
    const targetNetwork = network || getCurrentNetwork();
    // 使用網絡特定的存儲鍵
    const key = `${getJournalStorageKey(walletAddress)}_${targetNetwork}`;
    localStorage.setItem(key, journalId);
  } catch (error: any) {
    console.warn("[mintContract] Failed to save Journal ID to localStorage:", error);
    // 如果是配额超出错误，尝试清理旧数据
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn("[mintContract] Storage quota exceeded, attempting to clear old Journal IDs");
      try {
        clearJournalId(walletAddress);
        // 重试保存
        const targetNetwork = network || getCurrentNetwork();
        const key = `${getJournalStorageKey(walletAddress)}_${targetNetwork}`;
        localStorage.setItem(key, journalId);
      } catch (retryError) {
        console.error("[mintContract] Failed to save Journal ID after cleanup:", retryError);
      }
    }
  }
}

/**
 * 清除 Journal ID（當用戶切換錢包時）
 * 清除所有網絡的 Journal ID
 */
export function clearJournalId(walletAddress: string): void {
  if (!walletAddress) return;
  if (typeof window === "undefined") return;
  
  try {
    // 清除所有網絡的 Journal ID
    localStorage.removeItem(`${getJournalStorageKey(walletAddress)}_testnet`);
    localStorage.removeItem(`${getJournalStorageKey(walletAddress)}_mainnet`);
  } catch (error) {
    console.warn("[mintContract] Failed to clear Journal ID from localStorage:", error);
  }
}

/**
 * 查詢用戶的 Journal 對象（從鏈上）
 */
export async function queryJournalByOwner(
  ownerAddress: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  try {
    const targetNetwork = network || getCurrentNetwork();
    const client = suiClient || getClientForNetwork(targetNetwork);
    const packageId = getPackageId(targetNetwork);
    const objects = await client.getOwnedObjects({
      owner: ownerAddress,
      filter: {
        StructType: `${packageId}::${MODULE}::Journal`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (objects.data && objects.data.length > 0) {
      return objects.data[0].data?.objectId || null;
    }
    return null;
  } catch (error) {
    console.error("[mintContract] Error querying journal:", error);
    return null;
  }
}

/**
 * 查詢用戶的所有 EntryNFT（從鏈上）
 * 添加網絡驗證以防止混淆不同網絡的數據
 */
export async function queryEntryNFTsByOwner(
  ownerAddress: string,
  network?: SuiNetwork
): Promise<Array<{
  nftId: string;
  journalId: string;
  timestamp: string;
  moodScore: number;
  moodText: string;
  tagsCsv: string;
  imageUrl: string;
  audioUrl: string;
  blobId?: string;
  transactionDigest?: string | null; // 從 previousTransaction 獲取
}>> {
  try {
    const targetNetwork = network || getCurrentNetwork();
    const packageId = getPackageId(targetNetwork);
    console.log(`[mintContract] Querying EntryNFTs for owner: ${ownerAddress} on ${targetNetwork} with package ${packageId}`);
    
      const objects = await getClientForNetwork(targetNetwork).getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${packageId}::${MODULE}::EntryNFT`,
        },
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
        showPreviousTransaction: true, // 獲取 previousTransaction 以提取交易 digest
      },
      limit: 50, // 限制查詢數量，Sui RPC 最大限制为 50
    });

    console.log(`[mintContract] Found ${objects.data.length} EntryNFTs on ${targetNetwork}`);

    const nfts = [];
    for (const obj of objects.data) {
      if (!obj.data) continue;
      
      // 驗證對象類型是否匹配當前網絡的 Package ID
      const expectedType = `${packageId}::${MODULE}::EntryNFT`;
      const actualType = obj.data.type;
      
      if (actualType !== expectedType) {
        console.warn(
          `[mintContract] Skipping NFT ${obj.data.objectId}: type mismatch. ` +
          `Expected ${expectedType}, got ${actualType}. ` +
          `This NFT may belong to a different network or package.`
        );
        continue;
      }
      
      const content = obj.data.content;
      if (content && 'fields' in content) {
        const fields = content.fields as any;
        const rawImageUrl = fields.image_url || "";
        const rawAudioUrl = fields.audio_url || "";
        const blobIdFromUrls = extractBlobIdFromUrl(rawImageUrl) || extractBlobIdFromUrl(rawAudioUrl) || undefined;
        
        // 從 previousTransaction 獲取交易 digest
        const transactionDigest = obj.data.previousTransaction || null;
        
        nfts.push({
          nftId: obj.data.objectId,
          journalId: fields.journal_id || "",
          timestamp: fields.timestamp_ms 
            ? new Date(Number(fields.timestamp_ms)).toISOString()
            : new Date().toISOString(),
          moodScore: Number(fields.mood_score || 0),
          moodText: fields.mood_text || "",
          tagsCsv: fields.tags_csv || "",
          imageUrl: rawImageUrl,
          audioUrl: rawAudioUrl,
          blobId: blobIdFromUrls,
          transactionDigest: transactionDigest || undefined,
        });
      }
    }

    // 按時間戳排序（最新的在前）
    nfts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`[mintContract] Processed ${nfts.length} verified EntryNFTs from ${targetNetwork}`);
    return nfts;
  } catch (error) {
    console.error("[mintContract] Error querying EntryNFTs:", error);
    return [];
  }
}

/**
 * 檢查今天是否已經鑄造過 NFT
 */
export async function checkTodayMinted(journalId: string, network?: SuiNetwork): Promise<boolean> {
  try {
    const targetNetwork = network || getCurrentNetwork();
    const journal = await getClientForNetwork(targetNetwork).getObject({
      id: journalId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (!journal.data || !journal.data.content || !('fields' in journal.data.content)) {
      return false;
    }

    const fields = journal.data.content.fields as any;
    const mintedDays = fields.minted_days;
    
    if (!mintedDays) {
      return false;
    }

    // 檢查 minted_days 中是否包含今天的 day_index
    // minted_days 是一個 Table，我們無法直接讀取 Table 內容
    // 為了提高效率，我們只查詢最近的 NFT（最多 10 個）來檢查今天是否已鑄造
    // 因為每天只能鑄造一次，所以最近的 NFT 中如果有今天的，就說明今天已經鑄造過
    const recentNFTs = await queryEntryNFTsByOwner(
      fields.owner || "",
      targetNetwork
    );
    
    // 只檢查最近的 NFT（最多檢查 10 個，因為每天只能鑄造一次）
    const nftsToCheck = recentNFTs.slice(0, 10);
    
    // 檢查是否有今天的 NFT（使用 UTC 時間，與合約保持一致）
    // 合約使用 UTC 時間戳計算 day_index，所以我們也應該使用 UTC 時間來比較
    const nowUTC = Date.now();
    const todayDayIndex = Math.floor(nowUTC / 86400000);
    
    // 檢查 NFT 的 day_index 是否等於今天的 day_index
    // 注意：NFT 的 timestamp 是 UTC 時間戳（毫秒），我們需要計算它的 day_index
    const hasTodayNFT = nftsToCheck.some(nft => {
      const nftTime = new Date(nft.timestamp).getTime();
      const nftDayIndex = Math.floor(nftTime / 86400000);
      return nftDayIndex === todayDayIndex;
    });

    return hasTodayNFT;
  } catch (error) {
    console.error("[mintContract] Error checking today minted:", error);
    // 如果檢查失敗，返回 false（允許嘗試鑄造，讓合約來驗證）
    return false;
  }
}

/**
 * 獲取或創建 Journal
 * 優先從本地存儲獲取，如果不存在則查詢鏈上，最後才創建新的
 * 重要：必須傳遞網絡參數，確保在正確的網絡上查找/創建 Journal
 */
export async function getOrCreateJournal(
  signAndExecute: any,
  walletAddress: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  console.log(`[mintContract] getOrCreateJournal for ${walletAddress} on ${targetNetwork}`);
  
  // 1. 檢查本地存儲（使用網絡特定的鍵）
  let journalId = getJournalId(walletAddress, targetNetwork);
  if (journalId) {
      // 驗證 Journal 是否仍然存在於正確的網絡上，且類型匹配當前 Package ID
      try {
        const packageId = getPackageId(targetNetwork);
        const journal = await client.getObject({ 
          id: journalId,
          options: {
            showContent: true,
            showType: true,
          },
        });
        // 驗證對象確實存在
        if (!journal.data) {
          throw new Error("Journal object not found");
        }
        
        // 驗證類型是否匹配當前 Package ID
        const expectedType = `${packageId}::${MODULE}::Journal`;
        const actualType = journal.data.type;
        
        if (actualType !== expectedType) {
          console.warn(
            `[mintContract] Journal type mismatch. Expected ${expectedType}, but got ${actualType}. ` +
            `This Journal was created with an old package ID. Clearing cache and will create new Journal.`
          );
          // Journal 類型不匹配（可能是舊的 Package ID），清除本地存儲
          clearJournalId(walletAddress);
          journalId = null;
        } else {
          // Journal 存在且類型正確
          console.log(`[mintContract] Found existing Journal ${journalId} on ${targetNetwork} with correct type`);
          return journalId;
        }
      } catch (error: any) {
        console.warn(`[mintContract] Journal ${journalId} verification failed on ${targetNetwork}, clearing cache:`, error.message);
        // Journal 不存在或驗證失敗，清除本地存儲
        clearJournalId(walletAddress);
        journalId = null;
      }
  }

  // 2. 查詢鏈上（在正確的網絡上）
  journalId = await queryJournalByOwner(walletAddress, targetNetwork, suiClient);
  if (journalId) {
    console.log(`[mintContract] Found Journal ${journalId} on-chain for ${targetNetwork}`);
    saveJournalId(walletAddress, journalId, targetNetwork);
    return journalId;
  }

  // 3. 創建新的 Journal（在正確的網絡上）
  try {
    console.log(`[mintContract] Creating new Journal on ${targetNetwork}...`);
    journalId = await createJournal(signAndExecute, walletAddress, targetNetwork, suiClient);
    if (journalId) {
      console.log(`[mintContract] Created Journal ${journalId} on ${targetNetwork}`);
      saveJournalId(walletAddress, journalId, targetNetwork);
    } else {
      throw new Error("Journal 創建失敗：未返回 Journal ID");
    }
  } catch (error: any) {
    console.error("[mintContract] Error creating journal:", error);
    // 提供更清晰的錯誤信息
    if (error.message?.includes("Insufficient") || error.message?.includes("餘額不足")) {
      throw new Error("錢包餘額不足，無法創建 Journal。請確保有足夠的 SUI 代幣支付 Gas 費用。");
    } else if (error.message?.includes("sign") || error.message?.includes("簽名")) {
      throw new Error("交易簽名失敗，請檢查錢包連接並重試。");
    } else {
      throw new Error(`Journal 創建失敗：${error.message || "未知錯誤"}`);
    }
  }

  return journalId;
}

/**
 * 建立 Journal
 */
export async function createJournal(signAndExecute: any, sender?: string, network?: SuiNetwork, suiClient?: SuiClient): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const tx = new Transaction();
  
  // Set sender if provided (required for transaction building)
  if (sender) {
    tx.setSender(sender);
  }
  
  const packageId = getPackageId(targetNetwork);
  console.log(`[mintContract] Creating Journal on ${targetNetwork} with package ${packageId}`);
  tx.moveCall({
    target: `${packageId}::${MODULE}::create_journal`,
    arguments: [],
  });

  const chain = `sui:${targetNetwork}`;
  
  try {
    const result = await signAndExecute({ transaction: tx, chain });
    
    // 等待交易被索引（有時需要一點時間）
    let full;
    let retries = 3;
    while (retries > 0) {
      try {
        full = await client.getTransactionBlock({
          digest: result.digest!,
          options: { showObjectChanges: true },
        });
        break;
      } catch (error: any) {
        if (error.message?.includes("Could not find") && retries > 1) {
          console.log(`[mintContract] Transaction not indexed yet, retrying... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
          retries--;
        } else {
          throw error;
        }
      }
    }

    const created = full.objectChanges?.find(
      (o: any) =>
        o.type === "created" &&
        o.objectType?.endsWith("::diary::Journal")
    ) as any;

    return created?.objectId ?? null;
  } catch (error) {
    console.error("[mintContract] Error creating journal:", error);
    throw error;
  }
}

/**
 * 鑄造 Entry NFT
 * 返回 { nftId: string, transactionDigest: string } 或 null
 */
export async function mintEntry(
  signAndExecute: any,
  journalId: string,
  moodScore: number,
  moodText: string,
  tagsCsv: string,
  imageUrl: string,
  imageMime: string,
  imageSha256?: Uint8Array,
  audioUrl?: string,
  audioMime?: string,
  audioSha256?: Uint8Array,
  audioDurationMs?: number,
  sender?: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<{ nftId: string; transactionDigest: string } | null> {
  // Validate journalId format
  if (!journalId || typeof journalId !== "string") {
    throw new Error("Invalid journalId: must be a non-empty string");
  }
  if (!journalId.startsWith("0x") || journalId.length < 10) {
    throw new Error(`Invalid journalId format: ${journalId}. Expected a valid Sui object ID starting with 0x`);
  }

  const currentNetwork = network || getCurrentNetwork();
  const chain = `sui:${currentNetwork}`;
  
  const tx = new Transaction();
  
  // Set sender if provided (required for transaction building)
  if (sender) {
    tx.setSender(sender);
  }
  
  // 使用提供的 SHA256 或生成默認值
  const imageHash = imageSha256 || new Uint8Array([0x12, 0x34]);
  const audioHash = audioSha256 || new Uint8Array([]);
  const audioUrlValue = audioUrl || "";
  const audioMimeValue = audioMime || "";
  const audioDurationValue = audioDurationMs || 0;

  const packageId = getPackageId(currentNetwork);
  const client = suiClient || getClientForNetwork(currentNetwork);
  
  // Verify Journal object exists and has correct type before building transaction
  try {
    const journal = await client.getObject({
      id: journalId,
      options: {
        showType: true,
        showContent: true,
      },
    });
    
    if (!journal.data) {
      throw new Error(`Journal object ${journalId} not found on ${currentNetwork}`);
    }
    
    const expectedType = `${packageId}::${MODULE}::Journal`;
    const actualType = journal.data.type;
    
    if (actualType !== expectedType) {
      throw new Error(
        `Journal type mismatch. Expected ${expectedType}, but got ${actualType}. ` +
        `This Journal may be from a different network or package.`
      );
    }
    
    console.log("[mintContract] Journal verified:", {
      journalId,
      type: actualType,
      network: currentNetwork,
    });
  } catch (error: any) {
    console.error("[mintContract] Journal verification failed:", error);
    throw new Error(
      `Failed to verify Journal object: ${error.message}. ` +
      `Please ensure the Journal exists on ${currentNetwork} and belongs to package ${packageId}`
    );
  }
  
  console.log("[mintContract] Building transaction with params:", {
    journalId,
    moodScore,
    moodTextLength: moodText.length,
    tagsCsv,
    imageUrl: imageUrl ? `${imageUrl.substring(0, 50)}...` : "empty",
    chain,
    packageId,
  });

  tx.moveCall({
    target: `${packageId}::${MODULE}::mint_entry`,
    arguments: [
      tx.object(journalId),
      tx.pure.u8(moodScore),
      tx.pure.string(moodText),
      tx.pure.string(tagsCsv),
      tx.pure.string(imageUrl),
      tx.pure.string(imageMime),
      tx.pure.vector("u8", Array.from(imageHash)),
      tx.pure.string(audioUrlValue),
      tx.pure.string(audioMimeValue),
      tx.pure.vector("u8", Array.from(audioHash)),
      tx.pure.u64(audioDurationValue),
      tx.object(CLOCK_ID),
    ],
  });

  try {
    const result = await signAndExecute({ transaction: tx, chain });
    
    // 等待交易被索引（有時需要一點時間）
    let full;
    let retries = 3;
    while (retries > 0) {
      try {
        full = await client.getTransactionBlock({
          digest: result.digest!,
          options: { showObjectChanges: true },
        });
        break;
      } catch (error: any) {
        if (error.message?.includes("Could not find") && retries > 1) {
          console.log(`[mintContract] Transaction not indexed yet, retrying... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
          retries--;
        } else {
          throw error;
        }
      }
    }

    const created = full.objectChanges?.find(
      (o: any) =>
        o.type === "created" &&
        o.objectType?.endsWith("::diary::EntryNFT")
    ) as any;

    const nftId = created?.objectId;
    const transactionDigest = result.digest;

    if (!nftId || !transactionDigest) {
      console.error("[mintContract] Missing nftId or transactionDigest:", { nftId, transactionDigest });
      return null;
    }

    return { nftId, transactionDigest };
  } catch (error) {
    console.error("[mintContract] Error minting entry:", error);
    throw error;
  }
}

// ============================================================================
// Seal Access Policies Functions
// ============================================================================

/**
 * 获取或初始化 PolicyRegistry
 * PolicyRegistry 是一个共享对象，通过 init 函数自动创建
 * 我们需要查询链上已存在的 PolicyRegistry
 */
export async function getOrQueryPolicyRegistry(
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);

  try {
    // 1. 尝试从本地存储获取
    if (typeof window !== "undefined") {
      const key = getPolicyRegistryStorageKey(targetNetwork);
      const stored = localStorage.getItem(key);
      if (stored) {
        // 验证 registry 是否仍然存在
        try {
          const registry = await client.getObject({
            id: stored,
            options: { showType: true },
          });
          if (registry.data) {
            const expectedType = `${packageId}::${POLICY_MODULE}::PolicyRegistry`;
            if (registry.data.type === expectedType) {
              console.log(`[mintContract] Found PolicyRegistry from localStorage: ${stored}`);
              return stored;
            }
          }
        } catch {
          // Registry 不存在，清除存储
          localStorage.removeItem(key);
        }
      }
    }

    // 2. 尝试使用预设的 PolicyRegistry ID
    const { getPolicyRegistryId } = await import("./policyRegistry");
    const presetId = await getPolicyRegistryId(targetNetwork);
    if (presetId) {
      // 验证预设的 ID 是否有效
      try {
        const registry = await client.getObject({
          id: presetId,
          options: { showType: true },
        });
        if (registry.data) {
          const expectedType = `${packageId}::${POLICY_MODULE}::PolicyRegistry`;
          if (registry.data.type === expectedType) {
            console.log(`[mintContract] Found PolicyRegistry from preset: ${presetId}`);
            // 保存到 localStorage 以便下次使用
            if (typeof window !== "undefined") {
              const key = getPolicyRegistryStorageKey(targetNetwork);
              localStorage.setItem(key, presetId);
            }
            return presetId;
          } else {
            console.warn(`[mintContract] Preset PolicyRegistry type mismatch. Expected ${expectedType}, got ${registry.data.type}`);
          }
        }
      } catch (error: any) {
        console.warn(`[mintContract] Preset PolicyRegistry not found on chain: ${error.message}`);
      }
    }

    // 3. 查询链上的 PolicyRegistry（共享对象）
    // 注意：由于 PolicyRegistry 是共享对象，我们需要通过事件或已知 ID 来查找
    // 这里我们返回 null，让调用者知道需要初始化
    console.log(`[mintContract] PolicyRegistry not found for ${targetNetwork}`);
    return null;
  } catch (error) {
    console.error("[mintContract] Error querying PolicyRegistry:", error);
    return null;
  }
}

/**
 * 保存 PolicyRegistry ID 到本地存储
 */
export function savePolicyRegistryId(registryId: string, network?: SuiNetwork): void {
  if (typeof window === "undefined") return;
  
  const targetNetwork = network || getCurrentNetwork();
  const key = getPolicyRegistryStorageKey(targetNetwork);
  localStorage.setItem(key, registryId);
}

/**
 * 创建访问策略
 */
export async function createAccessPolicy(
  signAndExecute: any,
  entryNftId: string,
  ownerAddress: string,
  isPublic: boolean,
  registryId: string,
  sender?: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);
  const chain = `sui:${targetNetwork}`;

  const tx = new Transaction();
  if (sender) {
    tx.setSender(sender);
  }

  tx.moveCall({
    target: `${packageId}::${POLICY_MODULE}::create_policy`,
    arguments: [
      tx.pure.id(entryNftId),
      tx.pure.address(ownerAddress),
      tx.pure.bool(isPublic),
      tx.object(registryId),
    ],
  });

  try {
    const result = await signAndExecute({ transaction: tx, chain });
    return result.digest || null;
  } catch (error) {
    console.error("[mintContract] Error creating access policy:", error);
    throw error;
  }
}

/**
 * 检查地址是否有访问权限
 */
export async function hasAccess(
  entryNftId: string,
  requesterAddress: string,
  registryId: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<boolean> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);

  try {
    // Create transaction to call view function
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::${POLICY_MODULE}::has_access`,
      arguments: [
        tx.pure.id(entryNftId),
        tx.pure.address(requesterAddress),
        tx.object(registryId),
      ],
    });
    
    const result = await client.devInspectTransactionBlock({
      sender: requesterAddress,
      transactionBlock: tx,
    });

    // 解析返回结果
    if (result.results && result.results.length > 0) {
      const returnValue = result.results[0].returnValues?.[0];
      if (returnValue) {
        const [value] = returnValue;
        // Move bool 是 u8，0 是 false，1 是 true
        return value[0] === 1;
      }
    }
    return false;
  } catch (error) {
    console.error("[mintContract] Error checking access:", error);
    return false;
  }
}

/**
 * 检查 NFT 是否使用 Seal Access Policies 铸造（通过查询交易事件）
 * 这是一个诊断函数，用于确认 NFT 是否真的使用了 Seal Access Policies
 */
export async function checkIfMintedWithSealPolicies(
  entryNftId: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<{
  mintedWithPolicies: boolean;
  transactionDigest?: string;
  policyCreatedEvent?: any;
  error?: string;
}> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);

  try {
    // 1. 获取 NFT 对象，找到它的创建交易
    const nftObject = await client.getObject({
      id: entryNftId,
      options: {
        showPreviousTransaction: true,
      },
    });

    if (!nftObject.data || !nftObject.data.previousTransaction) {
      return {
        mintedWithPolicies: false,
        error: "无法找到 NFT 的创建交易",
      };
    }

    const transactionDigest = nftObject.data.previousTransaction;
    console.log(`[mintContract] 🔍 检查 NFT ${entryNftId} 的创建交易: ${transactionDigest}`);

    // 2. 查询交易详情，检查是否有 PolicyCreatedEvent 和 moveCall
    const txDetails = await client.getTransactionBlock({
      digest: transactionDigest,
      options: {
        showEvents: true,
        showEffects: true,
        showInput: true, // 需要 showInput 来查看 moveCall
        showObjectChanges: true, // 检查对象变更，可能包含 PolicyRegistry 的变更
      },
    });

    // 输出完整的交易结构以便调试
    console.log(`[mintContract] 交易详情结构:`, {
      hasTransaction: !!txDetails.transaction,
      hasEvents: !!txDetails.events,
      eventsCount: txDetails.events?.length || 0,
      transactionKeys: txDetails.transaction ? Object.keys(txDetails.transaction) : [],
      hasTransactionData: !!(txDetails.transaction as any)?.data,
      transactionDataKeys: (txDetails.transaction as any)?.data ? Object.keys((txDetails.transaction as any).data) : [],
    });
    
    // 输出完整的交易数据以便调试（限制长度）
    if (txDetails.transaction) {
      const tx = txDetails.transaction as any;
      console.log(`[mintContract] 交易数据概览:`, {
        kind: tx.kind,
        dataKind: tx.data?.kind,
        hasData: !!tx.data,
        hasTransactions: !!tx.data?.transactions,
        transactionsCount: Array.isArray(tx.data?.transactions) ? tx.data.transactions.length : 0,
      });
      
      // 输出交易数据的 JSON（限制长度）
      const txStr = JSON.stringify(tx, null, 2);
      console.log(`[mintContract] 交易数据 (前2000字符):`, txStr.substring(0, 2000));
    }

    // 3. 查找 PolicyCreatedEvent
    const events = txDetails.events || [];
    console.log(`[mintContract] 检查 ${events.length} 个事件...`);
    
    // 输出所有事件类型以便调试
    events.forEach((e: any, idx: number) => {
      const eventType = e.type || e.typeName || "";
      const eventTypeName = e.transactionModule || "";
      console.log(`[mintContract] 事件 ${idx}:`, {
        type: eventType,
        typeName: eventTypeName,
        full: e,
      });
    });
    
    const policyEvent = events.find((e: any) => {
      const typeName = e.type || e.typeName || "";
      const moduleName = e.transactionModule || "";
      const includesPolicyCreated = 
        typeName.includes("PolicyCreated") || 
        typeName.includes("PolicyCreatedEvent") ||
        (typeName.includes("seal_access_policies") && typeName.includes("Policy")) ||
        (moduleName.includes("seal_access_policies") && typeName.includes("Policy")) ||
        (moduleName.includes("diary_with_policy") && typeName.includes("PolicyCreated"));
      
      if (includesPolicyCreated) {
        console.log(`[mintContract] ✅ 找到 PolicyCreated 相关事件:`, {
          type: typeName,
          module: moduleName,
          full: e,
        });
      }
      return includesPolicyCreated;
    });

    if (policyEvent) {
      console.log(`[mintContract] ✅ 找到 PolicyCreatedEvent，确认使用 Seal Access Policies 铸造`);
      const parsed = typeof policyEvent.parsedJson === "string"
        ? JSON.parse(policyEvent.parsedJson)
        : policyEvent.parsedJson;
      
      console.log(`[mintContract] PolicyCreatedEvent 内容:`, parsed);
      
      // 验证 entry_nft_id 是否匹配（可能需要处理格式差异）
      const eventNftId = parsed?.entry_nft_id;
      if (eventNftId === entryNftId || eventNftId?.toLowerCase() === entryNftId.toLowerCase()) {
        return {
          mintedWithPolicies: true,
          transactionDigest,
          policyCreatedEvent: parsed,
        };
      } else {
        console.warn(`[mintContract] ⚠️ PolicyCreatedEvent 中的 entry_nft_id 不匹配:`, {
          expected: entryNftId,
          found: eventNftId,
        });
      }
    }

    // 4. 检查交易中是否调用了 mint_entry_with_policy
    // 需要检查多个可能的数据结构
    let hasPolicyMint = false;
    let moveCallDetails: any = null;
    
    // 递归查找所有可能的 moveCall
    const findMoveCalls = (obj: any, path: string = ""): any[] => {
      const calls: any[] = [];
      
      if (!obj || typeof obj !== 'object') return calls;
      
      // 检查当前对象是否是 moveCall
      if (obj.kind === 'moveCall') {
        calls.push({ call: obj, path });
      }
      
      // 检查是否有 transactions 数组
      if (Array.isArray(obj.transactions)) {
        obj.transactions.forEach((tx: any, idx: number) => {
          if (tx.kind === 'moveCall') {
            calls.push({ call: tx, path: `${path}.transactions[${idx}]` });
          }
          // 递归检查嵌套结构
          calls.push(...findMoveCalls(tx, `${path}.transactions[${idx}]`));
        });
      }
      
      // 检查是否有 data 字段
      if (obj.data) {
        calls.push(...findMoveCalls(obj.data, `${path}.data`));
      }
      
      // 递归检查所有属性
      for (const key in obj) {
        if (key !== 'data' && key !== 'transactions' && typeof obj[key] === 'object') {
          calls.push(...findMoveCalls(obj[key], `${path}.${key}`));
        }
      }
      
      return calls;
    };
    
    // 检查所有可能的数据结构路径
    const tx = txDetails.transaction as any;
    
    // 方法1: 检查 transaction.data.transaction.transactions（ProgrammableTransaction 的标准结构）
    const programmableTx = tx?.data?.transaction || tx?.transaction;
    if (programmableTx?.kind === 'ProgrammableTransaction' || programmableTx?.transactions) {
      const transactions = programmableTx.transactions || [];
      console.log(`[mintContract] 检查 ProgrammableTransaction.transactions (${transactions.length} 个交易)`);
      
      for (let i = 0; i < transactions.length; i++) {
        const subTx = transactions[i];
        console.log(`[mintContract] 交易 [${i}] 键:`, Object.keys(subTx || {}));
        
        // 检查 MoveCall 结构（Sui 标准格式）
        if (subTx?.MoveCall) {
          const moveCall = subTx.MoveCall;
          const packageId = moveCall.package || "";
          const module = moveCall.module || "";
          const functionName = moveCall.function || "";
          const fullTarget = packageId && module && functionName 
            ? `${packageId}::${module}::${functionName}`
            : functionName || module || packageId || "";
          
          console.log(`[mintContract] MoveCall [${i}]:`, { 
            package: packageId, 
            module, 
            function: functionName, 
            fullTarget,
          });
          
          if (fullTarget.includes("mint_entry_with_policy") || 
              fullTarget.includes("diary_with_policy") ||
              functionName.includes("mint_entry_with_policy") ||
              module.includes("diary_with_policy")) {
            hasPolicyMint = true;
            moveCallDetails = { target: fullTarget, call: moveCall, path: `transaction.data.transaction.transactions[${i}]` };
            console.log(`[mintContract] ✅ 找到 mint_entry_with_policy 调用:`, fullTarget);
            break;
          }
        }
      }
    }
    
    // 方法2: 检查 transaction.data.transactions（直接路径）
    if (!hasPolicyMint && tx?.data?.transactions && Array.isArray(tx.data.transactions)) {
      console.log(`[mintContract] 检查 transaction.data.transactions (${tx.data.transactions.length} 个交易)`);
      for (let i = 0; i < tx.data.transactions.length; i++) {
        const subTx = tx.data.transactions[i];
        console.log(`[mintContract] 交易 [${i}] 类型:`, Object.keys(subTx || {}));
        
        if (subTx?.MoveCall) {
          const moveCall = subTx.MoveCall;
          const packageId = moveCall.package || "";
          const module = moveCall.module || "";
          const functionName = moveCall.function || "";
          const fullTarget = packageId && module && functionName 
            ? `${packageId}::${module}::${functionName}`
            : functionName || module || packageId || "";
          
          console.log(`[mintContract] MoveCall [${i}]:`, { package: packageId, module, function: functionName, fullTarget });
          
          if (fullTarget.includes("mint_entry_with_policy") || 
              fullTarget.includes("diary_with_policy") ||
              functionName.includes("mint_entry_with_policy")) {
            hasPolicyMint = true;
            moveCallDetails = { target: fullTarget, call: moveCall, path: `transaction.data.transactions[${i}]` };
            console.log(`[mintContract] ✅ 找到 mint_entry_with_policy 调用:`, fullTarget);
            break;
          }
        }
      }
    }
    
    // 如果还没找到，使用递归查找
    if (!hasPolicyMint) {
      const allMoveCalls = findMoveCalls(txDetails.transaction, "transaction");
      console.log(`[mintContract] 递归查找找到 ${allMoveCalls.length} 个 moveCall`);
      
      for (const { call, path } of allMoveCalls) {
        // 尝试多种方式获取函数名
        const possibleTargets = [
          call.data?.function,
          call.data?.target,
          call.target,
          call.function,
          call.package,
          call.module,
          // 检查完整的 target 格式: package::module::function
          typeof call.data === 'string' ? call.data : null,
          // 检查 MoveCall 结构
          call.MoveCall?.function,
          call.MoveCall ? `${call.MoveCall.package}::${call.MoveCall.module}::${call.MoveCall.function}` : null,
        ].filter(Boolean);
        
        for (const target of possibleTargets) {
          const targetStr = String(target);
          console.log(`[mintContract] 检查 moveCall (${path}):`, targetStr);
          
          if (targetStr.includes("mint_entry_with_policy") || 
              targetStr.includes("diary_with_policy") ||
              (targetStr.includes("mint_entry") && targetStr.includes("policy"))) {
            hasPolicyMint = true;
            moveCallDetails = { target: targetStr, call, path };
            console.log(`[mintContract] ✅ 找到 mint_entry_with_policy 调用 (${path}):`, targetStr);
            break;
          }
        }
        
        if (hasPolicyMint) break;
      }
    }

    // 5. 检查对象变更（objectChanges）中是否有 AccessPolicy 对象被创建
    const objectChanges = txDetails.objectChanges || [];
    console.log(`[mintContract] 检查对象变更 (${objectChanges.length} 个)`);
    
    // 输出所有对象变更以便调试
    objectChanges.forEach((change: any, idx: number) => {
      const objectType = change.objectType || "";
      const changeType = change.type || "";
      console.log(`[mintContract] 对象变更 [${idx}]:`, {
        changeType,
        objectType,
        objectId: change.objectId,
      });
    });
    
    // 检查是否有创建 AccessPolicy 对象
    const accessPolicyCreated = objectChanges.find((change: any) => {
      const objectType = change.objectType || "";
      const changeType = change.type || "";
      const isAccessPolicy = (changeType === "created" || changeType === "Created") && 
                            (objectType.includes("AccessPolicy") || 
                             objectType.includes("seal_access_policies::AccessPolicy"));
      
      if (isAccessPolicy) {
        console.log(`[mintContract] ✅ 找到 AccessPolicy 对象创建:`, {
          type: changeType,
          objectType,
          objectId: change.objectId,
        });
      }
      
      return isAccessPolicy;
    });
    
    // 如果找到了 AccessPolicy 对象或 PolicyCreated 事件，确认使用了 Seal Access Policies
    if (accessPolicyCreated || policyEvent) {
      console.log(`[mintContract] ✅ 确认使用 Seal Access Policies 铸造（通过对象变更或事件验证）`);
      return {
        mintedWithPolicies: true,
        transactionDigest,
        policyCreatedEvent: policyEvent ? (typeof policyEvent.parsedJson === "string" ? JSON.parse(policyEvent.parsedJson) : policyEvent.parsedJson) : undefined,
        error: !policyEvent ? "在对象变更中找到了 AccessPolicy 对象，但 PolicyCreated 事件可能尚未索引" : undefined,
      };
    }

    if (hasPolicyMint) {
      console.log(`[mintContract] ✅ 交易中调用了 mint_entry_with_policy，确认使用 Seal Access Policies 铸造`);
      return {
        mintedWithPolicies: true,
        transactionDigest,
        error: policyEvent ? undefined : "交易中调用了 mint_entry_with_policy，但 PolicyCreatedEvent 可能尚未索引",
      };
    }

    // 6. 如果 previousTransaction 的交易中没有找到相关信息，尝试通过查询事件来找到正确的交易
    // 这可能是因为 previousTransaction 指向的是 Walrus 的 certify_blob 交易，而不是 mint_entry_with_policy 交易
    if (!policyEvent && !hasPolicyMint && !accessPolicyCreated) {
      console.log(`[mintContract] ⚠️ previousTransaction 的交易中没有找到相关信息，尝试通过查询事件来找到正确的交易...`);
      
      try {
        // 查询 PolicyCreatedEvent 事件，查找包含当前 NFT ID 的事件
        // 注意：事件是在 seal_access_policies 模块中定义的，不是 diary_with_policy
        const policyModule = `${packageId}::${POLICY_MODULE}`;
        const eventType = `${policyModule}::PolicyCreatedEvent`;
        
        console.log(`[mintContract] 查询事件类型: ${eventType}`);
        
        // 查询最近的事件（限制 50 个，应该足够找到最近的铸造交易）
        const events = await client.queryEvents({
          query: { MoveEventType: eventType },
          limit: 50,
          order: "descending",
        });
        
        console.log(`[mintContract] 找到 ${events.data.length} 个 PolicyCreatedEvent 事件`);
        console.log(`[mintContract] 正在查找匹配 NFT ID: ${entryNftId}`);
        
        // 查找匹配当前 NFT ID 的事件
        for (let i = 0; i < events.data.length; i++) {
          const event = events.data[i];
          try {
            console.log(`[mintContract] 检查事件 ${i + 1}/${events.data.length}:`, {
              txDigest: event.id.txDigest,
              eventId: event.id.eventSeq,
              rawType: event.type,
            });
            
            const parsed = typeof event.parsedJson === "string"
              ? JSON.parse(event.parsedJson)
              : event.parsedJson;
            
            console.log(`[mintContract] 事件 ${i + 1} 解析结果:`, parsed);
            console.log(`[mintContract] 事件 ${i + 1} 原始 parsedJson:`, event.parsedJson);
            
            // 尝试多种可能的字段名
            const eventNftId = parsed?.entry_nft_id || 
                              parsed?.entry_nft_Id || 
                              parsed?.entryNftId ||
                              parsed?.entryNft_Id ||
                              parsed?.["entry_nft_id"] ||
                              parsed?.["entry_nft_Id"];
            
            console.log(`[mintContract] 事件 ${i + 1} entry_nft_id 值:`, eventNftId);
            console.log(`[mintContract] 事件 ${i + 1} 比较:`, {
              eventNftId,
              entryNftId,
              exactMatch: eventNftId === entryNftId,
              caseInsensitiveMatch: eventNftId?.toLowerCase() === entryNftId.toLowerCase(),
            });
            
            if (eventNftId === entryNftId || eventNftId?.toLowerCase() === entryNftId.toLowerCase()) {
              console.log(`[mintContract] ✅ 通过事件查询找到匹配的 PolicyCreatedEvent！`);
              console.log(`[mintContract] 事件交易: ${event.id.txDigest}`);
              console.log(`[mintContract] 事件内容:`, parsed);
              
              // 验证这个交易是否真的创建了这个 NFT
              const mintTx = await client.getTransactionBlock({
                digest: event.id.txDigest,
                options: {
                  showObjectChanges: true,
                },
              });
              
              const nftCreated = mintTx.objectChanges?.find((change: any) => {
                return (change.type === "created" || change.type === "Created") &&
                       change.objectId === entryNftId;
              });
              
              if (nftCreated) {
                console.log(`[mintContract] ✅ 确认该交易创建了这个 NFT`);
                return {
                  mintedWithPolicies: true,
                  transactionDigest: event.id.txDigest,
                  policyCreatedEvent: parsed,
                };
              } else {
                console.warn(`[mintContract] ⚠️ 事件交易中没有找到 NFT 创建记录，可能不是正确的交易`);
              }
            } else {
              console.log(`[mintContract] 事件 ${i + 1} 不匹配:`, {
                eventNftId,
                expectedNftId: entryNftId,
              });
            }
          } catch (parseError) {
            console.warn(`[mintContract] 解析事件 ${i + 1} 失败:`, parseError, {
              rawEvent: event,
            });
          }
        }
        
        console.log(`[mintContract] ⚠️ 在事件查询中也没有找到匹配的事件`);
        console.log(`[mintContract] 已检查 ${events.data.length} 个事件，但都没有匹配 NFT ID: ${entryNftId}`);
        
        // 备选方法：如果事件匹配失败，尝试通过查询所有可能创建这个 NFT 的交易
        // 检查最近的几个 PolicyCreatedEvent 对应的交易，看哪个创建了这个 NFT
        console.log(`[mintContract] 尝试备选方法：检查最近的事件对应的交易...`);
        console.log(`[mintContract] 将检查最多 ${Math.min(events.data.length, 10)} 个交易`);
        
        for (let i = 0; i < Math.min(events.data.length, 10); i++) {
          const event = events.data[i];
          try {
            console.log(`[mintContract] 备选方法：检查交易 ${i + 1}/${Math.min(events.data.length, 10)}: ${event.id.txDigest}`);
            
            const mintTx = await client.getTransactionBlock({
              digest: event.id.txDigest,
              options: {
                showObjectChanges: true,
                showEvents: true,
              },
            });
            
            console.log(`[mintContract] 交易 ${i + 1} 的对象变更数量: ${mintTx.objectChanges?.length || 0}`);
            
            // 检查这个交易是否创建了这个 NFT
            const nftCreated = mintTx.objectChanges?.find((change: any) => {
              return (change.type === "created" || change.type === "Created") &&
                     change.objectId === entryNftId;
            });
            
            if (nftCreated) {
              console.log(`[mintContract] ✅ 备选方法成功：找到创建该 NFT 的交易 ${event.id.txDigest}`);
              console.log(`[mintContract] NFT 创建详情:`, nftCreated);
              
              // 检查这个交易是否有 PolicyCreatedEvent
              const policyEvent = mintTx.events?.find((e: any) => {
                const typeName = e.type || e.typeName || "";
                return typeName.includes("PolicyCreated");
              });
              
              if (policyEvent) {
                const parsed = typeof policyEvent.parsedJson === "string"
                  ? JSON.parse(policyEvent.parsedJson)
                  : policyEvent.parsedJson;
                
                console.log(`[mintContract] ✅ 确认该交易使用了 Seal Access Policies`);
                return {
                  mintedWithPolicies: true,
                  transactionDigest: event.id.txDigest,
                  policyCreatedEvent: parsed,
                };
              }
            } else {
              console.log(`[mintContract] 交易 ${i + 1} 没有创建该 NFT`);
            }
          } catch (txError) {
            console.warn(`[mintContract] 检查交易 ${event.id.txDigest} 失败:`, txError);
          }
        }
        
        console.log(`[mintContract] ⚠️ 备选方法失败：未找到创建该 NFT 的交易`);
        console.log(`[mintContract] 已检查 ${Math.min(events.data.length, 10)} 个交易，但都没有创建 NFT ${entryNftId}`);
      } catch (queryError) {
        console.warn(`[mintContract] 查询事件失败:`, queryError);
      }
    }
    
    // 7. 最后的方法：直接检查 PolicyRegistry 中是否有这个 NFT 的策略记录
    // 这是最可靠的方法，因为策略记录是存储在链上的
    console.log(`[mintContract] 尝试最后的方法：直接检查 PolicyRegistry 中是否有策略记录...`);
    try {
      const { getPolicyRegistryId } = await import("./policyRegistry");
      const registryId = await getPolicyRegistryId(targetNetwork);
      
      if (registryId) {
        console.log(`[mintContract] 找到 PolicyRegistry: ${registryId}`);
        console.log(`[mintContract] 尝试调用 isPublicSeal 来检查策略是否存在...`);
        
        // 尝试调用 isPublicSeal，如果策略存在，不会抛出"没有访问策略"的错误
        try {
          const isPublic = await isPublicSeal(entryNftId, registryId, targetNetwork, client);
          console.log(`[mintContract] ✅ 直接检查成功：PolicyRegistry 中存在该 NFT 的策略记录！`);
          console.log(`[mintContract] 策略类型: ${isPublic ? "Public Seal" : "Private Seal"}`);
          
          return {
            mintedWithPolicies: true,
            transactionDigest: transactionDigest,
            error: "通过直接检查 PolicyRegistry 确认策略存在，但未在交易事件中找到相关记录（可能是索引延迟）",
          };
        } catch (policyError: any) {
          const errorMsg = policyError?.message || String(policyError);
          if (errorMsg.includes("没有访问策略") || 
              errorMsg.includes("no access policy") ||
              errorMsg.includes("borrow_child_object_mut") ||
              errorMsg.includes("dynamic_field")) {
            console.log(`[mintContract] ❌ 直接检查确认：PolicyRegistry 中不存在该 NFT 的策略记录`);
            console.log(`[mintContract] 错误信息: ${errorMsg}`);
          } else {
            console.warn(`[mintContract] 检查 PolicyRegistry 时出现意外错误:`, policyError);
          }
        }
      } else {
        console.log(`[mintContract] ⚠️ 未找到 PolicyRegistry ID，无法进行直接检查`);
      }
    } catch (registryError) {
      console.warn(`[mintContract] 直接检查 PolicyRegistry 失败:`, registryError);
    }
    
    // 输出完整的交易结构以便进一步调试
    console.log(`[mintContract] ❌ 未找到 PolicyCreatedEvent 或 mint_entry_with_policy 调用`);
    console.log(`[mintContract] 完整交易结构:`, JSON.stringify(txDetails, null, 2).substring(0, 3000));
    
    return {
      mintedWithPolicies: false,
      transactionDigest,
      error: "交易中未找到 Seal Access Policies 相关的事件或调用，且 PolicyRegistry 中也不存在该 NFT 的策略记录。请检查控制台中的完整交易结构以获取更多信息。",
    };
  } catch (error: any) {
    console.error("[mintContract] Error checking if minted with Seal Policies:", error);
    return {
      mintedWithPolicies: false,
      error: error?.message || String(error),
    };
  }
}

/**
 * 检查是否为公开 Seal
 */
export async function isPublicSeal(
  entryNftId: string,
  registryId: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<boolean> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);
  const normalizedEntryId = normalizeSuiObjectId(entryNftId);
  const normalizedRegistryId = normalizeSuiObjectId(registryId);

  try {
    // 1) Try reading from PolicyCreatedEvent to avoid RPC serialization on large responses
    try {
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${packageId}::${POLICY_MODULE}::PolicyCreatedEvent`,
        },
        limit: 50,
      });

      const matched = events.data.find((e: any) => {
        try {
          const parsed = typeof e.parsedJson === "string" ? JSON.parse(e.parsedJson) : e.parsedJson;
          return parsed?.entry_nft_id?.toLowerCase() === normalizedEntryId.toLowerCase();
        } catch {
          return false;
        }
      });

      if (matched) {
        const parsed = typeof matched.parsedJson === "string" ? JSON.parse(matched.parsedJson) : matched.parsedJson;
        if (typeof parsed?.is_public === "boolean") {
          return parsed.is_public;
        }
      }
    } catch (eventErr: any) {
      const msg = eventErr?.message || "";
      const isRpcErr =
        msg.includes("RPC_SERIALIZATION_ERROR") ||
        msg.includes("malformed utf8") ||
        msg.includes("Deserialization error");
      if (isRpcErr) {
        console.warn("[mintContract] RPC serialization error when querying PolicyCreatedEvent:", msg);
        throw new Error(`RPC_SERIALIZATION_ERROR: ${msg}`);
      }
      console.warn("[mintContract] Failed to query PolicyCreatedEvent, will try dynamic field:", eventErr);
    }

    // 2) Try reading the dynamic field directly (avoids devInspect RPC serialization issues)
    try {
      const dynamicField = await client.getDynamicFieldObject({
        parentId: normalizedRegistryId,
        name: {
          type: "0x2::object::ID",
          value: normalizedEntryId,
        },
      });

      if ((dynamicField as any)?.error) {
        throw new Error((dynamicField as any).error?.code || "Dynamic Field not found");
      }

      const policyValue = (dynamicField.data as any)?.content?.fields?.value?.fields;
      const isPublic = policyValue?.seal_type?.fields?.is_public;

      if (typeof isPublic === "boolean") {
        return isPublic;
      }
    } catch (dfError: any) {
      const dfMessage = dfError?.message || "";
      const isRpcError =
        dfMessage.includes("RPC_SERIALIZATION_ERROR") ||
        dfMessage.includes("malformed utf8") ||
        dfMessage.includes("Deserialization error");
      const isPolicyNotFound =
        dfMessage.includes("Dynamic Field not found") ||
        dfMessage.includes("Entry does not exist") ||
        dfMessage.includes("not found") ||
        dfMessage.includes("borrow_child_object_mut") ||
        dfMessage.includes("dynamic_field");

      if (isRpcError) {
        console.warn("[mintContract] RPC serialization error when reading policy dynamic field:", dfMessage);
        throw new Error(`RPC_SERIALIZATION_ERROR: ${dfMessage}`);
      }

      if (isPolicyNotFound) {
        throw new Error(`Entry NFT ${normalizedEntryId} 没有访问策略。此 NFT 可能不是使用 Seal Access Policies 铸造的。`);
      }

      console.warn("[mintContract] Unexpected error reading policy dynamic field, falling back to devInspect:", dfError);
      // Fallback to devInspect below
    }

    // If neither event nor dynamic field resolved, treat as no policy
    return false;
  } catch (error: any) {
    // 检查是否是预期的错误（没有访问策略）
    const errorMessage = error.message || "";
    
    // "malformed utf8" 和 "Deserialization error" 是 RPC 临时问题，不一定代表策略不存在
    // 这些错误应该视为验证失败（需要重试），而不是策略不存在
    const isRpcError = 
      errorMessage.includes("malformed utf8") ||
      errorMessage.includes("Deserialization error");
    
    const isPolicyNotFoundError = 
      errorMessage.includes("borrow_child_object_mut") ||
      errorMessage.includes("dynamic_field") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("Entry does not exist");
    
    if (isRpcError) {
      // RPC 序列化错误，抛出特殊错误，让调用者知道需要重试
      console.warn("[mintContract] RPC serialization error when checking policy, may need retry:", errorMessage);
      throw new Error(`RPC_SERIALIZATION_ERROR: ${errorMessage}`);
    }
    
    // 如果是预期的错误（NFT 没有访问策略），静默处理，不记录错误日志
    if (isPolicyNotFoundError) {
      // 抛出特定错误，让调用者知道这是预期的（没有访问策略）
      throw new Error(`Entry NFT ${entryNftId} 没有访问策略。此 NFT 可能不是使用 Seal Access Policies 铸造的。`);
    }
    
    // 对于其他意外错误，记录日志
    console.error("[mintContract] Error checking public seal:", error);
    // For other errors, return false (assume not public)
    return false;
  }
}

/**
 * 获取授权地址列表
 * 通过查询授权历史事件来构建当前授权列表（更可靠的方法）
 */
export async function getAuthorizedAddresses(
  entryNftId: string,
  registryId: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string[]> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);

  try {
    // 通过查询事件来构建授权列表（最可靠的方法）
    const history = await queryAccessHistory(entryNftId, registryId, targetNetwork, client);
    const authorizedSet = new Set<string>();
    
    // 从历史事件中重建授权列表
    // 按时间顺序处理，grant 添加，revoke 移除
    for (const event of history) {
      if (event.type === "grant") {
        authorizedSet.add(event.address);
      } else if (event.type === "revoke") {
        authorizedSet.delete(event.address);
      }
    }
    
    return Array.from(authorizedSet);
  } catch (error) {
    console.error("[mintContract] Error getting authorized addresses:", error);
    return [];
  }
}

/**
 * 查询授权历史事件（grant/revoke）
 */
export async function queryAccessHistory(
  entryNftId: string,
  registryId: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<Array<{
  type: "grant" | "revoke";
  address: string;
  timestamp: number;
  transactionDigest: string;
}>> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);
  const targetNftLower = entryNftId.toLowerCase();

  try {
    // Paginate module events to ensure we don't miss older grants/revokes
    const fetchEvents = async (kind: "grant" | "revoke") => {
      const results: Array<{
        type: "grant" | "revoke";
        address: string;
        timestamp: number;
        transactionDigest: string;
      }> = [];

      let cursor: string | null | undefined = undefined;
      let pages = 0;
      const maxPages = 10; // up to ~500 events if limit=50
      const limit = 50;

      while (pages < maxPages) {
        const resp = await client.queryEvents({
          query: {
            MoveModule: {
              package: packageId,
              module: POLICY_MODULE,
            },
          },
          cursor,
          limit,
        });

        if (!resp.data || resp.data.length === 0) {
          break;
        }

        for (const e of resp.data) {
          const eventType = e.type || e.typeName || "";
          const isGrant = eventType.includes("AccessGrantedEvent") || eventType.includes("AccessGranted");
          const isRevoke = eventType.includes("AccessRevokedEvent") || eventType.includes("AccessRevoked");
          if ((kind === "grant" && !isGrant) || (kind === "revoke" && !isRevoke)) continue;

          try {
            const parsed = typeof e.parsedJson === "string" ? JSON.parse(e.parsedJson) : e.parsedJson;
            const eventNftId = parsed?.entry_nft_id?.toLowerCase();
            if (eventNftId !== targetNftLower) continue;

            results.push({
              type: kind,
              address: parsed?.grantee || "",
              timestamp: e.timestampMs ? Number(e.timestampMs) : Date.now(),
              transactionDigest: e.id.txDigest || "",
            });
          } catch {
            continue;
          }
        }

        pages += 1;
        if (!resp.hasNextPage || !resp.nextCursor) break;
        cursor = resp.nextCursor;
      }

      return results;
    };

    const [grantedEvents, revokedEvents] = await Promise.all([
      fetchEvents("grant"),
      fetchEvents("revoke"),
    ]);

    return [...grantedEvents, ...revokedEvents].sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[mintContract] Error querying access history:", error);
    return [];
  }
}

/**
 * 授权访问（仅限私有 Seal）
 */
export async function grantAccess(
  signAndExecute: any,
  entryNftId: string,
  granteeAddress: string,
  registryId: string,
  sender?: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);
  const chain = `sui:${targetNetwork}`;

  // Validate entry NFT exists and sender owns it
  try {
    const entryObject = await client.getObject({
      id: entryNftId,
      options: { showOwner: true },
    });
    
    if (entryObject.error) {
      throw new Error(`Entry NFT not found: ${entryNftId}`);
    }

    // Verify sender owns the NFT
    if (sender && entryObject.data?.owner) {
      const owner = entryObject.data.owner;
      if (typeof owner === 'object' && 'AddressOwner' in owner) {
        const ownerAddress = (owner as any).AddressOwner;
        if (ownerAddress !== sender) {
          throw new Error(`Sender ${sender} does not own Entry NFT ${entryNftId}. Owner is ${ownerAddress}`);
        }
      }
    }

    // Check if Entry NFT has access policy (was minted with Seal Access Policies)
    // We'll try to check, but if it fails, we'll proceed anyway and let the transaction fail with a clearer error
    try {
      const isPublic = await isPublicSeal(entryNftId, registryId, targetNetwork, client);
      // If check succeeds, the policy exists (either public or private)
      console.log(`[mintContract] Entry NFT ${entryNftId} has access policy, isPublic: ${isPublic}`);
    } catch (policyError: any) {
      // If checking policy fails, it might mean:
      // 1. Entry NFT doesn't have an access policy (not minted with Seal Access Policies)
      // 2. PolicyRegistry doesn't exist or is incorrect
      // 3. Network/API issue
      console.warn(`[mintContract] Could not verify access policy for Entry NFT ${entryNftId}:`, policyError);
      // Don't throw here - let the transaction fail with a clearer error message
      // The transaction will fail anyway if the policy doesn't exist
    }
  } catch (error: any) {
    console.error("[mintContract] Error validating entry NFT:", error);
    if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
      throw new Error(`Entry NFT ${entryNftId} does not exist or is not accessible`);
    }
    if (error.message?.includes("没有访问策略") || error.message?.includes("does not have an access policy")) {
      throw error; // Re-throw the policy error
    }
    throw error;
  }

  // Validate registry exists
  try {
    const registryObject = await client.getObject({
      id: registryId,
      options: { showOwner: true },
    });
    
    if (registryObject.error) {
      throw new Error(`PolicyRegistry not found: ${registryId}`);
    }
  } catch (error: any) {
    console.error("[mintContract] Error validating PolicyRegistry:", error);
    if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
      throw new Error(`PolicyRegistry ${registryId} does not exist. Please deploy Seal Access Policies contract first.`);
    }
    throw error;
  }

  const tx = new Transaction();
  if (sender) {
    tx.setSender(sender);
  }

  tx.moveCall({
    target: `${packageId}::${POLICY_MODULE}::grant_access`,
    arguments: [
      tx.pure.id(entryNftId),
      tx.pure.address(granteeAddress),
      tx.object(registryId),
    ],
  });

  try {
    const result = await signAndExecute({ transaction: tx, chain });
    return result.digest || null;
  } catch (error: any) {
    console.error("[mintContract] Error granting access:", error);
    
    const errorMessage = error?.message || String(error);
    
    // Provide more helpful error messages
    if (errorMessage.includes("Dry run failed") || errorMessage.includes("could not automatically determine")) {
      throw new Error(`交易构建失败。请确认：1) Entry NFT ${entryNftId} 存在且您拥有它；2) PolicyRegistry ${registryId} 已正确部署；3) 钱包有足够的 SUI 代币支付 gas 费用`);
    }
    
    if (errorMessage.includes("borrow_child_object_mut") || errorMessage.includes("dynamic_field")) {
      throw new Error(`访问策略对象不存在。请确认 Entry NFT 是使用 Seal Access Policies 铸造的，且 PolicyRegistry 已正确配置`);
    }
    
    // 检查合约错误代码
    if (errorMessage.includes("E_ALREADY_AUTHORIZED") || errorMessage.includes("already authorized")) {
      throw new Error(`地址已授权：该地址已经拥有访问权限，无需重复授权。`);
    }
    
    if (errorMessage.includes("E_INVALID_SEAL_TYPE") || errorMessage.includes("public seal")) {
      throw new Error(`公开记录无法授权：公开记录任何人都可以访问，无需授权特定地址。`);
    }
    
    if (errorMessage.includes("E_NOT_OWNER")) {
      throw new Error(`权限不足：您不是此 NFT 的所有者，无法授权其他地址访问。`);
    }
    
    throw error;
  }
}

/**
 * 撤销访问（仅限私有 Seal）
 */
export async function revokeAccess(
  signAndExecute: any,
  entryNftId: string,
  granteeAddress: string,
  registryId: string,
  sender?: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  const packageId = getPackageId(targetNetwork);
  const chain = `sui:${targetNetwork}`;

  const tx = new Transaction();
  if (sender) {
    tx.setSender(sender);
  }

  tx.moveCall({
    target: `${packageId}::${POLICY_MODULE}::revoke_access`,
    arguments: [
      tx.pure.id(entryNftId),
      tx.pure.address(granteeAddress),
      tx.object(registryId),
    ],
  });

  try {
    const result = await signAndExecute({ transaction: tx, chain });
    return result.digest || null;
  } catch (error: any) {
    console.error("[mintContract] Error revoking access:", error);
    
    const errorMessage = error?.message || String(error);
    
    // 提供更友好的错误消息
    if (errorMessage.includes("E_NOT_AUTHORIZED") || errorMessage.includes("not authorized")) {
      throw new Error(`地址未授权：该地址没有访问权限，无需撤销。`);
    }
    
    if (errorMessage.includes("E_NOT_OWNER")) {
      throw new Error(`权限不足：您不是此 NFT 的所有者，无法撤销其他地址的访问权限。`);
    }
    
    throw error;
  }
}

/**
 * 铸造 EntryNFT 并创建访问策略（一次性交易）
 */
export async function mintEntryWithPolicy(
  signAndExecute: any,
  journalId: string,
  moodScore: number,
  moodText: string,
  tagsCsv: string,
  imageUrl: string,
  imageMime: string,
  isPublic: boolean,
  registryId: string,
  imageSha256?: Uint8Array,
  audioUrl?: string,
  audioMime?: string,
  audioSha256?: Uint8Array,
  audioDurationMs?: number,
  sender?: string,
  network?: SuiNetwork,
  suiClient?: SuiClient
): Promise<{ nftId: string; transactionDigest: string; policyVerified: boolean } | null> {
  const targetNetwork = network || getCurrentNetwork();
  const client = suiClient || getClientForNetwork(targetNetwork);
  const packageId = getPackageId(targetNetwork);
  const chain = `sui:${targetNetwork}`;

  const tx = new Transaction();
  if (sender) {
    tx.setSender(sender);
  }

  // 使用提供的 SHA256 或生成默认值
  const imageHash = imageSha256 || new Uint8Array([0x12, 0x34]);
  const audioHash = audioSha256 || new Uint8Array([]);
  const audioUrlValue = audioUrl || "";
  const audioMimeValue = audioMime || "";
  const audioDurationValue = audioDurationMs || 0;

  tx.moveCall({
    target: `${packageId}::${POLICY_WITH_MINT_MODULE}::mint_entry_with_policy`,
    arguments: [
      tx.object(journalId),
      tx.pure.u8(moodScore),
      tx.pure.string(moodText),
      tx.pure.string(tagsCsv),
      tx.pure.string(imageUrl),
      tx.pure.string(imageMime),
      tx.pure.vector("u8", Array.from(imageHash)),
      tx.pure.string(audioUrlValue),
      tx.pure.string(audioMimeValue),
      tx.pure.vector("u8", Array.from(audioHash)),
      tx.pure.u64(audioDurationValue),
      tx.pure.bool(isPublic),
      tx.object(registryId),
      tx.object(CLOCK_ID),
    ],
  });

  try {
    const result = await signAndExecute({ transaction: tx, chain });

    // 等待交易被索引
    let full;
    let retries = 3;
    while (retries > 0) {
      try {
        full = await client.getTransactionBlock({
          digest: result.digest!,
          options: { showObjectChanges: true },
        });
        break;
      } catch (error: any) {
        if (error.message?.includes("Could not find") && retries > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          retries--;
        } else {
          throw error;
        }
      }
    }

    const created = full.objectChanges?.find(
      (o: any) =>
        o.type === "created" &&
        o.objectType?.endsWith("::diary::EntryNFT")
    ) as any;

    const nftId = created?.objectId;
    const transactionDigest = result.digest;

    if (!nftId || !transactionDigest) {
      console.error("[mintContract] Missing nftId or transactionDigest:", {
        nftId,
        transactionDigest,
      });
      return null;
    }

    // 验证访问策略是否真的被创建了（等待索引完成后检查）
    console.log(`[mintContract] ✅ NFT 铸造成功，NFT ID: ${nftId}`);
    console.log(`[mintContract] 🔍 验证访问策略是否已创建...`);
    
    // 等待一段时间让链上索引完成
    await new Promise((resolve) => setTimeout(resolve, POLICY_VERIFICATION_DELAY_MS));
    
    // 尝试检查策略是否存在（最多重试 2 次）
    let policyVerified = false;
    for (let retry = 0; retry < POLICY_VERIFICATION_RETRIES; retry++) {
      try {
        const hasPolicy = await isPublicSeal(nftId, registryId, targetNetwork, client);
        // 如果检查成功（无论 true/false），说明策略存在
        policyVerified = true;
        console.log(`[mintContract] ✅ 访问策略验证成功！isPublic: ${hasPolicy}`);
        break;
      } catch (error: any) {
        const errorMessage = error?.message || "";
        
        // 检查是否是 RPC 序列化错误
        if (errorMessage.includes("RPC_SERIALIZATION_ERROR")) {
          console.warn(
            `[mintContract] ⚠️ RPC 序列化错误（重试 ${retry + 1}/${POLICY_VERIFICATION_RETRIES}），尝试备选方案...`
          );
          
          // 备选方案：检查交易事件是否有 PolicyCreatedEvent
          try {
            const txDetails = await client.getTransactionBlock({
              digest: transactionDigest,
              options: { showEvents: true },
            });
            
            const policyEvent = txDetails.events?.find((e: any) => {
              const typeName = e.type || "";
              return typeName.includes("PolicyCreatedEvent") || typeName.includes("PolicyCreated");
            });
            
            if (policyEvent) {
              console.log(`[mintContract] ✅ 通过交易事件验证：策略已创建（跳过 RPC 查询）`);
              policyVerified = true;
              break;
            } else {
              console.warn(`[mintContract] ⚠️ 交易事件中未找到 PolicyCreatedEvent`);
            }
          } catch (eventError) {
            console.warn(`[mintContract] 备选方案失败:`, eventError);
          }
          
          // 如果还有重试机会，继续重试
          if (retry < POLICY_VERIFICATION_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, POLICY_VERIFICATION_DELAY_MS));
          }
          continue;
        }
        
        if (errorMessage.includes("没有访问策略")) {
          const remaining = POLICY_VERIFICATION_RETRIES - retry - 1;
          const logFn = remaining > 0 ? console.info : console.warn;
          logFn(
            `[mintContract] 访问策略尚未索引（重试 ${retry + 1}/${POLICY_VERIFICATION_RETRIES}）。`
          );
          if (remaining > 0) {
            // 等待更长时间后重试
            await new Promise((resolve) =>
              setTimeout(resolve, POLICY_VERIFICATION_DELAY_MS)
            );
          } else {
            console.error(`[mintContract] ❌ 访问策略验证失败：策略可能未创建或索引未完成`);
            console.error(`[mintContract] 这可能是合约问题，请检查交易详情: ${transactionDigest}`);
          }
        } else {
          // 其他错误，直接抛出
          throw error;
        }
      }
    }
    
    if (!policyVerified) {
      console.warn(`[mintContract] ⚠️ 警告：NFT 已创建但访问策略验证失败。NFT ID: ${nftId}`);
      console.warn(`[mintContract] 这可能是因为链上索引延迟，请稍后重试检查。`);
    }

    return { 
      nftId, 
      transactionDigest,
      policyVerified // 返回策略验证状态
    };
  } catch (error) {
    console.error("[mintContract] Error minting entry with policy:", error);
    throw error;
  }
}
