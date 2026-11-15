const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const express = require("express");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "familyhubs-oauth-"));
process.env.DB_PATH = path.join(directory, "oauth.db");
const identities = {
  client: {
    id: "google-client",
    email: "client@example.com",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ provider: "google" }],
  },
  partner: {
    id: "google-partner",
    email: "partner@example.com",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ provider: "google" }],
  },
  admin: {
    id: "google-admin",
    email: "admin@familyhubs.in",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ provider: "google" }],
  },
  unknown: {
    id: "unknown",
    email: "unknown@example.com",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ provider: "google" }],
  },
  unverified: {
    id: "unverified",
    email: "client@example.com",
    identities: [{ provider: "google" }],
  },
  nongoogle: {
    id: "nongoogle",
    email: "client@example.com",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ provider: "email" }],
  },
};
const challenges = new Map();
let providerEnabled = true;
let checks = 0;
function check(a, b, message) {
  assert.deepEqual(a, b, message);
  checks++;
  console.log("PASS " + message);
}
const jwt = (id) =>
  [
    "e30",
    Buffer.from(
      JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url"),
    "signature",
  ].join(".");
const mock = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/auth/v1/settings")
    return res.end(JSON.stringify({ external: { google: providerEnabled } }));
  if (req.url.startsWith("/auth/v1/token")) {
    let raw = "";
    for await (const piece of req) raw += piece;
    const body = JSON.parse(raw);
    const code = body.auth_code;
    if (
      !challenges.has(code) ||
      crypto
        .createHash("sha256")
        .update(body.code_verifier || "")
        .digest("base64url") !== challenges.get(code)
    ) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          error: "invalid_grant",
          message: "Invalid PKCE verifier",
        }),
      );
    }
    challenges.delete(code);
    const identity = identities[code.split("-")[0]];
    return res.end(
      JSON.stringify({
        access_token: jwt(identity.id),
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: identity,
      }),
    );
  }
  if (req.url === "/auth/v1/user") {
    const token = req.headers.authorization?.slice(7);
    const id = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ).sub;
    return res.end(
      JSON.stringify(Object.values(identities).find((u) => u.id === id)),
    );
  }
  res.statusCode = 404;
  res.end("{}");
});
const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
(async () => {
  let server, db;
  try {
    await listen(mock);
    process.env.SUPABASE_URL = `http://127.0.0.1:${mock.address().port}`;
    process.env.SUPABASE_ANON_KEY = "fixture-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service";
    const data = require("../server/db");
    db = data.db;
    await data.initDatabase();
    await db.prepare("INSERT INTO users (id,role,email,phone,full_name) VALUES ('admin-fixture','ADMIN','admin@familyhubs.in','1234567890','Operations fixture')").run();
    await data.registerClientAccount({
      email: "client@example.com",
      fullName: "Client fixture",
      phone: "1234567890",
      countryResidence: "India",
    });
    await data.registerPartnerAccount({
      email: "partner@example.com",
      fullName: "Partner fixture",
      phone: "1234567890",
      operatingRegion: "Test",
    });
    const app = express();
    app.set("trust proxy", "loopback");
    app.use(express.json());
    await require("../server/access").install(app);
    server = http.createServer(app);
    await listen(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.CORS_ORIGIN = base;
    let client = 0;
    const request = (url, options = {}) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "X-Forwarded-For": `192.0.2.${++client}`,
        },
        redirect: "manual",
      });
    async function begin(role) {
      const response = await request(
        `${base}/api/auth/google/start?role=${role}&origin=${encodeURIComponent(base)}`,
      );
      check(response.status, 303, `${role} OAuth starts`);
      const authorize = new URL(response.headers.get("location"));
      check(
        authorize.searchParams.get("provider"),
        "google",
        `${role} chooses Google`,
      );
      check(
        authorize.searchParams.get("code_challenge_method"),
        "s256",
        `${role} uses PKCE`,
      );
      return {
        cookie: response.headers.get("set-cookie").split(";")[0],
        callback: authorize.searchParams.get("redirect_to"),
        challenge: authorize.searchParams.get("code_challenge"),
      };
    }
    async function complete(role, identity) {
      const flow = await begin(role);
      const code = `${identity}-${crypto.randomUUID()}`;
      challenges.set(code, flow.challenge);
      const callback = flow.callback + "&code=" + code;
      const response = await request(callback, {
        headers: { Cookie: flow.cookie },
      });
      return { flow, response, callback };
    }
    const cookies = [];
    for (const [role, identity, destination] of [
      ["CLIENT", "client", "/"],
      ["ADMIN", "admin", "/ops/"],
      ["PARTNER", "partner", "/partner/"],
    ]) {
      const { response, callback, flow } = await complete(role, identity);
      check(response.status, 303, `${role} callback succeeds`);
      check(
        response.headers.get("location"),
        base + destination,
        `${role} returns to correct portal`,
      );
      const values = response.headers.getSetCookie();
      const cookie = values.find((x) =>
        x.startsWith(`fh_session_${role.toLowerCase()}=`),
      );
      assert.ok(cookie);
      check(cookie.includes("HttpOnly"), true, `${role} session is HttpOnly`);
      cookies.push(cookie.split(";")[0]);
      const replay = await request(callback, {
        headers: { Cookie: flow.cookie },
      });
      check(replay.status, 400, `${role} callback cannot be replayed`);
    }
    const combined = cookies.join("; ");
    for (const role of ["CLIENT", "ADMIN", "PARTNER"]) {
      const response = await request(base + "/api/auth/me", {
        headers: { Cookie: combined, "X-FamilyHubs-Portal": role },
      });
      check(
        (await response.json()).user.role,
        role,
        `${role} session coexists with other portal sessions`,
      );
    }
    const mismatch = await complete("ADMIN", "client");
    check(
      new URL(mismatch.response.headers.get("location")).searchParams.has(
        "auth_error",
      ),
      true,
      "Google cannot promote a client to administrator",
    );
    const unknown = await complete("ADMIN", "unknown");
    check(
      new URL(unknown.response.headers.get("location")).searchParams.has(
        "auth_error",
      ),
      true,
      "Google cannot create an administrator",
    );
    const unverified = await complete("CLIENT", "unverified");
    check(
      new URL(unverified.response.headers.get("location")).searchParams.has(
        "auth_error",
      ),
      true,
      "unverified identity rejected",
    );
    const nongoogle = await complete("CLIENT", "nongoogle");
    check(
      new URL(nongoogle.response.headers.get("location")).searchParams.has(
        "auth_error",
      ),
      true,
      "non-Google identity rejected",
    );
    const flow = await begin("CLIENT");
    const csrf = await request(flow.callback + "&code=forged");
    check(csrf.status, 403, "callback requires same-browser state cookie");
    await db.prepare("UPDATE google_oauth_flows SET expires=0").run();
    const expired = await request(flow.callback + "&code=expired", {
      headers: { Cookie: flow.cookie },
    });
    check(expired.status, 400, "expired Google flows rejected");
    const badOrigin = await request(
      `${base}/api/auth/google/start?role=CLIENT&origin=https://attacker.example`,
    );
    check(badOrigin.status, 400, "untrusted redirect origin rejected");
    providerEnabled = false;
    const disabled = await request(
      `${base}/api/auth/google/start?role=CLIENT&origin=${encodeURIComponent(base)}`,
    );
    check(
      new URL(disabled.headers.get("location")).searchParams.has("auth_error"),
      true,
      "provider disabled error is actionable",
    );
    await request(base + "/api/auth/logout", {
      method: "POST",
      headers: { Cookie: combined, "X-FamilyHubs-Portal": "ADMIN" },
    });
    const still = await request(base + "/api/auth/me", {
      headers: { Cookie: combined, "X-FamilyHubs-Portal": "CLIENT" },
    });
    check(
      (await still.json()).user.role,
      "CLIENT",
      "operations logout preserves family login",
    );
    console.log(
      `${checks} Google OAuth and multi-portal session checks passed (mock provider; no external accounts used).`,
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => mock.close(resolve));
    await db?.close();
  }
})();
