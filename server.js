import express from "express";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns/promises";
import net from "net";

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC = path.join(__dirname, "public");

const pageCache = new Map();
const assetCache = new Map();

app.disable("x-powered-by");

app.use(
  express.static(PUBLIC, {
    maxAge: "1h",
    etag: true,
  })
);

function isPrivateIP(ip) {
  if (!net.isIP(ip)) return false;

  if (ip === "127.0.0.1" || ip === "::1") return true;

  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;

  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }

  if (
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}

async function safeURL(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Local addresses are blocked");
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });

    for (const entry of addresses) {
      if (isPrivateIP(entry.address)) {
        throw new Error("Private network addresses are blocked");
      }
    }
  } catch (error) {
    if (error.message.includes("blocked")) throw error;
    throw new Error("Could not resolve hostname");
  }

  return url;
}

async function fetchSafe(input, options = {}) {
  let current = await safeURL(input);

  for (let redirects = 0; redirects < 6; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response;

    try {
      response = await fetch(current, {
        ...options,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
          accept:
            options.headers?.accept ||
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          ...options.headers,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (
      [301, 302, 303, 307, 308].includes(response.status) &&
      response.headers.get("location")
    ) {
      current = await safeURL(
        new URL(response.headers.get("location"), current).href
      );
      continue;
    }

    return { response, finalURL: current.href };
  }

  throw new Error("Too many redirects");
}

function absolute(value, base) {
  if (!value) return "";

  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function assetURL(value, base) {
  const target = absolute(value, base);

  if (!target) return "";

  return `/api/asset?url=${encodeURIComponent(target)}`;
}

function rewriteSrcset(value, base) {
  if (!value) return "";

  return value
    .split(",")
    .map((part) => {
      const pieces = part.trim().split(/\s+/);
      const url = absolute(pieces.shift(), base);

      if (!url) return "";

      return [url, ...pieces].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function rewriteCSS(css, base) {
  return css.replace(
    /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
    (match, quote, raw) => {
      const value = raw.trim();

      if (
        !value ||
        value.startsWith("data:") ||
        value.startsWith("blob:") ||
        value.startsWith("#")
      ) {
        return match;
      }

      const url = absolute(value, base);

      return url ? `url("${url}")` : match;
    }
  );
}

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    name: "VOID",
    version: "2.2",
  });
});

app.get("/api/page", async (req, res) => {
  try {
    const requested = String(req.query.url || "").trim();

    if (!requested) {
      return res.status(400).json({
        error: "Missing URL",
      });
    }

    const safe = await safeURL(requested);
    const cacheKey = safe.href;

    const cached = pageCache.get(cacheKey);

    if (cached && Date.now() - cached.time < 60_000) {
      return res.json(cached.value);
    }

    const { response, finalURL } = await fetchSafe(safe.href);

    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error("That URL is not an HTML page");
    }

    let html = await response.text();

    if (html.length > 8_000_000) {
      throw new Error("Page is too large");
    }

    const $ = cheerio.load(html);

    $("script,noscript,iframe,object,embed").remove();

    $('meta[http-equiv="Content-Security-Policy"]').remove();
    $('meta[http-equiv="content-security-policy"]').remove();

    $("base").remove();

    $("head").prepend(
      `<base href="${finalURL.replace(/"/g, "&quot;")}">`
    );

    $("link").each((_, element) => {
      const el = $(element);
      const rel = (el.attr("rel") || "").toLowerCase();
      const href = el.attr("href");

      if (!href) return;

      if (rel.includes("stylesheet")) {
        const rewritten = assetURL(href, finalURL);

        if (rewritten) {
          el.attr("href", rewritten);
        }
      } else if (
        rel.includes("preload") ||
        rel.includes("modulepreload") ||
        rel.includes("prefetch")
      ) {
        el.remove();
      } else {
        const url = absolute(href, finalURL);

        if (url) el.attr("href", url);
      }
    });

    $("img").each((_, element) => {
      const el = $(element);

      const src = absolute(
        el.attr("src") ||
          el.attr("data-src") ||
          el.attr("data-lazy-src"),
        finalURL
      );

      if (src) {
        el.attr("src", src);
      }

      const srcset =
        el.attr("srcset") ||
        el.attr("data-srcset");

      if (srcset) {
        el.attr("srcset", rewriteSrcset(srcset, finalURL));
      }

      el.removeAttr("loading");
    });

    $("source").each((_, element) => {
      const el = $(element);

      if (el.attr("src")) {
        const src = absolute(el.attr("src"), finalURL);
        if (src) el.attr("src", src);
      }

      if (el.attr("srcset")) {
        el.attr(
          "srcset",
          rewriteSrcset(el.attr("srcset"), finalURL)
        );
      }
    });

    $("video,audio").each((_, element) => {
      const el = $(element);

      if (el.attr("src")) {
        const src = absolute(el.attr("src"), finalURL);
        if (src) el.attr("src", src);
      }

      if (el.attr("poster")) {
        const poster = absolute(el.attr("poster"), finalURL);
        if (poster) el.attr("poster", poster);
      }
    });

    $("[style]").each((_, element) => {
      const el = $(element);

      el.attr(
        "style",
        rewriteCSS(el.attr("style") || "", finalURL)
      );
    });

    $("style").each((_, element) => {
      const el = $(element);

      el.html(
        rewriteCSS(el.html() || "", finalURL)
      );
    });

    $("a[href]").each((_, element) => {
      const el = $(element);
      const href = el.attr("href");

      if (!href) return;

      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const target = absolute(href, finalURL);

      if (!target) return;

      el.attr("href", target);
      el.attr("data-void-url", target);
      el.removeAttr("target");
    });

    $("form").each((_, element) => {
      const el = $(element);
      const action = el.attr("action");

      if (action) {
        const target = absolute(action, finalURL);
        if (target) el.attr("action", target);
      }

      el.attr("target", "_blank");
    });

    const title =
      $("title").first().text().trim() ||
      new URL(finalURL).hostname;

    html = $.html();

    const value = {
      url: finalURL,
      title,
      html,
    };

    pageCache.set(cacheKey, {
      time: Date.now(),
      value,
    });

    if (pageCache.size > 100) {
      const first = pageCache.keys().next().value;
      pageCache.delete(first);
    }

    res.set("Cache-Control", "no-store");
    res.json(value);
  } catch (error) {
    console.error("PAGE ERROR:", error);

    res.status(502).json({
      error:
        error.name === "AbortError"
          ? "Website took too long to respond"
          : error.message || "Could not load website",
    });
  }
});

app.get("/api/asset", async (req, res) => {
  try {
    const requested = String(req.query.url || "").trim();

    if (!requested) {
      return res.status(400).send("Missing URL");
    }

    const safe = await safeURL(requested);
    const cacheKey = safe.href;

    const cached = assetCache.get(cacheKey);

    if (cached && Date.now() - cached.time < 3_600_000) {
      res.set("Content-Type", cached.type);
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached.body);
    }

    const { response, finalURL } = await fetchSafe(safe.href, {
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Asset returned HTTP ${response.status}`);
    }

    const type =
      response.headers.get("content-type") ||
      "application/octet-stream";

    let body;

    if (type.includes("text/css")) {
      const text = await response.text();
      body = rewriteCSS(text, finalURL);

      res.set("Content-Type", "text/css; charset=utf-8");
    } else {
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > 15_000_000) {
        return res.status(413).send("Asset is too large");
      }

      body = Buffer.from(arrayBuffer);
      res.set("Content-Type", type);
    }

    assetCache.set(cacheKey, {
      time: Date.now(),
      type: type.includes("text/css")
        ? "text/css; charset=utf-8"
        : type,
      body,
    });

    if (assetCache.size > 300) {
      const first = assetCache.keys().next().value;
      assetCache.delete(first);
    }

    res.set("Cache-Control", "public, max-age=3600");
    res.send(body);
  } catch (error) {
    console.error("ASSET ERROR:", error);

    res.status(502).send(
      error.name === "AbortError"
        ? "Asset request timed out"
        : error.message || "Could not load asset"
    );
  }
});

// Express 5-safe fallback.
// Do NOT replace this with app.get("*", ...).
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("       VOID v2.2 ONLINE");
  console.log("======================================");
  console.log(`PORT ${PORT}`);
});
