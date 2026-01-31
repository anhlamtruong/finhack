"use server";

import { uploadToCompanionBucket } from "@/lib/supabase-upload";
import { v4 as uuidv4 } from "uuid";

export async function uploadFileAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file found.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const ext = file.name.split(".").pop();
    const fileName = `${uuidv4()}.${ext}`;

    const { publicUrl } = await uploadToCompanionBucket({
      path: fileName,
      data: buffer,
      contentType: file.type,
    });

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error("Upload failed:", error);
    return { success: false, error: "Failed to upload file" };
  }
}
