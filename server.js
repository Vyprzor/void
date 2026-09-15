import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

// ============================================================
// VOID v2 SERVER
// ============================================================

const app = express();

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const PORT = process.env.PORT || 3000;

// Serve everything inside /public
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// NETWORK SAFETY
// Prevent VOID from being used to access localhost/private IPs.
// ============================================================

function isPrivateIP(ip) {

    if (net.isIPv4(ip)) {

        const parts = ip.split(".").map(Number);

        return (
            parts[0] === 0 ||
            parts[0] === 10 ||
            parts[0] === 127 ||

            (parts[0] === 169 &&
             parts[1] === 254) ||

            (parts[0] === 172 &&
             parts[1] >= 16 &&
             parts[1] <= 31) ||

            (parts[0] === 192 &&
             parts[1] === 168)
        );
    }

    const address = ip.toLowerCase();

    return (
        address === "::1" ||
        address.startsWith("fc") ||
        address.startsWith("fd") ||
        address.startsWith("fe80:")
    );
}

// ============================================================
// CHECK URL
// ============================================================

async function safeURL(rawURL) {

    let url;

    try {

        url = new URL(rawURL);

    } catch {

        throw new Error("Invalid URL");
    }

    if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
    ) {
        throw new Error(
            "Only HTTP and HTTPS addresses are supported."
        );
    }

    // Block usernames/passwords inside URL
    if (url.username || url.password) {

        throw new Error(
            "Credentials inside URLs are not supported."
        );
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (
        hostname === "localhost" ||
        hostname.endsWith(".local")
    ) {

        throw new Error(
            "Local addresses are blocked."
        );
    }

    // Block direct private IP
    if (
        net.isIP(hostname) &&
        isPrivateIP(hostname)
    ) {

        throw new Error(
            "Private addresses are blocked."
        );
    }

    // Resolve hostname
    const records = await dns.lookup(
        hostname,
        {
            all: true
        }
    );

    if (!records.length) {

        throw new Error(
            "Website could not be resolved."
        );
    }

    // Block domains resolving to internal/private addresses
    if (
        records.some(record =>
            isPrivateIP(record.address)
        )
    ) {

        throw new Error(
            "Private addresses are blocked."
        );
    }

    return url;
}

// ============================================================
// HELPERS
// ============================================================

function absoluteURL(value, base) {

    try {

        return new URL(
            value,
            base
        ).href;

    } catch {

        return value;
    }
}

function proxyAsset(url) {

    return (
        "/api/asset?url=" +
        encodeURIComponent(url)
    );
}

// ============================================================
// PAGE FETCHER
// ============================================================

app.get(
    "/api/page",

    async (req, res) => {

        try {

            const requestedURL =
                String(req.query.url || "");

            const url =
                await safeURL(requestedURL);

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    15000
                );

            const response =
                await fetch(
                    url,
                    {
                        redirect: "follow",

                        signal:
                            controller.signal,

                        headers: {

                            "User-Agent":
                                "Mozilla/5.0 VOID/2.0",

                            "Accept":
                                "text/html,application/xhtml+xml"
                        }
                    }
                );

            clearTimeout(timeout);

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
                    "VOID can only display HTML pages here."
                );
            }

            const rawHTML =
                await response.text();

            // Prevent extremely large HTML documents
            const html =
                rawHTML.slice(
                    0,
                    4_000_000
                );

            const finalURL =
                response.url;

            const $ =
                cheerio.load(html);

            // ==================================================
            // REMOVE ELEMENTS THAT CANNOT SAFELY RUN IN READER
            // ==================================================

            $(
                "script, iframe, object, embed, form"
            ).remove();

            $(
                "meta[http-equiv='refresh']"
            ).remove();

            // ==================================================
            // STYLESHEETS
            // ==================================================

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

                    const fullURL =
                        absoluteURL(
                            href,
                            finalURL
                        );

                    $(element)
                        .attr(
                            "href",
                            proxyAsset(
                                fullURL
                            )
                        );
                }
            );

            // ==================================================
            // IMAGES / MEDIA
            // ==================================================

            $("[src]").each(
                (_, element) => {

                    const src =
                        $(element)
                            .attr("src");

                    if (!src) {
                        return;
                    }

                    // Leave inline data URLs alone
                    if (
                        src.startsWith(
                            "data:"
                        )
                    ) {
                        return;
                    }

                    const fullURL =
                        absoluteURL(
                            src,
                            finalURL
                        );

                    $(element)
                        .attr(
                            "src",
                            proxyAsset(
                                fullURL
                            )
                        );
                }
            );

            // ==================================================
            // SRCSET
            // ==================================================

            $("[srcset]").each(
                (_, element) => {

                    const srcset =
                        $(element)
                            .attr("srcset");

                    if (!srcset) {
                        return;
                    }

                    const rewritten =
                        srcset
                            .split(",")
                            .map(item => {

                                const pieces =
                                    item
                                        .trim()
                                        .split(
                                            /\s+/
                                        );

                                const source =
                                    pieces.shift();

                                const fullURL =
                                    absoluteURL(
                                        source,
                                        finalURL
                                    );

                                let output =
                                    proxyAsset(
                                        fullURL
                                    );

                                if (
                                    pieces.length
                                ) {

                                    output +=
                                        " " +
                                        pieces.join(
                                            " "
                                        );
                                }

                                return output;
                            })
                            .join(", ");

                    $(element)
                        .attr(
                            "srcset",
                            rewritten
                        );
                }
            );

            // ==================================================
            // LINKS
            // ==================================================

            $("a[href]").each(
                (_, element) => {

                    const href =
                        $(element)
                            .attr("href");

                    if (!href) {
                        return;
                    }

                    // Keep same-page anchors
                    if (
                        href.startsWith("#")
                    ) {
                        return;
                    }

                    // Ignore non-web links
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

                    // VOID frontend catches this
                    // and loads the page in the current tab.
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

            // ==================================================
            // INLINE STYLE URLS
            // ==================================================

            $("[style]").each(
                (_, element) => {

                    let style =
                        $(element)
                            .attr("style");

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

                                const fullURL =
                                    absoluteURL(
                                        value,
                                        finalURL
                                    );

                                return (
                                    `url("${proxyAsset(fullURL)}")`
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

            // ==================================================
            // SEND PAGE TO VOID
            // ==================================================

            res.json({

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
            });

        } catch (error) {

            console.error(
                "VOID page error:",
                error
            );

            if (
                error.name ===
                "AbortError"
            ) {

                return res
                    .status(408)
                    .json({
                        error:
                            "The website took too long to respond."
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
// ASSET FETCHER
// Loads CSS/images/fonts used by compatible pages.
// ============================================================

app.get(
    "/api/asset",

    async (req, res) => {

        try {

            const requestedURL =
                String(
                    req.query.url || ""
                );

            const url =
                await safeURL(
                    requestedURL
                );

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () =>
                        controller.abort(),
                    15000
                );

            const response =
                await fetch(
                    url,
                    {
                        redirect:
                            "follow",

                        signal:
                            controller.signal,

                        headers: {

                            "User-Agent":
                                "Mozilla/5.0 VOID/2.0"
                        }
                    }
                );

            clearTimeout(
                timeout
            );

            if (
                !response.ok
            ) {

                throw new Error(
                    `Asset returned ${response.status}`
                );
            }

            const contentType =
                response.headers.get(
                    "content-type"
                ) ||
                "application/octet-stream";

            const buffer =
                Buffer.from(
                    await response
                        .arrayBuffer()
                );

            // Don't let one resource consume huge amounts of RAM
            if (
                buffer.length >
                12_000_000
            ) {

                throw new Error(
                    "Asset is too large."
                );
            }

            // ==================================================
            // CSS NEEDS ITS OWN URL REWRITING
            // ==================================================

            if (
                contentType.includes(
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

                            const fullURL =
                                absoluteURL(
                                    value,
                                    response.url
                                );

                            return (
                                `url("${proxyAsset(fullURL)}")`
                            );
                        }
                    );

                res
                    .type("text/css")
                    .send(css);

                return;
            }

            res.set(
                "Content-Type",
                contentType
            );

            // Cache ordinary assets briefly
            res.set(
                "Cache-Control",
                "public, max-age=3600"
            );

            res.send(
                buffer
            );

        } catch (error) {

            console.error(
                "VOID asset error:",
                error
            );

            res
                .status(400)
                .send(
                    "VOID asset unavailable"
                );
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
                "2.0.0",

            status:
                "online"
        });
    }
);

// ============================================================
// FRONTEND FALLBACK
//
// IMPORTANT:
//
// DO NOT change this to:
//
// app.get("*", ...)
//
// Express 5 will crash with:
// "Missing parameter name at index 1: *"
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
// START VOID
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",

    () => {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "            VOID v2 ONLINE"
        );

        console.log(
            "========================================"
        );

        console.log(
            `PORT ${PORT}`
        );

        console.log("");
    }
);
