const { CosmosClient } = require('@azure/cosmos');

let client = null;
let database = null;
let containers = {};

// In-memory fallback for local development without Cosmos DB
const inMemoryStore = {
  creators: [],
  reviewers: [],
  reviewerAssignments: [],
  sessions: [],
  images: [],
  submissions: [],
};

const USE_MEMORY = !process.env.COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT.includes('your-account');

/**
 * Initialize Cosmos DB connection
 */
async function initDatabase() {
  if (USE_MEMORY) {
    console.log('[DB] Using in-memory store (no Cosmos DB configured)');
    return;
  }

  client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });

  const dbName = process.env.COSMOS_DATABASE || 'creativeswipe';
  const { database: db } = await client.databases.createIfNotExists({ id: dbName });
  database = db;

  // Create containers
  const containerDefs = [
    { id: 'creators', partitionKey: '/id' },
    { id: 'reviewers', partitionKey: '/id' },
    { id: 'reviewerAssignments', partitionKey: '/reviewerId' },
    { id: 'sessions', partitionKey: '/creatorId' },
    { id: 'images', partitionKey: '/sessionId' },
    { id: 'submissions', partitionKey: '/sessionId' },
  ];

  for (const def of containerDefs) {
    const { container } = await database.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey] },
    });
    containers[def.id] = container;
  }

  console.log('[DB] Cosmos DB initialized');
}

// ── CRUD Operations ──

async function createItem(containerName, item) {
  if (USE_MEMORY) {
    inMemoryStore[containerName].push(item);
    return item;
  }
  const { resource } = await containers[containerName].items.create(item);
  return resource;
}

async function getItem(containerName, id, partitionKey) {
  if (USE_MEMORY) {
    return inMemoryStore[containerName].find((i) => i.id === id) || null;
  }
  try {
    const { resource } = await containers[containerName].item(id, partitionKey).read();
    return resource;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function queryItems(containerName, query, parameters = []) {
  if (USE_MEMORY) {
    // Simple in-memory query support
    return inMemoryStore[containerName].filter((item) => {
      return parameters.every((param) => {
        const key = param.name.replace('@', '');
        return item[key] === param.value;
      });
    });
  }
  const { resources } = await containers[containerName].items
    .query({ query, parameters })
    .fetchAll();
  return resources;
}

async function updateItem(containerName, id, partitionKey, updates) {
  if (USE_MEMORY) {
    const idx = inMemoryStore[containerName].findIndex((i) => i.id === id);
    if (idx >= 0) {
      inMemoryStore[containerName][idx] = { ...inMemoryStore[containerName][idx], ...updates };
      return inMemoryStore[containerName][idx];
    }
    return null;
  }
  const { resource: existing } = await containers[containerName].item(id, partitionKey).read();
  const updated = { ...existing, ...updates };
  const { resource } = await containers[containerName].item(id, partitionKey).replace(updated);
  return resource;
}

async function deleteItem(containerName, id, partitionKey) {
  if (USE_MEMORY) {
    inMemoryStore[containerName] = inMemoryStore[containerName].filter((i) => i.id !== id);
    return true;
  }
  await containers[containerName].item(id, partitionKey).delete();
  return true;
}

// ── Specialized Queries ──

async function getSessionsByCreator(creatorId) {
  if (USE_MEMORY) {
    return inMemoryStore.sessions.filter((s) => s.creatorId === creatorId);
  }
  return queryItems('sessions', 'SELECT * FROM c WHERE c.creatorId = @creatorId', [
    { name: '@creatorId', value: creatorId },
  ]);
}

async function getImagesBySession(sessionId) {
  if (USE_MEMORY) {
    return inMemoryStore.images
      .filter((i) => i.sessionId === sessionId)
      .sort((a, b) => a.order - b.order);
  }
  const items = await queryItems('images', 'SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c["order"]', [
    { name: '@sessionId', value: sessionId },
  ]);
  return items;
}

async function getSubmissionsBySession(sessionId) {
  if (USE_MEMORY) {
    return inMemoryStore.submissions.filter((s) => s.sessionId === sessionId);
  }
  return queryItems('submissions', 'SELECT * FROM c WHERE c.sessionId = @sessionId', [
    { name: '@sessionId', value: sessionId },
  ]);
}

async function getSubmissionsByReviewerEmail(reviewerEmail) {
  const normalizedEmail = String(reviewerEmail || '').toLowerCase().trim();
  if (!normalizedEmail) return [];

  if (USE_MEMORY) {
    return inMemoryStore.submissions.filter(
      (submission) => String(submission.reviewerEmail || '').toLowerCase().trim() === normalizedEmail
    );
  }

  return queryItems(
    'submissions',
    'SELECT * FROM c WHERE c.reviewerEmail = @reviewerEmail',
    [{ name: '@reviewerEmail', value: normalizedEmail }]
  );
}

async function getSubmissionsByReviewerName(reviewerName) {
  const normalizedName = String(reviewerName || '').trim();
  if (!normalizedName) return [];

  if (USE_MEMORY) {
    return inMemoryStore.submissions.filter(
      (submission) => String(submission.reviewerName || '').trim() === normalizedName
    );
  }

  return queryItems(
    'submissions',
    'SELECT * FROM c WHERE c.reviewerName = @reviewerName',
    [{ name: '@reviewerName', value: normalizedName }]
  );
}

async function getSubmissionByReviewer(sessionId, reviewerName) {
  if (USE_MEMORY) {
    return inMemoryStore.submissions.find(
      (s) => s.sessionId === sessionId && s.reviewerName === reviewerName
    ) || null;
  }
  const items = await queryItems(
    'submissions',
    'SELECT * FROM c WHERE c.sessionId = @sessionId AND c.reviewerName = @reviewerName',
    [
      { name: '@sessionId', value: sessionId },
      { name: '@reviewerName', value: reviewerName },
    ]
  );
  return items[0] || null;
}

async function getSubmissionByReviewerEmail(sessionId, reviewerEmail) {
  const normalizedEmail = String(reviewerEmail || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  if (USE_MEMORY) {
    return inMemoryStore.submissions.find(
      (s) => s.sessionId === sessionId && String(s.reviewerEmail || '').toLowerCase().trim() === normalizedEmail
    ) || null;
  }

  const items = await queryItems(
    'submissions',
    'SELECT * FROM c WHERE c.sessionId = @sessionId AND c.reviewerEmail = @reviewerEmail',
    [
      { name: '@sessionId', value: sessionId },
      { name: '@reviewerEmail', value: normalizedEmail },
    ]
  );
  return items[0] || null;
}

async function getCreatorByEmail(email) {
  if (USE_MEMORY) {
    return inMemoryStore.creators.find((c) => c.email === email) || null;
  }
  const items = await queryItems('creators', 'SELECT * FROM c WHERE c.email = @email', [
    { name: '@email', value: email },
  ]);
  return items[0] || null;
}

async function getReviewerByEmail(email) {
  if (USE_MEMORY) {
    return inMemoryStore.reviewers.find((r) => r.email === email) || null;
  }
  const items = await queryItems('reviewers', 'SELECT * FROM c WHERE c.email = @email', [
    { name: '@email', value: email },
  ]);
  return items[0] || null;
}

async function getReviewerAssignments(reviewerId) {
  if (USE_MEMORY) {
    return inMemoryStore.reviewerAssignments.filter((a) => a.reviewerId === reviewerId);
  }
  return queryItems(
    'reviewerAssignments',
    'SELECT * FROM c WHERE c.reviewerId = @reviewerId',
    [{ name: '@reviewerId', value: reviewerId }]
  );
}

async function getReviewerAssignment(reviewerId, sessionId) {
  if (USE_MEMORY) {
    return inMemoryStore.reviewerAssignments.find(
      (a) => a.reviewerId === reviewerId && a.sessionId === sessionId
    ) || null;
  }
  const items = await queryItems(
    'reviewerAssignments',
    'SELECT * FROM c WHERE c.reviewerId = @reviewerId AND c.sessionId = @sessionId',
    [
      { name: '@reviewerId', value: reviewerId },
      { name: '@sessionId', value: sessionId },
    ]
  );
  return items[0] || null;
}

module.exports = {
  initDatabase,
  createItem,
  getItem,
  queryItems,
  updateItem,
  deleteItem,
  getSessionsByCreator,
  getImagesBySession,
  getSubmissionsBySession,
  getSubmissionsByReviewerEmail,
  getSubmissionsByReviewerName,
  getSubmissionByReviewer,
  getSubmissionByReviewerEmail,
  getCreatorByEmail,
  getReviewerByEmail,
  getReviewerAssignments,
  getReviewerAssignment,
};
