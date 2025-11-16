/**
 * 檢查 Mainnet 合約部署狀態的 Node.js 腳本
 * 使用方式: node scripts/check-mainnet-contract.js
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const MAINNET_PACKAGE_ID = process.env.MAINNET_PACKAGE_ID || 
  "0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9";

async function checkMainnetContract() {
  console.log("🔍 檢查 Sui Mainnet 合約部署狀態...\n");
  console.log(`Package ID: ${MAINNET_PACKAGE_ID}`);
  console.log(`Network: mainnet\n`);

  const client = new SuiClient({
    url: getFullnodeUrl("mainnet"),
  });

  try {
    console.log("正在檢查合約...");
    const packageObject = await client.getObject({
      id: MAINNET_PACKAGE_ID,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    });

    if (packageObject.data) {
      console.log("✅ 合約已部署到 Mainnet！\n");
      console.log("合約信息:");
      console.log(`  Object ID: ${packageObject.data.objectId}`);
      console.log(`  Type: ${packageObject.data.type}`);
      
      if (packageObject.data.content && "fields" in packageObject.data.content) {
        const fields = packageObject.data.content.fields;
        console.log(`  Version: ${fields.version || "N/A"}`);
        if (fields.publisher) {
          console.log(`  Publisher: ${fields.publisher}`);
        }
      }
      
      console.log(`\n🌐 在瀏覽器查看:`);
      console.log(`https://suiexplorer.com/?network=mainnet&object=${MAINNET_PACKAGE_ID}`);
      
      return true;
    } else {
      console.log("❌ 合約未找到");
      return false;
    }
  } catch (error) {
    if (error.message?.includes("not found") || error.message?.includes("Object not found")) {
      console.log("❌ 合約未部署到 Mainnet");
      console.log("\n📝 部署步驟:");
      console.log("1. 確保已切換到 mainnet: sui client switch --env mainnet");
      console.log("2. 進入合約目錄: cd nft_mint_test");
      console.log("3. 編譯合約: sui move build");
      console.log("4. 發布合約到 mainnet: sui client publish --gas-budget 100000000");
      console.log("5. 更新代碼中的 MAINNET_PACKAGE_ID");
      console.log("\n⚠️  注意：Mainnet 需要真實的 SUI 代幣支付 gas 費用");
      return false;
    } else {
      console.error("❌ 檢查合約時發生錯誤:", error.message);
      throw error;
    }
  }
}

// 執行檢查
checkMainnetContract()
  .then((deployed) => {
    process.exit(deployed ? 0 : 1);
  })
  .catch((error) => {
    console.error("錯誤:", error);
    process.exit(1);
  });

