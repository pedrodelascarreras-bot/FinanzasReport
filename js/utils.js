// ══ UTILS ══
function fmtN(n){
  if(n==null||n===undefined||isNaN(n))return'—';
  const num=Number(n);
  if(isNaN(num))return'—';
  // Coma decimal, punto de miles, 2 decimales exactos (es-AR)
  return num.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function fmtWeekLabel(k){const d=new Date(k+'T12:00:00');return d.getDate()+'/'+(d.getMonth()+1);}
function getWeekKey(d){const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-dt.getDay()+1);return dt.toISOString().split('T')[0];}
function getMonthKey(d){
  const dt=d instanceof Date?d:new Date(d);
  // Use local date parts to avoid UTC timezone shifting
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
}
function parseDate(raw){if(!raw)return null;const m=String(raw).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);if(m){const y=m[3].length===2?2000+parseInt(m[3]):parseInt(m[3]);return new Date(y,parseInt(m[2])-1,parseInt(m[1]));}const d=new Date(raw);return isNaN(d)?null:d;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function updateSidebarStats(){/* sidebar stats removed */}
function showToast(msg,type='info'){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';setTimeout(()=>t.classList.remove('show'),3500);}
/* iOS scroll-lock helpers */
let _iosOvCnt=0,_iosSY=0;
function _iosLock(){if(++_iosOvCnt===1){_iosSY=window.scrollY;document.body.style.overflow='hidden';document.body.style.position='fixed';document.body.style.top=(-_iosSY)+'px';document.body.style.width='100%';}}
function _iosUnlock(){if(--_iosOvCnt<=0){_iosOvCnt=0;document.body.style.overflow='';document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo(0,_iosSY);}}
function openModal(id){document.getElementById(id).classList.add('open');_iosLock();}
function closeModal(id){document.getElementById(id).classList.remove('open');_iosUnlock();}
function chartOpts(prefix,legend){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,labels:{color:'#8e8e93',font:{size:11},boxWidth:12}},tooltip:{backgroundColor:_isL()?'#1d1d1f':'#2c2c2e',titleColor:_isL()?'#fff':'#f5f5f7',bodyColor:'#8e8e93',borderColor:'rgba(0,0,0,0.08)',borderWidth:1,callbacks:{label:ctx=>' '+prefix+fmtN(ctx.parsed.y!=null?ctx.parsed.y:ctx.parsed)+' ARS'}}},scales:{x:{grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},ticks:{color:_isL()?'#86868b':'#6e6e73',font:{size:10}}},y:{grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},ticks:{color:_isL()?'#86868b':'#6e6e73',font:{size:10},callback:v=>'$'+fmtN(v)}}}};}

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
    if(document.getElementById('page-cuotas').classList.contains('active')){renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();}
    if(document.getElementById('page-income').classList.contains('active'))renderIncomePage();
    if(document.getElementById('page-savings').classList.contains('active'))renderSavingsPage();
  }
}
function loadTheme(){
  const saved=localStorage.getItem('fin_theme')||'dark';
  if(saved==='light'){document.body.classList.add('light-mode');document.getElementById('theme-icon').textContent='🌙';document.getElementById('theme-label').textContent='Modo oscuro';if(typeof Chart!=='undefined')Chart.defaults.plugins.tooltip.backgroundColor='rgba(255,255,255,0.95)';}
}

// ══ RENDER SUBS ANNUAL BREAKDOWN ══
function renderSubsAnnual(){
  const toMonthly=(s)=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  const toAnnual=(s)=>toMonthly(s)*12;
  if(!state.subscriptions.length){document.getElementById('subs-annual-card').style.display='none';return;}
  const sorted=[...state.subscriptions].sort((a,b)=>toAnnual(b)-toAnnual(a));
  const totalAnnual=sorted.filter(s=>s.currency==='ARS').reduce((acc,s)=>acc+toAnnual(s),0);
  const totalAnnualUSD=sorted.filter(s=>s.currency==='USD').reduce((acc,s)=>acc+toAnnual(s),0);
  const maxAnn=Math.max(...sorted.map(s=>toAnnual(s)),1);
  document.getElementById('subs-annual-card').style.display='block';
  const totalParts=[];
  if(totalAnnual>0)totalParts.push('$'+fmtN(Math.round(totalAnnual))+' ARS/año');
  if(totalAnnualUSD>0)totalParts.push('U$D '+fmtN(Math.round(totalAnnualUSD))+'/año');
  document.getElementById('subs-annual-total').textContent=totalParts.join(' + ');
  document.getElementById('subs-annual-list').innerHTML=sorted.map(s=>{
    const c=s.color||'#888888';const ann=toAnnual(s);const w=Math.round(ann/maxAnn*100);
    const prefix=s.currency==='USD'?'U$D ':'$';
    return`<div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:18px;width:28px;text-align:center;flex-shrink:0;">${esc(s.emoji||'●')}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px;">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.name)}</div>
          <div style="font-size:13px;font-family:var(--font);font-weight:700;color:${c};flex-shrink:0;">${prefix}${fmtN(Math.round(ann))}/año</div>
        </div>
        <div style="height:5px;background:var(--surface3);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${w}%;background:${c};border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-top:3px;">${prefix}${fmtN(Math.round(ann/12))}/mes · ${s.freq==='annual'?'Cobro anual':s.freq==='weekly'?'Semanal':'Mensual'}</div>
      </div>
    </div>`;
  }).join('');
}

