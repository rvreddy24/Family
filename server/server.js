require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const url = require('url');
const {
  initDatabase,
  closeDatabase,
  resetCleanDatabase,
  getTasks,
  getTaskById,
  createTask,
  assignPartner,
  partnerAcceptTask,
  partnerStartTask,
  submitVerification,
  approveEscrow,
  rejectVerification,
  getParents,
  createParent,
  getPartners,
  getPartnerProfile,
  updatePartnerDuty,
  getClientProfile,
  getEscrowSummary,
  getWhatsAppAuditLog,
  resendWhatsApp,
  addAuditLog,
  getAuditLogs,
  getSecuritySettings,
  updateSecuritySetting,
} = require('./db');

const {
  checkSupabaseHealth,
  uploadToSupabaseStorage,
  isSupabaseConfigured,
} = require('./supabase');

const app = express();
const server = http.createServer(app);

// Initialize DB schema
initDatabase();

// In production, only purge if explicitly requested via environment variable
if (process.env.RESET_DB_ON_START === 'true') {
  console.log('[WARN] RESET_DB_ON_START is enabled. Purging database tables...');
  resetCleanDatabase();
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security & Production Middlewares
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight request logging for operational visibility
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    });
  }
  next();
});

const corsOrigin = process.env.CORS_ORIGIN 
  ? (process.env.CORS_ORIGIN.includes(',') ? process.env.CORS_ORIGIN.split(',') : process.env.CORS_ORIGIN)
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: process.env.MAX_PAYLOAD_SIZE || '25mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d' }));

// WebSocket Gateway on /ws/events
const wss = new WebSocketServer({ noServer: true });
const activeClients = new Set();

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  if (pathname === '/ws/events') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const role = parsedUrl.query.role || 'GUEST';
  const userId = parsedUrl.query.userId || null;

  ws.role = role;
  ws.userId = userId;
  ws.isAlive = true;

  activeClients.add(ws);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    activeClients.delete(ws);
  });

  // Welcome handshake
  ws.send(
    JSON.stringify({
      type: 'CONNECTED',
      payload: {
        role,
        userId,
        timestamp: new Date().toISOString(),
        message: 'FamilyHubs Enterprise Ultra-Fast Real-Time Gateway Connected',
      },
    })
  );
});

// Periodic ping
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Broadcast
function broadcastEvent(type, payload, options = {}) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
    ...options,
  });

  let deliveredCount = 0;
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (options.targetRole && client.role !== options.targetRole && client.role !== 'ADMIN') {
        return;
      }
      if (options.targetUserId && client.userId && client.userId !== options.targetUserId && client.role !== 'ADMIN') {
        return;
      }
      client.send(message);
      deliveredCount++;
    }
  });

  console.log(`[REALTIME-WS] Broadcast ${type} to ${deliveredCount} clients.`);
}

// ---------------- REST API ROUTES ----------------

// Health check
app.get('/api/health', async (req, res) => {
  const supabaseStatus = await checkSupabaseHealth();
  res.json({
    status: 'ONLINE',
    uptime: process.uptime(),
    activeSockets: activeClients.size,
    supabase: supabaseStatus,
    timestamp: new Date().toISOString(),
  });
});

// Supabase Connection Status
app.get('/api/supabase/status', async (req, res) => {
  const status = await checkSupabaseHealth();
  res.json({
    ...status,
    projectUrl: process.env.SUPABASE_URL || null,
  });
});

// Auth profiles
app.get('/api/auth/profile', (req, res) => {
  const role = req.query.role || 'CLIENT';
  const userId = req.query.userId;

  if (role === 'CLIENT') {
    const profile = getClientProfile(userId || 'usr_client_ananya');
    return res.json(profile);
  }
  if (role === 'PARTNER') {
    const profile = getPartnerProfile(userId || 'usr_partner_srinivas');
    return res.json(profile);
  }
  return res.json({ id: 'usr_admin_lead', full_name: 'Prasad Varma', role: 'ADMIN' });
});

// Task Management Endpoints
app.get('/api/tasks', (req, res) => {
  const { clientId, partnerId, status, locality } = req.query;
  const tasks = getTasks({ clientId, partnerId, status, locality });
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  try {
    const { clientId, parentId, category, title, instructions, scheduledAt, escrowAmount } = req.body;
    if (!clientId || !parentId || !title || !instructions) {
      return res.status(400).json({ error: 'Missing mandatory task fields' });
    }

    const task = createTask({
      clientId,
      parentId,
      category: category || 'HOME_MAINTENANCE',
      title,
      instructions,
      scheduledAt,
      escrowAmount: parseFloat(escrowAmount) || 50.0,
    });

    broadcastEvent('TASK_CREATED', task);
    res.status(201).json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// Operations Assigns Partner
app.post('/api/tasks/:id/assign', (req, res) => {
  try {
    const { partnerId, adminId } = req.body;
    if (!partnerId) return res.status(400).json({ error: 'partnerId is required' });

    const updatedTask = assignPartner(req.params.id, partnerId, adminId || 'usr_admin_lead');

    broadcastEvent('TASK_DISPATCHED', updatedTask, { targetUserId: partnerId });
    broadcastEvent('TASK_UPDATED', updatedTask);

    res.json(updatedTask);
  } catch (err) {
    console.error('Error assigning partner:', err);
    res.status(500).json({ error: err.message });
  }
});

// Partner Accepts Task
app.post('/api/tasks/:id/accept', (req, res) => {
  try {
    const { partnerId } = req.body;
    const updatedTask = partnerAcceptTask(req.params.id, partnerId);

    broadcastEvent('TASK_ACCEPTED', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partner Starts Task
app.post('/api/tasks/:id/start', (req, res) => {
  try {
    const { partnerId } = req.body;
    const updatedTask = partnerStartTask(req.params.id, partnerId);

    broadcastEvent('TASK_IN_PROGRESS', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partner Submits Forensic Verification (Server calculates true Haversine Geofence)
app.post('/api/tasks/:id/verify', (req, res) => {
  try {
    const { partnerId, stage, selfieImageUrl, latitude, longitude } = req.body;
    if (!partnerId || !selfieImageUrl) {
      return res.status(400).json({ error: 'partnerId and selfieImageUrl are required' });
    }

    const updatedTask = submitVerification({
      taskId: req.params.id,
      partnerId,
      stage: stage || 'ARRIVAL_CHECKIN',
      selfieImageUrl,
      latitude: parseFloat(latitude) || 16.8724,
      longitude: parseFloat(longitude) || 79.5631,
    });

    const eventType = stage === 'ARRIVAL_CHECKIN' ? 'PARTNER_CHECKED_IN' : 'VERIFICATION_SUBMITTED';
    broadcastEvent(eventType, updatedTask);

    res.json(updatedTask);
  } catch (err) {
    console.error('Error submitting verification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Audits & Approves Escrow Release (Requires 6-Digit Escrow Authorization PIN)
app.post('/api/tasks/:id/escrow/approve', (req, res) => {
  try {
    const adminId = req.body.adminId || 'usr_admin_lead';
    const escrowPin = req.body.escrowPin || '';

    const updatedTask = approveEscrow(req.params.id, adminId, escrowPin);

    broadcastEvent('ESCROW_RELEASED', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    console.error('Error approving escrow:', err.message);
    if (err.message.includes('INVALID_SECURITY_PIN') || err.message.includes('EMERGENCY_FREEZE_ACTIVE')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Admin Flags & Rejects Verification
app.post('/api/tasks/:id/verify/reject', (req, res) => {
  try {
    const { logId, reason, adminId } = req.body;
    const updatedTask = rejectVerification(req.params.id, logId, adminId || 'usr_admin_lead', reason);

    broadcastEvent('VERIFICATION_REJECTED', {
      task: updatedTask,
      reason: reason || 'Photo or GPS distance out of tolerance. Please retake check-in selfie.',
    });

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parent Management
app.get('/api/parents', (req, res) => {
  const clientId = req.query.clientId || 'usr_client_ananya';
  const parents = getParents(clientId);
  res.json(parents);
});

app.post('/api/parents', (req, res) => {
  try {
    const newParent = createParent(req.body);
    res.status(201).json(newParent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partners List
app.get('/api/partners', (req, res) => {
  const partners = getPartners(req.query.category, req.query.region);
  res.json(partners);
});

app.get('/api/partners/:id/profile', (req, res) => {
  const partner = getPartnerProfile(req.params.id);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  res.json(partner);
});

// Partner Duty Toggle
app.post('/api/partners/:id/duty', (req, res) => {
  try {
    const { isActive } = req.body;
    const updated = updatePartnerDuty(req.params.id, isActive);

    broadcastEvent('PARTNER_AVAILABILITY_CHANGED', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Escrow Hub Summary
app.get('/api/escrow/summary', (req, res) => {
  const summary = getEscrowSummary();
  res.json(summary);
});

// WhatsApp Logs & Resend
app.get('/api/whatsapp/logs', (req, res) => {
  const logs = getWhatsAppAuditLog();
  res.json(logs);
});

app.post('/api/whatsapp/resend/:id', (req, res) => {
  try {
    const log = resendWhatsApp(req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    broadcastEvent('WHATSAPP_STATUS_UPDATED', log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- SECURITY & AUDIT ENDPOINTS -----------------

// Audit Trail Stream
app.get('/api/security/audit-logs', (req, res) => {
  try {
    const logs = getAuditLogs(req.query.limit ? parseInt(req.query.limit) : 50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Security Settings (PIN, Geofence Tolerance, Emergency Freeze)
app.get('/api/security/settings', (req, res) => {
  try {
    const settings = getSecuritySettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/security/settings', (req, res) => {
  try {
    const { key, value, actorId } = req.body;
    if (!key) return res.status(400).json({ error: 'Setting key is required' });
    const updated = updateSecuritySetting(key, value, actorId || 'usr_admin_lead');
    broadcastEvent('SECURITY_SETTINGS_UPDATED', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Emergency Escrow Freeze Toggle
app.post('/api/security/panic-freeze', (req, res) => {
  try {
    const settings = getSecuritySettings();
    const nextState = settings.emergency_escrow_freeze === '1' ? '0' : '1';
    const updated = updateSecuritySetting('emergency_escrow_freeze', nextState, req.body.actorId || 'usr_admin_lead');
    broadcastEvent('EMERGENCY_FREEZE_TOGGLED', { active: nextState === '1' });
    res.json({ success: true, emergencyFreezeActive: nextState === '1', settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Purge Preloaded Data on demand
app.post('/api/security/reset-clean', (req, res) => {
  try {
    resetCleanDatabase();
    broadcastEvent('DATABASE_PURGED', { message: 'Database purged clean.' });
    res.json({ success: true, message: 'All preloaded tasks and logs purged.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Camera / Image Upload Endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeName = (filename || `selfie_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg';
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, buffer);
    let imageUrl = `/uploads/${safeName}`;

    // Cloud upload if Supabase Storage is active
    if (isSupabaseConfigured()) {
      try {
        const cloudUrl = await uploadToSupabaseStorage(buffer, safeName, 'image/jpeg');
        if (cloudUrl) {
          imageUrl = cloudUrl;
        }
      } catch (storageErr) {
        console.warn('[STORAGE] Falling back to local upload:', storageErr.message);
      }
    }

    res.json({
      success: true,
      imageUrl,
      bytes: buffer.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve Isolated Web App Portals via Host Headers on Port 4000
const userDist = path.join(__dirname, '../apps/user/dist');
const adminDist = path.join(__dirname, '../apps/admin/dist');
const partnerDist = path.join(__dirname, '../apps/partner/dist');

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/ws')) {
    return next();
  }

  const host = (req.headers.host || '').toLowerCase();

  if (host.startsWith('ops.') || host.includes('admin') || req.path.startsWith('/ops')) {
    if (fs.existsSync(path.join(adminDist, 'index.html'))) {
      return express.static(adminDist)(req, res, () => res.sendFile(path.join(adminDist, 'index.html')));
    }
  }

  if (host.startsWith('partner.') || host.includes('partner') || req.path.startsWith('/partner')) {
    if (fs.existsSync(path.join(partnerDist, 'index.html'))) {
      return express.static(partnerDist)(req, res, () => res.sendFile(path.join(partnerDist, 'index.html')));
    }
  }

  if (fs.existsSync(path.join(userDist, 'index.html'))) {
    return express.static(userDist)(req, res, () => res.sendFile(path.join(userDist, 'index.html')));
  }

  next();
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('=======================================================');
  console.log(`🚀 FamilyHubs Enterprise Core Engine Online on Port ${PORT}`);
  console.log(`📡 REST API: http://localhost:${PORT}/api/health`);
  console.log(`⚡ WebSocket Gateway: ws://localhost:${PORT}/ws/events`);
  console.log('=======================================================');
});

// Graceful Shutdown: close active WS sockets, stop server, and flush/close SQLite WAL safely
function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully stopping FamilyHubs services...`);
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Terminate or close active WS clients cleanly
  activeClients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server shutting down');
      }
    } catch {
      // ignore
    }
  });

  server.close(() => {
    console.log('[SHUTDOWN] HTTP & WebSocket listeners terminated.');
    try {
      closeDatabase();
      console.log('[SHUTDOWN] SQLite WAL journal flushed and connection closed.');
    } catch (err) {
      console.error('[SHUTDOWN ERROR] Database closure error:', err.message);
    }
    process.exit(0);
  });

  // Force close if still hanging after 5s
  setTimeout(() => {
    console.error('[SHUTDOWN] Timeout reached. Forcing immediate process exit.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

