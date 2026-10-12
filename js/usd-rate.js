// ══ COTIZACIÓN DEL DÓLAR ══
// USD_TO_ARS es global: la usan todas las pantallas para pasar USD a ARS.
let USD_TO_ARS = state.usdRate || 1420;
function recordUsdRateSnapshot(buy, sell, source){
  const venta = Number(sell || 0);
  if(!(venta > 0)) return;
  const now = new Date();
  const history = Array.isArray(state.usdRateHistory) ? state.usdRateHistory.slice() : [];
  const snapshot = {
    ts: now.toISOString(),
    buy: Number(buy || venta),
    sell: venta,
    source: source || state.usdRateSource || 'oficial BNA'
  };
  const last = history[history.length - 1];
  if(last){
    const lastDate = new Date(last.ts);
    if(!Number.isNaN(lastDate.getTime()) && (now - lastDate) < 60 * 60 * 1000){
      history[history.length - 1] = snapshot;
    }else{
      history.push(snapshot);
    }
  }else{
    history.push(snapshot);
  }
  state.usdRateHistory = history
    .filter(item => item && Number(item.sell) > 0 && item.ts)
    .slice(-30);
}
async function fetchUsdRate(manual=false){
  const btn=document.getElementById('btn-refresh-usd');
  const statusEl=document.getElementById('usd-rate-status');
  if(btn){btn.disabled=true;btn.querySelector('span') ? btn.querySelector('span').textContent='...' : btn.textContent='↻ ...';}
  if(statusEl)statusEl.textContent='Actualizando...';

  // Múltiples fuentes con fallback — todas tienen CORS abierto
  const sources=[
    // 1. dolarapi directo
    {url:'https://dolarapi.com/v1/dolares/oficial', parse:d=>({buy:d.compra,sell:d.venta})},
    // 2. dolarapi via allorigins proxy
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://dolarapi.com/v1/dolares/oficial'), parse:d=>{const j=JSON.parse(d.contents);return {buy:j.compra,sell:j.venta};}},
    // 3. bluelytics directo
    {url:'https://api.bluelytics.com.ar/v2/latest', parse:d=>({buy:d.oficial?.value_buy,sell:d.oficial?.value_sell})},
    // 4. bluelytics via allorigins
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://api.bluelytics.com.ar/v2/latest'), parse:d=>{const j=JSON.parse(d.contents);return {buy:j.oficial?.value_buy,sell:j.oficial?.value_sell};}},
    // 5. Argentina.gob.ar series de tiempo (BCRA oficial)
    {url:'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD', parse:d=>({buy:d.results?.[0]?.tipoPase,sell:d.results?.[0]?.tipoPase})}
  ];

  for(const src of sources){
    try{
      const _ctrl=new AbortController();const _tmr=setTimeout(()=>_ctrl.abort(),5000);
      const r=await fetch(src.url,{signal:_ctrl.signal});
      clearTimeout(_tmr);
      if(!r.ok)continue;
      const d=await r.json();
      const parsed=src.parse(d);
      const compra=Number(parsed?.buy||parsed||0);
      const venta=Number(parsed?.sell||parsed||0);
      if(venta&&venta>0){
        USD_TO_ARS=venta;state.usdRate=venta;
        state.usdRateBuy=compra&&compra>0?compra:venta;
        state.usdRateSell=venta;
        state.usdRateSource='oficial BNA';
        state.usdRateUpdated=new Date().toISOString();
        recordUsdRateSnapshot(state.usdRateBuy, state.usdRateSell, state.usdRateSource);
        saveState();updateUsdRateUI();
        if(manual)showToast('✓ Oficial BNA: $'+fmtN(venta)+'/USD');
        if(btn){btn.disabled=false;btn.querySelector('span') ? btn.querySelector('span').textContent='Actualizar' : btn.textContent='↻ Actualizar';}
        if(statusEl)statusEl.textContent='';
        return;
      }
    }catch(e){}
  }

  if(manual)showToast('⚠️ No se pudo conectar. Editá el valor manualmente.');
  if(btn){btn.disabled=false;btn.querySelector('span') ? btn.querySelector('span').textContent='Actualizar' : btn.textContent='↻ Actualizar';}
  if(statusEl)statusEl.textContent='';
}
function updateUsdRateUI(){
  const rate=USD_TO_ARS;
  const buyRate=Number(state.usdRateBuy||rate||0) || rate;
  const sellRate=Number(state.usdRateSell||rate||0) || rate;
  // Card en dashboard
  const buyDisp=document.getElementById('usd-rate-buy-display');
  const sellDisp=document.getElementById('usd-rate-sell-display');
  if(buyDisp){
    animateNumberText(buyDisp,buyRate,{prefix:'$',decimals:2,duration:620});
  }
  if(sellDisp){
    animateNumberText(sellDisp,sellRate,{prefix:'$',decimals:2,duration:700});
  }
  const src=document.getElementById('usd-rate-source-badge');
  if(src)src.textContent=state.usdRateSource||'manual';
  const upd=document.getElementById('usd-rate-updated');
  if(upd&&state.usdRateUpdated){
    const d=new Date(state.usdRateUpdated);
    const label='Actualizado '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const span=upd.querySelector('span');
    if(span) span.textContent=label;
    else upd.textContent=label;
  }
  const status=document.getElementById('usd-rate-status');
  if(status)status.textContent='Tocá para ver compra y venta';
  // Legacy badge selector (otros lugares que puedan tener el badge)
  document.querySelectorAll('.usd-rate-badge').forEach(el=>{el.textContent='U$D 1 = $'+fmtN(rate)+' ('+( state.usdRateSource||'manual')+')'});
  renderDb2DollarSparkline();
  // Si el dashboard ya tiene datos, recalcular
  if(state.transactions.length)renderDashboard();
}
function saveUsdRateManual(){
  const val=parseFloat(document.getElementById('modal-usd-input').value);
  if(!val||val<1){showToast('⚠️ Ingresá un valor válido','error');return;}
  USD_TO_ARS=val;state.usdRate=val;state.usdRateBuy=state.usdRateBuy||val;state.usdRateSell=val;state.usdRateSource='manual';state.usdRateUpdated=new Date().toISOString();
  saveState();updateUsdRateUI();closeModal('modal-usd-rate');showToast('✓ Tipo de cambio actualizado: $'+fmtN(val),'success');
}
async function loadAllRates(){
  const blueEl=document.getElementById('ref-blue');
  const oficialEl=document.getElementById('ref-oficial');
  const oficialRangeEl=document.getElementById('ref-oficial-range');
  const mepEl=document.getElementById('ref-mep');
  if(blueEl)blueEl.textContent='Cargando...';
  try{
    const r=await fetch('https://dolarapi.com/v1/dolares');
    if(r.ok){
      const list=await r.json();
      const blue=list.find(d=>d.casa==='blue');
      const oficial=list.find(d=>d.casa==='oficial');
      const mep=list.find(d=>d.casa==='bolsa')||list.find(d=>d.casa==='mep');
      if(blueEl)blueEl.textContent=blue?'$'+fmtN(blue.venta):'—';
      if(oficialEl)oficialEl.textContent=oficial?'$'+fmtN(oficial.venta):'—';
      if(oficialRangeEl)oficialRangeEl.textContent=oficial?`$${fmtN(oficial.compra)} · $${fmtN(oficial.venta)}`:'—';
      if(mepEl)mepEl.textContent=mep?'$'+fmtN(mep.venta):'—';
      // Pre-fill input with blue
      if(blue&&blue.venta){const inp=document.getElementById('modal-usd-input');if(inp&&!inp.value)inp.value=Math.round(blue.venta);}
      return;
    }
  }catch(e){}
  // fallback bluelytics
  try{
    const r2=await fetch('https://api.bluelytics.com.ar/v2/latest');
    if(r2.ok){const d=await r2.json();
      if(blueEl)blueEl.textContent=d.blue?.value_sell?'$'+fmtN(d.blue.value_sell):'—';
      if(oficialEl)oficialEl.textContent=d.oficial?.value_sell?'$'+fmtN(d.oficial.value_sell):'—';
      if(oficialRangeEl)oficialRangeEl.textContent=d.oficial?.value_buy&&d.oficial?.value_sell?`$${fmtN(d.oficial.value_buy)} · $${fmtN(d.oficial.value_sell)}`:'—';
      if(mepEl)mepEl.textContent='—';
    }
  }catch(e2){if(blueEl)blueEl.textContent='Sin conexión';if(oficialRangeEl)oficialRangeEl.textContent='Sin conexión';}
}
