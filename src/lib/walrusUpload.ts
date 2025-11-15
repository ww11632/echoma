// 超簡版：專門上傳圖片 / 音檔檔案到 Walrus
const WALRUS_PUBLISHER_URL = "https://upload-relay.testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = "https://aggregator.testnet.walrus.space";
const DEFAULT_EPOCHS = 5;

export async function uploadMediaFileToWalrus(
  file: File,
  epochs: number = DEFAULT_EPOCHS
): Promise<{
  blobId: string;
  walrusUrl: string;
  mime: string;
  size: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const res = await fetch(
    `${WALRUS_PUBLISHER_URL}/v1/store?epochs=${epochs}`,
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
    walrusUrl: `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}
