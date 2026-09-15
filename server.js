import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

function privateIP(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    return p[0]===10 || p[0]===127 || (p[0]===169&&p[1]===254) ||
      (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168) || p[0]===0;
  }
  const x=ip.toLowerCase();
  return x==="::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:");
}

async function safeURL(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!["http:","https:"].includes(u.protocol)) throw new Error("Only HTTP(S) is supported");
  if (u.username || u.password) throw new Error("Credentials in URLs are blocked");
  const host=u.hostname.toLowerCase();
  if (host==="localhost" || host.endsWith(".local")) throw new Error("Local addresses are blocked");
  if (net.isIP(host) && privateIP(host)) throw new Error("Private addresses are blocked");
  const records = await dns.lookup(host,{all:true});
  if (!records.length || records.some(r=>privateIP(r.address))) throw new Error("Private addresses are blocked");
  return u;
}

app.get("/api/fetch", async (req,res) => {
  try {
    const u=await safeURL(String(req.query.url||""));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    const r=await fetch(u,{signal:controller.signal,redirect:"follow",headers:{"user-agent":"VOID-Web/1.0"}});
    clearTimeout(timer);
    const type=r.headers.get("content-type")||"";
    if (!type.includes("text/html") && !type.includes("text/plain"))
      return res.status(415).json({error:"VOID reader currently supports HTML/text pages only."});
    const text=(await r.text()).slice(0,2_000_000);
    res.json({url:r.url,status:r.status,contentType:type,body:text});
  } catch(e) {
    res.status(400).json({error:e.name==="AbortError"?"Request timed out":e.message});
  }
});

app.get("*",(_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`VOID running on http://localhost:${PORT}`));
