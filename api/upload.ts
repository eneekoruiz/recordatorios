import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Configuration for AWS S3 or Cloudflare R2
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // e.g. https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileBase64, mimeType, extension } = req.body;
    
    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing file payload' });
    }

    // Convert Base64 back to Buffer
    const buffer = Buffer.from(fileBase64, 'base64');
    const fileName = `attachments/${uuidv4()}.${extension || 'jpg'}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'my-app-bucket',
      Key: fileName,
      Body: buffer,
      ContentType: mimeType || 'image/jpeg',
    });

    await s3Client.send(command);

    // Assuming public bucket or custom domain configured in R2
    const publicUrl = `${process.env.S3_PUBLIC_DOMAIN}/${fileName}`;

    return res.status(200).json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
