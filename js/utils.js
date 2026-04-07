// ══ UTILS ══
function fmtN(n,dec){
  if(n==null||n===undefined||isNaN(n))return'—';
  const num=Number(n);
  if(isNaN(num))return'—';
  const d=dec!==undefined?dec:2;
  return num.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function fmtWeekLabel(k){const d=new Date(k+'T12:00:00');return d.getDate()+'/'+(d.getMonth()+1);}
function getWeekKey(d){const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-dt.getDay()+1);return dt.toISOString().split('T')[0];}
function getMonthKey(d){
  const dt=d instanceof Date?d:new Date(d);
  // Use local date parts to avoid UTC timezone shifting
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
}
function parseDate(raw){if(!raw)return null;const m=String(raw).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);if(m){const y=m[3].length===2?2000+parseInt(m[3]):parseInt(m[3]);return new Date(y,parseInt(m[2])-1,parseInt(m[1]));}const d=new Date(raw);return isNaN(d)?null:d;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function updateSidebarStats(){/* sidebar stats removed */}
function showToast(msg,type='info'){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';setTimeout(()=>t.classList.remove('show'),3500);}
const _animFrameMap=new WeakMap();
function prefersReducedMotion(){
  return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function animateNumberText(el,value,opts={}){
  if(!el)return;
  const num=Number(value);
  const formatter=typeof opts.formatter==='function'?opts.formatter:(n=>`${opts.prefix||''}${fmtN(n,opts.decimals)}${opts.suffix||''}`);
  if(!isFinite(num)){el.textContent=opts.fallback??'—';return;}
  if(prefersReducedMotion()){el.textContent=formatter(num);return;}
  const prev=_animFrameMap.get(el);
  if(prev)cancelAnimationFrame(prev);
  const duration=opts.duration||820;
  const easing=opts.easing||((t)=>1-Math.pow(1-t,4));
  const start=performance.now();
  const from=Number.isFinite(opts.from)?Number(opts.from):0;
  const tick=(now)=>{
    const progress=Math.min(1,(now-start)/duration);
    const eased=easing(progress);
    const current=from+((num-from)*eased);
    el.textContent=formatter(current);
    if(progress<1){
      _animFrameMap.set(el,requestAnimationFrame(tick));
    }else{
      el.textContent=formatter(num);
      _animFrameMap.delete(el);
    }
  };
  _animFrameMap.set(el,requestAnimationFrame(tick));
}
function animateProgressBar(el,targetPct){
  if(!el)return;
  const pct=Math.max(0,Math.min(100,Number(targetPct)||0));
  if(prefersReducedMotion()){el.style.width=pct+'%';return;}
  el.style.transition='width 760ms var(--ease-premium)';
  el.style.width='0%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.width=pct+'%';}));
}
function animateDonutStroke(el,targetPct,radius=38){
  if(!el)return;
  const pct=Math.max(0,Math.min(100,Number(targetPct)||0));
  const circumference=2*Math.PI*radius;
  if(prefersReducedMotion()){
    el.style.strokeDasharray=`${circumference}`;
    el.style.strokeDashoffset=`${circumference-(pct/100)*circumference}`;
    return;
  }
  el.style.transition='stroke-dashoffset 820ms var(--ease-premium), stroke var(--dur-med) var(--ease-premium)';
  el.style.strokeDasharray=`${circumference}`;
  el.style.strokeDashoffset=`${circumference}`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.strokeDashoffset=`${circumference-(pct/100)*circumference}`;
  }));
}
function getFadeDelay(el,idx){
  if(el.classList.contains('d1'))return 70;
  if(el.classList.contains('d2'))return 130;
  if(el.classList.contains('d3'))return 190;
  if(el.classList.contains('d4'))return 250;
  return idx*68;
}
function replayFadeUp(scope){
  const root=typeof scope==='string'?document.querySelector(scope):scope;
  if(!root)return;
  const nodes=[...root.querySelectorAll('.fade-up')];
  nodes.forEach((el,idx)=>{
    el.style.animation='none';
    el.style.opacity='1';
    el.style.transform='none';
    el.style.setProperty('--stagger-delay',`${getFadeDelay(el,idx)}ms`);
  });
}
function animatePageEnter(pageEl){
  if(!pageEl)return;
  pageEl.classList.remove('page-enter');
  replayFadeUp(pageEl);
}
/* iOS scroll-lock helpers */
let _iosOvCnt=0,_iosSY=0;
function _iosLock(){if(++_iosOvCnt===1){_iosSY=window.scrollY;document.body.style.overflow='hidden';document.body.style.position='fixed';document.body.style.top=(-_iosSY)+'px';document.body.style.width='100%';}}
function _iosUnlock(){if(--_iosOvCnt<=0){_iosOvCnt=0;document.body.style.overflow='';document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo(0,_iosSY);}}
function openModal(id){document.getElementById(id).classList.add('open');_iosLock();}
function closeModal(id){document.getElementById(id).classList.remove('open');_iosUnlock();}
function chartOpts(prefix,legend){const _tt=typeof _chartTooltip==='function'?_chartTooltip():{};const _tc=typeof _chartTickColor==='function'?_chartTickColor():(_isL()?'#748096':'#566172');const _tf=typeof _chartTickFont==='function'?_chartTickFont():{size:10,weight:'500',family:'-apple-system,SF Pro Display,sans-serif'};const _gy=typeof _chartGridY==='function'?_chartGridY():{color:_isL()?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)',drawBorder:false};return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,labels:{color:'#8e8e93',font:{size:11},boxWidth:12}},tooltip:{..._tt,callbacks:{label:ctx=>' '+prefix+fmtN(ctx.parsed.y!=null?ctx.parsed.y:ctx.parsed)+' ARS'}}},scales:{x:{grid:{display:false},ticks:{color:_tc,font:_tf}},y:{grid:_gy,ticks:{color:_tc,font:_tf,callback:v=>'$'+fmtN(v)}}}};}

// ══ SIDEBAR TOGGLE ══
function toggleMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display=m.style.display==='none'?'block':'none';
}
function closeMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display='none';
}
function toggleSidebar(){
  const app=document.querySelector('.app');
  const collapsed=app.classList.toggle('sidebar-collapsed');
  localStorage.setItem('fin_sidebar',collapsed?'collapsed':'open');
  const btn=document.getElementById('sidebar-open-btn');
  if(btn)btn.style.display=collapsed?'flex':'none';
}
window.addEventListener('load',()=>{
  const active=document.querySelector('.page.active');
  if(active)animatePageEnter(active);
});
function loadSidebar(){
  const saved=localStorage.getItem('fin_sidebar');
  if(saved==='collapsed'){
    document.querySelector('.app').classList.add('sidebar-collapsed');
    const btn=document.getElementById('sidebar-open-btn');
    if(btn)btn.style.display='flex';
  }
}

// ══ COLOR THEMES ══
const COLOR_THEMES = [
  { id:'blue',    label:'Azul',    color:'#2997ff', colorLight:'#0071e3' },
  { id:'purple',  label:'Violeta', color:'#bf5af2', colorLight:'#7d3aec' },
  { id:'emerald', label:'Verde',   color:'#30d158', colorLight:'#1c8c3b' },
  { id:'rose',    label:'Rosa',    color:'#ff375f', colorLight:'#c9193b' },
  { id:'amber',   label:'Ámbar',   color:'#ff9f0a', colorLight:'#c96a00' },
  { id:'indigo',  label:'Índigo',  color:'#5e5ce6', colorLight:'#3634a3' },
];

function applyColorTheme(themeId) {
  // Remove all theme classes
  COLOR_THEMES.forEach(t => document.body.classList.remove('theme-' + t.id));
  if(themeId && themeId !== 'blue') document.body.classList.add('theme-' + themeId);
  localStorage.setItem('fin_color_theme', themeId || 'blue');
  // Update dot color in button
  const isLight = document.body.classList.contains('light-mode');
  const theme = COLOR_THEMES.find(t => t.id === themeId) || COLOR_THEMES[0];
  const dot = document.getElementById('color-theme-dot');
  if(dot) dot.style.background = isLight ? theme.colorLight : theme.color;
  // Refresh active swatches if panel is open
  document.querySelectorAll('.ctp-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === themeId);
  });
}

function loadColorTheme() {
  const saved = localStorage.getItem('fin_color_theme') || 'blue';
  applyColorTheme(saved);
}

function toggleColorThemePanel() {
  const existing = document.getElementById('color-theme-panel');
  if(existing) { existing.remove(); return; }

  const currentTheme = localStorage.getItem('fin_color_theme') || 'blue';
  const isLight = document.body.classList.contains('light-mode');

  const panel = document.createElement('div');
  panel.id = 'color-theme-panel';
  panel.innerHTML = `
    <div class="ctp-title">Color de la app</div>
    <div class="ctp-grid">
      ${COLOR_THEMES.map(t => `
        <div class="ctp-swatch ${t.id === currentTheme ? 'active' : ''}" data-theme="${t.id}" onclick="applyColorTheme('${t.id}')">
          <div class="ctp-swatch-dot" style="background:${isLight ? t.colorLight : t.color};"></div>
          <span>${t.label}</span>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(panel);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if(!panel.contains(e.target) && e.target.id !== 'color-theme-btn') {
        panel.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 50);
}

// ══ THEME TOGGLE ══
function toggleTheme(){
  const isLight=document.body.classList.toggle('light-mode');
  state.theme=isLight?'light':'dark';
  localStorage.setItem('fin_theme',state.theme);
  document.getElementById('theme-icon').textContent=isLight?'🌙':'☀️';
  document.getElementById('theme-label').textContent=isLight?'Modo oscuro':'Modo claro';
  // Rebuild charts with new colors
  if(state.transactions.length){
    Chart.defaults.plugins.tooltip.backgroundColor = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(44,44,46,0.95)';
    renderDashboard();
    if(document.getElementById('page-tendencia').classList.contains('active'))renderTendencia();
    if(document.getElementById('page-compare').classList.contains('active'))renderCompare();
    if(document.getElementById('page-balance')?.classList.contains('active') && typeof renderBalancePage==='function')renderBalancePage();
    if(document.getElementById('page-cuotas').classList.contains('active')){renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();}
    if(document.getElementById('page-income').classList.contains('active'))renderIncomePage();
    if(document.getElementById('page-savings').classList.contains('active'))renderSavingsPage();
  }
}
function loadTheme(){
  const saved=localStorage.getItem('fin_theme')||'dark';
  if(saved==='light'){document.body.classList.add('light-mode');document.getElementById('theme-icon').textContent='🌙';document.getElementById('theme-label').textContent='Modo oscuro';if(typeof Chart!=='undefined')Chart.defaults.plugins.tooltip.backgroundColor='rgba(255,255,255,0.95)';}
}
