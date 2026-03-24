// ══ INSIGHTS ENGINE ══
// Análisis financiero local — sin IA, instantáneo, 100% basado en datos reales

// ── Entry point ──────────────────────────────────────────
function generateInsights() {
  const txns = (state.transactions||[]).filter(t => !t.isPendingCuota);
  const emptyEl   = document.getElementById('insights-empty');
  const contentEl = document.getElementById('insights-content');
  if(!txns.length) {
    if(emptyEl)  emptyEl.style.display = 'flex';
    if(contentEl) contentEl.style.display = 'none';
    return;
  }
  if(emptyEl)  emptyEl.style.display = 'none';
  if(contentEl) contentEl.style.display = 'flex';

  const data = _computeInsightsData();
  _renderScoreCard(data);
  _renderInsightsChart(data);
  _renderAllInsightSections(data);
  showToast('✓ Insights actualizados','success');
}

// Legacy stub kept for any old callers
function setInsightTab(tab) { generateInsights(); }

// ── Data computation ──────────────────────────────────────
function _computeInsightsData() {
  const today  = new Date();
  const txns   = (state.transactions||[]).filter(t => !t.isPendingCuota);
  const MNAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const currentMonth = getMonthKey(today);
  const prevMonth    = getMonthKey(new Date(today.getFullYear(), today.getMonth()-1, 1));

  const monthTxns = txns.filter(t => (t.month||getMonthKey(t.date)) === currentMonth);
  const prevTxns  = txns.filter(t => (t.month||getMonthKey(t.date)) === prevMonth);

  const arsThis = monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const arsPrev = prevTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdThis = monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);

  // Category totals
  const catThis={}, catPrev={};
  monthTxns.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{ catThis[t.category]=(catThis[t.category]||0)+t.amount; });
  prevTxns.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{  catPrev[t.category]=(catPrev[t.category]||0)+t.amount;  });
  const topCats    = Object.entries(catThis).sort((a,b)=>b[1]-a[1]);
  const growingCats = Object.entries(catThis)
    .filter(([c,v])=>catPrev[c]>0)
    .map(([c,v])=>({cat:c,current:v,prev:catPrev[c],pctChange:Math.round((v-catPrev[c])/catPrev[c]*100)}))
    .sort((a,b)=>b.pctChange-a.pctChange);

  // Day-of-week spending
  const dayTotals=[0,0,0,0,0,0,0];
  const dayNames=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  monthTxns.filter(t=>t.currency==='ARS').forEach(t=>{ dayTotals[new Date(t.date).getDay()]+=t.amount; });
  const maxDayAmt=Math.max(...dayTotals);
  const topDay=maxDayAmt>0?dayTotals.indexOf(maxDayAmt):-1;

  // Income — ARS + USD converted, from incomeSources or legacy income object
  const incomeARS = (state.incomeSources||[]).length
    ? (state.incomeSources||[]).reduce((s,src)=>{
        if(src.active===false) return s;
        const monthly = src.freq==='annual' ? (src.amount/12) : src.amount;
        return s + (src.currency==='USD' ? monthly*(USD_TO_ARS||1500) : monthly);
      }, 0)
    : ((state.income?.ars||0) + (state.income?.usd||0)*(USD_TO_ARS||1500));

  const spendPct=incomeARS>0?Math.round(arsThis/incomeARS*100):null;

  // Days
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const daysPassed=today.getDate();
  const daysLeft=daysInMonth-daysPassed;
  const dayAvg=daysPassed>0?arsThis/daysPassed:0;
  const projectedMonth=Math.round(dayAvg*daysInMonth);
  const daysWithSpending=new Set(monthTxns.map(t=>new Date(t.date).getDate())).size;
  const daysWithout=daysPassed-daysWithSpending;
  const momChange=arsPrev>0?Math.round((arsThis-arsPrev)/arsPrev*100):null;

  // Cuotas
  const cuotasTxns=monthTxns.filter(t=>t.cuotaNum);
  const cuotasTotal=cuotasTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const cuotasPct=incomeARS>0?Math.round(cuotasTotal/incomeARS*100):null;

  // Fixed expenses
  const fixedTotal=(state.fixedExpenses||[]).reduce((s,f)=>s+(f.currency==='USD'?f.amount*(USD_TO_ARS||1500):f.amount),0);
  const fixedPct=incomeARS>0?Math.round(fixedTotal/incomeARS*100):null;

  // Subscriptions
  const subsTotal=(state.subscriptions||[]).reduce((s,sub)=>{
    if(sub.active===false)return s;
    const monthly=sub.freq==='annual'?sub.amount/12:sub.amount;
    return s+(sub.currency==='USD'?monthly*(USD_TO_ARS||1500):monthly);
  },0);

  // Upcoming cuota payments
  const upcomingPayments=[];
  try {
    const autoGroups=detectAutoCuotas?detectAutoCuotas():[];
    autoGroups.forEach(g=>{
      const cfg=(state.autoCuotaConfig||{})[g.key]||{};
      if(!cfg.day)return;
      const actualT=g.transactions.filter(t=>!t.isPendingCuota);
      const maxPaid=actualT.sort((a,b)=>b.cuotaNum-a.cuotaNum)[0]?.cuotaNum||1;
      const total=cfg.total||g.transactions[0]?.cuotaTotal||maxPaid;
      if(maxPaid<total) upcomingPayments.push({name:g.name,daysUntil:getDaysUntilNext(cfg.day),amount:g.amount});
    });
    (state.cuotas||[]).forEach(c=>{
      if(c.day&&c.paid<c.total) upcomingPayments.push({name:c.name,daysUntil:getDaysUntilNext(c.day),amount:c.amount});
    });
    upcomingPayments.sort((a,b)=>a.daysUntil-b.daysUntil);
  } catch(e){}

  // Historical monthly
  const allMonths=[...new Set(txns.map(t=>t.month||getMonthKey(t.date)))].sort();
  const monthlyData=allMonths.map(m=>({
    month:m,
    label:MNAMES[parseInt(m.split('-')[1])-1]+' '+m.split('-')[0].slice(2),
    total:txns.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS').reduce((s,t)=>s+t.amount,0)
  }));
  const avgMonthly=monthlyData.length>0?monthlyData.reduce((s,m)=>s+m.total,0)/monthlyData.length:0;

  // Largest txn this month
  const largestTxn=monthTxns.filter(t=>t.currency==='ARS').sort((a,b)=>b.amount-a.amount)[0]||null;

  // USD exposure
  const usdInARS=usdThis*(USD_TO_ARS||1500);
  const totalInARS=arsThis+usdInARS;
  const usdExposurePct=totalInARS>0?Math.round(usdInARS/totalInARS*100):0;

  // Pending cuotas next month
  const nextMonthKey=getMonthKey(new Date(today.getFullYear(),today.getMonth()+1,1));
  const nextMonthCuotas=(state.transactions||[]).filter(t=>t.isPendingCuota&&t.currency==='ARS'&&(t.month||getMonthKey(t.date))===nextMonthKey);
  const nextCuotasTotal=nextMonthCuotas.reduce((s,t)=>s+t.amount,0);

  return {
    today,MNAMES,currentMonth,prevMonth,
    monthTxns:monthTxns.length,prevTxnsCount:prevTxns.length,
    arsThis,arsPrev,usdThis,usdInARS,usdExposurePct,
    topCats,catThis,catPrev,growingCats,
    dayTotals,dayNames,topDay,maxDayAmt,
    incomeARS,spendPct,
    daysInMonth,daysPassed,daysLeft,
    dayAvg,projectedMonth,
    daysWithSpending,daysWithout,
    momChange,
    cuotasTotal,cuotasPct,cuotasTxns:cuotasTxns.length,
    fixedTotal,fixedPct,
    subsTotal,
    upcomingPayments,
    avgMonthly,monthlyData,
    largestTxn,
    nextCuotasTotal,nextMonthCuotas:nextMonthCuotas.length
  };
}

// ── Monthly Evolution Chart ───────────────────────────────
function _renderInsightsChart(data) {
  const ctx = document.getElementById('ins-chart');
  const subEl = document.getElementById('ins-chart-sub');
  if(!ctx) return;

  if(window._insChart) { try{window._insChart.destroy();}catch(e){} }

  const months = data.monthlyData.slice(-12); // last 12 months
  if(months.length < 2) { ctx.parentElement.style.display='none'; return; }
  ctx.parentElement.style.display='block';

  const labels = months.map(m=>m.label);
  const values = months.map(m=>m.total);
  const avg    = data.avgMonthly;
  const isL    = typeof _isL==='function'?_isL():false;

  // Color bars: red if above avg, green if below
  const barColors = values.map(v=>v>avg*1.1?'rgba(255,59,48,0.75)':v<avg*0.9?'rgba(52,199,89,0.75)':'rgba(0,122,255,0.65)');

  if(subEl) subEl.textContent = `Últimos ${months.length} meses · Promedio $${fmtN(Math.round(avg))}/mes`;

  window._insChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Gasto ARS', data:values, backgroundColor:barColors, borderRadius:5, borderSkipped:false, order:2},
        {label:'Promedio', data:values.map(()=>avg), type:'line', borderColor:'rgba(160,154,148,0.5)', borderWidth:1.5,
         borderDash:[5,4], pointRadius:0, fill:false, tension:0, order:1}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,
          callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(Math.round(c.parsed.y))}}
      },
      scales:{
        x:{ticks:{color:isL?'#86868b':'#7a7470',font:{size:10}}, grid:{display:false}},
        y:{ticks:{color:isL?'#86868b':'#7a7470',font:{size:10},callback:v=>'$'+fmtN(v)},
           grid:{color:isL?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}}
      }
    }
  });
}

// ── Health score ──────────────────────────────────────────
function _getHealthScore(data) {
  let score=100;
  const factors=[];

  if(data.spendPct!==null){
    const pts=data.spendPct<=70?40:data.spendPct<=85?28:data.spendPct<=100?14:0;
    score-=(40-pts);
    factors.push({label:'Presupuesto',value:data.spendPct+'%',pct:Math.max(0,100-Math.max(0,data.spendPct-60)*2),color:data.spendPct<=75?'var(--accent2)':data.spendPct<=95?'var(--accent3)':'var(--danger)'});
  } else {
    factors.push({label:'Presupuesto',value:'Sin ingreso',pct:50,color:'var(--text3)'});
  }
  if(data.momChange!==null){
    const pts=data.momChange<=-5?25:data.momChange<=5?20:data.momChange<=20?10:0;
    score-=(25-pts);
    factors.push({label:'Tendencia',value:(data.momChange>0?'+':'')+data.momChange+'%',pct:data.momChange<=0?100:Math.max(0,100-data.momChange*4),color:data.momChange<=0?'var(--accent2)':data.momChange<=15?'var(--accent3)':'var(--danger)'});
  }
  if(data.cuotasPct!==null){
    const pts=data.cuotasPct<=15?20:data.cuotasPct<=30?12:0;
    score-=(20-pts);
    factors.push({label:'Cuotas',value:data.cuotasPct+'% ingreso',pct:Math.max(0,100-data.cuotasPct*2.5),color:data.cuotasPct<=15?'var(--accent2)':data.cuotasPct<=30?'var(--accent3)':'var(--danger)'});
  }
  if(data.fixedPct!==null){
    const pts=data.fixedPct<=40?15:data.fixedPct<=60?8:0;
    score-=(15-pts);
    factors.push({label:'Gastos fijos',value:data.fixedPct+'% ingreso',pct:Math.max(0,100-data.fixedPct),color:data.fixedPct<=40?'var(--accent2)':data.fixedPct<=60?'var(--accent3)':'var(--danger)'});
  }

  score=Math.max(10,Math.min(100,Math.round(score)));
  let label,desc,scoreColor;
  if(score>=80){label='Excelente 🟢';desc='Tus finanzas están muy bien encaminadas. Seguí así.';scoreColor='#34c759';}
  else if(score>=65){label='Bien 🟡';desc='Hay algunas áreas a mejorar, pero vas bien en general.';scoreColor='#ff9500';}
  else if(score>=50){label='Regular 🟠';desc='Prestá atención a los puntos débiles para mejorar.';scoreColor='#ff6b00';}
  else{label='Crítica 🔴';desc='Revisá y ajustá tus hábitos financieros con urgencia.';scoreColor='#ff3b30';}

  return{score,factors,label,desc,scoreColor};
}

// ── Score card render ─────────────────────────────────────
function _renderScoreCard(data) {
  const{score,factors,label,desc,scoreColor}=_getHealthScore(data);
  const circumference=2*Math.PI*40;
  const offset=circumference-(score/100)*circumference;
  const arc=document.getElementById('score-arc');
  if(arc){arc.style.strokeDashoffset=circumference;arc.style.stroke=scoreColor;setTimeout(()=>{arc.style.strokeDashoffset=offset;},100);}
  const numEl=document.getElementById('score-number');
  if(numEl){numEl.textContent=score;numEl.setAttribute('fill',scoreColor);}
  const labelEl=document.getElementById('score-label');
  if(labelEl)labelEl.textContent=label;
  const descEl=document.getElementById('score-desc');
  if(descEl)descEl.textContent=desc;
  const factorsEl=document.getElementById('score-factors');
  if(factorsEl){
    factorsEl.innerHTML=factors.map(f=>`
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text3);">${f.label}</span>
          <span style="font-size:11px;font-weight:700;color:${f.color};">${f.value}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(f.pct)}%;background:${f.color};border-radius:2px;transition:width 0.9s ease;"></div>
        </div>
      </div>`).join('');
  }
  const subEl=document.getElementById('insights-subtitle');
  if(subEl)subEl.textContent='Salud financiera: '+label+' · '+new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
}

// ── Render ALL sections expanded ──────────────────────────
function _renderAllInsightSections(data) {
  const grid = document.getElementById('insights-grid');
  if(!grid) return;

  const SECTIONS = [
    { key:'general',  emoji:'📊', title:'General',        desc:'Resumen del mes en curso' },
    { key:'ahorro',   emoji:'💰', title:'Ahorro',          desc:'Proyección y oportunidades de ahorro' },
    { key:'cuidado',  emoji:'🛡', title:'Cuidá tu plata',  desc:'Cuotas, fijos y compromisos' },
    { key:'economia', emoji:'📈', title:'Economía',        desc:'Contexto macro y tendencias' },
  ];

  grid.innerHTML = SECTIONS.map(sec => {
    const cards = _buildCards(data, sec.key);
    const cardsHtml = cards.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;">${cards.map(c=>_cardHTML(c)).join('')}</div>`
      : `<div style="color:var(--text3);font-size:13px;padding:20px 0;">No hay suficientes datos para este análisis todavía.</div>`;
    return `
      <div class="ins-section-block">
        <div class="ins-section-hdr">
          <span class="ins-section-ico">${sec.emoji}</span>
          <div>
            <div class="ins-section-ttl">${sec.title}</div>
            <div class="ins-section-dsc">${sec.desc}</div>
          </div>
        </div>
        ${cardsHtml}
      </div>`;
  }).join('');
}

// ── Build cards per section ───────────────────────────────
function _buildCards(data,tab) {
  const fmtM=n=>'$'+fmtN(Math.round(n));
  const MNAMES=data.MNAMES;
  const mesActual=MNAMES[data.today.getMonth()];
  const cards=[];

  /* ─── GENERAL ─── */
  if(tab==='general'){
    if(data.arsThis>0){
      const mom=data.momChange!==null
        ?(data.momChange>0?`<strong style="color:var(--danger)">+${data.momChange}%</strong> vs el mes pasado`:`<strong style="color:var(--accent2)">${data.momChange}%</strong> vs el mes pasado`)
        :'Primer mes con datos.';
      cards.push({type:data.momChange>15?'warn':'info',emoji:'📊',tag:'GASTO MENSUAL',
        headline:`Gastaste ${fmtM(data.arsThis)} en ${mesActual}`,
        body:`${mom} · ${data.monthTxns} movimientos registrados.`});
    }
    if(data.topCats.length>0){
      const[tc,ta]=data.topCats[0];
      const pct=data.arsThis>0?Math.round(ta/data.arsThis*100):0;
      cards.push({type:'info',emoji:'🏆',tag:'CATEGORÍA TOP',
        headline:`${tc} es tu mayor gasto este mes`,
        body:`Representa el <strong>${pct}%</strong> del total (${fmtM(ta)}). ${pct>40?'Proporción alta — analizá si hay margen para reducirlo.':'Dentro de rangos normales.'}`,
        barPct:pct,barColor:typeof catColor==='function'?catColor(tc):'var(--accent)'});
    }
    if(data.dayAvg>0){
      cards.push({type:'info',emoji:'📅',tag:'RITMO DIARIO',
        headline:`Gastás ${fmtM(data.dayAvg)} por día en promedio`,
        body:`Llevás ${data.daysPassed} días del mes · <strong>${data.daysWithSpending} días con gastos</strong> y <strong>${data.daysWithout} sin gastar</strong>. ${data.daysWithout>6?'¡Bien! Buenos hábitos de cero-gasto.':''}`});
    }
    if(data.topDay>=0&&data.maxDayAmt>0){
      cards.push({type:'info',emoji:'📆',tag:'DÍA MÁS ACTIVO',
        headline:`Los ${data.dayNames[data.topDay]} son tu día más caro`,
        body:`${fmtM(data.dayTotals[data.topDay])} gastados en total los ${data.dayNames[data.topDay]} este mes.`,
        bars:data.dayTotals.map((v,i)=>({label:data.dayNames[i],value:v,active:i===data.topDay})),
        maxBar:data.maxDayAmt});
    }
    if(data.usdThis>0){
      cards.push({type:data.usdExposurePct>30?'warn':'info',emoji:'💵',tag:'GASTOS EN USD',
        headline:`U$D ${fmtN(data.usdThis)} en gastos dolarizados`,
        body:`Equivalen a <strong>${fmtM(data.usdInARS)}</strong> al tipo ${fmtM(USD_TO_ARS||1500)}/USD. ${data.usdExposurePct>30?`${data.usdExposurePct}% de tu gasto total — alta exposición cambiaria.`:'Exposición moderada.'}`});
    }
    cards.push({type:'info',emoji:'🔢',tag:'ACTIVIDAD',
      headline:`${data.monthTxns} movimientos en ${mesActual}`,
      body:`Promedio de <strong>${data.daysPassed>0?(data.monthTxns/data.daysPassed).toFixed(1):0} transacciones por día</strong>. ${data.monthTxns>60?'Alta actividad — revisá que todo esté categorizado.':'Actividad normal.'}`});
  }

  /* ─── AHORRO ─── */
  if(tab==='ahorro'){
    if(data.projectedMonth>0){
      const vsI=data.incomeARS>0
        ?(data.projectedMonth>data.incomeARS?`⚠️ <strong style="color:var(--danger)">Supera tu ingreso</strong> de ${fmtM(data.incomeARS)}`:`Margen restante: <strong style="color:var(--accent2)">${fmtM(data.incomeARS-data.projectedMonth)}</strong>`)
        :'';
      cards.push({type:data.incomeARS>0&&data.projectedMonth>data.incomeARS?'alert':'info',emoji:'🔮',tag:'PROYECCIÓN AL CIERRE',
        headline:`Cerrarás ${mesActual} en ~${fmtM(data.projectedMonth)}`,
        body:`Ritmo: ${fmtM(data.dayAvg)}/día × ${data.daysInMonth} días. ${vsI}`,
        metric:data.projectedMonth,metricLabel:'proyectado'});
    }
    if(data.growingCats.length>0&&data.growingCats[0].pctChange>15){
      const top=data.growingCats[0];
      cards.push({type:'warn',emoji:'📈',tag:'OPORTUNIDAD DE AHORRO',
        headline:`${top.cat} subió +${top.pctChange}% vs el mes pasado`,
        body:`De <strong>${fmtM(top.prev)}</strong> a <strong>${fmtM(top.current)}</strong>. Si volvés al nivel anterior ahorrarías <strong>${fmtM(top.current-top.prev)}</strong> este mes.`,
        barPct:Math.min(100,top.pctChange),barColor:'var(--danger)'});
    }
    if(data.daysWithout>0){
      cards.push({type:'good',emoji:'🌱',tag:'DÍAS SIN GASTAR',
        headline:`${data.daysWithout} día${data.daysWithout!==1?'s':''} sin gastos este mes`,
        body:`${data.daysWithout>=8?'¡Excelente! Estás construyendo hábitos sólidos.':'Intentá llegar a 8+ días para un impacto real en tu ahorro.'}`,
        metric:data.daysWithout,metricLabel:'días "cero-gasto"'});
    }
    if(data.momChange!==null){
      cards.push({type:data.momChange>10?'warn':data.momChange<-5?'good':'info',
        emoji:data.momChange<0?'📉':'📈',tag:'VARIACIÓN MES A MES',
        headline:`Gastaste ${data.momChange>0?'+':''}${data.momChange}% ${data.momChange>=0?'más':'menos'} que el mes pasado`,
        body:`Este mes: <strong>${fmtM(data.arsThis)}</strong> · Anterior: <strong>${fmtM(data.arsPrev)}</strong>. ${data.momChange>15?'El aumento es significativo.':data.momChange<-5?'¡Muy bien! Vas en la dirección correcta.':'Gasto estable.'}`});
    }
    if(data.subsTotal>0){
      cards.push({type:'info',emoji:'📱',tag:'SUSCRIPCIONES',
        headline:`Pagás ${fmtM(data.subsTotal)}/mes en suscripciones`,
        body:`Revisá regularmente si usás todos tus servicios.${data.incomeARS>0?` Representan el ${Math.round(data.subsTotal/data.incomeARS*100)}% de tu ingreso.`:''} Cada suscripción sin uso es dinero que podés ahorrar.`});
    }
    if(data.largestTxn){
      cards.push({type:'info',emoji:'🧾',tag:'MAYOR GASTO',
        headline:`Tu gasto más grande: ${fmtM(data.largestTxn.amount)}`,
        body:`<strong>${esc(data.largestTxn.description)}</strong> — ${new Date(data.largestTxn.date).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}. Los gastos grandes impactan mucho en el total.`});
    }
  }

  /* ─── CUIDÁ TU PLATA ─── */
  if(tab==='cuidado'){
    if(data.cuotasTotal>0){
      const burdenType=data.cuotasPct===null?'info':data.cuotasPct>35?'alert':data.cuotasPct>20?'warn':'good';
      cards.push({type:burdenType,emoji:'💳',tag:'PESO DE CUOTAS',
        headline:`Cuotas: ${fmtM(data.cuotasTotal)} este mes (${data.cuotasTxns} pagos)`,
        body:data.cuotasPct!==null
          ?`Representan el <strong>${data.cuotasPct}% de tu ingreso</strong>. ${data.cuotasPct>35?'🚨 Nivel alto — no sumes más cuotas por ahora.':data.cuotasPct>20?'Nivel moderado — mantené el control.':'✅ Dentro de límites saludables (menos del 20%).'}`
          :'Configurá tu ingreso para ver el peso relativo de las cuotas.',
        barPct:data.cuotasPct!==null?Math.min(100,data.cuotasPct*2.5):null,
        barColor:data.cuotasPct>35?'var(--danger)':data.cuotasPct>20?'var(--accent3)':'var(--accent2)'});
    }
    if(data.upcomingPayments.length>0){
      const next=data.upcomingPayments[0];
      cards.push({type:next.daysUntil<=3?'alert':'info',emoji:'⏰',tag:'PRÓXIMOS VENCIMIENTOS',
        headline:`"${esc(next.name)}" vence en ${next.daysUntil} día${next.daysUntil!==1?'s':''}`,
        body:`<strong>Próximos pagos:</strong><br>${data.upcomingPayments.slice(0,3).map(p=>`${esc(p.name)} en <strong>${p.daysUntil}d</strong> — ${fmtM(p.amount)}`).join('<br>')}`});
    }
    if(data.fixedTotal>0){
      const fp=data.fixedPct;
      cards.push({type:fp!==null&&fp>60?'warn':'info',emoji:'🏠',tag:'GASTOS FIJOS',
        headline:`Tus gastos fijos suman ${fmtM(data.fixedTotal)}/mes`,
        body:fp!==null
          ?`Representan el <strong>${fp}%</strong> de tu ingreso. ${fp>60?'Nivel elevado — analizá si podés reducir alguno.':fp>40?'Nivel moderado — rango aceptable.':'✅ Bien manejados.'}`
          :'Configurá tu ingreso para ver el impacto real de tus gastos fijos.',
        barPct:fp!==null?Math.min(100,fp):null,barColor:fp>60?'var(--danger)':fp>40?'var(--accent3)':'var(--accent2)'});
    }
    if(data.usdExposurePct>30){
      cards.push({type:'warn',emoji:'⚠️',tag:'EXPOSICIÓN CAMBIARIA',
        headline:`El ${data.usdExposurePct}% de tus gastos son en USD`,
        body:`Con el tipo de cambio a <strong>${fmtM(USD_TO_ARS||1500)}/USD</strong>, una devaluación te impacta directo. Considerá renegociar servicios en pesos donde sea posible.`});
    }
    if(data.topCats.length>0){
      const[tc,ta]=data.topCats[0];
      const pct=data.arsThis>0?Math.round(ta/data.arsThis*100):0;
      if(pct>45){
        cards.push({type:'warn',emoji:'⚡',tag:'CONCENTRACIÓN DE GASTO',
          headline:`El ${pct}% de tu gasto está en una sola categoría`,
          body:`<strong>${esc(tc)}</strong> domina tu presupuesto este mes. Alta concentración reduce tu flexibilidad ante imprevistos.`,
          barPct:pct,barColor:'var(--accent3)'});
      }
    }
    if(!data.cuotasTotal&&!data.upcomingPayments.length&&!data.fixedTotal){
      cards.push({type:'good',emoji:'✅',tag:'TODO EN ORDEN',
        headline:'No detectamos compromisos financieros pendientes',
        body:'No tenés cuotas, gastos fijos ni vencimientos configurados. Si los tenés, agregálos en la sección Compromisos para un análisis completo.'});
    }
  }

  /* ─── ECONOMÍA ─── */
  if(tab==='economia'){
    if(data.spendPct!==null){
      const remaining=data.incomeARS-data.arsThis;
      cards.push({type:data.spendPct>100?'alert':data.spendPct>85?'warn':'good',
        emoji:data.spendPct>100?'🚨':data.spendPct>85?'⚠️':'✅',tag:'RATIO INGRESO/GASTO',
        headline:`Usaste el ${data.spendPct}% de tu ingreso este mes`,
        body:remaining>=0
          ?`Te quedan <strong style="color:var(--accent2)">${fmtM(remaining)}</strong> de ${fmtM(data.incomeARS)} de ingreso. ${data.spendPct<=70?'¡Excelente margen! Destiná algo al ahorro.':''}`
          :`Superaste tu ingreso por <strong style="color:var(--danger)">${fmtM(Math.abs(remaining))}</strong>. Revisá de dónde salió la diferencia.`,
        barPct:Math.min(100,data.spendPct),barColor:data.spendPct>100?'var(--danger)':data.spendPct>85?'var(--accent3)':'var(--accent2)'});
    }
    if(data.monthlyData.length>=2){
      const delta=data.arsThis>0&&data.avgMonthly>0?Math.round((data.arsThis-data.avgMonthly)/data.avgMonthly*100):null;
      cards.push({type:delta!==null&&delta>20?'warn':'info',emoji:'📊',tag:'VS PROMEDIO HISTÓRICO',
        headline:`Tu promedio histórico es ${fmtM(data.avgMonthly)}/mes`,
        body:delta!==null
          ?`Este mes estás <strong>${delta>0?'+':''}${delta}%</strong> respecto a tu promedio de ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''}. ${delta>20?'Revisá qué generó el desvío.':delta<-10?'¡Por debajo del promedio — muy bien!':'Dentro del promedio normal.'}`
          :`Basado en ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''} de datos.`});
    }
    const sigGrowing=data.growingCats.filter(c=>c.pctChange>20).slice(0,3);
    if(sigGrowing.length>0){
      cards.push({type:'warn',emoji:'📈',tag:'CATEGORÍAS EN ALZA',
        headline:`${sigGrowing.length} categoría${sigGrowing.length!==1?'s':''} con tendencia creciente`,
        body:sigGrowing.map(c=>`<strong>${esc(c.cat)}</strong>: +${c.pctChange}% (${fmtM(c.current-c.prev)} más que el mes pasado)`).join('<br>')});
    }
    if(data.nextCuotasTotal>0){
      cards.push({type:'info',emoji:'🔮',tag:'CUOTAS PRÓXIMO MES',
        headline:`El mes que viene tenés ${fmtM(data.nextCuotasTotal)} en cuotas`,
        body:`${data.nextMonthCuotas} cuota${data.nextMonthCuotas!==1?'s':''} proyectadas para ${MNAMES[data.today.getMonth()+1]||'el próximo mes'}. Compromiso fijo — planificalo en tu presupuesto.`,
        metric:data.nextCuotasTotal,metricLabel:'comprometido'});
    }
    if(data.monthlyData.length<3){
      cards.push({type:'info',emoji:'💡',tag:'TIP',
        headline:'Con más datos, el análisis mejora',
        body:`Tenés ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''} de datos. Importá al menos 3-4 meses para ver tendencias y proyecciones más confiables.`});
    }
    if(!data.spendPct&&!data.monthlyData.length){
      cards.push({type:'info',emoji:'🎯',tag:'PRIMEROS PASOS',
        headline:'Configurá tu perfil financiero',
        body:'Agregá tu ingreso mensual en la sección Ingresos e importá movimientos de al menos 2 meses para desbloquear el análisis económico completo.'});
    }
  }

  return cards;
}

// ── Card HTML builder ─────────────────────────────────────
function _cardHTML(c) {
  const TYPES={
    good: {color:'var(--accent2)', bg:'rgba(52,199,89,0.07)',  border:'rgba(52,199,89,0.2)'},
    info: {color:'var(--accent)',  bg:'var(--surface)',        border:'var(--border)'},
    warn: {color:'var(--accent3)', bg:'rgba(255,149,0,0.07)', border:'rgba(255,149,0,0.2)'},
    alert:{color:'var(--danger)',  bg:'rgba(255,59,48,0.07)', border:'rgba(255,59,48,0.2)'},
  };
  const cfg=TYPES[c.type]||TYPES.info;
  let extra='';
  if(c.barPct!=null){
    extra+=`<div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:12px;">
      <div style="height:100%;width:${Math.round(c.barPct)}%;background:${c.barColor||cfg.color};border-radius:3px;transition:width 0.9s ease;"></div>
    </div>`;
  }
  if(c.metric!=null){
    extra+=`<div style="margin-top:12px;display:flex;align-items:baseline;gap:6px;">
      <span style="font-size:20px;font-weight:700;font-family:var(--font);color:${cfg.color};">$${fmtN(Math.round(c.metric))}</span>
      <span style="font-size:11px;color:var(--text3);">${c.metricLabel||''}</span>
    </div>`;
  }
  if(c.bars){
    const mx=c.maxBar||Math.max(...c.bars.map(b=>b.value))||1;
    extra+=`<div style="display:flex;gap:4px;align-items:flex-end;height:40px;margin-top:12px;">
      ${c.bars.map(b=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:100%;background:${b.active?cfg.color:'var(--border)'};border-radius:3px 3px 0 0;height:${mx>0?Math.round(b.value/mx*30):0}px;transition:height 0.6s ease;min-height:${b.value>0?2:0}px;"></div>
        <span style="font-size:8px;color:${b.active?cfg.color:'var(--text3)'};font-weight:${b.active?'700':'400'};">${b.label}</span>
      </div>`).join('')}
    </div>`;
  }
  return `<div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px rgba(0,0,0,.18)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
    <div style="width:100%;height:3px;background:${cfg.color};"></div>
    <div style="padding:16px 18px 18px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:22px;line-height:1;">${c.emoji}</span>
        <span style="font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${cfg.color};background:${cfg.color}18;border:1px solid ${cfg.color}30;padding:2px 8px;border-radius:20px;">${c.tag}</span>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.35;margin-bottom:7px;">${c.headline}</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6;">${c.body}</div>
      ${extra}
    </div>
  </div>`;
}
