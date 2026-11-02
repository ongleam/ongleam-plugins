import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const methods = ["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFinished", "Network.loadingFailed"];
export const sha256 = text => createHash("sha256").update(text).digest("hex");

export function validateCapture(value, depth = 0) {
  if (depth > 64) throw new Error("JSON nesting exceeds 64");
  if (Array.isArray(value)) return value.forEach(child => validateCapture(child, depth + 1));
  if (typeof value === "string" && value.includes("mocked_username")) throw new Error("Mocked Marketplace data");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:__proto__|constructor|prototype|access_?token|refresh_?token|app_?secret|authorization|cookie|set-cookie|fb_dtsg|lsd|jazoest)$/i.test(key)) throw new Error("Session material or unsafe JSON key");
    validateCapture(child, depth + 1);
  }
}

export function parseResponses(body) {
  const text = body.replace(/^for\s*\(;;\);\s*/, "").trim();
  let responses;
  try { responses = [JSON.parse(text)]; }
  catch { responses = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  validateCapture(responses);
  if (!responses.length || responses.some(item => item.errors?.length || item.error)) throw new Error("GraphQL error or empty response");
  if (!responses.some(item => item.data?.cam_creator_profile_for_id || item.data?.cam_business_profile?.brand_profile?.creator_discovery_search)) throw new Error("Unknown Marketplace response structure");
  return responses;
}

export async function startCapture(cdp, directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await cdp.send("Network.enable");
  const { cursor } = await cdp.readEvents({ methods });
  return { cdp, directory, cursor, requests: new Map(), count: 0, lastAction: null, documents: 0, stopped: false };
}

export async function beginAction(session) {
  if (session.stopped || session.count >= 10) throw new Error("Capture stopped or 10-action session limit reached");
  const remaining = session.lastAction === null ? 0 : 30_000 - (Date.now() - session.lastAction);
  if (remaining > 0) throw new Error(`Wait at least ${Math.ceil(remaining / 1000)} seconds before another UI action`);
  const pending = await session.cdp.readEvents({ afterSequence: session.cursor, methods, limit: 1000 });
  if (pending.truncated || pending.events.length || pending.hasMore) throw new Error("Collect outstanding events before another UI action");
  session.cursor = pending.cursor;
  session.lastAction = Date.now();
  session.count++;
}

export async function collectResponses(session) {
  if (session.stopped) throw new Error("Capture stopped");
  let hasMore;
  try {
    do {
      const page = await session.cdp.readEvents({ afterSequence: session.cursor, methods, limit: 1000 });
      if (page.truncated) throw new Error("Network events lost; capture incomplete");
      for (const event of page.events) {
        const p = event.params;
        if (!p) continue;
        if (event.method === "Network.requestWillBeSent") {
          const url = new URL(p.request.url);
          if (url.origin !== "https://business.facebook.com" || url.pathname !== "/api/graphql/") continue;
          const form = new URLSearchParams(p.request.postData ?? "");
          const operation = form.get("fb_api_req_friendly_name");
          if (!operation || !/CreatorMarketplace|CreatorPortfolio/.test(operation)) continue;
          const variables = JSON.parse(form.get("variables") ?? "{}");
          validateCapture(variables);
          if (!Number.isFinite(p.wallTime)) throw new Error("Missing observed request time");
          session.requests.set(p.requestId, { operation, variables, docId: form.get("doc_id"), observedAt: new Date(p.wallTime * 1000).toISOString() });
        }
        const record = session.requests.get(p.requestId);
        if (!record) continue;
        if (event.method === "Network.responseReceived" && p.response.status >= 400) throw new Error(`Marketplace HTTP ${p.response.status}; stop collection`);
        if (event.method === "Network.loadingFailed") throw new Error("Marketplace request failed; capture incomplete");
        if (event.method !== "Network.loadingFinished") continue;
        const response = await session.cdp.send("Network.getResponseBody", { requestId: p.requestId });
        const body = response.base64Encoded ? Buffer.from(response.body, "base64").toString("utf8") : response.body;
        parseResponses(body);
        const hash = sha256(body);
        const name = `${String(++session.documents).padStart(4, "0")}-${hash}`;
        await writeFile(join(session.directory, `${name}.body`), body, { flag: "wx", mode: 0o600 });
        await writeFile(join(session.directory, `${name}.json`), JSON.stringify({ ...record, bodyFile: `${name}.body`, sha256: hash }), { flag: "wx", mode: 0o600 });
        session.requests.delete(p.requestId);
      }
      session.cursor = page.cursor;
      hasMore = page.hasMore;
    } while (hasMore);
    return { actions: session.count, documents: session.documents, pending: session.requests.size };
  } catch (error) {
    session.stopped = true;
    throw error;
  }
}

export async function stopCapture(session) {
  session.stopped = true;
  await session.cdp.send("Network.disable");
  return { actions: session.count, documents: session.documents, pending: session.requests.size };
}
