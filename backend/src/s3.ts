import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
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
	maxAttempts: 1,
	requestHandler: new NodeHttpHandler({
		// requestTimeout in ms — allow longer duration for large uploads to localstack
		requestTimeout: 120000,
	}),
});
const bucketName = process.env.S3_BUCKET || 'app-bucket';
export const iconBucketName = process.env.S3_ICON_BUCKET || 'app-icon-bucket';

export async function uploadFileToS3(key: string, filePath: string) {
	// Read the file into memory and upload as a single PutObject call.
	const body = await fs.promises.readFile(filePath);
	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		Body: body,
	});
	await s3.send(command);
}

export async function uploadIconToS3(key: string, filePath: string) {
	const body = await fs.promises.readFile(filePath);
	const command = new PutObjectCommand({
		Bucket: iconBucketName,
		Key: key,
		Body: body,
	});
	await s3.send(command);
}

export async function getFileFromS3(key: string, bucket: string = bucketName) {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});
	return s3.send(command);
}
