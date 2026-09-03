import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOADS_DIR = path.resolve(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function uploadFile(
  filePath: string,
  fileName: string
): Promise<{ url: string; isCloudinary: boolean }> {
  // If Cloudinary configured, upload to Cloudinary
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'auto',
        folder: 'docforensic_uploads',
      });
      return { url: result.secure_url, isCloudinary: true };
    } catch (error) {
      console.warn('[Storage] Cloudinary upload failed, falling back to local storage:', error);
    }
  }

  // Fallback: Copy to public uploads directory
  const destPath = path.join(UPLOADS_DIR, fileName);
  fs.copyFileSync(filePath, destPath);
  const port = process.env.PORT || 4000;
  const localUrl = `http://localhost:${port}/uploads/${encodeURIComponent(fileName)}`;
  return { url: localUrl, isCloudinary: false };
}
