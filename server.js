const express = require('express');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const {
  generateCreatorToken,
  generateReviewerToken,
  generateReviewerAccountToken,
  verifyToken,
  extractToken: extractTokenSvc,
} = require('./api/src/services/tokenService');
const db = require('./api/src/services/database');
const storage = require('./api/src/services/storage');
const { generateExport } = require('./api/src/services/exportService');

const app = express();
const PORT = process.env.PORT || 8080;
app.set('trust proxy', true);

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use((req, res, next) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const originalHost = req.headers['x-original-host'];
  const directHost = req.headers.host;
  const candidate = [forwardedHost, originalHost, directHost, req.hostname].find(Boolean);
  const host = String(candidate || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .split(':')[0];

  if (host === 'www.giggidy.work') {
    const target = `https://giggidy.work${req.originalUrl || '/'}`;
    return res.redirect(301, target);
  }

  return next();
});

// ── Auth helpers ──
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function requireCreator(req) {
  const token = extractToken(req);
  if (!token) return { valid: false, status: 401, error: 'Authentication required' };
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'creator')
    return { valid: false, status: 403, error: 'Creator access required' };
  return { valid: true, creator: decoded };
}

function requireReviewer(req, sessionId) {
  const token = extractToken(req);
  if (!token) return { valid: false, status: 401, error: 'Authentication required' };
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'reviewer')
    return { valid: false, status: 403, error: 'Reviewer access required' };
  if (decoded.sessionId !== sessionId)
    return { valid: false, status: 403, error: 'Token not valid for this session' };
  return { valid: true, reviewer: decoded };
}

function requireReviewerAccount(req) {
  const token = extractToken(req);
  if (!token) return { valid: false, status: 401, error: 'Authentication required' };
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'reviewerAccount') {
    return { valid: false, status: 403, error: 'Reviewer account access required' };
  }
  return { valid: true, reviewer: decoded };
}

function makeScopedId(prefix, source = '') {
  const slug = (source || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'default';
  return `${prefix}_${slug}_${uuidv4().slice(0, 8)}`;
}

function normalizeEmail(value = '') {
  return String(value || '').toLowerCase().trim();
}

function toReviewerContact(input = {}) {
  const email = normalizeEmail(input.email || input.reviewerEmail);
  const name = String(input.name || input.reviewerName || '').trim();
  if (!email) return null;
  return { email, name: name || email.split('@')[0] };
}

function mergeReviewerContacts(...lists) {
  const merged = new Map();
  lists.flat().forEach((item) => {
    const contact = toReviewerContact(item);
    if (!contact) return;
    if (!merged.has(contact.email)) {
      merged.set(contact.email, contact);
      return;
    }
    const existing = merged.get(contact.email);
    if (!existing.name && contact.name) {
      merged.set(contact.email, contact);
    }
  });
  return Array.from(merged.values());
}

async function getReviewerOrCreatorById(userId) {
  const reviewer = await db.getItem('reviewers', userId, userId);
  if (reviewer) {
    return {
      id: reviewer.id,
      email: reviewer.email,
      name: reviewer.name,
      source: 'reviewer',
      passwordHash: reviewer.passwordHash,
    };
  }

  const creator = await db.getItem('creators', userId, userId);
  if (creator) {
    return {
      id: creator.id,
      email: creator.email,
      name: creator.name,
      source: 'creator',
      passwordHash: creator.passwordHash,
    };
  }

  return null;
}

async function getReviewerOrCreatorByEmail(email) {
  const reviewer = await db.getReviewerByEmail(email);
  if (reviewer) {
    return {
      id: reviewer.id,
      email: reviewer.email,
      name: reviewer.name,
      source: 'reviewer',
      passwordHash: reviewer.passwordHash,
    };
  }

  const creator = await db.getCreatorByEmail(email);
  if (creator) {
    return {
      id: creator.id,
      email: creator.email,
      name: creator.name,
      source: 'creator',
      passwordHash: creator.passwordHash,
    };
  }

  return null;
}

async function deleteSessionCascade(sessionId, creatorId) {
  const [images, submissions, assignments] = await Promise.all([
    db.getImagesBySession(sessionId),
    db.getSubmissionsBySession(sessionId),
    db.queryItems(
      'reviewerAssignments',
      'SELECT * FROM c WHERE c.sessionId = @sessionId',
      [{ name: '@sessionId', value: sessionId }]
    ),
  ]);

  await Promise.all([
    ...images.map(async (img) => {
      if (img.blobName) {
        await storage.deleteBlob(img.blobName);
      }
      return db.deleteItem('images', img.id, img.sessionId);
    }),
    ...submissions.map((sub) => db.deleteItem('submissions', sub.id, sub.sessionId)),
    ...assignments.map((item) => db.deleteItem('reviewerAssignments', item.id, item.reviewerId)),
    db.deleteItem('sessions', sessionId, creatorId),
  ]);

  return {
    sessionId,
    imageCount: images.length,
    submissionCount: submissions.length,
    assignmentCount: assignments.length,
  };
}

// ── Init ──
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await db.initDatabase();
    await storage.initStorage();
    initialized = true;
    console.log('✓ Database & Storage initialized');
  }
}

// ═══════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  await ensureInit();
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const existing = await db.getCreatorByEmail(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const creator = {
      id: uuidv4(),
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    await db.createItem('creators', creator);
    const token = generateCreatorToken(creator.id, creator.email);
    res.status(201).json({ token, creator: { id: creator.id, email: creator.email, name: creator.name } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  await ensureInit();
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const creator = await db.getCreatorByEmail(email.toLowerCase().trim());
    if (!creator) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, creator.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateCreatorToken(creator.id, creator.email);
    res.json({ token, creator: { id: creator.id, email: creator.email, name: creator.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/reviewer/register
app.post('/api/reviewer/register', async (req, res) => {
  await ensureInit();
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await getReviewerOrCreatorByEmail(normalizedEmail);
    if (existing) {
      const samePassword = await bcrypt.compare(password, existing.passwordHash);
      if (!samePassword) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const token = generateReviewerAccountToken(existing.id, existing.email, existing.name);
      return res.status(200).json({
        token,
        reviewer: { id: existing.id, email: existing.email, name: existing.name },
      });
    }

    const reviewer = {
      id: uuidv4(),
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createItem('reviewers', reviewer);
    const token = generateReviewerAccountToken(reviewer.id, reviewer.email, reviewer.name);

    return res.status(201).json({
      token,
      reviewer: { id: reviewer.id, email: reviewer.email, name: reviewer.name },
    });
  } catch (err) {
    console.error('Reviewer registration error:', err);
    return res.status(500).json({ error: 'Reviewer registration failed' });
  }
});

// POST /api/reviewer/login
app.post('/api/reviewer/login', async (req, res) => {
  await ensureInit();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const account = await getReviewerOrCreatorByEmail(email.toLowerCase().trim());
    if (!account) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateReviewerAccountToken(account.id, account.email, account.name);
    return res.json({ token, reviewer: { id: account.id, email: account.email, name: account.name } });
  } catch (err) {
    console.error('Reviewer login error:', err);
    return res.status(500).json({ error: 'Reviewer login failed' });
  }
});

// GET /api/reviewer/me
app.get('/api/reviewer/me', async (req, res) => {
  await ensureInit();
  const auth = requireReviewerAccount(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const user = await getReviewerOrCreatorById(auth.reviewer.sub);
    if (!user) return res.status(404).json({ error: 'Reviewer not found' });
    return res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error('Reviewer profile error:', err);
    return res.status(500).json({ error: 'Failed to get reviewer profile' });
  }
});

// POST /api/reviewer/sessions/:id/claim
app.post('/api/reviewer/sessions/:id/claim', async (req, res) => {
  await ensureInit();
  const auth = requireReviewerAccount(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  const sessionId = req.params.id;
  try {
    const sessions = await db.queryItems('sessions', 'SELECT * FROM c WHERE c.id = @id', [{ name: '@id', value: sessionId }]);
    const session = sessions[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const existing = await db.getReviewerAssignment(auth.reviewer.sub, sessionId);
    if (!existing) {
      await db.createItem('reviewerAssignments', {
        id: uuidv4(),
        reviewerId: auth.reviewer.sub,
        sessionId,
        creatorId: session.creatorId,
        claimedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return res.json({ message: 'Session linked to reviewer account', sessionId });
  } catch (err) {
    console.error('Claim session error:', err);
    return res.status(500).json({ error: 'Failed to link session' });
  }
});

// GET /api/reviewer/sessions
app.get('/api/reviewer/sessions', async (req, res) => {
  await ensureInit();
  const auth = requireReviewerAccount(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const assignments = await db.getReviewerAssignments(auth.reviewer.sub);
    const sessions = [];

    for (const assignment of assignments) {
      const found = await db.queryItems('sessions', 'SELECT * FROM c WHERE c.id = @id', [
        { name: '@id', value: assignment.sessionId },
      ]);
      const session = found[0];
      if (!session) continue;

      const submissions = await db.getSubmissionsBySession(session.id);
      sessions.push({
        id: session.id,
        title: session.title,
        clientId: session.clientId,
        clientName: session.clientName,
        projectId: session.projectId,
        projectName: session.projectName,
        status: session.status,
        imageCount: session.imageCount || 0,
        submissionCount: submissions.length,
        updatedAt: session.updatedAt || session.createdAt,
        claimedAt: assignment.claimedAt,
      });
    }

    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return res.json({ sessions });
  } catch (err) {
    console.error('Reviewer sessions error:', err);
    return res.status(500).json({ error: 'Failed to load reviewer sessions' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const creator = await db.getItem('creators', auth.creator.sub, auth.creator.sub);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });
    res.json({ id: creator.id, email: creator.email, name: creator.name });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ═══════════════════════════════════════
// SESSION ROUTES
// ═══════════════════════════════════════

// POST /api/sessions
app.post('/api/sessions', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const {
      title,
      deadline,
      password,
      reviewerPassword,
      maxReviewers,
      clientName,
      projectName,
      clientId,
      projectId,
      expectedReviewers = [],
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Session title is required' });
    if (!clientName || !projectName) {
      return res.status(400).json({ error: 'Client and project names are required' });
    }

    const pw = reviewerPassword || password || null;
    const normalizedClientName = String(clientName).trim();
    const normalizedProjectName = String(projectName).trim();
    const session = {
      id: uuidv4(),
      creatorId: auth.creator.sub,
      title,
      clientId: clientId || makeScopedId('clt', normalizedClientName),
      clientName: normalizedClientName,
      projectId: projectId || makeScopedId('prj', `${normalizedClientName}-${normalizedProjectName}`),
      projectName: normalizedProjectName,
      status: 'active',
      imageCount: 0,
      reviewerPassword: pw ? await bcrypt.hash(pw, 10) : null,
      hasPassword: !!pw,
      expectedReviewers: mergeReviewerContacts(expectedReviewers),
      maxReviewers: maxReviewers || 50,
      reviewerCount: 0,
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.createItem('sessions', session);
    res.status(201).json({
      session: { ...session, reviewerPassword: undefined },
      reviewLink: `/r/${session.id}`,
    });
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions
app.get('/api/sessions', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const sessions = await db.getSessionsByCreator(auth.creator.sub);
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (s) => {
        const [submissions, images] = await Promise.all([
          db.getSubmissionsBySession(s.id),
          db.getImagesBySession(s.id),
        ]);

        return {
          ...s,
          reviewerPassword: undefined,
          _submissions: submissions,
          submissionCount: submissions.length,
          postCount: new Set(
            images.map((img) => `${img.rowId || ''}-${Number(img.rowOrder) || 0}`).filter((key) => key !== '-0')
          ).size,
          previewImages: images.slice(0, 8).map((img) => ({
            id: img.id,
            fileName: img.fileName,
            rowId: img.rowId || null,
            rowOrder: Number(img.rowOrder) || null,
            url: storage.generateSignedUrl(img.blobName),
          })),
          reviewLink: `/r/${s.id}`,
        };
      })
    );

    const knownContactsByProject = new Map();
    const knownContactsByClient = new Map();

    sessionsWithCounts.forEach((session) => {
      const submissionContacts = (session._submissions || []).map((sub) => ({
        reviewerName: sub.reviewerName,
        reviewerEmail: sub.reviewerEmail,
      }));

      const known = mergeReviewerContacts(session.expectedReviewers || [], submissionContacts);
      if (session.projectId) {
        knownContactsByProject.set(
          session.projectId,
          mergeReviewerContacts(knownContactsByProject.get(session.projectId) || [], known)
        );
      }

      if (session.clientId) {
        knownContactsByClient.set(
          session.clientId,
          mergeReviewerContacts(knownContactsByClient.get(session.clientId) || [], known)
        );
      }
    });

    const responseSessions = sessionsWithCounts.map((session) => {
      const submittedContacts = mergeReviewerContacts(
        (session._submissions || []).map((sub) => ({
          reviewerName: sub.reviewerName,
          reviewerEmail: sub.reviewerEmail,
        }))
      );

      const knownContacts = mergeReviewerContacts(
        session.expectedReviewers || [],
        knownContactsByProject.get(session.projectId) || [],
        knownContactsByClient.get(session.clientId) || [],
        submittedContacts
      );

      const submittedByEmail = new Map(submittedContacts.map((contact) => [contact.email, contact]));
      const reviewerProgress = knownContacts.map((contact) => ({
        name: submittedByEmail.get(contact.email)?.name || contact.name,
        email: contact.email,
        status: submittedByEmail.has(contact.email) ? 'done' : 'pending',
      }));

      const { _submissions, ...sessionView } = session;
      return {
        ...sessionView,
        reviewerProgress,
      };
    });

    res.json({ sessions: responseSessions });
  } catch (err) {
    console.error('Sessions list error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/:id
app.get('/api/sessions/:id', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const session = await db.getItem('sessions', req.params.id, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const images = await db.getImagesBySession(req.params.id);
    const submissions = await db.getSubmissionsBySession(req.params.id);

    const imageStats = images.map((img) => {
      let likes = 0, dislikes = 0;
      const annotations = [];
      submissions.forEach((sub) => {
        const decision = (sub.decisions || []).find((d) => d.imageId === img.id);
        if (decision) { if (decision.liked) likes++; else dislikes++; }
        (sub.annotations || []).filter((a) => a.imageId === img.id)
          .forEach((a) => annotations.push({ ...a, reviewer: sub.reviewerName }));
      });
      return { ...img, likes, dislikes, netScore: likes - dislikes, annotations, url: storage.generateSignedUrl(img.blobName) };
    });

    res.json({
      session: { ...session, reviewerPassword: undefined, images: imageStats, submissions: submissions.map((s) => ({
        id: s.id, reviewerName: s.reviewerName, submittedAt: s.submittedAt, decisions: s.decisions,
        decisionCount: (s.decisions || []).length, annotationCount: (s.annotations || []).length,
        likeCount: (s.decisions || []).filter((d) => d.liked).length,
        dislikeCount: (s.decisions || []).filter((d) => !d.liked).length,
      })) },
      reviewLink: `/r/${session.id}`,
    });
  } catch (err) {
    console.error('Session get error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// PATCH /api/sessions/:id
app.patch('/api/sessions/:id', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const session = await db.getItem('sessions', req.params.id, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const allowedUpdates = ['status', 'title', 'maxReviewers', 'deadline'];
    const updates = { updatedAt: new Date().toISOString() };
    allowedUpdates.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    const updated = await db.updateItem('sessions', req.params.id, auth.creator.sub, updates);
    res.json({ session: { ...updated, reviewerPassword: undefined } });
  } catch (err) {
    console.error('Session update error:', err);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:id
app.delete('/api/sessions/:id', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const session = await db.getItem('sessions', req.params.id, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const deleted = await deleteSessionCascade(req.params.id, auth.creator.sub);
    res.json({
      message: 'Session deleted',
      deleted,
    });
  } catch (err) {
    console.error('Session delete error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// DELETE /api/sessions (scoped bulk delete)
app.delete('/api/sessions', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const scope = (req.query.scope || 'all').toLowerCase();
    const clientId = req.query.clientId;
    const projectId = req.query.projectId;

    const allSessions = await db.getSessionsByCreator(auth.creator.sub);

    let targets = allSessions;
    if (scope === 'client') {
      if (!clientId) return res.status(400).json({ error: 'clientId is required for client scope' });
      targets = allSessions.filter((session) => session.clientId === clientId);
    } else if (scope === 'project') {
      if (!projectId) return res.status(400).json({ error: 'projectId is required for project scope' });
      targets = allSessions.filter((session) => session.projectId === projectId);
    } else if (scope !== 'all') {
      return res.status(400).json({ error: 'Unsupported delete scope' });
    }

    const deleted = [];
    for (const session of targets) {
      const result = await deleteSessionCascade(session.id, auth.creator.sub);
      deleted.push(result);
    }

    const totals = deleted.reduce(
      (acc, item) => {
        acc.sessions += 1;
        acc.images += item.imageCount;
        acc.submissions += item.submissionCount;
        acc.assignments += item.assignmentCount;
        return acc;
      },
      { sessions: 0, images: 0, submissions: 0, assignments: 0 }
    );

    return res.json({
      message: targets.length ? 'Sessions deleted' : 'No sessions matched scope',
      scope,
      deleted,
      totals,
    });
  } catch (err) {
    console.error('Scoped delete error:', err);
    return res.status(500).json({ error: 'Failed to delete sessions' });
  }
});


// POST /api/sessions/:id/join
app.post('/api/sessions/:id/join', async (req, res) => {
  await ensureInit();
  const sessionId = req.params.id;
  const reviewerAccount = requireReviewerAccount(req);

  try {
    const sessions = await db.queryItems('sessions', 'SELECT * FROM c WHERE c.id = @id', [{ name: '@id', value: sessionId }]);
    const session = sessions[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(403).json({ error: 'This session is no longer accepting reviews' });
    if (session.deadline && new Date(session.deadline) < new Date()) return res.status(403).json({ error: 'This session has expired' });

    const { reviewerName, reviewerEmail, password } = req.body;
    const cleanedName = String(reviewerName || '').trim();
    const cleanedEmail = normalizeEmail(reviewerEmail);
    if (!cleanedName) return res.status(400).json({ error: 'Reviewer name is required' });
    if (!cleanedEmail || !/^\S+@\S+\.\S+$/.test(cleanedEmail)) {
      return res.status(400).json({ error: 'Valid reviewer email is required' });
    }

    if (session.reviewerPassword) {
      if (!password) return res.status(401).json({ error: 'This session requires a password', requiresPassword: true });
      const validPw = await bcrypt.compare(password, session.reviewerPassword);
      if (!validPw) return res.status(401).json({ error: 'Incorrect session password' });
    }

    const existingSub = await db.getSubmissionByReviewerEmail(sessionId, cleanedEmail)
      || await db.getSubmissionByReviewer(sessionId, cleanedName);
    const subs = await db.getSubmissionsBySession(sessionId);
    if (!existingSub && subs.length >= session.maxReviewers) {
      return res.status(403).json({ error: 'Maximum reviewers reached' });
    }

    const token = generateReviewerToken(sessionId, cleanedName, cleanedEmail);

    if (reviewerAccount.valid) {
      const existingAssignment = await db.getReviewerAssignment(reviewerAccount.reviewer.sub, sessionId);
      if (!existingAssignment) {
        await db.createItem('reviewerAssignments', {
          id: uuidv4(),
          reviewerId: reviewerAccount.reviewer.sub,
          sessionId,
          creatorId: session.creatorId,
          claimedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const currentExpectedReviewers = mergeReviewerContacts(session.expectedReviewers || []);
    const hasReviewer = currentExpectedReviewers.some((contact) => contact.email === cleanedEmail);
    if (!hasReviewer) {
      await db.updateItem('sessions', session.id, session.creatorId, {
        expectedReviewers: mergeReviewerContacts(currentExpectedReviewers, [{ email: cleanedEmail, name: cleanedName }]),
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ token, session: { id: session.id, title: session.title, imageCount: session.imageCount } });
  } catch (err) {
    console.error('Session join error:', err);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// GET /api/public/sessions/:id/preview
app.get('/api/public/sessions/:id/preview', async (req, res) => {
  await ensureInit();
  const sessionId = req.params.id;

  try {
    const sessions = await db.queryItems('sessions', 'SELECT * FROM c WHERE c.id = @id', [
      { name: '@id', value: sessionId },
    ]);
    const session = sessions[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const images = await db.getImagesBySession(sessionId);
    const firstImage = images[0] || null;

    return res.json({
      session: {
        id: session.id,
        title: session.title,
        clientName: session.clientName,
        projectName: session.projectName,
      },
      previewImage: firstImage
        ? {
            id: firstImage.id,
            fileName: firstImage.fileName,
            url: storage.generateSignedUrl(firstImage.blobName),
          }
        : null,
      imageCount: session.imageCount || images.length,
    });
  } catch (err) {
    console.error('Public preview error:', err);
    return res.status(500).json({ error: 'Failed to load preview' });
  }
});

// GET /api/sessions/:id/export
app.get('/api/sessions/:id/export', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const session = await db.getItem('sessions', req.params.id, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const images = await db.getImagesBySession(req.params.id);
    const submissions = await db.getSubmissionsBySession(req.params.id);
    const format = req.query.format || 'xlsx';
    const buffer = generateExport(session, images, submissions, format);

    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const ct = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', `attachment; filename="${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.${ext}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ═══════════════════════════════════════
// IMAGE ROUTES
// ═══════════════════════════════════════

// POST /api/sessions/:id/images
app.post('/api/sessions/:id/images', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  const sessionId = req.params.id;
  try {
    const session = await db.getItem('sessions', sessionId, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const { images } = req.body;
    if (!images || !images.length) return res.status(400).json({ error: 'No images provided' });

    const existingImages = await db.getImagesBySession(sessionId);
    if (existingImages.length + images.length > 100) return res.status(400).json({ error: 'Maximum 100 images per session' });

    const uploaded = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const buffer = Buffer.from(img.data, 'base64');
      if (buffer.length > 50 * 1024 * 1024) continue;

      const { blobUrl, blobName } = await storage.uploadImage(sessionId, img.fileName, buffer, img.contentType || 'application/octet-stream');
      const imageDoc = {
        id: uuidv4(), sessionId, blobUrl, blobName,
        fileName: img.fileName, contentType: img.contentType || 'application/octet-stream',
        templateChannel: img.templateChannel || null,
        templateText: img.templateText || '',
        rowId: img.rowId || null,
        rowOrder: Number(img.rowOrder) || existingImages.length + i + 1,
        fileSize: buffer.length, order: existingImages.length + i,
        uploadedAt: new Date().toISOString(),
      };
      await db.createItem('images', imageDoc);
      uploaded.push(imageDoc);
    }

    const totalImages = existingImages.length + uploaded.length;
    await db.updateItem('sessions', sessionId, auth.creator.sub, { imageCount: totalImages, updatedAt: new Date().toISOString() });

    res.status(201).json({ uploaded: uploaded.length, total: totalImages, images: uploaded.map((img) => ({ id: img.id, fileName: img.fileName, order: img.order })) });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// DELETE /api/sessions/:id/images/:imageId
app.delete('/api/sessions/:id/images/:imageId', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  const { id: sessionId, imageId } = req.params;
  try {
    const session = await db.getItem('sessions', sessionId, auth.creator.sub);
    if (!session || session.creatorId !== auth.creator.sub) return res.status(404).json({ error: 'Session not found' });

    const image = await db.getItem('images', imageId, sessionId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Delete blob from storage and document from DB
    await storage.deleteBlob(image.blobName);
    await db.deleteItem('images', imageId, sessionId);

    // Update session image count
    const remaining = await db.getImagesBySession(sessionId);
    await db.updateItem('sessions', sessionId, auth.creator.sub, {
      imageCount: remaining.length,
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: 'Image deleted', remaining: remaining.length });
  } catch (err) {
    console.error('Image delete error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// GET /api/sessions/:id/images
app.get('/api/sessions/:id/images', async (req, res) => {
  await ensureInit();
  const sessionId = req.params.id;
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });
  if (decoded.role === 'reviewer' && decoded.sessionId !== sessionId) return res.status(403).json({ error: 'Not authorized for this session' });

  try {
    const images = await db.getImagesBySession(sessionId);
    const imagesWithUrls = images.map((img) => ({
      id: img.id, fileName: img.fileName, order: img.order,
      templateChannel: img.templateChannel || null,
      templateText: img.templateText || '',
      rowId: img.rowId || null,
      rowOrder: img.rowOrder || null,
      url: storage.generateSignedUrl(img.blobName), uploadedAt: img.uploadedAt,
    }));
    res.json({ images: imagesWithUrls });
  } catch (err) {
    console.error('Images get error:', err);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// ═══════════════════════════════════════
// REVIEW ROUTES
// ═══════════════════════════════════════

// POST /api/sessions/:id/submit
app.post('/api/sessions/:id/submit', async (req, res) => {
  await ensureInit();
  const sessionId = req.params.id;
  const auth = requireReviewer(req, sessionId);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const reviewerEmail = normalizeEmail(auth.reviewer.reviewerEmail);
    const existing = await db.getSubmissionByReviewerEmail(sessionId, reviewerEmail)
      || await db.getSubmissionByReviewer(sessionId, auth.reviewer.reviewerName);

    const { decisions, annotations } = req.body;
    if (!decisions || !Array.isArray(decisions)) return res.status(400).json({ error: 'Decisions array is required' });

    const mappedDecisions = decisions.map((d) => ({ imageId: d.imageId, liked: !!d.liked }));
    const mappedAnnotations = (annotations || []).map((a) => ({
      imageId: a.imageId, x: a.x, y: a.y, comment: a.comment || '',
      author: auth.reviewer.reviewerName, createdAt: a.createdAt || new Date().toISOString(),
    }));

    if (existing) {
      await db.updateItem('submissions', existing.id, sessionId, {
        decisions: mappedDecisions,
        annotations: mappedAnnotations,
        reviewerEmail: reviewerEmail || existing.reviewerEmail || null,
        reviewerName: auth.reviewer.reviewerName || existing.reviewerName,
        submittedAt: new Date().toISOString(),
      });
    } else {
      const submission = {
        id: uuidv4(), sessionId,
        reviewerName: auth.reviewer.reviewerName,
        reviewerEmail: reviewerEmail || null,
        decisions: mappedDecisions,
        annotations: mappedAnnotations,
        submittedAt: new Date().toISOString(),
      };
      await db.createItem('submissions', submission);
    }

    res.status(201).json({
      message: existing ? 'Review updated successfully' : 'Review submitted successfully',
      summary: {
        total: decisions.length, liked: decisions.filter((d) => d.liked).length,
        disliked: decisions.filter((d) => !d.liked).length, annotations: (annotations || []).length,
      },
    });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/sessions/:id/reviewer-history
app.get('/api/sessions/:id/reviewer-history', async (req, res) => {
  await ensureInit();
  const sessionId = req.params.id;
  const auth = requireReviewer(req, sessionId);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const sessions = await db.queryItems('sessions', 'SELECT * FROM c WHERE c.id = @id', [
      { name: '@id', value: sessionId },
    ]);
    const session = sessions[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const reviewerEmail = normalizeEmail(auth.reviewer.reviewerEmail);
    const reviewerName = String(auth.reviewer.reviewerName || '').trim();

    const creatorSessions = await db.getSessionsByCreator(session.creatorId);
    const relatedSessions = creatorSessions.filter(
      (item) => item.clientId === session.clientId && item.projectId === session.projectId
    );

    const historyEntries = [];
    for (const related of relatedSessions) {
      const submissions = await db.getSubmissionsBySession(related.id);
      const matchedSubmission = submissions.find((sub) => {
        const submissionEmail = normalizeEmail(sub.reviewerEmail);
        if (reviewerEmail && submissionEmail) {
          return submissionEmail === reviewerEmail;
        }
        return String(sub.reviewerName || '').trim() === reviewerName;
      });

      if (!matchedSubmission) continue;

      const liked = (matchedSubmission.decisions || []).filter((decision) => decision.liked).length;
      const disliked = (matchedSubmission.decisions || []).filter((decision) => !decision.liked).length;
      historyEntries.push({
        sessionId: related.id,
        sessionTitle: related.title,
        submittedAt: matchedSubmission.submittedAt,
        liked,
        disliked,
        annotationCount: (matchedSubmission.annotations || []).length,
        totalImagesReviewed: (matchedSubmission.decisions || []).length,
        isCurrentSession: related.id === sessionId,
      });
    }

    historyEntries.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return res.json({
      session: {
        id: session.id,
        title: session.title,
        clientId: session.clientId,
        clientName: session.clientName,
        projectId: session.projectId,
        projectName: session.projectName,
      },
      reviewer: {
        name: reviewerName,
        email: reviewerEmail || null,
      },
      history: historyEntries,
    });
  } catch (err) {
    console.error('Reviewer history error:', err);
    return res.status(500).json({ error: 'Failed to load reviewer history' });
  }
});

// GET /api/sessions/:id/submissions
app.get('/api/sessions/:id/submissions', async (req, res) => {
  await ensureInit();
  const auth = requireCreator(req);
  if (!auth.valid) return res.status(auth.status).json({ error: auth.error });

  try {
    const submissions = await db.getSubmissionsBySession(req.params.id);
    res.json({
      submissions: submissions.map((s) => ({
        id: s.id, reviewerName: s.reviewerName, reviewerEmail: s.reviewerEmail || null, submittedAt: s.submittedAt,
        decisions: s.decisions, annotations: s.annotations,
        likeCount: (s.decisions || []).filter((d) => d.liked).length,
        dislikeCount: (s.decisions || []).filter((d) => !d.liked).length,
      })),
    });
  } catch (err) {
    console.error('Submissions list error:', err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
});

// ═══════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
});

// ═══════════════════════════════════════
// SERVE STATIC FRONTEND
// ═══════════════════════════════════════

const clientDist = path.join(__dirname, 'client', 'dist');

app.use(express.static(clientDist));

// SPA fallback: all non-API routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ═══════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   CreativeSwipe Server                   ║
║   Port: ${PORT}                            ║
║   Mode: ${process.env.NODE_ENV || 'development'}                   ║
╚══════════════════════════════════════════╝
  `);
});
