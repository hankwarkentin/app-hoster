import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

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

export async function uploadFileToS3(key: string, filePath: string) {
	const fileStream = fs.createReadStream(filePath);
	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		Body: fileStream,
	});
	await s3.send(command);
}

export async function getFileFromS3(key: string) {
	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	return s3.send(command);
}
