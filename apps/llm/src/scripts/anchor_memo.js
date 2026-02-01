const fs = require("fs");
const crypto = require("crypto");
const {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  TransactionInstruction,
} = require("@solana/web3.js");

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function main() {
  const payload = process.argv[2];
  if (!payload) {
    console.error("Usage: node scripts/anchor_memo.js '<json-payload>'");
    process.exit(1);
  }

  const hash = sha256Hex(payload);

  const secret = JSON.parse(fs.readFileSync(process.env.HOME + "/solana/devnet-keypair.json", "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`finhack:${hash}`), // keep it short
  });

  const tx = new Transaction().add(memoIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log(JSON.stringify({ hash, signature: sig }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});