import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const app = express();

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const PORT = process.env.PORT || 3000;

// ============================================================
// VOID v2.1 — FAST SERVER
// ============================================================

app.disable("x-powered-by");

app.use(
    express.static(
        path.join(__dirname, "public"),
        {
            maxAge: "1h",
            etag: true
        }
    )
);

// ============================================================
// MEMORY CACHE
// ============================================================

const assetCache = new Map();
const pageCache = new Map();

const MAX_ASSET_CACHE = 300;
const MAX_PAGE_CACHE = 40;

const ASSET_CACHE_TIME = 30 * 60 * 1000;
const PAGE_CACHE_TIME = 2 * 60 * 1000;

function cacheGet(cache, key) {

    const item = cache.get(key);

    if (!item) {
        return null;
    }

    if (Date.now() > item.expires) {

        cache.delete(key);

        return null;
    }

    return item.value;
}

function cacheSet(
    cache,
    key,
    value,
    ttl,
    max
) {

    if (cache.size >= max) {

        const first =
            cache.keys().next().value;

        cache.delete(first);
    }

    cache.set(
        key,
        {
            value,
            expires:
                Date.now() + ttl
        }
    );
}

// ============================================================
// PRIVATE NETWORK PROTECTION
// ============================================================

function privateIP(ip) {

    if (net.isIPv4(ip)) {

        const p =
            ip.split(".").map(Number);

        return (
            p[0] === 0 ||
            p[0] === 10 ||
            p[0] === 127 ||

            (
                p[0] === 169 &&
                p[1] === 254
            ) ||

            (
                p[0] === 172 &&
                p[1] >= 16 &&
                p[1] <= 31
            ) ||

            (
                p[0] === 192 &&
                p[1] === 168
            )
        );
    }

    const x =
        ip.toLowerCase();

    return (
        x === "::1" ||
        x.startsWith("fc") ||
        x.startsWith("fd") ||
        x.startsWith("fe80:")
    );
}

// ============================================================
// URL VALIDATION
// ============================================================

async function safeURL(raw) {

    let url;

    try {

        url = new URL(raw);

    } catch {

        throw new Error(
            "Invalid URL"
        );
    }

    if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
    ) {

        throw new Error(
            "Only HTTP/HTTPS is supported"
        );
    }

    if (
        url.username ||
        url.password
    ) {

        throw new Error(
            "URL credentials are blocked"
        );
    }

    const host =
        url.hostname.toLowerCase();

    if (
        host === "localhost" ||
        host.endsWith(".local")
    ) {

        throw new Error(
            "Local addresses are blocked"
        );
    }

    if (
        net.isIP(host) &&
        privateIP(host)
    ) {

        throw new Error(
            "Private addresses are blocked"
        );
    }

    const records =
        await dns.lookup(
            host,
            {
                all: true
            }
        );

    if (!records.length) {

        throw new Error(
            "Could not resolve website"
        );
    }

    if (
        records.some(
            r =>
                privateIP(
                    r.address
                )
        )
    ) {

        throw new Error(
            "Private addresses are blocked"
        );
    }

    return url;
}

// ============================================================
// HELPERS
// ============================================================

function absoluteURL(
    value,
    base
) {

    try {

        return new URL(
            value,
            base
        ).href;

    } catch {

        return value;
    }
}

function assetProxy(url) {

    return (
        "/api/asset?url=" +
        encodeURIComponent(url)
    );
}

function isDirectAsset(url) {

    try {

        const u =
            new URL(url);

        return (
            u.protocol === "https:"
        );

    } catch {

        return false;
    }
}

// ============================================================
// FETCH WITH TIMEOUT
// ============================================================

async function fastFetch(
    url,
    options = {},
    timeout = 7000
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () =>
                controller.abort(),
            timeout
        );

    try {

        return await fetch(
            url,
            {
                ...options,

                signal:
                    controller.signal
            }
        );

    } finally {

        clearTimeout(timer);
    }
}

// ============================================================
// PAGE ENDPOINT
// ============================================================

app.get(
    "/api/page",

    async (req, res) => {

        try {

            const requested =
                String(
                    req.query.url || ""
                );

            const url =
                await safeURL(
                    requested
                );

            // ----------------------------------------
            // PAGE CACHE
            // ----------------------------------------

            const cached =
                cacheGet(
                    pageCache,
                    url.href
                );

            if (cached) {

                res.set(
                    "X-VOID-Cache",
                    "HIT"
                );

                return res.json(
                    cached
                );
            }

            // ----------------------------------------
            // DOWNLOAD PAGE
            // ----------------------------------------

            const response =
                await fastFetch(
                    url,
                    {
                        redirect:
                            "follow",

                        headers: {

                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",

                            "Accept":
                                "text/html,application/xhtml+xml",

                            "Accept-Language":
                                "en-US,en;q=0.9"
                        }
                    },
                    8000
                );

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            if (
                !contentType.includes(
                    "text/html"
                )
            ) {

                throw new Error(
                    "This isn't an HTML page"
                );
            }

            const raw =
                await response.text();

            const html =
                raw.slice(
                    0,
                    5_000_000
                );

            const finalURL =
                response.url;

            const $ =
                cheerio.load(html);

            // =================================================
            // REMOVE UNSUPPORTED / HEAVY ELEMENTS
            // =================================================

            $(
                "script, iframe, object, embed"
            ).remove();

            $(
                "meta[http-equiv='refresh']"
            ).remove();

            // Preload tags aren't useful to our reader.
            $(
                "link[rel='preload'], link[rel='modulepreload']"
            ).remove();

            // =================================================
            // CSS
            //
            // CSS still goes through VOID because relative
            // url(...) paths inside stylesheets need rewriting.
            // =================================================

            $(
                "link[rel='stylesheet']"
            ).each(
                (_, element) => {

                    const href =
                        $(element)
                            .attr("href");

                    if (!href) {
                        return;
                    }

                    const full =
                        absoluteURL(
                            href,
                            finalURL
                        );

                    $(element)
                        .attr(
                            "href",
                            assetProxy(
                                full
                            )
                        );
                }
            );

            // =================================================
            // IMAGES
            //
            // IMPORTANT PERFORMANCE CHANGE:
            //
            // Public HTTPS images load DIRECTLY from the
            // destination CDN instead of traveling:
            //
            // browser -> Render -> website -> Render -> browser
            //
            // This saves a lot of requests on free hosting.
            // =================================================

            $(
                "img[src], source[src]"
            ).each(
                (_, element) => {

                    const src =
                        $(element)
                            .attr("src");

                    if (!src) {
                        return;
                    }

                    if (
                        src.startsWith(
                            "data:"
                        )
                    ) {
                        return;
                    }

                    const full =
                        absoluteURL(
                            src,
                            finalURL
                        );

                    if (
                        isDirectAsset(
                            full
                        )
                    ) {

                        $(element)
                            .attr(
                                "src",
                                full
                            );

                    } else {

                        $(element)
                            .attr(
                                "src",
                                assetProxy(
                                    full
                                )
                            );
                    }

                    // Browser lazy loading
                    $(element)
                        .attr(
                            "loading",
                            "lazy"
                        );

                    $(element)
                        .attr(
                            "decoding",
                            "async"
                        );
                }
            );

            // =================================================
            // SRCSET
            // =================================================

            $("[srcset]").each(
                (_, element) => {

                    const srcset =
                        $(element)
                            .attr(
                                "srcset"
                            );

                    if (!srcset) {
                        return;
                    }

                    const rewritten =
                        srcset
                            .split(",")
                            .map(
                                item => {

                                    const pieces =
                                        item
                                            .trim()
                                            .split(
                                                /\s+/
                                            );

                                    const source =
                                        pieces.shift();

                                    const full =
                                        absoluteURL(
                                            source,
                                            finalURL
                                        );

                                    const resource =
                                        isDirectAsset(
                                            full
                                        )
                                            ? full
                                            : assetProxy(
                                                full
                                            );

                                    return (
                                        resource +
                                        (
                                            pieces.length
                                                ? " " +
                                                  pieces.join(
                                                      " "
                                                  )
                                                : ""
                                        )
                                    );
                                }
                            )
                            .join(", ");

                    $(element)
                        .attr(
                            "srcset",
                            rewritten
                        );
                }
            );

            // =================================================
            // LINKS
            // =================================================

            $("a[href]").each(
                (_, element) => {

                    const href =
                        $(element)
                            .attr(
                                "href"
                            );

                    if (!href) {
                        return;
                    }

                    if (
                        href.startsWith(
                            "#"
                        )
                    ) {
                        return;
                    }

                    if (
                        href.startsWith(
                            "javascript:"
                        ) ||
                        href.startsWith(
                            "mailto:"
                        ) ||
                        href.startsWith(
                            "tel:"
                        )
                    ) {

                        $(element)
                            .removeAttr(
                                "href"
                            );

                        return;
                    }

                    const destination =
                        absoluteURL(
                            href,
                            finalURL
                        );

                    $(element)
                        .attr(
                            "data-void-url",
                            destination
                        )
                        .attr(
                            "href",
                            "#"
                        );
                }
            );

            // =================================================
            // INLINE BACKGROUND IMAGES
            // =================================================

            $("[style]").each(
                (_, element) => {

                    let style =
                        $(element)
                            .attr(
                                "style"
                            );

                    if (!style) {
                        return;
                    }

                    style =
                        style.replace(
                            /url\((['"]?)(.*?)\1\)/gi,

                            (
                                match,
                                quote,
                                value
                            ) => {

                                if (
                                    !value ||
                                    value.startsWith(
                                        "data:"
                                    )
                                ) {

                                    return match;
                                }

                                const full =
                                    absoluteURL(
                                        value,
                                        finalURL
                                    );

                                // Prefer direct HTTPS asset
                                const replacement =
                                    isDirectAsset(
                                        full
                                    )
                                        ? full
                                        : assetProxy(
                                            full
                                        );

                                return (
                                    `url("${replacement}")`
                                );
                            }
                        );

                    $(element)
                        .attr(
                            "style",
                            style
                        );
                }
            );

            // =================================================
            // RESULT
            // =================================================

            const result = {

                url:
                    finalURL,

                title:
                    $("title")
                        .first()
                        .text()
                        .trim() ||
                    url.hostname,

                html:
                    $.html()
            };

            cacheSet(
                pageCache,
                url.href,
                result,
                PAGE_CACHE_TIME,
                MAX_PAGE_CACHE
            );

            res.set(
                "Cache-Control",
                "private, max-age=60"
            );

            res.set(
                "X-VOID-Cache",
                "MISS"
            );

            res.json(
                result
            );

        } catch (error) {

            console.error(
                "VOID PAGE:",
                error.message
            );

            if (
                error.name ===
                "AbortError"
            ) {

                return res
                    .status(408)
                    .json({
                        error:
                            "Website took too long to respond"
                    });
            }

            res
                .status(400)
                .json({
                    error:
                        error.message
                });
        }
    }
);

// ============================================================
// FAST ASSET ENDPOINT
// ============================================================

app.get(
    "/api/asset",

    async (req, res) => {

        try {

            const requested =
                String(
                    req.query.url || ""
                );

            const url =
                await safeURL(
                    requested
                );

            // ----------------------------------------
            // MEMORY CACHE
            // ----------------------------------------

            const cached =
                cacheGet(
                    assetCache,
                    url.href
                );

            if (cached) {

                res.set(
                    "Content-Type",
                    cached.type
                );

                res.set(
                    "Cache-Control",
                    "public, max-age=86400"
                );

                res.set(
                    "X-VOID-Cache",
                    "HIT"
                );

                return res.send(
                    cached.body
                );
            }

            // ----------------------------------------
            // FETCH
            // ----------------------------------------

            const response =
                await fastFetch(
                    url,
                    {
                        redirect:
                            "follow",

                        headers: {

                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"
                        }
                    },
                    6000
                );

            if (!response.ok) {

                throw new Error(
                    `Asset ${response.status}`
                );
            }

            const type =
                response.headers.get(
                    "content-type"
                ) ||
                "application/octet-stream";

            const arrayBuffer =
                await response
                    .arrayBuffer();

            const buffer =
                Buffer.from(
                    arrayBuffer
                );

            // Free Render instances have limited RAM.
            if (
                buffer.length >
                10_000_000
            ) {

                throw new Error(
                    "Asset too large"
                );
            }

            // =================================================
            // CSS REWRITING
            // =================================================

            if (
                type.includes(
                    "text/css"
                )
            ) {

                let css =
                    buffer.toString(
                        "utf8"
                    );

                css =
                    css.replace(
                        /url\((['"]?)(.*?)\1\)/gi,

                        (
                            match,
                            quote,
                            value
                        ) => {

                            if (
                                !value ||
                                value.startsWith(
                                    "data:"
                                )
                            ) {

                                return match;
                            }

                            const full =
                                absoluteURL(
                                    value,
                                    response.url
                                );

                            // Fonts/images referenced by CSS
                            // can usually load directly.
                            const replacement =
                                isDirectAsset(
                                    full
                                )
                                    ? full
                                    : assetProxy(
                                        full
                                    );

                            return (
                                `url("${replacement}")`
                            );
                        }
                    );

                const cssBuffer =
                    Buffer.from(
                        css,
                        "utf8"
                    );

                cacheSet(
                    assetCache,
                    url.href,
                    {
                        type:
                            "text/css; charset=utf-8",

                        body:
                            cssBuffer
                    },
                    ASSET_CACHE_TIME,
                    MAX_ASSET_CACHE
                );

                res.set(
                    "Content-Type",
                    "text/css; charset=utf-8"
                );

                res.set(
                    "Cache-Control",
                    "public, max-age=86400"
                );

                res.set(
                    "X-VOID-Cache",
                    "MISS"
                );

                return res.send(
                    cssBuffer
                );
            }

            // =================================================
            // OTHER ASSET
            // =================================================

            cacheSet(
                assetCache,
                url.href,
                {
                    type,
                    body:
                        buffer
                },
                ASSET_CACHE_TIME,
                MAX_ASSET_CACHE
            );

            res.set(
                "Content-Type",
                type
            );

            res.set(
                "Cache-Control",
                "public, max-age=86400"
            );

            res.set(
                "X-VOID-Cache",
                "MISS"
            );

            res.send(
                buffer
            );

        } catch (error) {

            console.error(
                "VOID ASSET:",
                error.message
            );

            res
                .status(404)
                .send("");
        }
    }
);

// ============================================================
// STATUS
// ============================================================

app.get(
    "/api/status",

    (req, res) => {

        res.json({

            name:
                "VOID",

            version:
                "2.1-fast",

            status:
                "online",

            pageCache:
                pageCache.size,

            assetCache:
                assetCache.size
        });
    }
);

// ============================================================
// VOID FRONTEND
// ============================================================

app.use(
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

// ============================================================
// START
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",

    () => {

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "       VOID v2.1 FAST ONLINE"
        );

        console.log(
            "======================================"
        );

        console.log(
            `PORT ${PORT}`
        );

        console.log("");
    }
);
