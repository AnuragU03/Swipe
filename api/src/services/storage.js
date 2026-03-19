const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

let blobServiceClient = null;
let containerClient = null;

// In-memory fallback for local dev
const inMemoryBlobs = new Map();
const USE_MEMORY = !process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.AZURE_STORAGE_CONNECTION_STRING === 'UseDevelopmentStorage=true';

/**
 * Initialize Azure Blob Storage connection
 */
async function initStorage() {
  if (USE_MEMORY) {
    console.log('[Storage] Using in-memory blob store (no Azure Storage configured)');
    return;
  }

  blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  const containerName = process.env.AZURE_STORAGE_CONTAINER || 'creatives';
  containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({
    access: undefined, // Private — no anonymous access
  });

  console.log('[Storage] Azure Blob Storage initialized');
}

/**
 * Upload an image to blob storage
 * @returns {{ blobUrl: string, blobName: string }}
 */
async function uploadImage(sessionId, fileName, buffer, contentType) {
  const ext = path.extname(fileName) || '.jpg';
  const blobName = `${sessionId}/${uuidv4()}${ext}`;

  if (USE_MEMORY) {
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    inMemoryBlobs.set(blobName, { data: dataUrl, contentType });
    return {
      blobUrl: `/api/images/blob/${blobName}`,
      blobName,
    };
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });

  return {
    blobUrl: blockBlobClient.url,
    blobName,
  };
}

/**
 * Generate a signed URL for an image (15-minute expiry)
 */
function generateSignedUrl(blobName, expiryMinutes = 15) {
  if (USE_MEMORY) {
    const blob = inMemoryBlobs.get(blobName);
    return blob ? blob.data : null;
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Parse connection string to get account name and key
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const accountName = connStr.match(/AccountName=([^;]+)/)?.[1];
  const accountKey = connStr.match(/AccountKey=([^;]+)/)?.[1];

  if (!accountName || !accountKey) {
    return blockBlobClient.url;
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const sasToken = generateBlobSASQueryParameters({
    containerName: process.env.AZURE_STORAGE_CONTAINER || 'creatives',
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn,
  }, sharedKeyCredential).toString();

  return `${blockBlobClient.url}?${sasToken}`;
}

/**
 * Delete a blob
 */
async function deleteBlob(blobName) {
  if (USE_MEMORY) {
    inMemoryBlobs.delete(blobName);
    return;
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * Get blob data (for in-memory serving)
 */
function getBlobData(blobName) {
  return inMemoryBlobs.get(blobName) || null;
}

module.exports = {
  initStorage,
  uploadImage,
  generateSignedUrl,
  deleteBlob,
  getBlobData,
};
