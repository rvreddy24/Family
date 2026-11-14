const crypto = require("crypto");
const {
  db,
  getUserByEmail,
  getUserById,
  registerClientAccount,
  registerPartnerAccount,
  getTaskById,
} = require("./db");
const { supabaseAdmin } = require("./supabase");
const { createClient } = require("@supabase/supabase-js");

db.exec(
  "CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL)",
);
db.exec(
  "CREATE TABLE IF NOT EXISTS private_uploads (path TEXT PRIMARY KEY, owner TEXT NOT NULL)",
);
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
function roleHint(req) {
  const value =
    req.headers["x-familyhubs-portal"] ||
    (req.url?.startsWith("/ws")
      ? new URL(req.url, "http://localhost").searchParams.get("role")
      : null);
  return value && ["CLIENT", "ADMIN", "PARTNER"].includes(value) ? value : null;
}
function sessionToken(req) {
  const role = roleHint(req);
  const names = role
    ? [`fh_session_${role.toLowerCase()}`, "fh_session"]
    : [
        "fh_session_admin",
        "fh_session_partner",
        "fh_session_client",
        "fh_session",
      ];
  const cookies = (req.headers.cookie || "").split(";").map((x) => x.trim());
  for (const name of names) {
    const token = cookies
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) continue;
    const row = db
      .prepare("SELECT user_id FROM sessions WHERE digest=? AND expires>?")
      .get(digest(token), Date.now());
    const user = row ? getUserById(row.user_id) : null;
    if (user && (!role || user.role === role)) return { token, user, name };
  }
  return null;
}
function session(req) {
  return sessionToken(req)?.user || null;
}
function issue(req, res, user, json = true) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
    digest(token),
    user.id,
    Date.now() + 8 * 3600000,
  );
  res.append(
    "Set-Cookie",
    `fh_session_${user.role.toLowerCase()}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.secure ? "; Secure" : ""}`,
  );
  if (json) res.json({ success: true, user });
}
function install(app) {
  const attempts = new Map();
  const traffic = new Map();
  app.use("/api", (req, res, next) => {
    const now = Date.now();
    let record = traffic.get(req.ip);
    if (!record || record.until < now) {
      record = { count: 0, until: now + 60000 };
      traffic.set(req.ip, record);
    }
    if (traffic.size > 10000)
      for (const [key, value] of traffic)
        if (value.until < now) traffic.delete(key);
    if (++record.count > 240) {
      res.setHeader("Retry-After", "60");
      return res
        .status(429)
        .json({ error: "Too many requests. Please wait a minute." });
    }
    next();
  });
  app.use("/api/auth", (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let item = attempts.get(key);
    if (!item || now > item.until) {
      item = { count: 0, until: now + 60000 };
      attempts.set(key, item);
    }
    if (++item.count > 20)
      return res
        .status(429)
        .json({ error: "Too many attempts. Please try again in a minute." });
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (now > v.until) attempts.delete(k);
    next();
  });
  app.post("/api/auth/logout", (req, res) => {
    const current = sessionToken(req);
    if (current)
      db.prepare("DELETE FROM sessions WHERE digest=?").run(
        digest(current.token),
      );
    const name =
      current?.name ||
      (roleHint(req)
        ? `fh_session_${roleHint(req).toLowerCase()}`
        : "fh_session");
    res.append(
      "Set-Cookie",
      `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${req.secure ? "; Secure" : ""}`,
    );
    res.json({ success: true });
  });
  app.get("/api/auth/me", (req, res) => {
    const user = session(req);
    return user
      ? res.json({ user })
      : res.status(401).json({ error: "Please sign in." });
  });
  require("./google-auth").install(app, issue);
  app.use("/api/auth", async (req, res) => {
    try {
      if (!supabaseAdmin)
        return res.status(503).json({
          error:
            "Authentication is not configured. Contact the platform operator.",
        });
      const provider = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const {
        email,
        password,
        role,
        fullName,
        phone,
        countryResidence,
        operatingRegion,
        serviceCategory,
        accessToken,
      } = req.body || {};
      const requestedRole =
        role === "PARTNER" ? "PARTNER" : role === "ADMIN" ? "ADMIN" : "CLIENT";
      if (req.path === "/register" && req.method === "POST") {
        if (requestedRole === "ADMIN")
          return res
            .status(403)
            .json({ error: "Administrator registration is disabled." });
        if (
          !email ||
          !fullName?.trim() ||
          !phone?.trim() ||
          typeof password !== "string" ||
          password.length < 12
        )
          return res.status(400).json({
            error:
              "Name, phone, email and a password of at least 12 characters are required.",
          });
        const { error } = await provider.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              requested_role: requestedRole,
              country_residence: countryResidence,
              operating_region: operatingRegion,
              service_category: serviceCategory,
            },
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({
          success: true,
          confirmationRequired: true,
          message: "Check your email to confirm your account, then sign in.",
        });
      }
      if (req.method !== "POST" || !["/login", "/google"].includes(req.path))
        return res
          .status(404)
          .json({ error: "Authentication endpoint not available." });
      let identity;
      if (req.path === "/google") {
        if (!accessToken)
          return res
            .status(401)
            .json({ error: "Verified provider token required." });
        const { data, error } = await provider.auth.getUser(accessToken);
        if (error) throw Error("Invalid provider session.");
        identity = data.user;
      } else {
        if (!email || !password)
          return res
            .status(400)
            .json({ error: "Email and password are required." });
        const { data, error } = await provider.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          return res.status(401).json({
            error:
              "Email or password is incorrect, or email confirmation is pending.",
          });
        identity = data.user;
      }
      if (!identity?.email_confirmed_at)
        return res
          .status(403)
          .json({ error: "Please confirm your email before signing in." });
      let user = getUserByEmail(identity.email.toLowerCase());
      if (!user) {
        const meta = identity.user_metadata || {};
        if (requestedRole === "ADMIN")
          return res.status(403).json({
            error: "Administrator must be provisioned by the operator.",
          });
        const account = {
          email: identity.email.toLowerCase(),
          fullName: meta.full_name || identity.email,
          phone: meta.phone || "",
          authProviderId: identity.id,
          countryResidence: meta.country_residence || "",
          subscriptionTier: "NONE",
          operatingRegion: meta.operating_region || "",
          serviceCategory: meta.service_category || "ERRANDS",
        };
        if (requestedRole !== (meta.requested_role || "CLIENT"))
          return res
            .status(403)
            .json({ error: "Use the portal you registered with." });
        requestedRole === "PARTNER"
          ? registerPartnerAccount(account)
          : registerClientAccount(account);
        user = getUserByEmail(account.email);
      }
      if (user.role !== requestedRole)
        return res
          .status(403)
          .json({ error: "This account belongs to a different portal." });
      issue(req, res, user);
    } catch (error) {
      res
        .status(401)
        .json({ error: error.message || "Authentication failed." });
    }
  });
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    const user = session(req);
    if (!user) return res.status(401).json({ error: "Please sign in." });
    req.user = user;
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map((x) => x.trim());
      if (
        origin &&
        origin !== `${req.protocol}://${req.get("host")}` &&
        !allowed.includes(origin)
      )
        return res.status(403).json({ error: "Origin not allowed." });
    }
    const p = req.path;
    const body = req.body || {};
    for (const key of [
      "parentId",
      "parent_id",
      "parentName",
      "primaryPhone",
      "whatsappPhone",
      "locality",
      "fullAddress",
      "medicalNotes",
      "title",
      "instructions",
      "notes",
      "partnerId",
      "medicineName",
      "dosage",
      "frequency",
      "fileUrl",
      "fullName",
      "resolutionNotes",
    ])
      if (
        body[key] !== undefined &&
        (typeof body[key] !== "string" || body[key].length > 4000)
      )
        return res.status(400).json({ error: "Invalid text field." });
    if (
      user.role === "PARTNER" &&
      (p === "/parents" || p === "/client/profile")
    )
      return res.status(403).json({ error: "Family access required." });
    if (p.startsWith("/security/reset-clean"))
      return res
        .status(410)
        .json({ error: "Remote database reset has been removed." });
    if (
      /^\/security|^\/whatsapp|^\/escrow|^\/supabase/.test(p) &&
      user.role !== "ADMIN"
    )
      return res.status(403).json({ error: "Operations access required." });
    if (user.role === "ADMIN") {
      body.adminId = user.id;
      body.actorId = user.id;
    }
    const deny = () =>
      res.status(403).json({ error: "You do not have access to this record." });
    const parentAccess = (id) =>
      user.role === "ADMIN" ||
      !!db
        .prepare(
          user.role === "CLIENT"
            ? "SELECT id FROM parents_profile WHERE id=? AND client_id=?"
            : "SELECT id FROM tasks WHERE parent_id=? AND assigned_partner_id=? AND status IN ('ACCEPTED','IN_PROGRESS','VERIFICATION_SUBMITTED')",
        )
        .get(id, user.id);
    if (p === "/tasks" && req.method === "POST") {
      if (
        !body.parentId ||
        !parentAccess(body.parentId) ||
        ![
          "ERRANDS",
          "MEDICAL_TRANSPORT",
          "HOME_MAINTENANCE",
          "EMERGENCY",
        ].includes(body.category) ||
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.length > 160 ||
        !body.instructions?.trim() ||
        !Number.isFinite(Date.parse(body.scheduledAt)) ||
        Date.parse(body.scheduledAt) < Date.now() - 60000
      )
        return res.status(400).json({
          error:
            "Provide a parent, service, description and a future visit time.",
        });
    }
    if (
      (p === "/parents" && req.method === "POST") ||
      (/^\/parents\/[^/]+$/.test(p) && req.method === "PUT")
    ) {
      if (
        !body.parentName?.trim() ||
        !body.primaryPhone?.trim() ||
        !body.locality?.trim() ||
        !body.fullAddress?.trim() ||
        typeof body.coordinatesLat !== "number" ||
        typeof body.coordinatesLng !== "number" ||
        !Number.isFinite(body.coordinatesLat) ||
        !Number.isFinite(body.coordinatesLng) ||
        Math.abs(body.coordinatesLat) > 90 ||
        Math.abs(body.coordinatesLng) > 180
      )
        return res.status(400).json({
          error:
            "Provide contact details, a full address and valid home coordinates.",
        });
    }
    if (/\/assign$/.test(p)) {
      if (user.role !== "ADMIN") return deny();
      const target = db
        .prepare("SELECT * FROM partners_profile WHERE user_id=?")
        .get(body.partnerId || "");
      if (user.role !== "ADMIN" || !target?.kyc_verified || !target.is_active)
        return res
          .status(400)
          .json({ error: "Choose an on-duty, verified partner." });
      const task = getTaskById(p.split("/")[2]);
      if (!task || task.status !== "PENDING_OPS_REVIEW")
        return res
          .status(409)
          .json({ error: "Only pending requests can be assigned." });
    }
    if (/\/vitals$/.test(p) && req.method === "POST") {
      for (const [key, min, max] of [
        ["bloodPressureSys", 40, 300],
        ["bloodPressureDia", 20, 200],
        ["pulse", 20, 250],
        ["spo2", 1, 100],
      ]) {
        const value = body[key];
        if (
          value !== undefined &&
          (typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < min ||
            value > max)
        )
          return res.status(400).json({
            error: "Health reading is outside the accepted input range.",
          });
      }
    }
    if (
      /\/documents$/.test(p) &&
      req.method === "POST" &&
      (!body.title?.trim() || !/^https:\/\//.test(body.fileUrl || ""))
    )
      return res
        .status(400)
        .json({ error: "Provide a title and a secure HTTPS document URL." });
    if (
      /\/medications$/.test(p) &&
      req.method === "POST" &&
      (!body.medicineName?.trim() ||
        !body.dosage?.trim() ||
        !body.frequency?.trim())
    )
      return res.status(400).json({
        error: "Medicine, prescribed dose and frequency are required.",
      });
    if (
      /\/duty$/.test(p) &&
      req.method === "POST" &&
      typeof body.isActive !== "boolean"
    )
      return res
        .status(400)
        .json({ error: "Duty status must be true or false." });
    if (/\/location$/.test(p) && req.method === "POST") {
      if (
        typeof body.latitude !== "number" ||
        typeof body.longitude !== "number" ||
        !Number.isFinite(body.latitude) ||
        !Number.isFinite(body.longitude) ||
        Math.abs(body.latitude) > 90 ||
        Math.abs(body.longitude) > 180
      )
        return res
          .status(400)
          .json({ error: "Valid location coordinates are required." });
    }
    if (user.role === "ADMIN") return next();
    if (p === "/tasks" && req.method === "GET") {
      // Express 5 query objects are getters: define a scoped copy.
      Object.defineProperty(req, "query", {
        value: {
          ...req.query,
          clientId: user.role === "CLIENT" ? user.id : undefined,
          partnerId: user.role === "PARTNER" ? user.id : undefined,
        },
        configurable: true,
      });
    }
    const taskMatch = p.match(/^\/tasks\/([^/]+)/);
    if (taskMatch) {
      const task = getTaskById(taskMatch[1]);
      if (!task) return res.status(404).json({ error: "Task not found." });
      if (
        (user.role === "CLIENT" ? task.client_id : task.assigned_partner_id) !==
        user.id
      )
        return deny();
      if (/\/(assign|escrow|reject)/.test(p)) return deny();
      if (
        user.role === "CLIENT" &&
        req.method !== "GET" &&
        !p.endsWith("/review")
      )
        return deny();
      if (
        user.role === "PARTNER" &&
        req.method !== "GET" &&
        !/\/(accept|start|verify)$/.test(p)
      )
        return deny();
      body.partnerId =
        user.role === "PARTNER" ? user.id : task.assigned_partner_id;
      delete body.taskId;
      delete body.task_id;
      const suffix = p.split("/").pop();
      if (
        suffix === "review" &&
        req.method === "POST" &&
        (task.status !== "COMPLETED" ||
          !Number.isInteger(body.rating) ||
          body.rating < 1 ||
          body.rating > 5)
      )
        return res
          .status(400)
          .json({
            error:
              "Only completed visits can be reviewed with a rating from one to five.",
          });
      if (
        (suffix === "accept" && task.status !== "DISPATCHED") ||
        (suffix === "start" && task.status !== "ACCEPTED")
      )
        return res
          .status(409)
          .json({ error: "This task has already moved to another stage." });
      if (suffix === "verify") {
        if (
          !["ARRIVAL_CHECKIN", "TASK_COMPLETION"].includes(body.stage) ||
          (body.stage === "ARRIVAL_CHECKIN" && task.status !== "ACCEPTED") ||
          (body.stage === "TASK_COMPLETION" && task.status !== "IN_PROGRESS")
        )
          return res.status(409).json({ error: "Invalid visit stage." });
        if (
          !db
            .prepare(
              "SELECT path FROM private_uploads WHERE path=? AND owner=?",
            )
            .get(body.selfieImageUrl || "", user.id)
        )
          return deny();
      }
    }
    const parentMatch = p.match(/^\/parents\/([^/]+)/);
    if (parentMatch && !parentAccess(parentMatch[1])) return deny();
    if (
      parentMatch &&
      user.role === "PARTNER" &&
      req.method !== "GET" &&
      !p.endsWith("/vitals")
    )
      return deny();
    const medMatch = p.match(/\/medications\/([^/]+)/);
    if (
      medMatch &&
      !db
        .prepare("SELECT id FROM parent_medications WHERE id=? AND parent_id=?")
        .get(medMatch[1], parentMatch?.[1])
    )
      return deny();
    const partnerMatch = p.match(/^\/partners\/([^/]+)/);
    if (partnerMatch && partnerMatch[1] !== user.id) {
      if (
        req.method !== "GET" ||
        !db
          .prepare(
            "SELECT id FROM tasks WHERE client_id=? AND assigned_partner_id=?",
          )
          .get(user.id, partnerMatch[1])
      )
        return deny();
    }
    if (
      p === "/partners" ||
      (p.startsWith("/emergency/") && p !== "/emergency/sos")
    )
      return deny();
    const family = p.match(/^\/clients\/([^/]+)/);
    if (family && (user.role !== "CLIENT" || family[1] !== user.id))
      return deny();
    if (
      ["/tasks", "/parents", "/client/profile", "/emergency/sos"].includes(p) &&
      req.method !== "GET" &&
      user.role !== "CLIENT"
    )
      return deny();
    if (body.parentId && !parentAccess(body.parentId)) return deny();
    if (body.parent_id && !parentAccess(body.parent_id)) return deny();
    if (user.role === "CLIENT") {
      body.clientId = user.id;
      body.client_id = user.id;
      Object.defineProperty(req, "query", {
        value: { ...req.query, clientId: user.id },
        configurable: true,
      });
    }
    body.recordedBy = user.id;
    body.uploadedBy = user.id;
    body.triggeredByUserId = user.id;
    if (parentMatch) {
      delete body.parentId;
      delete body.parent_id;
    }
    next();
  });
}
module.exports = { install, session };
