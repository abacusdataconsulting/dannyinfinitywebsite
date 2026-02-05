var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-8ETYev/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-8ETYev/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
__name(errorResponse, "errorResponse");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");
function getClientInfo(request) {
  return {
    ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown",
    country: request.headers.get("CF-IPCountry") || null,
    city: request.cf?.city || null,
    region: request.cf?.region || null
  };
}
__name(getClientInfo, "getClientInfo");
async function verifyAdmin(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const session = await env.DB.prepare(`
        SELECT s.*, u.is_admin
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();
  if (!session || !session.is_admin) {
    return null;
  }
  return session;
}
__name(verifyAdmin, "verifyAdmin");
async function handleVisit(request, env) {
  try {
    const body = await request.json();
    const clientInfo = getClientInfo(request);
    let userId = null;
    if (body.name) {
      const user = await env.DB.prepare(
        "SELECT id FROM users WHERE name = ? COLLATE NOCASE"
      ).bind(body.name).first();
      if (user) {
        userId = user.id;
        await env.DB.prepare(
          "UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(userId).run();
      }
    }
    const result = await env.DB.prepare(`
            INSERT INTO visits (
                user_id, name, login_type, ip_address, country, city, region,
                user_agent, device_type, os, os_version, browser, browser_version, browser_engine,
                language, screen_width, screen_height, window_width, window_height,
                timezone, referrer, client_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      userId,
      body.name || null,
      body.loginType || null,
      clientInfo.ip,
      clientInfo.country,
      clientInfo.city,
      clientInfo.region,
      body.userAgent || null,
      body.deviceType || null,
      body.os || null,
      body.osVersion || null,
      body.browser || null,
      body.browserVersion || null,
      body.browserEngine || null,
      body.language || null,
      body.screenWidth || null,
      body.screenHeight || null,
      body.windowWidth || null,
      body.windowHeight || null,
      body.timezone || null,
      body.referrer || null,
      body.clientTimestamp || null
    ).run();
    return jsonResponse({
      success: true,
      visitId: result.meta.last_row_id,
      recognized: userId !== null
    });
  } catch (error) {
    console.error("Visit error:", error);
    return errorResponse("Failed to log visit", 500);
  }
}
__name(handleVisit, "handleVisit");
async function handleUserCheck(name, env) {
  try {
    const user = await env.DB.prepare(
      "SELECT id, name, password_hash IS NOT NULL as has_password FROM users WHERE name = ? COLLATE NOCASE"
    ).bind(name).first();
    if (user) {
      return jsonResponse({
        recognized: true,
        name: user.name,
        hasPassword: Boolean(user.has_password)
      });
    }
    return jsonResponse({
      recognized: false
    });
  } catch (error) {
    console.error("User check error:", error);
    return errorResponse("Failed to check user", 500);
  }
}
__name(handleUserCheck, "handleUserCheck");
async function handleUserRegister(request, env) {
  try {
    const body = await request.json();
    if (!body.name || body.name.trim().length < 2) {
      return errorResponse("Name must be at least 2 characters");
    }
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE name = ? COLLATE NOCASE"
    ).bind(body.name.trim()).first();
    if (existing) {
      return errorResponse("User already exists", 409);
    }
    let passwordHash = null;
    if (body.password) {
      passwordHash = await hashPassword(body.password);
    }
    const result = await env.DB.prepare(
      "INSERT INTO users (name, password_hash) VALUES (?, ?)"
    ).bind(body.name.trim(), passwordHash).run();
    return jsonResponse({
      success: true,
      userId: result.meta.last_row_id,
      message: "User registered successfully"
    });
  } catch (error) {
    console.error("Register error:", error);
    return errorResponse("Failed to register user", 500);
  }
}
__name(handleUserRegister, "handleUserRegister");
async function handleUserLogin(request, env) {
  try {
    const body = await request.json();
    if (!body.name) {
      return errorResponse("Name is required");
    }
    const user = await env.DB.prepare(
      "SELECT id, name, password_hash, is_admin FROM users WHERE name = ? COLLATE NOCASE"
    ).bind(body.name).first();
    if (!user) {
      return errorResponse("User not found", 404);
    }
    if (user.password_hash) {
      if (!body.password) {
        return errorResponse("Password required", 401);
      }
      const inputHash = await hashPassword(body.password);
      if (inputHash !== user.password_hash) {
        return errorResponse("Invalid password", 401);
      }
    }
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    await env.DB.prepare(
      "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)"
    ).bind(user.id, token, expiresAt.toISOString()).run();
    await env.DB.prepare(
      "UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id).run();
    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        isAdmin: Boolean(user.is_admin)
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Failed to login", 500);
  }
}
__name(handleUserLogin, "handleUserLogin");
async function handleGetVisits(request, env) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const visits = await env.DB.prepare(`
            SELECT
                v.*,
                u.name as user_name
            FROM visits v
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.visited_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM visits"
    ).first();
    return jsonResponse({
      visits: visits.results,
      total: countResult.total,
      limit,
      offset
    });
  } catch (error) {
    console.error("Get visits error:", error);
    return errorResponse("Failed to get visits", 500);
  }
}
__name(handleGetVisits, "handleGetVisits");
async function handleGetUsers(request, env) {
  try {
    const users = await env.DB.prepare(`
            SELECT
                id, name, is_admin, created_at, last_seen,
                password_hash IS NOT NULL as has_password
            FROM users
            ORDER BY last_seen DESC
        `).all();
    return jsonResponse({
      users: users.results
    });
  } catch (error) {
    console.error("Get users error:", error);
    return errorResponse("Failed to get users", 500);
  }
}
__name(handleGetUsers, "handleGetUsers");
async function handleAdminGetVisits(request, env) {
  const admin = await verifyAdmin(request, env);
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const visits = await env.DB.prepare(`
            SELECT *
            FROM visits
            ORDER BY visited_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM visits"
    ).first();
    return jsonResponse({
      visits: visits.results,
      total: countResult.total,
      hasMore: offset + visits.results.length < countResult.total,
      limit,
      offset
    });
  } catch (error) {
    console.error("Admin get visits error:", error);
    return errorResponse("Failed to get visits", 500);
  }
}
__name(handleAdminGetVisits, "handleAdminGetVisits");
async function handleAdminGetUsers(request, env) {
  const admin = await verifyAdmin(request, env);
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const users = await env.DB.prepare(`
            SELECT
                id, name, is_admin, created_at, last_seen,
                password_hash IS NOT NULL as has_password
            FROM users
            ORDER BY last_seen DESC
        `).all();
    return jsonResponse({
      users: users.results
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    return errorResponse("Failed to get users", 500);
  }
}
__name(handleAdminGetUsers, "handleAdminGetUsers");
async function handleAdminGetStats(request, env) {
  const admin = await verifyAdmin(request, env);
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const totalVisits = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM visits"
    ).first();
    const uniqueVisitors = await env.DB.prepare(
      "SELECT COUNT(DISTINCT ip_address) as count FROM visits"
    ).first();
    const totalUsers = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM users"
    ).first();
    const visitsToday = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM visits WHERE date(visited_at) = date('now')"
    ).first();
    const deviceStats = await env.DB.prepare(`
            SELECT device_type, COUNT(*) as count
            FROM visits
            WHERE device_type IS NOT NULL
            GROUP BY device_type
        `).all();
    const loginStats = await env.DB.prepare(`
            SELECT login_type, COUNT(*) as count
            FROM visits
            WHERE login_type IS NOT NULL
            GROUP BY login_type
        `).all();
    const osStats = await env.DB.prepare(`
            SELECT os, COUNT(*) as count
            FROM visits
            WHERE os IS NOT NULL
            GROUP BY os
            ORDER BY count DESC
            LIMIT 5
        `).all();
    const browserStats = await env.DB.prepare(`
            SELECT browser, COUNT(*) as count
            FROM visits
            WHERE browser IS NOT NULL
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 5
        `).all();
    const deviceObj = {};
    deviceStats.results.forEach((d) => {
      deviceObj[d.device_type] = d.count;
    });
    const loginObj = {};
    loginStats.results.forEach((l) => {
      loginObj[l.login_type] = l.count;
    });
    return jsonResponse({
      totalVisits: totalVisits.count,
      uniqueVisitors: uniqueVisitors.count,
      totalUsers: totalUsers.count,
      visitsToday: visitsToday.count,
      deviceStats: deviceObj,
      loginStats: loginObj,
      osStats: osStats.results,
      browserStats: browserStats.results
    });
  } catch (error) {
    console.error("Admin get stats error:", error);
    return errorResponse("Failed to get stats", 500);
  }
}
__name(handleAdminGetStats, "handleAdminGetStats");
var src_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/api/visit" && method === "POST") {
        return handleVisit(request, env);
      }
      if (path.startsWith("/api/user/check/") && method === "GET") {
        const name = decodeURIComponent(path.split("/").pop());
        return handleUserCheck(name, env);
      }
      if (path === "/api/user/register" && method === "POST") {
        return handleUserRegister(request, env);
      }
      if (path === "/api/user/login" && method === "POST") {
        return handleUserLogin(request, env);
      }
      if (path === "/api/visits" && method === "GET") {
        return handleGetVisits(request, env);
      }
      if (path === "/api/users" && method === "GET") {
        return handleGetUsers(request, env);
      }
      if (path === "/api/admin/visits" && method === "GET") {
        return handleAdminGetVisits(request, env);
      }
      if (path === "/api/admin/users" && method === "GET") {
        return handleAdminGetUsers(request, env);
      }
      if (path === "/api/admin/stats" && method === "GET") {
        return handleAdminGetStats(request, env);
      }
      if (path === "/api/health") {
        return jsonResponse({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      }
      return errorResponse("Not found", 404);
    } catch (error) {
      console.error("Unhandled error:", error);
      return errorResponse("Internal server error", 500);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-8ETYev/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-8ETYev/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
