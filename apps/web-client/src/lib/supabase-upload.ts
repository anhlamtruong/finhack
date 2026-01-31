import axios from "axios";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANION_BUCKET = process.env.SUPABASE_COMPANION_BUCKET || "companions";

if (!SUPABASE_URL) {
  console.warn("[supabase-upload] SUPABASE_URL is not set");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[supabase-upload] SUPABASE_SERVICE_ROLE_KEY is not set");
}

export type UploadArgs = {
  path: string;
  data: Uint8Array | ArrayBuffer;
  contentType: string;
};

export async function uploadToCompanionBucket(args: UploadArgs) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for upload",
    );
  }

  const uploadUrl =
    `${SUPABASE_URL}/storage/v1/object/${COMPANION_BUCKET}/${args.path}`;

  const body = args.data instanceof ArrayBuffer
    ? args.data
    : args.data.byteOffset === 0 &&
        args.data.byteLength === args.data.buffer.byteLength
    ? args.data.buffer
    : args.data.buffer.slice(
      args.data.byteOffset,
      args.data.byteOffset + args.data.byteLength,
    );

  try {
    await axios.post(uploadUrl, body, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": args.contentType,
        "x-upsert": "true",
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const data = error.response?.data;
      const message = typeof data === "string"
        ? data
        : JSON.stringify(data ?? "");
      throw new Error(`Supabase upload failed (${status}): ${message}`);
    }
    throw error;
  }

  const publicUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${COMPANION_BUCKET}/${args.path}`;
  return { publicUrl };
}

export function inferExtension(contentType: string) {
  const ct = contentType.split(";")[0].toLowerCase();
  if (ct.includes("svg")) return "svg";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("webp")) return "webp";
  return "bin";
}

export function parseDataUrl(source: string) {
  const match = /^data:(.+?);base64,(.*)$/.exec(source);
  if (!match) return null;
  const [, mime, b64] = match;
  return {
    contentType: mime,
    buffer: new Uint8Array(Buffer.from(b64, "base64")),
  };
}
