import { getCurrentNetwork, getNetworkConfig, type SuiNetwork } from "./networkConfig";

const DEFAULT_EPOCHS = 5;

export async function uploadMediaFileToWalrus(
  file: File,
  epochs: number = DEFAULT_EPOCHS,
  network?: SuiNetwork
): Promise<{
  blobId: string;
  walrusUrl: string;
  mime: string;
  size: number;
}> {
  const targetNetwork = network || getCurrentNetwork();
  const config = getNetworkConfig(targetNetwork);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const res = await fetch(
    `${config.walrusUploadRelay}/v1/store?epochs=${epochs}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[Walrus media upload error]", res.status, text);
    throw new Error("媒體檔上傳 Walrus 失敗，請稍後再試。");
  }

  const json = await res.json();

  const blobId =
    json?.alreadyCertified?.blobId ??
    json?.newlyCreated?.blobObject?.blobId ??
    null;

  if (!blobId || typeof blobId !== "string") {
    throw new Error("Walrus 回傳格式異常，沒有 blobId");
  }

  return {
    blobId,
    walrusUrl: `${config.walrusAggregator}/v1/${blobId}`,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}
