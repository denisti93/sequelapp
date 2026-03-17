import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};
const PROFILE_IMAGE_ROUTE_PREFIX = '/uploads/profiles/';

let cachedS3Client = null;

function assertS3Configured() {
  if (!env.awsRegion || !env.awsS3Bucket || !env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error(
      'Upload de imagem nao configurado. Defina AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.'
    );
  }
}

function getS3Client() {
  if (cachedS3Client) {
    return cachedS3Client;
  }

  assertS3Configured();

  cachedS3Client = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
      ...(env.awsSessionToken ? { sessionToken: env.awsSessionToken } : {})
    }
  });

  return cachedS3Client;
}

function normalizePrefix(prefix) {
  return String(prefix || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function parseProfileImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new Error('Envie uma imagem valida em formato base64.');
  }

  const normalized = dataUrl.trim();
  const match = normalized.match(DATA_URL_PATTERN);

  if (!match) {
    throw new Error('Formato de imagem invalido. Use JPG, PNG ou WEBP.');
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const extension = ALLOWED_MIME_TO_EXT[mimeType];
  const buffer = Buffer.from(base64Data, 'base64');

  if (!buffer.length) {
    throw new Error('A imagem enviada esta vazia.');
  }

  if (buffer.length > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('A imagem deve ter no maximo 2MB.');
  }

  return { buffer, extension, mimeType };
}

function buildObjectKeyAndFilename(userId, extension) {
  const prefix = normalizePrefix(env.awsS3ProfilePrefix || 'profile_image');
  const filename = `user-${String(userId)}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  return {
    filename,
    objectKey: prefix ? `${prefix}/${filename}` : filename
  };
}

function objectKeyFromFilename(filename) {
  const prefix = normalizePrefix(env.awsS3ProfilePrefix || 'profile_image');
  return prefix ? `${prefix}/${filename}` : filename;
}

function isValidFilename(filename) {
  return /^[A-Za-z0-9._-]+$/.test(String(filename || ''));
}

function extractFilenameFromRoutePath(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith(PROFILE_IMAGE_ROUTE_PREFIX)) {
    const filename = decodeURIComponent(normalized.slice(PROFILE_IMAGE_ROUTE_PREFIX.length));
    return isValidFilename(filename) ? filename : null;
  }

  try {
    const url = new URL(normalized);
    const path = decodeURIComponent(url.pathname || '');
    if (!path.startsWith(PROFILE_IMAGE_ROUTE_PREFIX)) {
      return null;
    }

    const filename = path.slice(PROFILE_IMAGE_ROUTE_PREFIX.length);
    return isValidFilename(filename) ? filename : null;
  } catch {
    return null;
  }
}

function extractObjectKeyFromPublicPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') {
    return null;
  }

  const normalized = publicPath.trim();
  if (!normalized) {
    return null;
  }

  const routeFilename = extractFilenameFromRoutePath(normalized);
  if (routeFilename) {
    return objectKeyFromFilename(routeFilename);
  }

  const expectedBase = env.awsS3PublicBaseUrl?.replace(/\/+$/, '') || '';
  if (expectedBase && normalized.startsWith(`${expectedBase}/`)) {
    return decodeURIComponent(normalized.slice(expectedBase.length + 1));
  }

  try {
    const url = new URL(normalized);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key) {
      return null;
    }

    if (url.hostname === `${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com`) {
      return key;
    }

    if (url.hostname.startsWith(`${env.awsS3Bucket}.s3.`)) {
      return key;
    }
  } catch {
    // Ignora valores que nao sao URL.
  }

  const normalizedPrefix = normalizePrefix(env.awsS3ProfilePrefix || 'profile_image');
  if (normalizedPrefix && normalized.startsWith(`${normalizedPrefix}/`)) {
    return normalized;
  }

  return null;
}

export async function saveProfileImageFromDataUrl(userId, dataUrl) {
  const s3Client = getS3Client();
  const { buffer, extension, mimeType } = parseProfileImageDataUrl(dataUrl);
  const { filename, objectKey } = buildObjectKeyAndFilename(userId, extension);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable'
    })
  );

  return `${PROFILE_IMAGE_ROUTE_PREFIX}${filename}`;
}

export async function removeProfileImageByPublicPath(publicPath) {
  const objectKey = extractObjectKeyFromPublicPath(publicPath);
  if (!objectKey) {
    return;
  }

  const s3Client = getS3Client();
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: objectKey
    })
  );
}

export function validateProfileImageFilename(filename) {
  return isValidFilename(filename);
}

export async function getProfileImageObjectByFilename(filename) {
  if (!isValidFilename(filename)) {
    return null;
  }

  const objectKey = objectKeyFromFilename(filename);
  const s3Client = getS3Client();

  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.awsS3Bucket,
        Key: objectKey
      })
    );

    const contentType =
      (typeof result.ContentType === 'string' && result.ContentType) ||
      EXT_TO_MIME[String(filename).split('.').pop()?.toLowerCase()] ||
      'application/octet-stream';

    return {
      body: result.Body,
      contentType,
      cacheControl:
        (typeof result.CacheControl === 'string' && result.CacheControl) ||
        'public, max-age=31536000, immutable'
    };
  } catch (error) {
    const code = error?.name || error?.Code || '';
    const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
    if (code === 'NoSuchKey' || code === 'NotFound' || statusCode === 404) {
      return null;
    }
    throw error;
  }
}
