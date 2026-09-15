<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VOID</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
:root{--bg:#060609;--side:#0a0a10;--panel:#0e0e15;--panel2:#15151f;--line:#292938;--text:#f5f5f8;--muted:#89899b;--accent:#8b5cf6;--sw:238px}
body{font:14px Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text)}
button,input{font:inherit}.shell{height:100%;display:grid;grid-template-columns:var(--sw) minmax(0,1fr);transition:.22s}.shell.mini{--sw:72px}
aside{background:linear-gradient(180deg,#0d0d14,#07070b);border-right:1px solid var(--line);min-width:0;overflow:hidden;display:flex;flex-direction:column}
.brand{height:60px;border-bottom:1px solid #1d1d27;display:flex;align-items:center;padding:0 13px}.brand b{letter-spacing:7px;font-size:20px;flex:1;overflow:hidden}.sq,.tool,.new{border:1px solid #30303e;background:#14141d;color:#ddd;border-radius:10px;cursor:pointer}.sq{width:34px;height:34px}
.sidebody{padding:12px;overflow:auto;scrollbar-width:none}.label{font-size:10px;color:#666679;letter-spacing:2px;margin:16px 9px 7px}.nav{height:43px;border-radius:11px;padding:6px 8px;display:flex;align-items:center;gap:10px;color:#b6b6c5;cursor:pointer}.nav:hover{background:#171720;color:#fff}.icon{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:#1a1a24;flex:none;overflow:hidden}.icon img{width:100%;height:100%;object-fit:cover}.games{display:grid;grid-template-columns:1fr 1fr;gap:7px}.game{height:68px;border:1px solid #272735;background:#111118;border-radius:12px;display:grid;place-items:center;cursor:pointer;text-align:center;font-size:11px}.game img{width:28px;height:28px;border-radius:7px;margin-bottom:3px}
.mini .brand b,.mini .nav span,.mini .label,.mini .game span{display:none}.mini .nav{justify-content:center}.mini .games{grid-template-columns:1fr}.mini .game{height:44px}
.browser{height:100%;min-width:0;display:grid;grid-template-rows:42px 58px minmax(0,1fr)}
.tabs{display:flex;align-items:end;gap:5px;padding:0 9px;background:#08080d;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}.tab{width:190px;max-width:27vw;height:34px;flex:none;border:1px solid var(--line);border-bottom:0;border-radius:10px 10px 0 0;background:#101017;color:#999;padding:0 10px;display:flex;align-items:center;gap:7px;cursor:pointer}.tab.on{background:#171720;color:white}.tt{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.close{font-size:16px;color:#747485}.new{width:30px;height:29px;margin-bottom:3px}
.toolbar{display:flex;align-items:center;gap:7px;padding:9px 10px;background:#0c0c12;border-bottom:1px solid var(--line);position:relative;z-index:50}.tool{width:39px;height:39px}.tool:hover,.sq:hover,.new:hover{background:#1d1d28}
.omniWrap{position:relative;flex:1;min-width:80px}.omni{height:40px;border:1px solid #30303f;background:#111119;border-radius:12px;display:flex;align-items:center;padding:0 5px 0 12px}.omni input{border:0;background:none;outline:0;color:#eee;flex:1;min-width:0}.diamond{color:#6f6f82;margin-right:8px}.go{height:30px;border:0;border-radius:9px;background:var(--accent);color:#fff;padding:0 14px;cursor:pointer}
.suggest{display:none;position:absolute;left:0;right:0;top:45px;background:#101018;border:1px solid #30303e;border-radius:13px;box-shadow:0 20px 55px #000b;overflow:hidden;z-index:100}.suggest.show{display:block}.srow{height:42px;display:flex;align-items:center;gap:10px;padding:0 13px;cursor:pointer;color:#d0d0da}.srow:hover,.srow.sel{background:#1a1a25}.srow small{color:#777;margin-left:auto}.mag{color:#888}
.stage{position:relative;min-width:0;min-height:0;overflow:hidden;background:#050507}.home{position:absolute;inset:0;overflow:auto;display:grid;place-items:center;padding:30px;background:radial-gradient(circle at 50% 0,#291848 0,#0b0b11 35%,#050507 72%)}.home.hide{display:none}.hero{width:min(760px,92%);text-align:center}.hero h1{font-size:clamp(74px,11vw,145px);line-height:.8;letter-spacing:-8px;margin:0;background:linear-gradient(#fff,#666675);color:transparent;background-clip:text}.hero>p{letter-spacing:5px;color:#858597;margin:27px 0}
.bigsearch{height:57px;display:flex;align-items:center;border:1px solid #373748;background:#101018d9;border-radius:18px;padding:6px 7px 6px 15px;box-shadow:0 25px 80px #0009;position:relative}.bigsearch input{border:0;outline:0;background:none;color:#fff;flex:1;min-width:0;font-size:16px}
.quick{margin-top:22px;display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.quick div{border:1px solid #292937;background:#0e0e16bb;border-radius:13px;padding:13px 7px;color:#aaa;cursor:pointer}.quick div:hover{background:#181821;color:white}
.reader{position:absolute;inset:0;width:100%;height:100%;border:0;background:white;display:none}.reader.show{display:block}
.progress{display:none;position:absolute;top:0;left:0;right:0;height:2px;z-index:20;overflow:hidden}.progress.on{display:block}.progress:after{content:"";display:block;height:100%;width:30%;background:var(--accent);box-shadow:0 0 14px var(--accent);animation:p .9s infinite}@keyframes p{from{transform:translateX(-110%)}to{transform:translateX(360%)}}
.error{height:100%;display:grid;place-items:center;text-align:center;padding:30px;background:#09090e}.error div{max-width:560px}.error p{color:#858595;line-height:1.6}.open{border:0;background:var(--accent);color:#fff;padding:11px 16px;border-radius:11px;cursor:pointer}
@media(max-width:760px){:root{--sw:72px}.brand b,.nav span,.label,.game span{display:none}.nav{justify-content:center}.games{grid-template-columns:1fr}.game{height:44px}.quick{grid-template-columns:repeat(2,1fr)}.hero h1{letter-spacing:-4px}.tab{width:140px}}
</style></head>
<body>
<div class="shell" id="shell">
<aside>
 <div class="brand"><b>VOID</b><button class="sq" onclick="shell.classList.toggle('mini')">☰</button></div>
 <div class="sidebody">
  <div class="nav" onclick="home()"><div class="icon">⌂</div><span>Home</span></div>
  <div class="label">APPS</div>
  <div class="nav" onclick="nav('https://www.youtube.com')"><div class="icon"><img src="https://www.google.com/s2/favicons?domain=youtube.com&sz=64"></div><span>YouTube</span></div>
  <div class="nav" onclick="nav('https://www.tiktok.com')"><div class="icon"><img src="https://www.google.com/s2/favicons?domain=tiktok.com&sz=64"></div><span>TikTok</span></div>
  <div class="nav" onclick="nav('https://discord.com/app')"><div class="icon"><img src="https://www.google.com/s2/favicons?domain=discord.com&sz=64"></div><span>Discord</span></div>
  <div class="nav" onclick="nav('https://www.roblox.com')"><div class="icon"><img src="https://www.google.com/s2/favicons?domain=roblox.com&sz=64"></div><span>Roblox</span></div>
  <div class="nav" onclick="nav('https://www.snapchat.com')"><div class="icon"><img src="https://www.google.com/s2/favicons?domain=snapchat.com&sz=64"></div><span>Snapchat</span></div>
  <div class="label">GAMES</div><div class="games">
   <div class="game" onclick="nav('https://www.crazygames.com')"><div><img src="https://www.google.com/s2/favicons?domain=crazygames.com&sz=64"><br><span>CrazyGames</span></div></div>
   <div class="game" onclick="nav('https://poki.com')"><div><img src="https://www.google.com/s2/favicons?domain=poki.com&sz=64"><br><span>Poki</span></div></div>
   <div class="game" onclick="nav('https://lichess.org')"><div><img src="https://www.google.com/s2/favicons?domain=lichess.org&sz=64"><br><span>Chess</span></div></div>
   <div class="game" onclick="nav('https://2048game.com')"><div><img src="https://www.google.com/s2/favicons?domain=2048game.com&sz=64"><br><span>2048</span></div></div>
  </div>
 </div>
</aside>
<section class="browser">
 <div class="tabs" id="tabs"></div>
 <div class="toolbar">
  <button class="tool" onclick="back()">←</button><button class="tool" onclick="forward()">→</button><button class="tool" onclick="reload()">↻</button>
  <div class="omniWrap">
   <div class="omni"><span class="diamond">◇</span><input id="q" autocomplete="off" placeholder="Search Google or type a URL"><button class="go" onclick="submitQ()">GO</button></div>
   <div class="suggest" id="suggest"></div>
  </div>
  <button class="tool" onclick="document.fullscreenElement?document.exitFullscreen():stage.requestFullscreen()">⛶</button>
 </div>
 <div class="stage" id="stage">
  <div class="progress" id="progress"></div>
  <iframe class="reader" id="reader" sandbox="allow-forms allow-popups"></iframe>
  <div class="home" id="home"><div class="hero"><h1>VOID</h1><p>SEARCH WITHOUT THE NOISE</p>
   <div class="bigsearch"><span class="mag">⌕</span>&nbsp;&nbsp;<input id="hq" autocomplete="off" placeholder="Search the web or enter a URL"><button class="go" onclick="submitHome()">SEARCH</button></div>
   <div class="quick"><div onclick="nav('https://en.wikipedia.org')">Wikipedia</div><div onclick="search('YouTube')">YouTube</div><div onclick="search('games')">Games</div><div onclick="search('Roblox')">Roblox</div><div onclick="search('Discord')">Discord</div></div>
  </div></div>
 </div>
</section></div>
<script>
const $=x=>document.getElementById(x);let T=[],A=-1,sel=-1,suggestions=[],timer;
const heavy=/youtube\.com|tiktok\.com|discord\.com|roblox\.com|snapchat\.com|crazygames\.com|poki\.com/i;
function obj(){return{title:"New Tab",url:"",hist:[],pos:-1,html:""}}
function add(){T.push(obj());A=T.length-1;draw();home()}
function draw(){tabs.innerHTML=T.map((t,i)=>`<div class="tab ${i===A?'on':''}" onclick="pick(${i})"><span class="tt">${esc(t.title)}</span><span class="close" onclick="event.stopPropagation();closeT(${i})">×</span></div>`).join("")+`<button class="new" onclick="add()">＋</button>`}
function pick(i){A=i;draw();let t=T[i];if(!t.url)return home(false);q.value=t.url;homeEl(true);reader.srcdoc=t.html;reader.classList.add("show")}
function closeT(i){T.splice(i,1);if(!T.length)return add();A=Math.min(A,T.length-1);pick(A)}
function home(reset=true){let t=T[A];if(reset){t.title="New Tab";t.url="";t.html=""}q.value="";reader.classList.remove("show");reader.srcdoc="";homeEl(false);draw()}
function homeEl(hide){$("home").classList.toggle("hide",hide)}
function destination(v){v=v.trim();if(!v)return"";if(/^https?:\/\//i.test(v))return v;if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v))return"https://"+v;return"https://en.wikipedia.org/w/index.php?search="+encodeURIComponent(v)}
function submitQ(){let v=q.value.trim();if(isURLish(v))nav(destination(v));else search(v)}
function submitHome(){let v=hq.value.trim();if(isURLish(v))nav(destination(v));else search(v)}
function isURLish(v){return /^https?:\/\//i.test(v)||/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)}
function search(v){if(!v)return;remember(v);nav("https://en.wikipedia.org/w/index.php?search="+encodeURIComponent(v))}
async function nav(url,push=true){
 if(!url)return;hideSuggest();let t=T[A];if(push){t.hist=t.hist.slice(0,t.pos+1);t.hist.push(url);t.pos++}
 q.value=url;progress.classList.add("on");homeEl(true);reader.classList.remove("show");
 try{
  let r=await fetch("/api/page?url="+encodeURIComponent(url)),d=await r.json();if(!r.ok)throw Error(d.error||"Could not load");
  t.url=d.url;t.title=d.title||new URL(d.url).hostname;
  let bridge=`<script>document.addEventListener('click',e=>{let a=e.target.closest('[data-void-url]');if(a){e.preventDefault();parent.postMessage({voidNav:a.getAttribute('data-void-url')},'*')}})<\/script>`;
  t.html=d.html.replace(/<\/body>/i,bridge+"</body>");reader.srcdoc=t.html;reader.classList.add("show");q.value=t.url;draw();
 }catch(e){
  t.url=url;t.title="Can't render";
  let direct=heavy.test(url);
  t.html=`<!doctype html><style>body{margin:0;background:#0b0b10;color:#eee;font:16px system-ui;display:grid;place-items:center;height:100vh;text-align:center}main{max-width:570px;padding:35px}p{color:#999;line-height:1.6}button{background:#8b5cf6;color:white;border:0;border-radius:11px;padding:12px 17px;cursor:pointer}</style><main><h1>${direct?"This app needs its original site":"VOID couldn't render this page"}</h1><p>${esc(e.message)}</p><p>JavaScript-heavy apps may require their normal website to function.</p><button onclick="window.open('${safeAttr(url)}','_blank')">Open original site</button></main>`;
  reader.srcdoc=t.html;reader.classList.add("show");draw()
 }finally{progress.classList.remove("on")}
}
addEventListener("message",e=>{if(e.data?.voidNav&&/^https?:\/\//.test(e.data.voidNav))nav(e.data.voidNav)})
function back(){let t=T[A];if(t.pos>0){t.pos--;nav(t.hist[t.pos],false)}}function forward(){let t=T[A];if(t.pos<t.hist.length-1){t.pos++;nav(t.hist[t.pos],false)}}function reload(){let t=T[A];if(t.url)nav(t.url,false)}
function remember(s){let a=JSON.parse(localStorage.voidRecent||"[]").filter(x=>x!==s);a.unshift(s);localStorage.voidRecent=JSON.stringify(a.slice(0,8))}
function localSuggest(v){let rec=JSON.parse(localStorage.voidRecent||"[]");let common=["youtube","youtube music","roblox","discord","tiktok","minecraft","minecraft wiki","crazy games","poki games","chess","weather","calculator"];return[...new Set([...rec,...common].filter(x=>x.toLowerCase().includes(v.toLowerCase())))].slice(0,7)}
function updateSuggest(input){
 clearTimeout(timer);let v=input.value.trim();if(!v)return hideSuggest();timer=setTimeout(()=>{
  suggestions=localSuggest(v);sel=-1;suggest.innerHTML=suggestions.map((s,i)=>`<div class="srow" data-i="${i}"><span class="mag">⌕</span><span>${esc(s)}</span><small>Search</small></div>`).join("");
  suggest.classList.toggle("show",suggestions.length>0);suggest.querySelectorAll(".srow").forEach(r=>r.onmousedown=e=>{e.preventDefault();input.value=suggestions[+r.dataset.i];search(input.value)})
 },80)
}
function key(e,input){if(!suggestions.length)return;if(e.key==="ArrowDown"){e.preventDefault();sel=Math.min(sel+1,suggestions.length-1)}else if(e.key==="ArrowUp"){e.preventDefault();sel=Math.max(sel-1,0)}else if(e.key==="Escape")return hideSuggest();else if(e.key==="Enter"&&sel>=0){e.preventDefault();input.value=suggestions[sel];return search(input.value)}else return;[...suggest.children].forEach((x,i)=>x.classList.toggle("sel",i===sel));if(sel>=0)input.value=suggestions[sel]}
function hideSuggest(){suggest.classList.remove("show");suggestions=[];sel=-1}
[q,hq].forEach(inp=>{inp.addEventListener("input",()=>updateSuggest(inp));inp.addEventListener("keydown",e=>{key(e,inp);if(e.key==="Enter"&&sel<0){hideSuggest();inp===q?submitQ():submitHome()}});inp.addEventListener("blur",()=>setTimeout(hideSuggest,120))})
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeAttr(s){return String(s).replace(/'/g,"%27")}
add();
</script></body></html>
