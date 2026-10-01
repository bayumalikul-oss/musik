/* ===== 6. DATA ===== */
const TRACKS=[
["Jalan Pulang Sore","Rinai Kota","Pop",92,60,"mayor",3,["Lampu jalan menyala satu per satu","Aku berjalan pelan menuju rumahmu","Angin sore membawa wangi hujan","Dan hatiku tenang karena ada kamu"]],
["Kopi Tanpa Gula","Dua Cangkir","Indie",84,57,"minor",7,["Pahit di lidah, manis di ingatan","Kita duduk lama tanpa banyak bicara","Uap hangat menari di antara kita","Seperti rindu yang tak pernah selesai"]],
["Layar Biru","Satelit Kecil","Elektronik",118,62,"penta",11,["Cahaya layar menemani malamku","Pesanmu datang seperti bintang jatuh","Jari ini ragu untuk membalas","Namun detak jantung sudah menjawab"]],
["Sawah di Matamu","Padi Kuning","Akustik",76,55,"mayor",5,["Hijau membentang sejauh pandang","Burung pipit bernyanyi di pematang","Kau tersenyum di ujung petang","Dunia berhenti sejenak untukmu"]],
["Hujan di Bulan Ini","Rinai Kota","Pop",88,59,"minor",13,["Atap seng berirama sepanjang malam","Kita berteduh di warung kecil itu","Cerita lama mengalir bersama air","Dan kenangan basah di jendela"]],
["Langkah Pertama","Fajar Muda","Pop",104,64,"mayor",17,["Pagi ini aku berani melangkah","Meski peta belum selesai kugambar","Setiap jalan punya cerita","Dan aku siap menuliskannya"]],
["Malam di Dermaga","Kapal Kertas","Santai",70,52,"minor",19,["Ombak pelan menyapa tiang kayu","Lampu kapal bergoyang di kejauhan","Aku titipkan resah pada laut","Biar fajar yang menjawabnya"]],
["Roda Berputar","Bengkel Nada","Rock",132,57,"penta",23,["Mesin menderu di jalan panjang","Tak ada yang bisa menahan kita","Debu beterbangan, kita tertawa","Selama roda masih berputar"]],
["Surat untuk Esok","Fajar Muda","Akustik",72,60,"mayor",29,["Kutulis harap di selembar kertas","Kulipat rapi dan kusimpan di saku","Esok mungkin lebih ramah dari kemarin","Dan aku akan menyambutnya dengan senyum"]],
["Neon Kota Tua","Satelit Kecil","Elektronik",124,55,"minor",31,["Gedung tua berpendar warna ungu","Kita menari di antara bayang","Waktu melambat di lantai dansa","Malam ini milik kita berdua"]],
["Teduh","Dua Cangkir","Santai",66,62,"penta",37,["Duduklah sebentar di bawah pohon","Biarkan dunia berjalan tanpamu","Napas panjang, bahu yang turun","Semua baik-baik saja di sini"]],
["Gaung Pegunungan","Kapal Kertas","Indie",96,53,"mayor",41,["Kupanggil namamu dari puncak sunyi","Gunung membalas dengan suara lembut","Awan lewat membawa kabar baik","Aku pulang dengan dada yang lapang"]]
].map(([title,artist,genre,bpm,root,scale,seed,lyrics],id)=>({id,title,artist,genre,bpm,root,scale,seed,lyrics,hue:(seed*47)%360}));
const SCALES={mayor:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],penta:[0,2,4,7,9]};
const STEPS=96,PER=STEPS/4;

/* ===== 7. UTILITIES ===== */
const $=(s,r=document)=>r.querySelector(s);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const store={
 get(k,d){try{const v=localStorage.getItem("ns."+k);return v===null?d:JSON.parse(v)}catch{return d}},
 set(k,v){try{localStorage.setItem("ns."+k,JSON.stringify(v))}catch{}},
 del(k){try{localStorage.removeItem("ns."+k)}catch{}}
};
const sha=async s=>{
 try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
 catch{return btoa(s)}
};
const lcg=seed=>()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
const midi=m=>440*2**((m-69)/12);

/* ===== 8. STATE ===== */
const S={user:store.get("sesi",null),mode:"masuk",err:"",q:"",genre:"Semua",favOnly:false,
 cur:-1,step:0,playing:false,shuffle:false,repeat:false,vol:.8};

/* ===== 9. AUTH SERVICE ===== */
const Auth={
 users:()=>store.get("users",{}),
 async seed(){const u=this.users();if(!u.demo){u.demo={salt:"ns",hash:await sha("ns:demo123"),fav:[]};store.set("users",u)}},
 async register(name,pw){
  const u=this.users();if(u[name])throw new Error("Nama pengguna sudah dipakai.");
  const salt=crypto.getRandomValues?[...crypto.getRandomValues(new Uint8Array(8))].join(""):"ns";
  u[name]={salt,hash:await sha(salt+":"+pw),fav:[]};store.set("users",u);
 },
 async login(name,pw){
  const r=this.users()[name];
  if(!r||r.hash!==await sha(r.salt+":"+pw))throw new Error("Nama pengguna atau kata sandi salah.");
 },
 favs(){return new Set((this.users()[S.user]||{}).fav||[])},
 toggleFav(id){const u=this.users(),f=new Set(u[S.user].fav);f.has(id)?f.delete(id):f.add(id);u[S.user].fav=[...f];store.set("users",u)}
};

/* ===== 10. AUDIO ENGINE (Web Audio sintesis) ===== */
const Engine={
 ctx:null,master:null,an:null,send:null,timer:null,
 init(){
  if(this.ctx)return;
  this.ctx=new(window.AudioContext||window.webkitAudioContext)();
  const c=this.ctx;
  this.master=c.createGain();this.master.gain.value=S.vol;
  this.an=c.createAnalyser();this.an.fftSize=128;this.an.smoothingTimeConstant=.8;
  const delay=c.createDelay(),fb=c.createGain();delay.delayTime.value=.28;fb.gain.value=.3;
  delay.connect(fb);fb.connect(delay);
  this.send=c.createGain();this.send.gain.value=.35;this.send.connect(delay);delay.connect(this.master);
  this.master.connect(this.an);this.an.connect(c.destination);
 },
 note(freq,dur,type,vol){
  const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(this.master);g.connect(this.send);o.start(t);o.stop(t+dur+.05);
 },
 tick(){
  const t=TRACKS[S.cur],sc=SCALES[t.scale],r=lcg(t.seed*1000+S.step),sd=60/t.bpm/2;
  const deg=Math.floor(r()*sc.length),oct=r()<.3?12:0;
  if(r()<.82)this.note(midi(t.root+12+sc[deg]+oct),sd*1.6,"triangle",.16);
  if(S.step%4===0)this.note(midi(t.root-12+sc[(S.step/4*2)%sc.length|0]),sd*3.5,"sine",.22);
  if(S.step%2===0)this.note(midi(t.root+36),.04,"square",.015);
  S.step++;
  if(S.step>=STEPS){S.step=0;Player.ended();return}
  UI.progress();UI.lyrics();
 },
 start(){this.stop();const ms=60/TRACKS[S.cur].bpm/2*1000;this.tick();this.timer=setInterval(()=>this.tick(),ms)},
 stop(){clearInterval(this.timer);this.timer=null},
 volume(v){if(this.master)this.master.gain.value=v}
};

/* ===== 11. PLAYER CONTROLLER ===== */
const Player={
 play(i){
  Engine.init();if(Engine.ctx.state==="suspended")Engine.ctx.resume();
  if(S.cur!==i)S.step=0;S.cur=i;S.playing=true;Engine.start();UI.all();Viz.start();
 },
 pause(){Engine.stop();S.playing=false;UI.all()},
 toggle(){S.cur<0?this.play(0):(S.playing?this.pause():this.play(S.cur))},
 next(d=1){
  const n=TRACKS.length;
  const i=S.shuffle&&d>0?(S.cur+1+Math.floor(Math.random()*(n-1)))%n:((S.cur<0?0:S.cur)+d+n)%n;
  S.step=0;this.play(i);
 },
 ended(){S.repeat?this.play(S.cur):this.next(1)},
 seek(step){if(S.cur<0)return;S.step=Math.max(0,Math.min(STEPS-1,step));UI.progress();UI.lyrics()}
};

/* ===== 12. VISUALIZER ===== */
const Viz={
 raf:0,
 start(){if(!this.raf)this.loop()},
 loop(){
  const cv=$("#viz");if(!cv||!Engine.an){this.raf=0;return}
  const g=cv.getContext("2d"),dpr=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
  if(cv.width!==w*dpr){cv.width=w*dpr;cv.height=h*dpr}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const d=new Uint8Array(Engine.an.frequencyBinCount);Engine.an.getByteFrequencyData(d);
  const n=40,bw=w/n,cs=getComputedStyle(document.documentElement);
  g.fillStyle=cs.getPropertyValue("--vis").trim();
  for(let i=0;i<n;i++){const v=d[i]/255,bh=Math.max(3,v*h);g.globalAlpha=.35+v*.65;g.fillRect(i*bw+2,h-bh,bw-4,bh)}
  this.raf=requestAnimationFrame(()=>this.loop());
 }
};

/* ===== 13. UI ===== */
const UI={
 visible(){
  const q=S.q.toLowerCase(),fav=Auth.favs();
  return TRACKS.filter(t=>(S.genre==="Semua"||t.genre===S.genre)&&(!S.favOnly||fav.has(t.id))&&(`${t.title} ${t.artist}`.toLowerCase().includes(q)));
 },
 authView(){
  const m=S.mode==="masuk";
  return `<div class="auth"><div><div class="vinyl go" style="--h:340;width:120px;margin-bottom:22px"></div>
  <h1 class="brand">Nada<br><span>Senja</span></h1><p class="tag">Putar lagu, ikuti liriknya, dan simpan favoritmu di akun sendiri.</p></div>
  <div class="panel"><h2>${m?"Masuk":"Buat akun"}</h2>
  <input id="un" placeholder="Nama pengguna" autocomplete="username"><input id="pw" type="password" placeholder="Kata sandi" autocomplete="${m?"current-password":"new-password"}">
  ${m?"":'<input id="pw2" type="password" placeholder="Ulangi kata sandi">'}
  <div class="err" role="alert">${esc(S.err)}</div>
  <button class="p" data-act="submit">${m?"Masuk":"Daftar"}</button>
  <button data-act="mode">${m?"Belum punya akun? Daftar":"Sudah punya akun? Masuk"}</button>
  <span class="mute">Akun contoh: demo / demo123</span></div></div>`;
 },
 appView(){
  const gs=["Semua",...new Set(TRACKS.map(t=>t.genre))];
  return `<div class="wrap"><header class="head"><h1>Nada <span>Senja</span></h1><span class="sp"></span>
  <button data-act="theme" aria-label="Ganti tema">◐</button><span class="mute">@${esc(S.user)}</span><button data-act="logout">Keluar</button></header>
  <div class="grid"><main>
   <section class="card hero"><div class="vinyl" id="vinyl"></div><div class="info"><span class="mute" id="meta">Belum ada lagu</span><h2 id="title">Pilih lagu</h2><div class="mute" id="artist">Ketuk lagu di daftar</div>
   <canvas id="viz" aria-hidden="true"></canvas>
   <div class="prog" id="prog" role="slider" aria-label="Posisi lagu"><i id="bar"></i></div><div class="times mute"><span id="t1">0:00</span><span id="t2">0:00</span></div></div>
   <div class="ctl" style="width:100%"><button data-act="prev" aria-label="Sebelumnya">⏮</button><button class="p" data-act="toggle" id="pp" aria-label="Putar atau jeda">▶</button><button data-act="next" aria-label="Berikutnya">⏭</button>
   <button data-act="shuffle" id="bs" aria-label="Acak">⇄</button><button data-act="repeat" id="br" aria-label="Ulangi">↻</button>
   <input class="vol" type="range" min="0" max="1" step=".05" value="${S.vol}" data-act="vol" aria-label="Volume"></div></section>
   <div class="tools"><input id="q" placeholder="Cari judul atau artis" value="${esc(S.q)}" aria-label="Cari lagu"><button data-act="fav" id="bf">♥ Favorit</button></div>
   <div class="chips">${gs.map(g=>`<button data-act="genre" data-g="${g}" class="${g===S.genre?"on":""}">${g}</button>`).join("")}</div>
   <div class="list" id="list"></div></main>
  <aside class="card lyr" id="lyr"></aside></div>
  <p class="mute kbd"><kbd>Spasi</kbd> putar/jeda · <kbd>←</kbd> <kbd>→</kbd> lagu sebelumnya/berikutnya</p></div>`;
 },
 render(){$("#app").innerHTML=S.user?this.appView():this.authView();if(S.user)this.all()},
 all(){this.list();this.now();this.lyrics();this.progress()},
 list(){
  const el=$("#list");if(!el)return;const fav=Auth.favs(),v=this.visible();
  el.innerHTML=v.length?v.map(t=>`<div class="tr${t.id===S.cur?" cur":""}" data-act="play" data-id="${t.id}" tabindex="0" role="button" aria-label="Putar ${esc(t.title)}">
   <span class="cov" style="--h:${t.hue}"></span><span><b>${esc(t.title)}</b><span class="mute">${esc(t.artist)}</span></span><span class="mute">${t.genre}</span>
   <button class="heart${fav.has(t.id)?" on":""}" data-act="heart" data-id="${t.id}" aria-label="Favorit">${fav.has(t.id)?"♥":"♡"}</button></div>`).join(""):`<p class="mute">Tidak ada lagu yang cocok. Ubah kata kunci atau filter.</p>`;
  $("#bf").classList.toggle("on",S.favOnly);
 },
 now(){
  if(!$("#title"))return;const t=TRACKS[S.cur];
  $("#vinyl").classList.toggle("go",S.playing);$("#pp").textContent=S.playing?"⏸":"▶";
  $("#bs").classList.toggle("on",S.shuffle);$("#br").classList.toggle("on",S.repeat);
  if(t){$("#title").textContent=t.title;$("#artist").textContent=t.artist;$("#meta").textContent=`${t.genre} · ${t.bpm} BPM`;$("#vinyl").style.setProperty("--h",t.hue)}
 },
 progress(){
  if(!$("#bar"))return;const t=TRACKS[S.cur];$("#bar").style.width=S.step/STEPS*100+"%";
  if(t){const sd=60/t.bpm/2;$("#t1").textContent=fmt(S.step*sd);$("#t2").textContent=fmt(STEPS*sd)}
 },
 lyrics(){
  const el=$("#lyr");if(!el)return;
  if(S.cur<0){el.innerHTML=`<h3>Lirik</h3><p class="mute">Pilih lagu untuk melihat lirik. Baris yang dinyanyikan akan menyala, dan kamu bisa mengetuk baris untuk melompat.</p>`;return}
  const t=TRACKS[S.cur],a=Math.min(3,Math.floor(S.step/PER)),sig=S.cur+"-"+a;
  if(el.dataset.sig===sig)return;el.dataset.sig=sig;
  el.innerHTML=`<h3>${esc(t.title)}</h3><span class="mute">${esc(t.artist)}</span>`+t.lyrics.map((l,i)=>`<div class="ln${i===a?" now":""}" data-act="line" data-i="${i}">${esc(l)}</div>`).join("");
 }
};

/* ===== 14. EVENTS (event delegation) ===== */
const Actions={
 async submit(){
  const n=$("#un").value.trim().toLowerCase(),p=$("#pw").value;
  try{
   if(n.length<3||p.length<6)throw new Error("Nama minimal 3 huruf, kata sandi minimal 6 karakter.");
   if(S.mode==="daftar"){if(p!==$("#pw2").value)throw new Error("Kata sandi tidak sama.");await Auth.register(n,p)}
   await Auth.login(n,p);S.user=n;S.err="";store.set("sesi",n);
  }catch(e){S.err=e.message}
  UI.render();
 },
 mode(){S.mode=S.mode==="masuk"?"daftar":"masuk";S.err="";UI.render()},
 logout(){Player.pause();S.user=null;S.cur=-1;S.step=0;store.del("sesi");UI.render()},
 theme(){const r=document.documentElement,d=r.dataset.theme==="dark"||(!r.dataset.theme&&!matchMedia("(prefers-color-scheme: light)").matches);r.dataset.theme=d?"light":"dark";store.set("tema",r.dataset.theme)},
 play(el){Player.play(+el.dataset.id)},
 heart(el){Auth.toggleFav(+el.dataset.id);UI.list()},
 toggle(){Player.toggle()},next(){Player.next(1)},prev(){Player.next(-1)},
 shuffle(){S.shuffle=!S.shuffle;UI.now()},repeat(){S.repeat=!S.repeat;UI.now()},
 fav(){S.favOnly=!S.favOnly;UI.list()},
 genre(el){S.genre=el.dataset.g;document.querySelectorAll("[data-act=genre]").forEach(b=>b.classList.toggle("on",b===el));UI.list()},
 line(el){Player.seek(+el.dataset.i*PER);const l=$("#lyr");l.dataset.sig="";UI.lyrics()}
};
document.addEventListener("click",e=>{
 const p=e.target.closest("#prog");
 if(p&&S.cur>=0){const b=p.getBoundingClientRect();Player.seek(Math.floor((e.clientX-b.left)/b.width*STEPS));return}
 const el=e.target.closest("[data-act]");if(!el||el.dataset.act==="vol")return;
 if(el.dataset.act==="play"&&e.target.closest(".heart"))return;
 Actions[el.dataset.act]?.(el);
});
document.addEventListener("input",e=>{
 if(e.target.id==="q"){S.q=e.target.value;UI.list()}
 if(e.target.dataset.act==="vol"){S.vol=+e.target.value;Engine.volume(S.vol)}
});
document.addEventListener("keydown",e=>{
 if(!S.user)return;
 if(e.target.matches("input")){if(e.key==="Enter"&&!S.user)Actions.submit();return}
 if(e.code==="Space"){e.preventDefault();Player.toggle()}
 else if(e.key==="ArrowRight")Player.next(1);
 else if(e.key==="ArrowLeft")Player.next(-1);
 else if(e.key==="Enter"&&e.target.dataset.act==="play")Actions.play(e.target);
});
document.addEventListener("keydown",e=>{if(!S.user&&e.key==="Enter"&&e.target.matches("input"))Actions.submit()});

/* ===== 15. BOOT ===== */
(async()=>{
 const th=store.get("tema",null);if(th)document.documentElement.dataset.theme=th;
 await Auth.seed();
 if(S.user&&!Auth.users()[S.user])S.user=null;
 UI.render();
})();
