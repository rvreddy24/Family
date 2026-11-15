(async () => {
  require('dotenv').config();
  const express = require('express');
  const http = require('http');
  const {
    WebSocketServer,
    WebSocket
  } = require('ws');
  const cors = require('cors');
  const path = require('path');
  const fs = require('fs');
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
    updateParent,
    deleteParent,
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
    getUserByEmail,
    getUserById,
    registerClientAccount,
    registerPartnerAccount,
    updateClientProfile,
    // New features
    getVitals,
    addVital,
    getMedications,
    addMedication,
    deleteMedication,
    updateMedicationStock,
    getVaultDocuments,
    addVaultDocument,
    getEmergencyEventById,
    getActiveEmergencies,
    createEmergencyEvent,
    resolveEmergencyEvent,
    createTaskReview,
    getTaskReview,
    getPartnerReviews,
    getFamilyMembers,
    addFamilyMember,
    updatePartnerLocation,
    getPartnerLocation,
    createEmailOtp,
    verifyEmailOtp
  } = require('./db');
  const {
    checkSupabaseHealth
  } = require('./supabase');
  const app = express();
  const server = http.createServer(app);
  const requestErrorStatus = error => error.code === 'TASK_CONFLICT' || error.code === '23503' || error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ? 409 : error.code === 'INVALID_INPUT' ? 400 : 500;

  // Initialize DB schema
  await initDatabase();
  const storage=require("./private-storage");
  await storage.init();
  const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {
      recursive: true
    });
  }

  // Security & Production Middlewares for Domain Deployments
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false); // Trust reverse proxies (Cloudflare, Render, AWS ALB, Nginx) for HTTPS protocol, IP, and domain detection

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Lightweight request logging for operational visibility
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
      });
    }
    next();
  });

  // Production Domain CORS configuration:
  // If CORS_ORIGIN is '*' or not set, dynamically reflect request origin so credentials work on any domain in all browsers
  // If CORS_ORIGIN is a comma-separated list, validate against allowed domains
  let corsOptions = {
    credentials: true
  };
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '*') {
    corsOptions.origin = (origin, callback) => {
      // Allow requests with no origin (e.g. curl, mobile apps) or any browser origin
      callback(null, !origin || /^http:\/\/(localhost|127\.0\.0\.1):(3001|3002|3003|4000)$/.test(origin));
    };
  } else {
    const allowedList = process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
    corsOptions.origin = (origin, callback) => {
      if (!origin || allowedList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    };
  }
  app.use(cors(corsOptions));
  const whatsapp = require('./whatsapp');
  await whatsapp.init();
  whatsapp.installWebhook(app, express);
  await whatsapp.start();
  app.use(express.json({
    limit: '8mb',
    inflate: false
  }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const access = require('./access');
  await access.install(app);
  app.use('/uploads', async (req, res, next) => {
    const user = await access.session(req);
    if (!user) return res.sendStatus(401);
    const {
      db
    } = require('./db');
    const imagePath = '/uploads' + req.path;
    const owner = await db.prepare('SELECT owner FROM private_uploads WHERE path=?').get(imagePath);
    const shared = await db.prepare('SELECT t.id FROM verification_logs v JOIN tasks t ON v.task_id=t.id WHERE v.selfie_image_url=? AND (t.client_id=? OR t.assigned_partner_id=?)').get(imagePath, user.id, user.id);
    if (user.role !== 'ADMIN' && owner?.owner !== user.id && !shared) return res.sendStatus(403);
    res.setHeader('Cache-Control', 'private, no-store');
    if(storage.cloud()){
      const name=path.basename(req.path);const image=await storage.get(name);
      if(!image)return res.sendStatus(404);
      return res.type(name.endsWith('.png')?'image/png':'image/jpeg').send(image);
    }
    next();
  }, express.static(uploadsDir, {
    maxAge: 0
  }));

  // WebSocket Gateway on /ws/events and /ws
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 8192
  });
  const activeClients = new Set();
  server.on('upgrade', async (request, socket, head) => {
    try {
    const origin = request.headers.origin;
    const allowed = (process.env.CORS_ORIGIN || '').split(',').map(x => x.trim());
    if (!(await access.session(request)) || origin && !allowed.includes(origin) && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}`) {
      socket.destroy();
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/ws/events' || pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
    } catch { socket.destroy(); }
  });
  wss.on('connection', async (ws, req) => {
    try {
    const identity = await access.session(req);
    if (!identity) {
      ws.close(1008, 'Authentication required');
      return;
    }
    const role = identity.role;
    const userId = identity.id;
    ws.role = role;
    ws.userId = userId;
    ws.isAlive = true;
    activeClients.add(ws);
    ws.on('error', () => { activeClients.delete(ws); ws.terminate(); });
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', message => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: new Date().toISOString()
          }));
        }
      } catch (e) {
        // ignore
      }
    });
    ws.on('close', () => {
      activeClients.delete(ws);
    });

    // Welcome handshake
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        role,
        userId,
        timestamp: new Date().toISOString(),
        message: 'FamilyHubs Enterprise Ultra-Fast Real-Time Gateway Connected'
      }
    }));
    } catch { ws.close(1011,'Connection unavailable. Please reconnect.'); }
  });

  // Periodic ping
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
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
      ...options
    });
    let deliveredCount = 0;
    activeClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (client.role !== 'ADMIN') {
          client.send(JSON.stringify({
            type: 'DATA_CHANGED'
          }));
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
    try {
      await require('./db').db.prepare('SELECT 1').get();
      res.json({
        status: 'ONLINE',
        uptime: process.uptime(),
        activeSockets: activeClients.size,
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch {
      res.status(503).json({
        status: 'UNAVAILABLE'
      });
    }
  });

  // Supabase Connection Status
  app.get('/api/supabase/status', async (req, res) => {
    const status = await checkSupabaseHealth();
    res.json({
      ...status,
      projectUrl: process.env.SUPABASE_URL || null
    });
  });

  // -------------------------------------------------------------
  // STRICT 3-ROLE PLATFORM ARCHITECTURE & DOMAIN-BASED SEPARATION
  // 1. ADMIN   - Operations Administrator (Single official account: admin@familyhubs.in)
  // 2. CLIENT  - NRI Family User (Portals: familyhubs.in, port 3001)
  // 3. PARTNER - Ground Field Partner (Portals: partner.familyhubs.in, port 3003, /partner)
  // -------------------------------------------------------------

  app.get('/api/integrations/status', (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    res.json({
      whatsapp: whatsapp.configured(),
      payments: false
    });
  });

  // Task Management Endpoints
  app.post('/api/tasks/:id/complete', async (req, res) => {
    const {
      db
    } = require('./db');
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const task = await getTaskById(req.params.id);
    if (!task || task.status !== 'VERIFICATION_SUBMITTED') return res.status(409).json({
      error: 'Completion proof is required.'
    });
    const proof = await db.prepare("SELECT id FROM verification_logs WHERE task_id=? AND stage='TASK_COMPLETION' AND geofence_passed=1 AND review_status='PENDING' ORDER BY timestamp DESC LIMIT 1").get(task.id);
    if (!proof) return res.status(409).json({
      error: 'A completion proof within the home geofence is required.'
    });
    await require('./db').transact(async () => {
      const changed = await db.prepare("UPDATE tasks SET status='COMPLETED', updated_at=? WHERE id=? AND status='VERIFICATION_SUBMITTED'").run(new Date().toISOString(), task.id);
      if (!changed.changes) throw Object.assign(new Error('Task stage changed.'), {code:'TASK_CONFLICT'});
      await db.prepare("UPDATE verification_logs SET review_status='APPROVED', reviewed_by_admin=? WHERE task_id=? AND geofence_passed=1 AND review_status='PENDING'").run(req.user.id, task.id);
      await addAuditLog({
        eventType: 'CARE_VISIT_COMPLETED',
        actorId: req.user.id,
        actorRole: 'ADMIN',
        severity: 'LOW',
        details: {
          taskId: task.id,
          paymentTransferred: false
        }
      });
    });
    broadcastEvent('TASK_UPDATED', await getTaskById(task.id));
    res.json(await getTaskById(task.id));
  });
  app.post('/api/partners/:id/verification', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    if (typeof req.body.verified !== 'boolean' || !req.body.notes?.trim()) return res.status(400).json({
      error: 'A verification decision and review notes are required.'
    });
    const {
      db
    } = require('./db');
    if (!(await db.prepare('SELECT user_id FROM partners_profile WHERE user_id=?').get(req.params.id))) return res.sendStatus(404);
    await db.prepare('UPDATE partners_profile SET kyc_verified=? WHERE user_id=?').run(req.body.verified ? 1 : 0, req.params.id);
    await addAuditLog({
      eventType: 'PARTNER_VERIFICATION_REVIEWED',
      actorId: req.user.id,
      actorRole: 'ADMIN',
      severity: 'HIGH',
      details: {
        partnerId: req.params.id,
        verified: req.body.verified,
        notes: req.body.notes
      }
    });
    res.json({
      success: true
    });
  });
  app.get('/api/tasks', async (req, res) => {
    const {
      clientId,
      partnerId,
      status,
      locality
    } = req.query;
    const tasks = await getTasks({
      clientId,
      partnerId,
      status,
      locality
    });
    res.json(tasks);
  });
  app.get('/api/tasks/:id', async (req, res) => {
    const task = await getTaskById(req.params.id);
    if (!task) return res.status(404).json({
      error: 'Task not found'
    });
    res.json(task);
  });
  app.post('/api/tasks', async (req, res) => {
    try {
      const {
        clientId,
        parentId,
        category,
        title,
        instructions,
        scheduledAt,
        escrowAmount
      } = req.body;
      if (!clientId || !parentId || !title || !instructions) {
        return res.status(400).json({
          error: 'Missing mandatory task fields'
        });
      }
      const task = await createTask({
        clientId,
        parentId,
        category: category || 'HOME_MAINTENANCE',
        title,
        instructions,
        scheduledAt,
        escrowAmount: 0
      });
      broadcastEvent('TASK_CREATED', task);
      res.status(201).json(task);
    } catch (err) {
      console.error('Error creating task:', err);
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Operations Assigns Partner
  app.post('/api/tasks/:id/assign', async (req, res) => {
    try {
      const {
        partnerId,
        adminId
      } = req.body;
      if (!partnerId) return res.status(400).json({
        error: 'partnerId is required'
      });
      const updatedTask = await assignPartner(req.params.id, partnerId, adminId || 'admin');
      broadcastEvent('TASK_DISPATCHED', updatedTask, {
        targetUserId: partnerId
      });
      broadcastEvent('TASK_UPDATED', updatedTask);
      res.json(updatedTask);
    } catch (err) {
      console.error('Error assigning partner:', err);
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Partner Accepts Task
  app.post('/api/tasks/:id/accept', async (req, res) => {
    try {
      const {
        partnerId
      } = req.body;
      const updatedTask = await partnerAcceptTask(req.params.id, partnerId);
      broadcastEvent('TASK_ACCEPTED', updatedTask);
      res.json(updatedTask);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Partner Starts Task
  app.post('/api/tasks/:id/start', async (req, res) => {
    return res.status(410).json({error:'Submit arrival proof to begin the visit.'});
  });

  // Partner Submits Forensic Verification (Server calculates true Haversine Geofence)
  app.post('/api/tasks/:id/verify', async (req, res) => {
    try {
      const {
        partnerId,
        stage,
        selfieImageUrl,
        latitude,
        longitude
      } = req.body;
      if (!partnerId || !selfieImageUrl || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) {
        return res.status(400).json({
          error: 'partnerId and selfieImageUrl are required'
        });
      }
      const updatedTask = await submitVerification({
        taskId: req.params.id,
        partnerId,
        stage: stage || 'ARRIVAL_CHECKIN',
        selfieImageUrl,
        latitude: Number(latitude),
        longitude: Number(longitude)
      });
      const eventType = stage === 'ARRIVAL_CHECKIN' ? 'PARTNER_CHECKED_IN' : 'VERIFICATION_SUBMITTED';
      broadcastEvent(eventType, updatedTask);
      res.json(updatedTask);
    } catch (err) {
      console.error('Error submitting verification:', err);
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Admin Audits & Approves Escrow Release (Requires 6-Digit Escrow Authorization PIN)
  app.post('/api/tasks/:id/escrow/approve', (req, res) => {
    try {
      const adminId = req.body.adminId || 'admin';
      const escrowPin = req.body.escrowPin || req.body.adminPin || req.body.pin || '';
      return res.status(503).json({
        error: 'Payout provider is not configured. No money has been transferred.'
      });
      broadcastEvent('ESCROW_RELEASED', updatedTask);
      res.json(updatedTask);
    } catch (err) {
      console.error('Error approving escrow:', err.message);
      if (err.message.includes('INVALID_SECURITY_PIN') || err.message.includes('EMERGENCY_FREEZE_ACTIVE')) {
        return res.status(403).json({
          error: err.message
        });
      }
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Admin Flags & Rejects Verification
  app.post('/api/tasks/:id/verify/reject', async (req, res) => {
    try {
      const {
        logId,
        reason,
        adminId
      } = req.body;
      const updatedTask = await rejectVerification(req.params.id, logId, adminId || 'admin', reason);
      broadcastEvent('VERIFICATION_REJECTED', {
        task: updatedTask,
        reason: reason || 'Photo or GPS distance out of tolerance. Please retake check-in selfie.'
      });
      res.json(updatedTask);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Parent Management
  app.get('/api/parents', async (req, res) => {
    const clientId = req.query.clientId;
    if (!clientId) {
      return res.json([]);
    }
    const parents = await getParents(clientId);
    res.json(parents);
  });
  app.post('/api/parents', async (req, res) => {
    try {
      const newParent = await createParent(req.body);
      await require('./db').db.prepare('UPDATE parents_profile SET whatsapp_consent=? WHERE id=?').run(req.body.whatsappConsent === true ? 1 : 0, newParent.id);
      res.status(201).json({...newParent,whatsapp_consent:req.body.whatsappConsent === true ? 1 : 0});
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.put('/api/parents/:id', async (req, res) => {
    try {
      const updated = await updateParent(req.params.id, req.body);
      if (updated) await require('./db').db.prepare('UPDATE parents_profile SET whatsapp_consent=? WHERE id=?').run(req.body.whatsappConsent === true ? 1 : 0, req.params.id);
      if (!updated) {
        return res.status(404).json({
          error: 'Parent residence not found.'
        });
      }
      res.json({...updated,whatsapp_consent:req.body.whatsappConsent === true ? 1 : 0});
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.delete('/api/parents/:id', async (req, res) => {
    try {
      const history = await require('./db').db.prepare('SELECT id FROM tasks WHERE parent_id=? LIMIT 1').get(req.params.id);
      if (history) return res.status(409).json({error:'This parent has visit history and cannot be removed. Contact operations for help.'});
      const success = await deleteParent(req.params.id);
      if (!success) {
        return res.status(404).json({
          error: 'Parent residence not found.'
        });
      }
      res.json({
        success: true,
        message: 'Parent residence removed successfully.'
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Partners List
  app.get('/api/partners', async (req, res) => {
    const partners = await getPartners(req.query.category, req.query.region);
    res.json(partners);
  });
  app.get('/api/partners/:id/profile', async (req, res) => {
    const partner = await getPartnerProfile(req.params.id);
    if (!partner) return res.status(404).json({
      error: 'Partner not found'
    });
    res.json(partner);
  });

  // Partner Duty Toggle
  app.post('/api/partners/:id/duty', async (req, res) => {
    try {
      const {
        isActive
      } = req.body;
      const updated = await updatePartnerDuty(req.params.id, isActive);
      broadcastEvent('PARTNER_AVAILABILITY_CHANGED', updated);
      res.json(updated);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Escrow Hub Summary
  app.get('/api/escrow/summary', async (req, res) => {
    const summary = await getEscrowSummary();
    res.json(summary);
  });

  // WhatsApp Logs & Resend
  app.get('/api/whatsapp/logs', async (req, res) => {
    const logs = await getWhatsAppAuditLog();
    res.json(logs);
  });
  app.post('/api/whatsapp/resend/:id', async (req, res) => {
    try {
      const log = await resendWhatsApp(req.params.id);
      if (!log) return res.status(404).json({
        error: 'Log not found'
      });
      broadcastEvent('WHATSAPP_STATUS_UPDATED', log);
      res.json(log);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- SECURITY & AUDIT ENDPOINTS -----------------

  // Audit Trail Stream
  app.get('/api/security/audit-logs', async (req, res) => {
    try {
      const logs = await getAuditLogs(req.query.limit ? parseInt(req.query.limit) : 50);
      res.json(logs);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Security Settings (PIN, Geofence Tolerance, Emergency Freeze)
  app.get('/api/security/settings', async (req, res) => {
    try {
      const settings = await getSecuritySettings();
      delete settings.escrow_release_pin;
      res.json(settings);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/security/settings', async (req, res) => {
    try {
      const {
        key,
        value,
        actorId
      } = req.body;
      if (!['escrow_release_pin', 'geofence_tolerance_meters', 'emergency_escrow_freeze'].includes(key)) return res.status(400).json({
        error: 'Invalid setting.'
      });
      if (key === 'escrow_release_pin' && !/^\d{6}$/.test(value)) return res.status(400).json({
        error: 'PIN must contain six digits.'
      });
      if (!key) return res.status(400).json({
        error: 'Setting key is required'
      });
      const updated = await updateSecuritySetting(key, value, actorId || 'admin');
      broadcastEvent('SECURITY_SETTINGS_UPDATED', updated);
      res.json(updated);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Emergency Escrow Freeze Toggle
  app.post(['/api/security/freeze', '/api/security/panic-freeze', '/api/security/settings/emergency-freeze'], async (req, res) => {
    try {
      const settings = await getSecuritySettings();
      let nextState;
      if (req.body && req.body.enabled !== undefined) {
        nextState = req.body.enabled ? '1' : '0';
      } else {
        nextState = settings.emergency_escrow_freeze === '1' ? '0' : '1';
      }
      const updated = await updateSecuritySetting('emergency_escrow_freeze', nextState, req.body.actorId || 'admin');
      broadcastEvent('EMERGENCY_FREEZE_TOGGLED', {
        active: nextState === '1'
      });
      res.json({
        success: true,
        active: nextState === '1',
        emergency_freeze: nextState === '1',
        emergencyFreezeActive: nextState === '1',
        settings: updated
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Purge Preloaded Data on demand
  app.post('/api/security/reset-clean', async (req, res) => {
    try {
      await resetCleanDatabase();
      broadcastEvent('DATABASE_PURGED', {
        message: 'Database purged clean.'
      });
      res.json({
        success: true,
        message: 'All preloaded tasks and logs purged.'
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Camera / Image Upload Endpoint
  app.post('/api/upload', async (req, res) => {
    try {
      const {
        imageBase64
      } = req.body;
      if (typeof imageBase64 !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(imageBase64) || imageBase64.length > 8000000) return res.status(400).json({
        error: 'A JPEG or PNG image under 6 MB is required.'
      });
      if (!imageBase64) {
        return res.status(400).json({
          error: 'imageBase64 is required'
        });
      }
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!jpeg && !png) return res.status(400).json({
        error: 'The file must contain a valid JPEG or PNG image.'
      });
      const safeName = require('crypto').randomUUID() + (png ? '.png' : '.jpg');
      const filePath = path.join(uploadsDir, safeName);
      if(storage.cloud())await storage.put(safeName,buffer,png?"image/png":"image/jpeg");
      else fs.writeFileSync(filePath, buffer);
      let imageUrl = `/uploads/${safeName}`;
      await require('./db').db.prepare('INSERT INTO private_uploads VALUES (?,?)').run(imageUrl, req.user.id);
      res.json({
        success: true,
        imageUrl,
        bytes: buffer.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- HEALTH VITALS ROUTES -----------------
  app.get('/api/parents/:id/vitals', async (req, res) => {
    try {
      const vitals = await getVitals(req.params.id);
      res.json(vitals);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/parents/:id/vitals', async (req, res) => {
    try {
      const vital = await addVital({
        parentId: req.params.id,
        ...req.body
      });
      broadcastEvent('VITALS_RECORDED', vital);
      res.status(201).json(vital);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- MEDICATIONS SCHEDULE ROUTES -----------------
  app.get('/api/parents/:id/medications', async (req, res) => {
    try {
      const meds = await getMedications(req.params.id);
      res.json(meds);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/parents/:id/medications', async (req, res) => {
    try {
      const med = await addMedication({
        parentId: req.params.id,
        ...req.body
      });
      broadcastEvent('MEDICATION_UPDATED', med);
      res.status(201).json(med);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.delete('/api/parents/:id/medications/:medId', async (req, res) => {
    try {
      await deleteMedication(req.params.medId);
      broadcastEvent('MEDICATION_UPDATED', {
        id: req.params.medId,
        deleted: true
      });
      res.json({
        success: true
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // 1-Click Medication Concierge Refill Task Dispatch
  app.post('/api/parents/:id/medications/:medId/refill', async (req, res) => {
    try {
      const parentId = req.params.id;
      const medId = req.params.medId;
      const parent = await require('./db').db.prepare('SELECT * FROM parents_profile WHERE id=?').get(parentId);
      if (!parent) return res.status(404).json({error:'Parent record not found.'});
      const meds = await getMedications(parentId);
      const med = meds.find(m => m.id === medId);
      if (!med) return res.status(404).json({error:'Medication record not found.'});
      const task = await createTask({
        clientId: parent.client_id,
        parentId,
        category: 'ERRANDS',
        title: `Pharmacy Delivery: Refill ${med.medicine_name} (${med.dosage})`,
        instructions: `Coordinate a refill of ${med.medicine_name} with the family and an authorized pharmacy. Follow the current prescription (${med.dosage}); confirm the quantity and availability before purchase. Deliver with the receipt to ${parent.parent_name}.`,
        scheduledAt: new Date().toISOString(),
        escrowAmount: 0
      });
      broadcastEvent('TASK_CREATED', task);
      res.status(201).json({
        success: true,
        task
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- MEDICAL VAULT DOCUMENTS ROUTES -----------------
  app.get('/api/parents/:id/documents', async (req, res) => {
    try {
      const docs = await getVaultDocuments(req.params.id);
      res.json(docs);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/parents/:id/documents', async (req, res) => {
    try {
      const doc = await addVaultDocument({
        parentId: req.params.id,
        ...req.body
      });
      res.status(201).json(doc);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- EMERGENCY SOS ROUTES -----------------
  app.post('/api/emergency/sos', async (req, res) => {
    try {
      const {
        parentId,
        triggeredByUserId,
        clientId,
        latitude,
        longitude,
        coordinatesLat,
        coordinatesLng,
        notes
      } = req.body;
      if (!parentId) {
        return res.status(400).json({
          error: 'parentId is required for Emergency SOS'
        });
      }
      const sosEvent = await createEmergencyEvent({
        parentId,
        triggeredByUserId: triggeredByUserId || clientId || 'system',
        latitude: latitude !== undefined ? latitude : coordinatesLat,
        longitude: longitude !== undefined ? longitude : coordinatesLng,
        notes
      });
      broadcastEvent('EMERGENCY_SOS_TRIGGERED', sosEvent);
      res.status(201).json(sosEvent);
    } catch (err) {
      console.error('SOS Trigger Error:', err);
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.get('/api/emergency/active', async (req, res) => {
    try {
      const emergencies = await getActiveEmergencies();
      res.json(emergencies);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/emergency/:id/resolve', async (req, res) => {
    try {
      if (!req.body.resolutionNotes?.trim()) return res.status(400).json({error:'Describe how the alert was resolved and any follow-up needed.'});
      const current = await getEmergencyEventById(req.params.id);
      if (!current) return res.status(404).json({error:'Care alert not found.'});
      if (current.status === 'RESOLVED') return res.status(409).json({error:'This alert is already resolved.'});
      const resolved = await resolveEmergencyEvent(req.params.id, req.body);
      broadcastEvent('EMERGENCY_SOS_RESOLVED', resolved);
      res.json(resolved);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- TASK REVIEWS & CSAT ROUTES -----------------
  app.post('/api/tasks/:id/review', async (req, res) => {
    try {
      const review = await createTaskReview({
        taskId: req.params.id,
        ...req.body
      });
      broadcastEvent('TASK_REVIEW_SUBMITTED', review);
      res.status(201).json(review);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.get('/api/tasks/:id/review', async (req, res) => {
    try {
      const review = await getTaskReview(req.params.id);
      res.json(review || null);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.get('/api/partners/:id/reviews', async (req, res) => {
    try {
      const reviews = await getPartnerReviews(req.params.id);
      res.json(reviews);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- FAMILY MEMBERS / SIBLING COLLABORATION -----------------
  app.get('/api/clients/:id/family', async (req, res) => {
    try {
      const members = await getFamilyMembers(req.params.id);
      res.json(members);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.post('/api/clients/:id/family', async (req, res) => {
    try {
      const member = await addFamilyMember({
        clientId: req.params.id,
        ...req.body
      });
      res.status(201).json(member);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // ----------------- PARTNER LIVE GPS TELEMETRY -----------------
  app.post('/api/partners/:id/location', async (req, res) => {
    try {
      const {
        latitude,
        longitude,
        speed,
        heading,
        taskId
      } = req.body;
      const location = await updatePartnerLocation(req.params.id, latitude, longitude);
      broadcastEvent('PARTNER_LOCATION_UPDATE', {
        partner_id: req.params.id,
        task_id: taskId,
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date().toISOString()
      });
      res.json({
        success: true,
        location
      });
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });
  app.get('/api/partners/:id/location', async (req, res) => {
    try {
      const loc = await getPartnerLocation(req.params.id);
      res.json(loc || null);
    } catch (err) {
      res.status(requestErrorStatus(err)).json({
        error: 'The request could not be completed. Please try again or contact support.'
      });
    }
  });

  // Unknown API routes must not fall through to a successful HTML app response.
  app.use('/api', (req,res) => res.status(404).json({error:'API endpoint not found.'}));

  // Serve Isolated Web App Portals via Host Headers on Port 4000
  const userDist = path.join(__dirname, '../apps/user/dist');
  const adminDist = path.join(__dirname, '../apps/admin/dist');
  const partnerDist = path.join(__dirname, '../apps/partner/dist');
  const staticHtmlNoCache = {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  };

  // Serve scoped static assets (/partner, /ops, /admin, and root)
  app.use('/partner', express.static(partnerDist, staticHtmlNoCache));
  app.use('/ops', express.static(adminDist, staticHtmlNoCache));
  app.use('/admin', express.static(adminDist, staticHtmlNoCache));
  app.use('/assets', express.static(path.join(userDist, 'assets')));
  app.use('/assets', express.static(path.join(partnerDist, 'assets')));
  app.use('/assets', express.static(path.join(adminDist, 'assets')));
  app.use('/', express.static(userDist, {
    ...staticHtmlNoCache,
    index: false
  }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/ws')) {
      return next();
    }

    // If requesting a static file with an extension that wasn't matched above, return 404 instead of HTML
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
      return res.status(404).send('Asset not found');
    }
    const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
    const host = rawHost.split(':')[0]; // strip port (e.g., partner.familyhubs.in:443 -> partner.familyhubs.in)

    const sendHtmlNoCache = htmlPath => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(htmlPath);
    };

    // 1. Partner Portal (via partner.*, field.*, or /partner path)
    if (host.startsWith('partner.') || host.startsWith('field.') || host.startsWith('partner-') || req.path.startsWith('/partner')) {
      if (fs.existsSync(path.join(partnerDist, 'index.html'))) {
        return sendHtmlNoCache(path.join(partnerDist, 'index.html'));
      }
    }

    // 2. Operations Admin Portal (via ops.*, admin.*, or /ops, /admin paths)
    if (host.startsWith('ops.') || host.startsWith('admin.') || host.startsWith('ops-') || host.startsWith('admin-') || req.path.startsWith('/ops') || req.path.startsWith('/admin')) {
      if (fs.existsSync(path.join(adminDist, 'index.html'))) {
        return sendHtmlNoCache(path.join(adminDist, 'index.html'));
      }
    }

    // 3. NRI Client Portal (Root domain / default fallback for SPA routes)
    if (fs.existsSync(path.join(userDist, 'index.html'))) {
      return sendHtmlNoCache(path.join(userDist, 'index.html'));
    }
    next();
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.code === 'TASK_CONFLICT' ? 409 : error.status === 413 ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({
      error: status === 409 ? 'This visit changed. Refresh and try again.' : status === 413 ? 'The upload is too large.' : status === 400 ? 'Invalid request body.' : 'The request could not be completed.'
    });
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
    activeClients.forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1001, 'Server shutting down');
        }
      } catch {
        // ignore
      }
    });
    server.close(async () => {
      console.log('[SHUTDOWN] HTTP & WebSocket listeners terminated.');
      try {
        await closeDatabase();
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
})().catch(() => {
  console.error("[STARTUP] Database or service configuration failed.");
  process.exitCode = 1;
});
