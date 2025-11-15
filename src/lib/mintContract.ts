// src/lib/nftContract.ts
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { client } from "./suiClient";

// 常數（換成你的合約資訊）
const PACKAGE_ID =
  "0x164946ea72fa61a075956caaf80bde3a75fd2feb90a903f1bac8441830cba248";
const MODULE = "diary";
const CLOCK_ID = "0x6";

// 建立 Journal
export async function createJournal(signAndExecute: any) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::create_journal`,
    arguments: [],
  });

  const result = await signAndExecute({ transaction: tx, chain: "sui:devnet" });
  const full = await client.getTransactionBlock({
    digest: result.digest!,
    options: { showObjectChanges: true },
  });

  const created = full.objectChanges?.find(
    (o: any) =>
      o.type === "created" &&
      o.objectType.endsWith("::diary::Journal")
  ) as any;

  return created?.objectId ?? null;
}

// 鑄造 Entry NFT
export async function mintEntry(
  signAndExecute: any,
  journalId: string,
  moodScore: number,
  moodText: string,
  tagsCsv: string,
  imageUrl: string,
  imageMime: string
) {
  const tx = new TransactionBlock();
  const dummySha = new Uint8Array([0x12, 0x34]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::mint_entry`,
    arguments: [
      tx.object(journalId),
      tx.pure.u8(moodScore),
      tx.pure.string(moodText),
      tx.pure.string(tagsCsv),
      tx.pure.string(imageUrl),
      tx.pure.string(imageMime),
      tx.pure(dummySha),
      tx.pure.string(""),         // audio_url
      tx.pure.string(""),         // audio_mime
      tx.pure(new Uint8Array([])), // audio_sha256
      tx.pure.u64("0"),           // audio_duration
      tx.object(CLOCK_ID),
    ],
  });

  const result = await signAndExecute({ transaction: tx, chain: "sui:testnet" });
  const full = await client.getTransactionBlock({
    digest: result.digest!,
    options: { showObjectChanges: true },
  });

  const created = full.objectChanges?.find(
    (o: any) =>
      o.type === "created" &&
      o.objectType.endsWith("::diary::EntryNFT")
  ) as any;

  return created?.objectId ?? null;
}
