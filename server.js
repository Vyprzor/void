import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Serve VOID frontend
app.use(express.static(path.join(__dirname, "public")));

function privateIP(ip) {
    if (net.isIPv4(ip)) {
        const p = ip.split(".").map(Number);

        return (
            p[0] === 10 ||
            p[0] === 127 ||
            (p[0] === 169 && p[1] === 254) ||
            (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
            (p[0] === 192 && p[1] === 168) ||
            p[0] === 0
        );
    }

    const x = ip.toLowerCase();

    return (
        x === "::1" ||
        x.startsWith("fc") ||
        x.startsWith("fd") ||
        x.startsWith("fe80:")
    );
}

async function safeURL(raw) {
    let url;

    try {
        url = new URL(raw);
    } catch {
        throw new Error("Invalid URL");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS websites are supported");
    }

    // Don't allow URLs containing usernames/passwords
    if (url.username || url.password) {
        throw new Error("Credentials inside URLs are blocked");
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (
        hostname === "localhost" ||
        hostname.endsWith(".local")
    ) {
        throw new Error("Local addresses are blocked");
    }

    // Block direct private IP addresses
    if (net.isIP(hostname) && privateIP(hostname)) {
        throw new Error("Private addresses are blocked");
    }

    // Resolve hostname
    const records = await dns.lookup(hostname, {
        all: true
    });

    if (!records.length) {
        throw new Error("Website could not be resolved");
    }

    // Prevent requests into private/internal networks
    if (records.some(record => privateIP(record.address))) {
        throw new Error("Private addresses are blocked");
    }

    return url;
}

// ============================================================
// VOID WEB FETCHER
// ============================================================

app.get("/api/fetch", async (req, res) => {
    let timer;

    try {
        const requestedURL = String(req.query.url || "");

        const url = await safeURL(requestedURL);

        const controller = new AbortController();

        timer = setTimeout(() => {
            controller.abort();
        }, 10000);

        const response = await fetch(url, {
            signal: controller.signal,

            redirect: "follow",

            headers: {
                "User-Agent": "VOID-Web/1.0"
            }
        });

        clearTimeout(timer);

        const contentType =
            response.headers.get("content-type") || "";

        // VOID currently displays HTML/text documents
        if (
            !contentType.includes("text/html") &&
            !contentType.includes("text/plain")
        ) {
            return res.status(415).json({
                error:
                    "VOID Reader currently supports HTML/text pages only."
            });
        }

        const text = await response.text();

        // Limit response size
        const body = text.slice(0, 2_000_000);

        res.json({
            url: response.url,
            status: response.status,
            contentType,
            body
        });

    } catch (error) {

        if (timer) {
            clearTimeout(timer);
        }

        console.error("VOID fetch error:", error);

        res.status(400).json({
            error:
                error.name === "AbortError"
                    ? "Website request timed out."
                    : error.message
        });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        name: "VOID",
        version: "1.0.1"
    });
});

// ============================================================
// VOID FRONTEND FALLBACK
// ============================================================

// IMPORTANT:
// Express 5 no longer accepts app.get("*", ...).
// This middleware handles anything not matched above.

app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("====================================");
    console.log("          VOID IS ONLINE");
    console.log("====================================");
    console.log(`Port: ${PORT}`);
    console.log("");
});
