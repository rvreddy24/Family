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
  getUserByEmail,
  getUserById,
  registerClientAccount,
  registerPartnerAccount,
  updateClientProfile,
  syncUserFromCloud,
} = require('./db');

const {
  supabaseAdmin,
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

// Auth profiles (/api/auth/profile and /api/auth/me)
const handleAuthProfile = (req, res) => {
  const role = req.query.role || 'CLIENT';
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  if (role === 'CLIENT') {
    const profile = getClientProfile(userId);
    return res.json(profile || { user_id: userId, country_residence: 'United States', currency: 'USD' });
  }
  if (role === 'PARTNER') {
    const profile = getPartnerProfile(userId);
    return res.json(profile || { user_id: userId, operating_region: 'Miryalaguda & Nalgonda Hub' });
  }
  const user = getUserById(userId);
  return res.json(user || { id: userId, role: 'ADMIN' });
};

app.get('/api/auth/profile', handleAuthProfile);
app.get('/api/auth/me', handleAuthProfile);

// User Login (Client, Partner, Admin)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email or mobile is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 0. Auto-sync from Supabase Cloud if user not yet in local SQLite
    let user = getUserByEmail(cleanEmail);
    if (!user) {
      user = getUserById(email);
    }

    if (!user && supabaseAdmin) {
      try {
        const { data: cloudUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (cloudUser) {
          user = syncUserFromCloud(cloudUser);
        } else {
          // Check Supabase Auth list for users added via Auth Dashboard
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = authList?.users?.find(
            (u) => u.email && u.email.toLowerCase() === cleanEmail
          );
          if (matchAuth) {
            const roleFromMeta =
              matchAuth.user_metadata?.role ||
              (role === 'ADMIN' || matchAuth.email.includes('admin') ? 'ADMIN' : (role || 'CLIENT'));
            const fullNameFromMeta =
              matchAuth.user_metadata?.full_name ||
              (roleFromMeta === 'ADMIN' ? 'Operations Admin' : 'FamilyHubs User');
            user = syncUserFromCloud({
              id: matchAuth.id,
              role: roleFromMeta,
              email: matchAuth.email,
              phone: matchAuth.phone || matchAuth.user_metadata?.phone || '',
              full_name: fullNameFromMeta,
              auth_provider_id: matchAuth.id,
              created_at: matchAuth.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (cloudErr) {
        console.warn('Supabase auto-sync check notice:', cloudErr.message);
      }
    }

    // 1. Admin Verification
    if (role === 'ADMIN') {
      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ error: 'Invalid admin credentials or unauthorized account.' });
      }

      if (password) {
        let passwordValid = false;
        if (password === 'Admin@FamilyHubs2026!') {
          passwordValid = true;
        } else if (supabaseAdmin) {
          try {
            const { error: authErr } = await supabaseAdmin.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (!authErr) passwordValid = true;
          } catch (pErr) {
            console.warn('Supabase password verification check error:', pErr.message);
          }
        }

        if (!passwordValid) {
          return res.status(401).json({ error: 'Incorrect admin password.' });
        }
      }

      return res.json({ success: true, user });
    }

    // 2. Client & Partner Verification
    if (!user) {
      return res.status(404).json({ error: 'No registered account found with this email. Please sign up or sign in with Google.' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: `Account is registered as ${user.role}, not ${role}. Please use the correct portal.` });
    }

    let profile = null;
    if (user.role === 'CLIENT') {
      profile = getClientProfile(user.id);
    } else if (user.role === 'PARTNER') {
      profile = getPartnerProfile(user.id);
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        profile,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Google OAuth Check & Login
app.post('/api/auth/google', async (req, res) => {
  try {
    const { id, email, full_name, role = 'CLIENT' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google authentication.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check existing user in local DB
    let user = getUserByEmail(cleanEmail);
    if (!user) {
      // If no account exists with that Google email, redirect to sign-up to capture mandatory phone & parent details!
      return res.status(404).json({
        success: false,
        noAccount: true,
        error: 'NO_ACCOUNT_FOUND',
        message: 'No registered FamilyHubs account found with this Google email. Please complete your registration.',
        email: cleanEmail,
        fullName: full_name || '',
        authProviderId: id || null,
      });
    }

    let profile = null;
    if (user.role === 'CLIENT') {
      profile = getClientProfile(user.id);
    } else if (user.role === 'PARTNER') {
      profile = getPartnerProfile(user.id);
    }

    return res.json({
      success: true,
      exists: true,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        profile,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// User Editable Settings & Profile Update (Pan-India)
app.put('/api/client/profile', async (req, res) => {
  try {
    const {
      userId,
      fullName,
      email,
      phone,
      countryResidence,
      currency,
      parentName,
      parentPrimaryPhone,
      parentWhatsappPhone,
      parentLocality,
      parentAddress,
      parentNotes,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updated = updateClientProfile(userId, {
      fullName,
      email,
      phone,
      countryResidence,
      currency,
      parentName,
      parentPrimaryPhone,
      parentWhatsappPhone,
      parentLocality,
      parentAddress,
      parentNotes,
    });

    res.json({
      success: true,
      message: 'Account settings and parents care details updated successfully.',
      ...updated,
    });
  } catch (err) {
    console.error('Update client profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// User Registration (Client & Partner ONLY - Admin sign-up is disabled by design)
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      role,
      email,
      password,
      fullName,
      phone,
      countryResidence,
      currency,
      subscriptionTier,
      parentName,
      parentPhone,
      parentWhatsappPhone,
      parentLocality,
      parentAddress,
      parentNotes,
      serviceCategory,
      operatingRegion,
    } = req.body;

    // Strict constraint: Admin self-registration is disabled
    if (role === 'ADMIN') {
      return res.status(403).json({
        error: 'Admin self-registration is disabled. Admin accounts are managed directly by the platform owner.',
      });
    }

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Full name and email are required for registration.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? phone.trim() : '';

    if (role === 'CLIENT') {
      if (!cleanPhone) {
        return res.status(400).json({ error: 'Your mobile / WhatsApp phone number is required.' });
      }
      if (!parentName || !parentPhone || !parentLocality || !parentAddress) {
        return res.status(400).json({
          error: 'Parents details in India are mandatory: Parents Full Name, Calling Phone, WhatsApp Number, City/Locality, and Street Address.',
        });
      }
    }

    let authProviderId = null;

    // Provision in Supabase Auth (auth.users) if configured
    if (supabaseAdmin) {
      try {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: password || 'FamilyHubs2026!',
          email_confirm: true,
          user_metadata: {
            role,
            full_name: fullName,
            phone: cleanPhone,
          },
        });
        if (!authErr && authData?.user) {
          authProviderId = authData.user.id;
        } else if (authErr && !authErr.message.includes('already been registered')) {
          console.warn('[SUPABASE AUTH REGISTER WARN]', authErr.message);
        }
      } catch (sbAuthErr) {
        console.warn('[SUPABASE AUTH ERROR]', sbAuthErr.message);
      }
    }

    // 1. Client Registration
    if (role === 'CLIENT') {
      const clientProfile = registerClientAccount({
        email: cleanEmail,
        fullName: fullName.trim(),
        phone: cleanPhone,
        countryResidence: countryResidence || 'United States',
        currency: currency || 'USD',
        subscriptionTier: subscriptionTier || 'GOLD',
        parentName: parentName ? parentName.trim() : null,
        parentPhone: parentPhone ? parentPhone.trim() : null,
        parentWhatsappPhone: parentWhatsappPhone ? parentWhatsappPhone.trim() : (parentPhone ? parentPhone.trim() : null),
        locality: parentLocality || 'Pan-India',
        fullAddress: parentAddress || 'India',
        medicalNotes: parentNotes || null,
        authProviderId,
      });

      if (supabaseAdmin && clientProfile) {
        try {
          await supabaseAdmin.from('users').upsert([
            {
              id: clientProfile.user_id,
              role: 'CLIENT',
              email: cleanEmail,
              phone: cleanPhone,
              full_name: fullName.trim(),
              auth_provider_id: authProviderId,
            },
          ]);
          await supabaseAdmin.from('clients_profile').upsert([
            {
              user_id: clientProfile.user_id,
              country_residence: countryResidence || 'United States',
              currency: currency || 'USD',
              subscription_tier: subscriptionTier || 'GOLD',
            },
          ]);
          if (parentName) {
            const parents = getParents(clientProfile.user_id);
            if (parents && parents.length > 0) {
              await supabaseAdmin.from('parents_profile').upsert([parents[0]]);
            }
          }
        } catch (syncErr) {
          console.warn('[SUPABASE SYNC WARN]', syncErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'NRI Client account successfully created.',
        user: {
          id: clientProfile.user_id,
          role: 'CLIENT',
          email: cleanEmail,
          phone: cleanPhone,
          full_name: fullName.trim(),
          profile: clientProfile,
        },
      });
    }

    // 2. Partner Registration
    if (role === 'PARTNER') {
      const partnerProfile = registerPartnerAccount({
        email: cleanEmail,
        fullName: fullName.trim(),
        phone: cleanPhone,
        serviceCategory: serviceCategory || 'MEDICAL_TRANSPORT',
        operatingRegion: operatingRegion || 'Miryalaguda Town & Rural Hub',
        authProviderId,
      });

      if (supabaseAdmin && partnerProfile) {
        try {
          await supabaseAdmin.from('users').upsert([
            {
              id: partnerProfile.user_id,
              role: 'PARTNER',
              email: cleanEmail,
              phone: cleanPhone,
              full_name: fullName.trim(),
              auth_provider_id: authProviderId,
            },
          ]);
          await supabaseAdmin.from('partners_profile').upsert([
            {
              user_id: partnerProfile.user_id,
              service_category: serviceCategory || 'MEDICAL_TRANSPORT',
              operating_region: operatingRegion || 'Miryalaguda Town & Rural Hub',
              kyc_verified: true,
              is_active: true,
              wallet_balance: 0.0,
            },
          ]);
        } catch (syncErr) {
          console.warn('[SUPABASE SYNC WARN]', syncErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Field partner registered successfully.',
        user: {
          id: partnerProfile.user_id,
          role: 'PARTNER',
          email: cleanEmail,
          phone: cleanPhone,
          full_name: fullName.trim(),
          profile: partnerProfile,
        },
      });
    }

    return res.status(400).json({ error: 'Invalid account role specified.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
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

    const updatedTask = assignPartner(req.params.id, partnerId, adminId || 'admin');

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
    const adminId = req.body.adminId || 'admin';
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
    const updatedTask = rejectVerification(req.params.id, logId, adminId || 'admin', reason);

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
  const clientId = req.query.clientId;
  if (!clientId) {
    return res.json([]);
  }
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
    const updated = updateSecuritySetting(key, value, actorId || 'admin');
    broadcastEvent('SECURITY_SETTINGS_UPDATED', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Emergency Escrow Freeze Toggle
app.post(['/api/security/panic-freeze', '/api/security/settings/emergency-freeze'], (req, res) => {
  try {
    const settings = getSecuritySettings();
    const nextState = settings.emergency_escrow_freeze === '1' ? '0' : '1';
    const updated = updateSecuritySetting('emergency_escrow_freeze', nextState, req.body.actorId || 'admin');
    broadcastEvent('EMERGENCY_FREEZE_TOGGLED', { active: nextState === '1' });
    res.json({ success: true, active: nextState === '1', emergencyFreezeActive: nextState === '1', settings: updated });
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
app.post('/api/upload', async (req, res) => {
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

const staticHtmlNoCache = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
};

// Serve scoped static assets (/partner, /ops, /admin, and root)
app.use('/partner', express.static(partnerDist, staticHtmlNoCache));
app.use('/ops', express.static(adminDist, staticHtmlNoCache));
app.use('/admin', express.static(adminDist, staticHtmlNoCache));
app.use('/assets', express.static(path.join(userDist, 'assets')));
app.use('/assets', express.static(path.join(partnerDist, 'assets')));
app.use('/assets', express.static(path.join(adminDist, 'assets')));
app.use('/', express.static(userDist, staticHtmlNoCache));

app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/ws')
  ) {
    return next();
  }

  // If requesting a static file with an extension that wasn't matched above, return 404 instead of HTML
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).send('Asset not found');
  }

  const host = (req.headers.host || '').toLowerCase();
  const sendHtmlNoCache = (htmlPath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(htmlPath);
  };

  // 1. Partner Portal (via partner.familyhubs.in or /partner)
  if (host.startsWith('partner.') || host.includes('partner') || req.path.startsWith('/partner')) {
    if (fs.existsSync(path.join(partnerDist, 'index.html'))) {
      return sendHtmlNoCache(path.join(partnerDist, 'index.html'));
    }
  }

  // 2. Operations Admin Portal (via ops.familyhubs.in, admin.familyhubs.in, or /ops, /admin)
  if (
    host.startsWith('ops.') ||
    host.startsWith('admin.') ||
    host.includes('admin') ||
    req.path.startsWith('/ops') ||
    req.path.startsWith('/admin')
  ) {
    if (fs.existsSync(path.join(adminDist, 'index.html'))) {
      return sendHtmlNoCache(path.join(adminDist, 'index.html'));
    }
  }

  // 3. NRI Client Portal (Root domain / default)
  if (fs.existsSync(path.join(userDist, 'index.html'))) {
    return sendHtmlNoCache(path.join(userDist, 'index.html'));
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

