// ══ FILE / PASTE ══
function handleDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function handleDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function handleDrop(e){e.preventDefault();e.currentTarget.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f)processFile(f);}
function handleFileSelect(e){const f=e.target.files[0];if(f)processFile(f);e.target.value='';}
function processFile(file){
  showToast('⏳ Procesando...','info');
  const reader=new FileReader();
  reader.onload=e=>{Papa.parse(e.target.result,{header:true,skipEmptyLines:true,delimiter:';',complete:r=>{const txns=parseSantander(r.data);if(!txns.length){showToast('⚠️ No se encontraron transacciones','error');return;}finishImport(txns,file.name,'csv');},error:()=>showToast('Error al parsear','error')});};
  reader.readAsText(file,'ISO-8859-1');
}
function processPasteText(){
  const text=document.getElementById('paste-input').value.trim();
  if(!text){showToast('⚠️ Pegá texto primero','error');return;}
  const{txns,issues,detectedPayMethod}=parsePasteTextWithReview(text);
  if(!txns.length&&!issues.length){showToast('⚠️ No se encontraron movimientos','error');return;}
  // Detect if this is a Gmail email (VISA or AMEX detected) → use correct origin
  window._pendingIsGmail=!!detectedPayMethod;
  window._detectedPayMethod=detectedPayMethod||null;
  window._pendingImportTxns=txns;
  window._pendingImportText=text;
  openImportReview(txns,issues);
}

function parsePasteTextWithReview(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l);
  const txns=[];
  const issues=[];
  const mmap={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
  let lastDate=null, latestDateSeen=null, i=0;

  // Auto-detect card type from Gmail email body (Santander)
  // Matches "Tarjeta Santander Visa Crédito terminada en 3177" or "American Express terminada en 7262"
  let detectedPayMethod = null;
  if (/tarjeta santander visa|terminada en 3177/i.test(text)) detectedPayMethod = 'visa';
  else if (/american express|amex|terminada en 7262/i.test(text)) detectedPayMethod = 'amex';

  // Helper: parse amount string "25.918,34" → 25918.34
  const parseAmt = s => parseFloat(s.replace(/[^\d.,]/g,'').replace(/\./g,'').replace(',','.')) || 0;

  // First pass: find the latest (most recent) date in the text — used for cuota date correction
  for(const l of lines){
    const dm=l.replace(/^\*+\s*/,'').match(/^(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?$/i);
    if(dm){const mon=mmap[dm[2].toLowerCase()];if(mon){const yr=dm[3]?parseInt(dm[3]):new Date().getFullYear();const d=new Date(yr,mon-1,parseInt(dm[1]));if(!latestDateSeen||d>latestDateSeen)latestDateSeen=d;}}
  }
  // If no dates in text, use today as reference
  if(!latestDateSeen) latestDateSeen=new Date();

  while(i<lines.length){
    const rawLine=lines[i];
    const line=rawLine.replace(/^\*+\s*/,'').trim();

    // ── Date line ──
    const dm=line.match(/^(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?$/i);
    if(dm){const mon=mmap[dm[2].toLowerCase()];const yr=dm[3]?parseInt(dm[3]):new Date().getFullYear();if(mon)lastDate=new Date(yr,mon-1,parseInt(dm[1]));i++;continue;}

    // ── Cuota line: "Cuota X de Y" — attach to previous txn ──
    const cuotaMatch=line.match(/^[Cc]uota\s+(\d+)\s+de\s+(\d+)$/i);
    if(cuotaMatch){
      const num=parseInt(cuotaMatch[1]),total=parseInt(cuotaMatch[2]);
      if(txns.length>0){
        const prev=txns[txns.length-1];
        prev.cuotaNum=num;
        prev.cuotaTotal=total;
        prev.description=prev._baseDesc+' (Cuota '+num+'/'+total+')';
        // Si la fecha del gasto es de un mes anterior al período del resumen,
        // corregirla: la cuota corresponde al período actual, no al inicio de la cuota.
        // Usamos la fecha más reciente vista en el texto como referencia del período.
        const monthsDiff=(latestDateSeen.getFullYear()-prev.date.getFullYear())*12+(latestDateSeen.getMonth()-prev.date.getMonth());
        if(monthsDiff>=1){
          // Mantener el día original pero mover al mes del período del resumen
          const origDay=prev.date.getDate();
          // Asegurar que el día sea válido en el mes destino
          const daysInTarget=new Date(latestDateSeen.getFullYear(),latestDateSeen.getMonth()+1,0).getDate();
          const safeDay=Math.min(origDay,daysInTarget);
          const corrected=new Date(latestDateSeen.getFullYear(),latestDateSeen.getMonth(),safeDay);
          prev._originalDate=new Date(prev.date); // guardamos fecha original ANTES de corregir
          prev.date=corrected;
          prev.week=getWeekKey(corrected);
          prev.month=getMonthKey(corrected);
          prev._dateCorrected=true;
        }
      }
      i++;continue;
    }

    // ── Skip pure amount/currency lines ──
    if(line==='$'||line==='U$S'||line==='USD'||/^[\d.,]+$/.test(line)||/^\$[\d.,]+$/.test(line)){i++;continue;}

    // ── Description line: look ahead for amount ──
    if(!line.startsWith('$')&&line.length>1){
      let j=i+1,amount=0,currency='ARS',found=false;
      while(j<lines.length&&j<i+6){
        const next=lines[j].trim();
        // Skip "Cuota X de Y" lines when looking ahead for amount (they come before the $)
        if(/^[Cc]uota\s+\d+\s+de\s+\d+$/i.test(next)){j++;continue;}
        if(next==='$'||next==='U$S'||next==='USD'){
          currency=(next==='U$S'||next==='USD')?'USD':'ARS';
          j++;
          if(j<lines.length){const a=parseAmt(lines[j]);if(a>0){i=j+1;found=true;amount=a;break;}}
        } else if(/^\$[\d.,]+/.test(next)){
          amount=parseAmt(next);currency='ARS';i=j+1;found=true;break;
        } else break;
        j++;
      }
      if(found&&amount>0){
        if(!lastDate){
          issues.push({type:'no_date',desc:line,amount,currency,resolved:false,id:'iss_'+Math.random().toString(36).substr(2,6)});
        } else {
          const id=Math.random().toString(36).substr(2,9);
          const cat=ruleBasedCategory(line);
          // Check if the NEXT line (after skipping blanks) is a cuota line
          // We peek ahead: if so, we'll handle cuota metadata in next iteration
          const _t={id,date:new Date(lastDate),description:line,_baseDesc:line,amount,currency,category:cat,week:getWeekKey(lastDate),month:getMonthKey(lastDate),_autocat:cat!=='Otros'};
          if(detectedPayMethod) _t.payMethod=detectedPayMethod;
          txns.push(_t);
        }
        continue;
      } else if(!found&&line.length>1&&lastDate){
        const rawNext=lines[i+1]?lines[i+1].trim():'';
        if(rawNext&&!/^[Cc]uota\s+\d+\s+de\s+\d+$/i.test(rawNext)){
          issues.push({type:'parse_error',desc:line,rawNext,lastDate:lastDate?new Date(lastDate):null,resolved:false,id:'iss_'+Math.random().toString(36).substr(2,6)});
        }
      }
    }
    i++;
  }
  return{txns,issues,detectedPayMethod};
}

// _pendingReviewIssues stores issues being resolved
window._pendingReviewIssues=[];

function openImportReview(txns,issues){
  window._pendingReviewIssues=issues.map(iss=>({...iss}));
  let catOpts='';
  CATEGORY_GROUPS.forEach(g=>{
    const subs=state.categories.filter(c=>c.group===g.group);
    if(subs.length){
      catOpts+='<optgroup label="'+g.emoji+' '+g.group+'">';
      subs.forEach(c=>{catOpts+='<option value="'+c.name+'">'+c.name+'</option>';});
      catOpts+='</optgroup>';
    }
  });
  const subEl=document.getElementById('review-sub');
  subEl.textContent=txns.length+' movimientos detectados'+(issues.length?' · '+issues.length+' requieren revisión':'');
  
  const bodyEl=document.getElementById('review-body');
  let html='';

  // Issues first (need resolution)
  if(issues.length){
    html+='<div style="font-size:11px;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:0.02em;margin-bottom:4px;">⚠️ Requieren revisión</div>';
    issues.forEach((iss,idx)=>{
      html+=`<div class="review-issue-row" id="iss-row-${iss.id}" style="background:rgba(240,96,96,0.08);border:1px solid rgba(240,96,96,0.25);border-radius:8px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px;">${iss.desc}</div>
            <div style="font-size:10px;color:var(--text3);font-family:var(--font);">${iss.type==='no_date'?'Sin fecha detectada':'Error al parsear · siguiente línea: '+iss.rawNext}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
            ${iss.type==='no_date'?`<input type="date" id="iss-date-${iss.id}" class="input-field" style="font-size:11px;padding:4px 8px;width:130px;">`:
            `<input type="number" id="iss-amount-${iss.id}" class="input-field" style="font-size:11px;padding:4px 8px;width:100px;" placeholder="Monto">
             <select id="iss-curr-${iss.id}" class="input-field" style="font-size:11px;padding:4px 6px;width:70px;"><option value="ARS">ARS</option><option value="USD">USD</option></select>`}
            <select id="iss-cat-${iss.id}" class="input-field" style="font-size:11px;padding:4px 6px;width:120px;">${catOpts}</select>
            <button class="btn btn-primary btn-sm" style="font-size:10px;padding:4px 8px;" onclick="resolveIssue('${iss.id}')">✓ Agregar</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="skipIssue('${iss.id}')">Ignorar</button>
          </div>
        </div>
      </div>`;
    });
  }

  // Normal txns preview
  if(txns.length){
    html+='<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.02em;margin:8px 0 4px;">✓ Movimientos detectados</div>';
    txns.forEach(t=>{
      const c=catColor(t.category);
      const dateStr=new Date(t.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--surface2);border-radius:6px;font-size:12px;">
        <span style="color:var(--text3);font-family:var(--font);flex-shrink:0;width:42px;">${dateStr}</span>
        <span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description}</span>
        <span style="background:${c}22;color:${c};border-radius:6px;padding:2px 7px;font-size:10px;flex-shrink:0;">${t.category}</span>
        <span style="font-family:var(--font);color:var(--accent);flex-shrink:0;">${t.currency==='USD'?'U$S ':'$'}${fmtN(t.amount)}</span>
      </div>`;
    });
  }
  
  bodyEl.innerHTML=html;
  document.getElementById('modal-import-review').classList.add('open');
}

function resolveIssue(issId){
  const iss=window._pendingReviewIssues.find(x=>x.id===issId);
  if(!iss)return;
  let date=iss.lastDate;
  let amount=iss.amount||0;
  let currency=iss.currency||'ARS';
  if(iss.type==='no_date'){
    const dv=document.getElementById('iss-date-'+issId).value;
    if(!dv){showToast('⚠️ Ingresá una fecha','error');return;}
    date=new Date(dv+'T12:00:00');
  } else {
    amount=parseFloat(document.getElementById('iss-amount-'+issId).value)||0;
    currency=document.getElementById('iss-curr-'+issId).value;
    if(!amount){showToast('⚠️ Ingresá el monto','error');return;}
  }
  const cat=document.getElementById('iss-cat-'+issId).value;
  const id=Math.random().toString(36).substr(2,9);
  const _rTxn={id,date:new Date(date),description:iss.desc,amount,currency,category:cat,week:getWeekKey(date),month:getMonthKey(date)};
  // Propagate payMethod from Gmail detection context
  if(window._pendingIsGmail && window._detectedPayMethod) _rTxn.payMethod=window._detectedPayMethod;
  window._pendingImportTxns.push(_rTxn);
  iss.resolved=true;
  const row=document.getElementById('iss-row-'+issId);
  if(row){row.style.opacity='0.4';row.style.pointerEvents='none';row.querySelector('[onclick^="resolveIssue"]').textContent='✓ Agregado';}
}

function skipIssue(issId){
  const iss=window._pendingReviewIssues.find(x=>x.id===issId);
  if(iss)iss.resolved=true;
  const row=document.getElementById('iss-row-'+issId);
  if(row){row.style.opacity='0.3';row.style.pointerEvents='none';}
}

function confirmImportReview(){
  const txns=window._pendingImportTxns||[];
  if(!txns.length){showToast('⚠️ No hay movimientos para importar','error');return;}
  document.getElementById('paste-input').value='';
  closeModal('modal-import-review');
  // Use 'importado_desde_gmail' when the text came from a Gmail email (VISA/AMEX detected)
  const origenFinal=window._pendingIsGmail?'importado_desde_gmail':'importado_desde_resumen';
  finishImport(txns,'Texto pegado',origenFinal);
  window._pendingImportTxns=[];
  window._pendingIsGmail=false;
}

function cancelImportReview(){
  closeModal('modal-import-review');
  window._pendingImportTxns=[];
}
function autoCreateGmailCuotas(txns){
  // For each imported Gmail cuota transaction, generate projected installment transactions
  const cuotaTxns=txns.filter(t=>t.cuotaGroupId&&t.cuotaTotal>=2&&!t.isPendingCuota);
  if(!cuotaTxns.length) return;
  const toAdd=[];
  for(const t of cuotaTxns){
    // Eliminar cualquier cuota proyectada para la misma posición (este pago real la reemplaza)
    state.transactions=state.transactions.filter(x=>
      !(x.isPendingCuota&&x.cuotaGroupId===t.cuotaGroupId&&x.cuotaNum===t.cuotaNum)
    );
    // Generar proyecciones para las cuotas restantes (a partir de la siguiente)
    for(let n=t.cuotaNum+1;n<=t.cuotaTotal;n++){
      const projId='proj_'+t.cuotaGroupId+'_c'+n;
      // Saltar si ya existe una proyección para esta posición (cualquier formato de ID)
      const alreadyExists=state.transactions.some(x=>x.isPendingCuota&&x.cuotaGroupId===t.cuotaGroupId&&x.cuotaNum===n)
        ||toAdd.some(x=>x.cuotaGroupId===t.cuotaGroupId&&x.cuotaNum===n);
      if(alreadyExists) continue;
      const origDate=t.date instanceof Date?t.date:new Date(t.date);
      // Fecha = fecha de este pago + (n - cuotaNum) meses
      const projDate=new Date(origDate.getFullYear(),origDate.getMonth()+(n-t.cuotaNum),origDate.getDate());
      // Ajustar día si el mes destino tiene menos días
      const maxDay=new Date(projDate.getFullYear(),projDate.getMonth()+1,0).getDate();
      if(projDate.getDate()>maxDay) projDate.setDate(maxDay);
      const base=t._baseDesc||(t.description.replace(/\s*\(Cuota\s*\d+\/\d+\)\s*$/i,'').replace(/\s*\d{2}:\d{2}\s*$/,'').trim());
      toAdd.push({
        id:projId,
        gmailId:null,
        date:projDate,
        description:base+' (Cuota '+n+'/'+t.cuotaTotal+')',
        _baseDesc:base,
        amount:t.amount,
        currency:t.currency,
        category:t.category||'Procesando...',
        week:getWeekKey(projDate),
        month:getMonthKey(projDate),
        source:'gmail',
        cuotaNum:n,
        cuotaTotal:t.cuotaTotal,
        cuotaGroupId:t.cuotaGroupId,
        isPendingCuota:true,
        origen_del_movimiento:'importado_desde_gmail',
        comercio_detectado:t.comercio_detectado||null,
        cat_sugerida:t.cat_sugerida||null,
        cat_motivo:'Cuota proyectada automáticamente',
        cat_source:'cuota',
        estado_revision:'detectado_automaticamente',
        payMethod:t.payMethod||null
      });
    }
  }
  if(toAdd.length) state.transactions=[...state.transactions,...toAdd];
}

function finishImport(txns,source,origen){
  const origenVal = origen || (source==='gmail'?'importado_desde_gmail': source==='paste'?'pegado_manualmente':'importado_desde_resumen');
  const isGmail = origenVal === 'importado_desde_gmail';
  txns.forEach(t=>{
    // Gmail imports: skip auto-categorization, leave for manual review
    if(!isGmail && (t.category==='Procesando...' || !t.category)) t.category=ruleBasedCategory(t.description);
    enrichTransaction(t, origenVal);
    // Gmail imports stay as pending
    if(isGmail) t.estado_revision='pendiente_de_revision';
  });
  const before=state.transactions.length;
  const existingIds=new Set(state.transactions.map(t=>t.id));
  state.transactions=[...state.transactions,...txns];
  deduplicateTransactions();
  // Auto-generate projected installment transactions for Gmail cuota purchases
  if(isGmail) autoCreateGmailCuotas(txns);
  const added=state.transactions.length-before;
  const duplicates=txns.length-added;
  const pi=detectPeriod(txns);
  const imp={id:Date.now().toString(36),label:pi.label,weekKey:pi.weekKey,monthKey:pi.monthKey,date:new Date().toLocaleDateString('es-AR'),count:added,source,txnIds:txns.map(t=>t.id)};
  state.imports.unshift(imp);
  if(pi.monthKey) state.dashMonth=pi.monthKey;
  saveState();
  const dupMsg=duplicates>0?' · '+duplicates+' duplicadas':'' ;
  showToast('✓ '+added+' nuevas'+dupMsg+' — '+pi.label,'success');
  afterDataLoad();
  // Gmail imports: don't auto-categorize, just render
  if(isGmail){
    saveState();renderDashboard();renderTransactions();updateQrBadge();
  } else {
    Promise.resolve(categorizeWithAI()).then(()=>{saveState();renderDashboard();renderTransactions();});
  }
}
function detectPeriod(txns){
  if(!txns.length)return{label:'Sin fecha',weekKey:'',monthKey:''};
  const dates=txns.map(t=>new Date(t.date)).filter(d=>!isNaN(d));
  const minD=new Date(Math.min(...dates)),maxD=new Date(Math.max(...dates));
  const weekKey=getWeekKey(minD);
  const monthKey=maxD.getFullYear()+'-'+String(maxD.getMonth()+1).padStart(2,'0');
  const months=[...new Set(dates.map(d=>d.getFullYear()+'-'+d.getMonth()))];
  const label=months.length===1?minD.toLocaleDateString('es-AR',{month:'long',year:'numeric'}):minD.toLocaleDateString('es-AR',{day:'numeric',month:'short'})+' – '+maxD.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'});
  return{label,weekKey,monthKey};
}

// ══ PARSERS ══
function parseSantander(rows){
  const txns=[];let lastDate=null;
  for(const row of rows){
    const keys=Object.keys(row);
    const fk=keys.find(k=>/^fecha$/i.test(k.trim()));const dk=keys.find(k=>/^descripci/i.test(k.trim()));
    const ak=keys.find(k=>/pesos/i.test(k.trim()));const uk=keys.find(k=>/d.lar/i.test(k.trim()));
    const vals=Object.values(row).map(v=>String(v||'').trim());
    const dateRaw=fk!==undefined?row[fk]:vals[0];const desc=fk!==undefined?(dk?row[dk]:vals[1]):vals[1];
    const arsRaw=fk!==undefined?(ak?row[ak]:vals[4]):vals[4];const usdRaw=fk!==undefined?(uk?row[uk]:vals[5]):vals[5];
    const pd=parseDate(dateRaw);if(pd&&!isNaN(pd))lastDate=pd;
    if(!lastDate||!desc)continue;
    const ds=String(desc).trim();
    if(/^descripci|^fecha$|^tarjeta|^últimos|^consumido|^tenés|^pago de|^fecha de/i.test(ds))continue;
    if(/^su pago|^anulac/i.test(ds))continue;if(ds.length<2)continue;
    const pA=s=>{if(!s)return 0;const c=String(s).replace(/\$/g,'').replace(/\s/g,'').trim();return Math.abs(parseFloat(c.replace(/\./g,'').replace(',','.'))||0);};
    const pU=s=>{if(!s)return 0;const c=String(s).replace(/U\$S/gi,'').replace(/\$/g,'').replace(/\s/g,'').trim();const n=parseFloat(c.replace(/\./g,'').replace(',','.'));return isNaN(n)?0:Math.abs(n);};
    const ars=pA(arsRaw),usd=pU(usdRaw);if(ars<=0&&usd<=0)continue;
    const currency=usd>0&&ars===0?'USD':'ARS';const amount=currency==='USD'?usd:ars;
    const id=Math.random().toString(36).substr(2,9);
    // detect installment info from description (e.g. "FRAVEGA CTA 3/12")
    const cuotaMatch=ds.match(/(\d+)\/(\d+)\s*$/)||ds.match(/cuota\s+(\d+)\s+de\s+(\d+)/i);
    const cuotaNum=cuotaMatch?parseInt(cuotaMatch[1]):null;const cuotaTotal=cuotaMatch?parseInt(cuotaMatch[2]):null;
    txns.push({id,date:new Date(lastDate),description:ds,amount,currency,category:'Procesando...',week:getWeekKey(lastDate),month:getMonthKey(lastDate),cuotaNum,cuotaTotal});
  }
  return txns;
}
function parsePasteText(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l);
  const txns=[];
  const mmap={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
  let lastDate=null,i=0;
  while(i<lines.length){
    const line=lines[i].replace(/^\*+\s*/,'').trim();
    const dm=line.match(/^(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?$/i);
    if(dm){const mon=mmap[dm[2].toLowerCase()];const yr=dm[3]?parseInt(dm[3]):new Date().getFullYear();if(mon)lastDate=new Date(yr,mon-1,parseInt(dm[1]));i++;continue;}
    if(!line.startsWith('$')&&!/^\d[\d.,]+$/.test(line)&&line.length>1){
      let j=i+1,amount=0,currency='ARS';
      while(j<lines.length&&j<i+5){
        const next=lines[j].trim();
        if(next==='$'||next==='U$S'||next==='USD'){currency=(next==='U$S'||next==='USD')?'USD':'ARS';j++;if(j<lines.length){const a=lines[j].replace(/[^\d.,]/g,'').replace(/\./g,'').replace(',','.');amount=parseFloat(a)||0;if(amount>0){i=j+1;break;}}}
        else if(/^\$[\d.,]+/.test(next)){amount=parseFloat(next.replace(/[^\d.,]/g,'').replace(/\./g,'').replace(',','.'))||0;currency='ARS';i=j+1;break;}
        else break;j++;
      }
      if(amount>0&&lastDate){const id=Math.random().toString(36).substr(2,9);txns.push({id,date:new Date(lastDate),description:line.replace(/^\*+\s*/,'').trim(),amount,currency,category:'Procesando...',week:getWeekKey(lastDate),month:getMonthKey(lastDate)});continue;}
    }
    i++;
  }
  return txns;
}
// ══ REGLAS DE CATEGORIZACIÓN V2 ══
// Reglas base del sistema (siempre activas, prioridad 0)
const BASE_RULES = [
  // Transporte
  {keyword:'uber',category:'Uber'},{keyword:'cabify',category:'Uber'},
  {keyword:'taxi',category:'Uber'},{keyword:'peaje',category:'Estacionamiento'},
  {keyword:'nafta',category:'Combustible'},{keyword:'ypf',category:'Combustible'},
  {keyword:'shell',category:'Combustible'},{keyword:'axion',category:'Combustible'},
  {keyword:'subte',category:'Transporte público'},{keyword:'sube',category:'Transporte público'},
  {keyword:'tren ',category:'Transporte público'},{keyword:'colectivo',category:'Transporte público'},
  {keyword:'estacionamiento',category:'Estacionamiento'},{keyword:'parking',category:'Estacionamiento'},
  {keyword:'mecanico',category:'Mantenimiento auto'},{keyword:'taller',category:'Mantenimiento auto'},
  // Alimentación
  {keyword:'mcdonalds',category:'Restaurantes'},{keyword:'burger',category:'Restaurantes'},
  {keyword:'pizza',category:'Restaurantes'},{keyword:'sushi',category:'Restaurantes'},
  {keyword:'resto',category:'Restaurantes'},{keyword:'starbucks',category:'Restaurantes'},
  {keyword:'kfc',category:'Restaurantes'},{keyword:'propina',category:'Restaurantes'},
  {keyword:'rappi',category:'Delivery'},{keyword:'pedidosya',category:'Delivery'},
  {keyword:'pedido ya',category:'Delivery'},{keyword:'dlo*pedidos',category:'Delivery'},
  {keyword:'delivery',category:'Delivery'},
  {keyword:'disco',category:'Supermercado'},{keyword:'carrefour',category:'Supermercado'},
  {keyword:'coto',category:'Supermercado'},{keyword:'jumbo',category:'Supermercado'},
  {keyword:'walmart',category:'Supermercado'},{keyword:'supermercado',category:'Supermercado'},
  {keyword:'almacen',category:'Supermercado'},{keyword:'panaderia',category:'Supermercado'},
  {keyword:'mercadopago',category:'Transferencias'},
  {keyword:'kiosco',category:'Kiosco'},{keyword:'maxikiosco',category:'Kiosco'},
  // Vida Social
  {keyword:'boliche',category:'Fiesta'},{keyword:'disco ',category:'Fiesta'},
  {keyword:'entradas',category:'Eventos'},{keyword:'teatro',category:'Eventos'},
  {keyword:'cine',category:'Eventos'},{keyword:'recital',category:'Eventos'},
  {keyword:'steam',category:'Juegos'},{keyword:'playstation',category:'Juegos'},
  {keyword:'xbox',category:'Juegos'},
  // Plataformas / streaming
  {keyword:'netflix',category:'Plataformas'},{keyword:'spotify',category:'Plataformas'},
  {keyword:'amazon prime',category:'Plataformas'},{keyword:'hbo',category:'Plataformas'},
  {keyword:'disney',category:'Plataformas'},{keyword:'youtube premium',category:'Plataformas'},
  {keyword:'crunchyroll',category:'Plataformas'},{keyword:'star+',category:'Plataformas'},
  // Salud
  {keyword:'pharmacity',category:'Farmacia'},{keyword:'farmacia',category:'Farmacia'},
  {keyword:'doctor',category:'Consultas médicas'},{keyword:'medico',category:'Consultas médicas'},
  {keyword:'clinica',category:'Consultas médicas'},{keyword:'hospital',category:'Consultas médicas'},
  {keyword:'consulta',category:'Consultas médicas'},
  // Bienestar
  {keyword:'megatlon',category:'Gimnasio'},{keyword:'gym',category:'Gimnasio'},
  {keyword:'sportclub',category:'Gimnasio'},{keyword:'gimnasio',category:'Gimnasio'},
  {keyword:'terapia',category:'Terapia'},{keyword:'psicologo',category:'Terapia'},
  // Consumo Personal
  {keyword:'zara',category:'Ropa'},{keyword:'adidas',category:'Ropa'},
  {keyword:'nike',category:'Ropa'},{keyword:'rapsodia',category:'Ropa'},
  // Tecnología
  {keyword:'fravega',category:'Dispositivos'},{keyword:'musimundo',category:'Dispositivos'},
  {keyword:'garbarino',category:'Dispositivos'},{keyword:'apple',category:'Dispositivos'},
  {keyword:'chatgpt',category:'Suscripciones tech'},{keyword:'openai',category:'Suscripciones tech'},
  {keyword:'github',category:'Suscripciones tech'},{keyword:'claude',category:'Suscripciones tech'},
  {keyword:'icloud',category:'Suscripciones tech'},
  // Viajes
  {keyword:'flybondi',category:'Vuelos'},{keyword:'aerolin',category:'Vuelos'},
  {keyword:'jetsmart',category:'Vuelos'},{keyword:'latam',category:'Vuelos'},
  {keyword:'hotel',category:'Alojamiento'},{keyword:'airbnb',category:'Alojamiento'},
  {keyword:'booking',category:'Alojamiento'},{keyword:'despegar',category:'Vuelos'},
  // Servicios & Hogar
  {keyword:'luz',category:'Expensas'},{keyword:'internet',category:'Internet'},
  {keyword:'claro',category:'Telefonía'},{keyword:'personal',category:'Telefonía'},
  {keyword:'movistar',category:'Telefonía'},{keyword:'expensas',category:'Expensas'},
  {keyword:'alquiler',category:'Alquiler'},{keyword:'seguro',category:'Expensas'},
  {keyword:'edenor',category:'Expensas'},{keyword:'metrogas',category:'Expensas'},
  {keyword:'aysa',category:'Expensas'},{keyword:'abl',category:'Expensas'},
  // Educación
  {keyword:'curso',category:'Cursos'},{keyword:'colegio',category:'Universidad'},
  {keyword:'udemy',category:'Cursos'},{keyword:'universidad',category:'Universidad'},
  {keyword:'platzi',category:'Cursos'},{keyword:'coursera',category:'Cursos'},
  // Finanzas
  {keyword:'transferencia',category:'Transferencias'},{keyword:'comision',category:'Comisiones bancarias'},
  {keyword:'mantenimiento cuenta',category:'Comisiones bancarias'},
];

// Detectar comercio normalizado desde descripción
function detectComercio(desc){
  const d = String(desc||'').toLowerCase();
  // Intentar extraer nombre limpio: quitar prefijos tipo "MERPAGO*", "POS*"
  const clean = d.replace(/^(merpago\*|mp\*|pos\*|compra\s+|pago\s+|pagos?\s+|debin\s+)/i,'').trim();
  // Reglas de normalización conocidas
  const knownMap = [
    {patterns:['ypf','merpago*ypf','shell ypf'],name:'YPF'},
    {patterns:['pedidosya','pedido ya','dlo*pedidosya','dlo*pedidos','pedidos ya'],name:'PedidosYa'},
    {patterns:['pharmacity'],name:'Pharmacity'},
    {patterns:['flybondi'],name:'Flybondi'},
    {patterns:['uber'],name:'Uber'},
    {patterns:['cabify'],name:'Cabify'},
    {patterns:['rappi'],name:'Rappi'},
    {patterns:['netflix'],name:'Netflix'},
    {patterns:['spotify'],name:'Spotify'},
    {patterns:['mercadopago','merpago'],name:'MercadoPago'},
    {patterns:['carrefour'],name:'Carrefour'},
    {patterns:['coto'],name:'Coto'},
    {patterns:['disco'],name:'Disco'},
    {patterns:['starbucks'],name:'Starbucks'},
    {patterns:['mcdonalds','mc donalds','mc donald'],name:'McDonald\'s'},
    {patterns:['farmacia'],name:'Farmacia'},
    {patterns:['airbnb'],name:'Airbnb'},
    {patterns:['booking'],name:'Booking'},
    {patterns:['despegar'],name:'Despegar'},
    {patterns:['amazon'],name:'Amazon'},
    {patterns:['fravega'],name:'Fravega'},
    {patterns:['garbarino'],name:'Garbarino'},
    {patterns:['claro'],name:'Claro'},
    {patterns:['personal'],name:'Personal'},
    {patterns:['movistar'],name:'Movistar'},
    {patterns:['jumbo'],name:'Jumbo'},
    {patterns:['shell'],name:'Shell'},
    {patterns:['axion'],name:'Axion'},
  ];
  for(const entry of knownMap){
    if(entry.patterns.some(p=>d.includes(p))) return entry.name;
  }
  // Capitalizar primer token limpio como fallback
  const tokens = clean.split(/[\s\*\-\/]+/).filter(Boolean);
  if(tokens.length) return tokens[0].charAt(0).toUpperCase()+tokens[0].slice(1);
  return null;
}

// Motor de sugerencia: devuelve {category, reason, source}
function suggestCategory(desc){
  const d = String(desc||'').toLowerCase();
  const comercio = detectComercio(desc);
  const comercioNorm = comercio ? comercio.toLowerCase() : null;

  // 1. Historial personal del usuario (mayor peso)
  if(comercioNorm && state.catHistory[comercioNorm]){
    const hist = state.catHistory[comercioNorm];
    const best = Object.entries(hist).sort((a,b)=>b[1]-a[1])[0];
    if(best && best[1]>=2){
      return {category:best[0], reason:'Confirmado '+best[1]+'x por vos para '+comercio, source:'historial'};
    }
  }

  // 2. Reglas de usuario (state.catRules, las más recientes tienen más prioridad)
  const userRules = (state.catRules||[]).filter(r=>r.active!==false);
  // ordenar por prioridad desc
  const sorted = [...userRules].sort((a,b)=>(b.priority||0)-(a.priority||0));
  for(const rule of sorted){
    if(d.includes(rule.keyword.toLowerCase())){
      return {category:rule.category, reason:'Regla: "'+rule.keyword+'" → '+rule.category, source:'regla_usuario'};
    }
  }

  // 3. Reglas base del sistema
  for(const rule of BASE_RULES){
    if(d.includes(rule.keyword)){
      return {category:rule.category, reason:'Regla automática por "'+rule.keyword+'"', source:'regla_base'};
    }
  }

  return {category:'Otros', reason:'Sin coincidencias', source:'default'};
}

// Función legacy compatible
function ruleBasedCategory(desc){
  return suggestCategory(desc).category;
}

// Enriquecer transacción con campos nuevos si no los tiene
function enrichTransaction(t, origen){
  // Gmail-sourced transactions: detect via source field OR payMethod (visa/amex = came from Gmail email)
  const _isGmailSource=t.source==='gmail'||t.payMethod==='visa'||t.payMethod==='amex';
  const _VALID_ORIGINS=['importado_desde_gmail','importado_desde_resumen','pegado_manualmente'];
  if(!t.origen_del_movimiento || !_VALID_ORIGINS.includes(t.origen_del_movimiento)){
    // Set for new txns OR migrate invalid values ('paste', etc.)
    t.origen_del_movimiento=_isGmailSource?'importado_desde_gmail':(origen&&_VALID_ORIGINS.includes(origen)?origen:'importado_desde_resumen');
  } else if(_isGmailSource && t.origen_del_movimiento!=='importado_desde_gmail'){
    // Retroactively fix already-stored Gmail transactions with wrong origin
    t.origen_del_movimiento='importado_desde_gmail';
  }
  if(!t.comercio_detectado) t.comercio_detectado = detectComercio(t.description)||null;
  if(!t.cat_sugerida || !t.cat_motivo){
    const sug = suggestCategory(t.description);
    t.cat_sugerida = sug.category;
    t.cat_motivo = sug.reason;
    t.cat_source = sug.source;
  }
  // Estado: si ya estaba confirmado, no degradar
  if(!t.estado_revision){
    if(t.category && t.category!=='Procesando...' && t.category!=='Otros'){
      t.estado_revision = 'detectado_automaticamente';
    } else {
      t.estado_revision = 'pendiente_de_revision';
    }
  }
  return t;
}

// Aprender de confirmación manual
function learnFromConfirmation(t, catName){
  if(!t.comercio_detectado) return;
  const key = t.comercio_detectado.toLowerCase();
  if(!state.catHistory[key]) state.catHistory[key]={};
  state.catHistory[key][catName]=(state.catHistory[key][catName]||0)+1;
}

// Aplicar sugerencias masivas (sin sobreescribir confirmados)
function applySuggestions(){
  let count=0;
  state.transactions.forEach(t=>{
    if(t.estado_revision==='confirmado_por_usuario') return;
    enrichTransaction(t);
    if(t.category==='Procesando...'||!t.category){
      t.category = t.cat_sugerida||'Otros';
      count++;
    }
  });
  return count;
}



function deduplicateTransactions(){
  // Step 1: Remove standalone "Cuota X de Y" entries — these are parser artifacts from old imports
  state.transactions=state.transactions.filter(t=>{
    const desc=String(t.description||'').trim();
    return !/^[Cc]uota\s+\d+\s+de\s+\d+$/.test(desc);
  });
  // Step 2: Standard dedup — same date + same normalized description + same amount + same currency
  const seen=new Set();
  state.transactions=state.transactions.filter(t=>{
    const d=t.date instanceof Date?t.date.toISOString().split('T')[0]:String(t.date).split('T')[0];
    const rawDesc=String(t.description||'').toLowerCase().trim().replace(/\s+/g,' ');
    const descNorm=rawDesc
      .replace(/\s*\d{2}:\d{2}\s*/g,'')            // strip HH:MM timestamps
      .replace(/\s*\(cuota\s*\d+\/\d+\)\s*$/i,'')  // strip (Cuota X/Y) suffix
      .trim();
    
    // Si la transacción proviene de Gmail, usamos su ID único provisto por Google
    // para garantizar que correos distintos no se fusionen, incluso si son del mismo monto, fecha y comercio.
    const suffix = t.gmailId ? '-gmail-'+t.gmailId : '';
    
    // Si es un gasto exportado del PDF de la TC, también tiene un identificador de origen que podríamos aislar, 
    // pero por ahora el ID seguro que se pierde en la deduplicación es el de Gmail.
    // También conservamos transacciones manuales creadas desde "cc-compare" si tuvieran un marker,
    // pero gmailId cubre el problema reportado.
    
    const k=d+'-'+descNorm+'-'+t.amount+'-'+t.currency+suffix;
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
}

// ── Find duplicates in current transactions for the UI button ──
function findDuplicateGroups(){
  // Group by amount + currency + date (day) — same amount on same day
  const byAmt={};
  state.transactions.forEach(t=>{
    const d=t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10);
    const k=String(t.amount)+'|'+t.currency+'|'+d;
    if(!byAmt[k])byAmt[k]=[];
    byAmt[k].push(t);
  });
  // Return groups with 2+ entries, sorted newest first within each group
  return Object.values(byAmt)
    .filter(g=>g.length>1)
    .map(g=>g.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)))
    .sort((a,b)=>b.length-a.length); // most dupes first
}

// ── Duplicate modal ──
// openDuplicateModal and confirmDeleteDupes replaced by showDuplicatesModal

// ══ AI CATEGORIZATION ══
async function categorizeWithAI(){
  const unc=state.transactions.filter(t=>t.category==='Procesando...');
  if(!unc.length)return Promise.resolve();
  const key=getApiKey();
  if(!key){unc.forEach(t=>{t.category=ruleBasedCategory(t.description);});return Promise.resolve();}
  const chunks=[];for(let i=0;i<unc.length;i+=40)chunks.push(unc.slice(i,i+40));
  for(const chunk of chunks){
    try{
      const items=chunk.map(t=>t.id+'|||'+t.description).join('\n');
      const prompt='Categoriza gastos en subcategorías. SOLO JSON sin backticks.\nSubcategorías disponibles: '+catNames().join(', ')+'\nFormato: {"id":"Subcategoria",...}\nUsá la subcategoría más específica posible.\n'+items;
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
      const d=await r.json();
      const map=JSON.parse((d.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());
      chunk.forEach(t=>{if(map[t.id])t.category=map[t.id];});
    }catch(e){chunk.forEach(t=>{t.category=ruleBasedCategory(t.description);});}
  }
}
async function autoCategorizeAll(){
  if(!state.transactions.length){showToast('Sin movimientos','error');return;}
  const btn=document.getElementById('btn-autocat');const statusEl=document.getElementById('autocat-status');
  const msgEl=document.getElementById('autocat-msg');const progEl=document.getElementById('autocat-progress');
  const apiKey=getApiKey();const total=state.transactions.length;
  btn.disabled=true;btn.style.opacity='0.5';statusEl.style.display='flex';
  if(apiKey){
    msgEl.textContent='Categorizando con IA...';
    const chunks=[];for(let i=0;i<state.transactions.length;i+=40)chunks.push(state.transactions.slice(i,i+40));
    let done=0;
    for(const chunk of chunks){
      try{const items=chunk.map(t=>t.id+'|||'+t.description).join('\n');const prompt='Categoriza gastos en subcategorías. SOLO JSON sin backticks.\nSubcategorías: '+catNames().join(', ')+'\nFormato: {"id":"Subcategoria",...}\nUsá la más específica.\n'+items;const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});const d=await r.json();const map=JSON.parse((d.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());chunk.forEach(t=>{if(map[t.id])t.category=map[t.id];});}catch(e){chunk.forEach(t=>{t.category=ruleBasedCategory(t.description);});}
      done+=chunk.length;progEl.textContent=done+'/'+total;
    }
    msgEl.textContent='Completado con IA';
  }else{
    msgEl.textContent='Reglas...';state.transactions.forEach((t,i)=>{t.category=ruleBasedCategory(t.description);if(i%20===0)progEl.textContent=(i+1)+'/'+total;});
    progEl.textContent=total+'/'+total;msgEl.textContent='Completado';
  }
  saveState();refreshAll();showToast(total+' movimientos categorizados','success');
  setTimeout(()=>{statusEl.style.display='none';btn.disabled=false;btn.style.opacity='1';progEl.textContent='';},2500);
}

// ══ AFTER IMPORT ══
function afterDataLoad(){
  // Update month selector in dashboard to reflect current dashMonth
  const sel=document.getElementById('dash-month-select');
  if(sel){
    // Rebuild options from available months
    const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort().reverse();
    const MNAMES=['Enero','Feb','Marzo','Abril','Mayo','Junio','Julio','Agosto','Sep','Oct','Nov','Dic'];
    sel.innerHTML='<option value="">Mes actual</option>'+months.map(m=>{
      const[y,mo]=m.split('-');
      return'<option value="'+m+'" '+(m===state.dashMonth?'selected':'')+'>'+MNAMES[+mo-1]+' '+y+'</option>';
    }).join('');
  }
  migrateCategories();renderDashboard();renderTransactions();renderImportHistory();
  if(state.transactions.length>1)renderTendencia();
  document.getElementById('dash-empty').style.display='none';
  document.getElementById('dash-content').style.display='flex';
  // CC alerts
  if(typeof checkCreditCardAlerts==='function') checkCreditCardAlerts();
}

