import fs from 'fs';
import path from 'path';

const uploadDir = path.join(new URL('.', import.meta.url).pathname, '../uploads');

export function saveLocalFile(file: Express.Multer.File): string {
  const dest = path.join(uploadDir, file.originalname);
  fs.copyFileSync(file.path, dest);
  return dest;
}

export function getLocalFilePath(filename: string): string {
  return path.join(uploadDir, filename);
}
