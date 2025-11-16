// src/lib/mintContract.ts
import { Transaction } from "@mysten/sui/transactions";
import { getClientForNetwork } from "./suiClient";
import { getCurrentNetwork, type SuiNetwork } from "./networkConfig";

// 合約常數
// Testnet Package ID
const TESTNET_PACKAGE_ID =
  "0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71";
// Mainnet Package ID
// 可以通過環境變數 MAINNET_PACKAGE_ID 覆蓋
const MAINNET_PACKAGE_ID =
  typeof window !== "undefined" && (window as any).MAINNET_PACKAGE_ID
    ? (window as any).MAINNET_PACKAGE_ID
    : "0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9";

const MODULE = "diary";
const CLOCK_ID = "0x6"; // Sui Clock object ID

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
  network?: SuiNetwork
): Promise<string | null> {
  try {
    const targetNetwork = network || getCurrentNetwork();
    const packageId = getPackageId(targetNetwork);
    const objects = await getClientForNetwork(targetNetwork).getOwnedObjects({
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
  transactionDigest?: string | null; // 從 previousTransaction 獲取
}>> {
  try {
    const targetNetwork = network || getCurrentNetwork();
    const packageId = getPackageId(targetNetwork);
    console.log(`[mintContract] Querying EntryNFTs for owner: ${ownerAddress} on ${targetNetwork}`);
    
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
      limit: 100, // 限制查詢數量，避免一次查詢過多
    });

    console.log(`[mintContract] Found ${objects.data.length} EntryNFTs`);

    const nfts = [];
    for (const obj of objects.data) {
      if (!obj.data) continue;
      
      const content = obj.data.content;
      if (content && 'fields' in content) {
        const fields = content.fields as any;
        
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
          imageUrl: fields.image_url || "",
          audioUrl: fields.audio_url || "",
          transactionDigest: transactionDigest || undefined,
        });
      }
    }

    // 按時間戳排序（最新的在前）
    nfts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`[mintContract] Processed ${nfts.length} EntryNFTs`);
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
  network?: SuiNetwork
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
  console.log(`[mintContract] getOrCreateJournal for ${walletAddress} on ${targetNetwork}`);
  
  // 1. 檢查本地存儲（使用網絡特定的鍵）
  let journalId = getJournalId(walletAddress, targetNetwork);
  if (journalId) {
      // 驗證 Journal 是否仍然存在於正確的網絡上
      try {
        const journal = await getClientForNetwork(targetNetwork).getObject({ 
          id: journalId,
          options: {
            showContent: true,
            showType: true,
          },
        });
        // 驗證對象確實存在且類型正確
        if (journal.data) {
          console.log(`[mintContract] Found existing Journal ${journalId} on ${targetNetwork}`);
          return journalId;
        }
      } catch (error: any) {
        console.warn(`[mintContract] Journal ${journalId} not found on ${targetNetwork}, clearing cache:`, error.message);
        // Journal 不存在，清除本地存儲
        clearJournalId(walletAddress);
        journalId = null;
      }
  }

  // 2. 查詢鏈上（在正確的網絡上）
  journalId = await queryJournalByOwner(walletAddress, targetNetwork);
  if (journalId) {
    console.log(`[mintContract] Found Journal ${journalId} on-chain for ${targetNetwork}`);
    saveJournalId(walletAddress, journalId, targetNetwork);
    return journalId;
  }

  // 3. 創建新的 Journal（在正確的網絡上）
  try {
    console.log(`[mintContract] Creating new Journal on ${targetNetwork}...`);
    journalId = await createJournal(signAndExecute, walletAddress, targetNetwork);
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
export async function createJournal(signAndExecute: any, sender?: string, network?: SuiNetwork): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();
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
        full = await getClientForNetwork(targetNetwork).getTransactionBlock({
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
  network?: SuiNetwork
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
        full = await getClientForNetwork(currentNetwork).getTransactionBlock({
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
