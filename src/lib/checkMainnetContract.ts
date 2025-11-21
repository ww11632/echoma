/**
 * 檢查 Mainnet 合約的工具函數
 * 可以在瀏覽器控制台中使用
 */

import { checkMainnetContract, getPackageId } from "./mintContract";

/**
 * 在瀏覽器控制台中檢查 Mainnet 合約
 * 使用方式: 在瀏覽器控制台中輸入
 *   import { checkMainnetInConsole } from './lib/checkMainnetContract'
 *   或直接調用 window.checkMainnetContract()
 */
export async function checkMainnetInConsole() {
  console.log("🔍 開始檢查 Mainnet 合約...\n");
  
  try {
    const result = await checkMainnetContract();
    
    console.log("📊 檢查結果:");
    console.log(`  Package ID: ${result.packageId}`);
    console.log(`  部署狀態: ${result.deployed ? "✅ 已部署" : "❌ 未部署"}`);
    
    if (result.deployed && result.details) {
      console.log("\n📋 合約詳情:");
      console.log(`  Object ID: ${result.details.objectId || "N/A"}`);
      console.log(`  Version: ${result.details.version || "N/A"}`);
      console.log(`  Publisher: ${result.details.publisher || "N/A"}`);
      console.log(`\n🌐 瀏覽器查看:`);
      console.log(`  ${result.details.explorerUrl}`);
    } else if (!result.deployed) {
      console.log("\n⚠️  合約未部署到 Mainnet");
      console.log("\n📝 部署步驟:");
      console.log("1. 確保已切換到 mainnet: sui client switch --env mainnet");
      console.log("2. 進入合約目錄: cd nft_mint_test");
      console.log("3. 編譯合約: sui move build");
      console.log("4. 發布合約到 mainnet: sui client publish --gas-budget 100000000");
      console.log("5. 更新代碼中的 MAINNET_PACKAGE_ID");
      console.log("\n⚠️  注意：Mainnet 需要真實的 SUI 代幣支付 gas 費用");
    }
    
    return result;
  } catch (error: any) {
    console.error("❌ 檢查合約時發生錯誤:", error.message);
    throw error;
  }
}

// 如果在瀏覽器環境中，將函數暴露到 window 對象
if (typeof window !== "undefined") {
  (window as any).checkMainnetContract = checkMainnetInConsole;
  console.log("💡 提示: 可以在控制台中使用 window.checkMainnetContract() 來檢查 Mainnet 合約");
}






