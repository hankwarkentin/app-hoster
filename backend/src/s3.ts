import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({
	region: 'us-east-1',
	endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
	},
	forcePathStyle: true,
});
const bucketName = process.env.S3_BUCKET || 'app-bucket';

const TEST_LOCAL_S3_DIR = path.join(process.cwd(), 'backend', 'local_s3');

export async function uploadFileToS3(key: string, filePath: string) {
	// During tests, avoid network S3 calls — copy file to a local folder
	if (process.env.NODE_ENV === 'test') {
		fs.mkdirSync(TEST_LOCAL_S3_DIR, { recursive: true });
		const dest = path.join(TEST_LOCAL_S3_DIR, key);
		fs.copyFileSync(filePath, dest);
		return;
	}

	return new Promise<void>((resolve, reject) => {
		const fileStream = fs.createReadStream(filePath);
		fileStream.on('error', (err) => {
			reject(err);
		});
		const command = new PutObjectCommand({
			Bucket: bucketName,
			Key: key,
			Body: fileStream,
		});
		s3.send(command).then(() => resolve()).catch(reject);
	});
}

export async function getFileFromS3(key: string) {
	if (process.env.NODE_ENV === 'test') {
		const p = path.join(TEST_LOCAL_S3_DIR, key);
		if (!fs.existsSync(p)) {
			throw new Error('File not found in local S3');
		}
		const body = fs.createReadStream(p);
		return { Body: body } as any;
	}
	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	return s3.send(command);
}
