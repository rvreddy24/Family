const crypto = require("crypto");
const {
  createClient
} = require("@supabase/supabase-js");
const {
  db,
  getUserByEmail
} = require("./db");
const paths = {
  CLIENT: "/",
  ADMIN: "/ops/",
  PARTNER: "/partner/"
};
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
async function install(app, issue) {
  await db.exec("CREATE TABLE IF NOT EXISTS google_oauth_flows (digest TEXT PRIMARY KEY, role TEXT NOT NULL, storage TEXT NOT NULL, flow_id TEXT, return_to TEXT NOT NULL, expires INTEGER NOT NULL)");
  function provider(storageValues = {}) {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "familyhubs-google",
        storage: {
          getItem: key => storageValues[key] || null,
          setItem: (key, value) => {
            storageValues[key] = value;
          },
          removeItem: key => {
            delete storageValues[key];
          }
        }
      }
    });
  }
  function cookieName(role) {
    return `fh_google_${role.toLowerCase()}`;
  }
  function fail(res, destination, message) {
    return res.redirect(303, `${destination}?auth_error=${encodeURIComponent(message)}`);
  }
  app.get("/api/auth/google/start", async (req, res) => {
    const role = req.query.role;
    if (!Object.hasOwn(paths, role)) return res.status(400).json({
      error: "Choose a valid portal."
    });
    let origin;
    try {
      origin = new URL(req.query.origin || `${req.protocol}://${req.get("host")}`).origin;
      const allowed = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim());
      if (!allowed.includes(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):(3001|3002|3003|4000)$/.test(origin)) return res.status(400).json({
        error: "This portal origin is not configured for sign-in."
      });
    } catch {
      return res.status(400).json({
        error: "Invalid portal origin."
      });
    }
    const destination = origin + paths[role];
    try {
      if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return fail(res, destination, "Authentication is not configured.");
      const settings = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        signal: AbortSignal.timeout(10000)
      });
      const config = await settings.json();
      if (!settings.ok || config.external?.google !== true) return fail(res, destination, "Google sign-in is not enabled in Supabase yet. Please use email sign-in.");
      const state = crypto.randomBytes(32).toString("hex");
      const values = {};
      const callback = `${origin}/api/auth/google/callback?state=${state}&role=${role}`;
      const {
        data,
        error
      } = await provider(values).auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account"
          }
        }
      });
      if (error || !data.url) return fail(res, destination, "Google sign-in could not start. Please try again.");
      await db.prepare("DELETE FROM google_oauth_flows WHERE expires < ?").run(Date.now());
      await db.prepare("INSERT INTO google_oauth_flows VALUES (?,?,?,?,?,?)").run(hash(state), role, JSON.stringify(values), data.flowId || null, destination, Date.now() + 600000);
      res.setHeader("Set-Cookie", `${cookieName(role)}=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=600${req.secure ? "; Secure" : ""}`);
      res.redirect(303, data.url);
    } catch {
      return fail(res, destination, "Google sign-in is temporarily unavailable. Please try again.");
    }
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const {
      state,
      role,
      code
    } = req.query;
    if (!Object.hasOwn(paths, role) || typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state)) return res.status(400).json({
      error: "Invalid Google sign-in callback. Start sign-in again."
    });
    const supplied = (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(cookieName(role) + "="))?.split("=")[1];
    if (supplied !== state) return res.status(403).json({
      error: "Google sign-in verification failed. Start sign-in again from this browser."
    });
    const flow = await db.prepare("SELECT * FROM google_oauth_flows WHERE digest=? AND role=? AND expires>?").get(hash(state), role, Date.now());
    if (!flow) return res.status(400).json({
      error: "Google sign-in expired or has already been used. Please start again."
    });
    await db.prepare("DELETE FROM google_oauth_flows WHERE digest=?").run(hash(state));
    res.setHeader("Set-Cookie", `${cookieName(role)}=; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=0${req.secure ? "; Secure" : ""}`);
    if (req.query.error || typeof code !== "string" || !code) return fail(res, flow.return_to, "Google sign-in was cancelled or could not be completed.");
    try {
      const client = provider(JSON.parse(flow.storage));
      const {
        data,
        error
      } = await client.auth.exchangeCodeForSession(code, {
        flowId: flow.flow_id || undefined
      });
      if (error || !data.session?.access_token) return fail(res, flow.return_to, "Google sign-in could not be verified. Please start again.");
      const checked = await client.auth.getUser(data.session.access_token);
      const identity = checked.data?.user;
      if (checked.error || !identity?.email_confirmed_at || !identity.email || !identity.identities?.some(i => i.provider === "google")) return fail(res, flow.return_to, "A verified Google account is required.");
      // Google login links only to existing provisioned accounts. It never creates an admin or changes a role.
      const user = await getUserByEmail(identity.email.toLowerCase());
      if (!user) return fail(res, flow.return_to, role === "ADMIN" ? "Your Google account is not an authorized administrator." : "Create a FamilyHubs account with this email first, then sign in with Google.");
      if (user.role !== role) return fail(res, flow.return_to, "This account belongs to a different portal. Use its registered portal.");
      await issue(req, res, user, false);
      res.redirect(303, flow.return_to);
    } catch {
      return fail(res, flow.return_to, "Google sign-in could not be verified. Please try again.");
    }
  });
}
module.exports = {
  install
};
