// ══ FILE / PASTE ══
function handleFileSelect(e){const f=e.target.files[0];if(f)processFile(f);e.target.value='';}

function ensureImportConfig(){
  if(!state.importConfig || typeof state.importConfig !== 'object') state.importConfig = {};
  state.importConfig = {
    bankProfileId: state.importConfig.bankProfileId || '',
    parserMode: state.importConfig.parserMode || 'santander_auto',
    ...state.importConfig
  };
  return state.importConfig;
}

function getImportProfileOptions(){
  const config = ensureImportConfig();
  const bankProfiles = Array.isArray(state.bankProfiles) ? state.bankProfiles : [];
  return {
    config,
    bankProfiles,
    selectedProfile: bankProfiles.find(profile => profile.id === config.bankProfileId) || null
  };
}

function renderImportConfigPanel(){
  const shell = document.getElementById('import-config-shell');
  if(!shell) return;
  const { config, bankProfiles, selectedProfile } = getImportProfileOptions();
  const parserLabel = {
    santander_auto: 'Santander / tarjetas conocidas',
    generic_text: 'Genérico por texto',
    generic_csv: 'Genérico por archivo'
  };
  shell.innerHTML = `
    <div class="input-group">
      <label class="input-label">Perfil bancario activo</label>
      <select id="import-bank-profile-select" class="input-field" onchange="setImportBankProfile(this.value)">
        <option value="">Sin perfil específico</option>
        ${bankProfiles.map(profile => `<option value="${profile.id}" ${config.bankProfileId===profile.id?'selected':''}>${profile.name}</option>`).join('')}
      </select>
    </div>
    <div class="input-group">
      <label class="input-label">Modo de lectura</label>
      <select id="import-parser-mode-select" class="input-field" onchange="setImportParserMode(this.value)">
        <option value="santander_auto" ${config.parserMode==='santander_auto'?'selected':''}>Santander / tarjetas conocidas</option>
        <option value="generic_text" ${config.parserMode==='generic_text'?'selected':''}>Texto genérico</option>
        <option value="generic_csv" ${config.parserMode==='generic_csv'?'selected':''}>CSV genérico</option>
      </select>
    </div>
    <div class="input-group" style="grid-column:1/-1;">
      <div class="settings-inline-note">
        ${selectedProfile
          ? `Perfil activo: <strong>${selectedProfile.name}</strong> · ${selectedProfile.bank || 'Banco'} · ${selectedProfile.card || 'Tarjeta'} · método preferido ${selectedProfile.methodLabel || 'manual'}.`
          : `Elegí un perfil bancario si querés dejar la importación orientada a una tarjeta o banco concreto. Si no, podés usar un modo genérico.`}
        <br>Lectura actual: <strong>${parserLabel[config.parserMode] || 'Automática'}</strong>.
      </div>
    </div>
  `;
}

function setImportBankProfile(profileId){
  ensureImportConfig();
  state.importConfig.bankProfileId = profileId || '';
  const profile = (state.bankProfiles || []).find(item => item.id === profileId);
  if(profile){
    if(profile.method === 'gmail') state.importConfig.parserMode = 'santander_auto';
    else if(profile.method === 'csv') state.importConfig.parserMode = 'generic_csv';
    else if(profile.method === 'paste') state.importConfig.parserMode = 'generic_text';
  }
  if(typeof syncActiveUserProfileFromState === 'function') syncActiveUserProfileFromState(false);
  saveState();
  renderImportConfigPanel();
}

function setImportParserMode(mode){
  ensureImportConfig();
  state.importConfig.parserMode = mode || 'santander_auto';
  if(typeof syncActiveUserProfileFromState === 'function') syncActiveUserProfileFromState(false);
  saveState();
  renderImportConfigPanel();
}

function parseAmountLoose(value){
  return parseFloat(String(value || '').replace(/[^\d.,-]/g,'').replace(/\./g,'').replace(',','.')) || 0;
}

function parseGenericCSV(rows){
  const txns = [];
  for(const row of rows){
    const values = Object.values(row || {}).map(value => String(value || '').trim()).filter(Boolean);
    if(!values.length) continue;
    const keys = Object.keys(row || {});
    const findKey = pattern => keys.find(key => pattern.test(String(key).trim()));
    const dateRaw = findKey(/fecha|date/i) ? row[findKey(/fecha|date/i)] : values[0];
    const descRaw = findKey(/descrip|detalle|concept|movim|comercio/i) ? row[findKey(/descrip|detalle|concept|movim|comercio/i)] : values[1];
    const amountKey = findKey(/monto|importe|amount|pesos|debito|consumo/i);
    const currencyKey = findKey(/moneda|currency|divisa/i);
    const date = parseDate(dateRaw);
    const description = String(descRaw || '').trim();
    const currencyGuess = String(currencyKey ? row[currencyKey] : '').toUpperCase();
    let amount = amountKey ? parseAmountLoose(row[amountKey]) : 0;
    if(!amount && values.length >= 3) amount = parseAmountLoose(values[values.length-1]);
    const currency = currencyGuess.includes('USD') || currencyGuess.includes('U$S') ? 'USD' : 'ARS';
    if(!date || !description || !amount) continue;
    const id = Math.random().toString(36).substr(2,9);
    txns.push({
      id,
      date:new Date(date),
      description,
      amount:Math.abs(amount),
      currency,
      category:'Procesando...',
      week:getWeekKey(date),
      month:getMonthKey(date)
    });
  }
  return txns;
}

function parseGenericTextWithReview(text){
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const txns = [];
  const issues = [];
  let currentDate = null;

  const dateOnlyRegex = /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)$/;
  const inlineRegex = /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+(-?[$UuSsD\d][\d\s.,-]*)$/;

  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(dateOnlyRegex.test(line)){
      currentDate = parseDate(line);
      continue;
    }

    const inlineMatch = line.match(inlineRegex);
    if(inlineMatch){
      const date = parseDate(inlineMatch[1]);
      const description = inlineMatch[2].trim();
      const amount = Math.abs(parseAmountLoose(inlineMatch[3]));
      const currency = /U\$S|USD/i.test(inlineMatch[3]) ? 'USD' : 'ARS';
      if(date && description && amount){
        const id = Math.random().toString(36).substr(2,9);
        txns.push({id,date:new Date(date),description,amount,currency,category:'Procesando...',week:getWeekKey(date),month:getMonthKey(date)});
        continue;
      }
    }

    if(currentDate && i+1 < lines.length){
      const next = lines[i+1];
      if(/^[$UuSsD\d][\d\s.,-]*$/.test(next)){
        const amount = Math.abs(parseAmountLoose(next));
        if(amount){
          const currency = /U\$S|USD/i.test(next) ? 'USD' : 'ARS';
          const id = Math.random().toString(36).substr(2,9);
          txns.push({id,date:new Date(currentDate),description:line,amount,currency,category:'Procesando...',week:getWeekKey(currentDate),month:getMonthKey(currentDate)});
          i += 1;
          continue;
        }
      }
    }

    if(line.length > 4){
      issues.push({
        type:'parse_error',
        desc:line,
        rawNext:lines[i+1] || '',
        lastDate:currentDate ? new Date(currentDate) : null,
        resolved:false,
        id:'iss_'+Math.random().toString(36).substr(2,6)
      });
    }
  }
  return { txns, issues, detectedPayMethod:null };
}

function processFile(file){
  showToast('⏳ Procesando...','info');
  const reader=new FileReader();
  reader.onload=e=>{
    const config = ensureImportConfig();
    const papaOptions = {header:true,skipEmptyLines:true,complete:r=>{
      const txns = config.parserMode === 'generic_csv' ? parseGenericCSV(r.data) : parseSantander(r.data);
      if(!txns.length){showToast('⚠️ No se encontraron transacciones','error');return;}
      finishImport(txns,file.name,'csv');
    },error:()=>showToast('Error al parsear','error')};
    if(config.parserMode !== 'generic_csv') papaOptions.delimiter=';';
    Papa.parse(e.target.result,papaOptions);
  };
  reader.readAsText(file,'ISO-8859-1');
}
function processPasteText(){
  const text=document.getElementById('paste-input').value.trim();
  if(!text){showToast('⚠️ Pegá texto primero','error');return;}
  const config = ensureImportConfig();
  const parser = config.parserMode === 'generic_text' ? parseGenericTextWithReview : parsePasteTextWithReview;
  const{txns,issues,detectedPayMethod}=parser(text);
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
        // Generate stable cuotaGroupId so auto-projection of remaining cuotas works
        // (same logic as Gmail import in init.js line 1540) — based on comercio + per-cuota amount + total.
        // All cuotas of the same plan share the same groupId regardless of import source.
        if(!prev.cuotaGroupId){
          const _slug = String(prev._baseDesc||prev.description||'').toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,15);
          prev.cuotaGroupId = 'cg_' + _slug + '_' + (Number(prev.amount)||0) + '_' + total;
        }
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
  subEl.textContent=txns.length+' movimientos detectados'+(issues.length?' · '+issues.length+' requieren corrección antes de importar':' · listos para confirmar');
  
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
// Movimientos con cuota pero sin cuotaGroupId (p. ej. CSV o pegado): les asigno el mismo
// id estable que usan los otros parsers (comercio + monto por cuota + total), así todas
// las cuotas del mismo plan caen en el mismo grupo de state.cuotas.
function assignCuotaGroupIds(txns){
  (txns||[]).forEach(t=>{
    if(t.cuotaGroupId || !(Number(t.cuotaTotal)>=2) || t.isPendingCuota) return;
    const _base=String(t._baseDesc||t.description||'').replace(/\s*\(?(?:Cuota\s+\d+\s+de\s+\d+|\d+\/\d+)\)?\s*$/i,'').trim();
    const _slug=_base.toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,15);
    t.cuotaGroupId='cg_'+_slug+'_'+(Number(t.amount)||0)+'_'+t.cuotaTotal;
  });
}

// ── Comercios que el usuario nunca quiere importar ──
// Mercado Libre genera cuotas que se re-importan en cada sync de Gmail y que el
// usuario siempre termina borrando (no tiene compras reales de Mercado Libre).
// Normalizamos la descripción y buscamos "mercadolib": agarra "Mercado Libre",
// "MERCADOLIBRE*123", "MERPAGO*MERCADOLIBRE...", etc., pero NO "Mercado Pago"
// /"mercadopago" (que sí se usa para transferencias legítimas).
function importMerchantNorm(t){
  return String(t && (t._baseDesc || t.description || t.comercio || t.name || ''))
    .toLowerCase().replace(/[^a-z0-9]/g,'');
}
function isExcludedImportMerchant(t){
  return importMerchantNorm(t).includes('mercadolib');
}
// Barre consumos y cuotas de esos comercios que hayan quedado de imports previos,
// así "no aparece nunca más" (no solo en la próxima importación).
function purgeExcludedMerchants(){
  let removed=0;
  if(Array.isArray(state.transactions)){
    const before=state.transactions.length;
    state.transactions=state.transactions.filter(t=>!isExcludedImportMerchant(t));
    removed+=before-state.transactions.length;
  }
  if(Array.isArray(state.cuotas)){
    state.cuotas=state.cuotas.filter(c=>!String(c&&(c.name||c.comercio||'')).toLowerCase().replace(/[^a-z0-9]/g,'').includes('mercadolib'));
  }
  if(removed) console.info('[import] Comercios excluidos purgados — transacciones:',removed);
  return removed;
}

// ══ CUOTAS EN IMPORTS DE RESUMEN (CSV, texto genérico, Santander) ══
// Detecta "CUOTA 3 DE 12", "CTA 3/12", "C.03/12" o "3/12" al final de la descripción, con
// validación (cuota ≤ total, total entre 2 y 60: "PAGO 15/10" no es una cuota).
function detectCuotaInfo(desc){
  const d=String(desc||'');
  const m=d.match(/\b(?:cuota|cta|c\.)\s*0?(\d{1,2})\s*(?:\/|de)\s*0?(\d{1,2})\b/i) || d.match(/(?:^|\s)0?(\d{1,2})\/0?(\d{1,2})\s*$/);
  if(!m) return null;
  const num=parseInt(m[1],10), total=parseInt(m[2],10);
  if(!(num>=1 && total>=2 && total<=60 && num<=total)) return null;
  return {num,total};
}
// En los resúmenes las cuotas 2+ suelen venir con la fecha ORIGINAL de compra: se llevan al
// período del resumen (mes de la fecha más reciente del lote), conservando el día, como ya
// hacía el parser de texto de Santander. La fecha original queda en _originalDate.
function normalizeImportedCuotas(txns){
  const list=(txns||[]).filter(Boolean);
  list.forEach(t=>{
    const info=detectCuotaInfo(t.description);
    if(t.cuotaNum && t.cuotaTotal){
      const n=Number(t.cuotaNum), tot=Number(t.cuotaTotal);
      if(!(n>=1 && tot>=2 && tot<=60 && n<=tot)){ delete t.cuotaNum; delete t.cuotaTotal; delete t.cuotaGroupId; }
      return;
    }
    if(info){ t.cuotaNum=info.num; t.cuotaTotal=info.total; }
  });
  const dates=list.map(t=>new Date(t.date)).filter(d=>!Number.isNaN(d.getTime()));
  if(!dates.length) return;
  const latest=new Date(Math.max(...dates));
  list.forEach(t=>{
    if(!(Number(t.cuotaNum)>=2) || t._dateCorrected) return;
    const d=new Date(t.date);
    const monthsDiff=(latest.getFullYear()-d.getFullYear())*12+(latest.getMonth()-d.getMonth());
    if(monthsDiff<1) return;
    const maxDay=new Date(latest.getFullYear(), latest.getMonth()+1, 0).getDate();
    const moved=new Date(latest.getFullYear(), latest.getMonth(), Math.min(d.getDate(), maxDay), 12, 0, 0, 0);
    t._originalDate=new Date(d); t.date=moved; t.week=getWeekKey(moved); t.month=getMonthKey(moved); t._dateCorrected=true;
  });
}

// ══ MISMA COMPRA POR GMAIL Y POR RESUMEN ══
// Una compra puede entrar dos veces: el mail del banco al momento de comprar y la línea del
// resumen después. Se emparejan uno a uno y queda un solo movimiento.
function importIsFromGmail(t){
  return !!(t && (t.gmailId || t.source==='gmail' || t.origen_del_movimiento==='importado_desde_gmail'));
}
function importAmountsClose(a,b){
  a=Math.abs(Number(a)||0); b=Math.abs(Number(b)||0);
  return a>0 && b>0 && Math.abs(a-b)<=Math.max(1, 0.01*Math.max(a,b));   // redondeo del mail (total/cuotas)
}
function importMerchantsClose(a,b){
  const na=getCuotaTxnBaseName(a), nb=getCuotaTxnBaseName(b);
  if(cuotaMerchantsMatch(na,nb)) return true;
  const w=x=>String(x||'').toLowerCase().split(/[\s*]+/)[0]||'';
  return w(na).length>3 && w(na)===w(nb);
}
function importIsSamePurchase(a,b){
  if((a.currency||'ARS')!==(b.currency||'ARS')) return false;
  if(!importAmountsClose(a.amount,b.amount)) return false;
  if((a.cuotaNum||b.cuotaNum) && (Number(a.cuotaNum)||1)!==(Number(b.cuotaNum)||1)) return false;
  // el resumen mueve la fecha de las cuotas al período; comparamos con la fecha original de compra
  const da=new Date(a._originalDate||a.date), db=new Date(b._originalDate||b.date);
  if(!(Math.abs(da-db)<=3*86400000)) return false;
  return importMerchantsClose(a,b);
}
// Resumen nuevo vs. movimientos que ya entraron por Gmail. Devuelve los que hay que agregar
// y actualiza los de Gmail emparejados (el resumen manda en monto/fecha/cuota; la categoría y
// el reparto de gastos compartidos que cargaste se conservan).
function mergeStatementWithGmail(newTxns){
  const pool=(state.transactions||[]).filter(t=>importIsFromGmail(t) && !t.isPendingCuota && !t.isPendingSubscription);
  const used=new Set(), kept=[], merged=[];
  (newTxns||[]).forEach(n=>{
    if(importIsFromGmail(n)){ kept.push(n); return; }
    const g=pool.find(p=>!used.has(p.id) && importIsSamePurchase(n,p));
    if(!g){ kept.push(n); return; }
    used.add(g.id);
    const d=n.date instanceof Date?n.date:new Date(n.date);
    g.amount=Number(n.amount)||g.amount;
    g.date=d; g.week=getWeekKey(d); g.month=getMonthKey(d);
    if(n.cuotaNum){ g.cuotaNum=n.cuotaNum; g.cuotaTotal=n.cuotaTotal; }
    if(!g.cuotaGroupId && n.cuotaGroupId) g.cuotaGroupId=n.cuotaGroupId;
    if(!g.payMethod && n.payMethod) g.payMethod=n.payMethod;
    g.statementConfirmed=true;
    g.statementDescription=n.description||'';
    merged.push(g);
  });
  return {kept, merged};
}

function finishImport(txns,source,origen){
  // Excluir comercios bloqueados (Mercado Libre) ANTES de crear nada, para que no
  // aparezcan en Movimientos ni en Cuotas. Ver isExcludedImportMerchant.
  txns=(txns||[]).filter(t=>!isExcludedImportMerchant(t));
  purgeExcludedMerchants();
  const sourceIsGmail = source==='gmail' || /^gmail\b/i.test(String(source||'')) || txns.some(t=>isGmailSourceTransaction(t));
  const origenVal = origen || (sourceIsGmail?'importado_desde_gmail': source==='paste'?'pegado_manualmente':'importado_desde_resumen');
  const isGmail = origenVal === 'importado_desde_gmail';
  if(!isGmail) normalizeImportedCuotas(txns);
  const config = ensureImportConfig();
  const bankProfile = (state.bankProfiles || []).find(profile => profile.id === config.bankProfileId) || null;
  txns.forEach(t=>{
    // Gmail imports: skip auto-categorization, leave for manual review
    if(!isGmail && (t.category==='Procesando...' || !t.category)) t.category=ruleBasedCategory(t.description);
    enrichTransaction(t, origenVal);
    // Gmail imports stay as pending
    if(isGmail) t.estado_revision='pendiente_de_revision';
    t.ownerProfileId = state.activeUserProfileId || t.ownerProfileId || 'default-profile';
    if(bankProfile){
      t.importBankProfileId = bankProfile.id;
      t.importBankName = bankProfile.bank || null;
      if(!t.payMethod && bankProfile.card) t.importBankCard = bankProfile.card;
    }
  });
  const importedSubscriptions = [];
  txns.forEach(t=>{
    if(t.importKind === 'subscription' && typeof upsertImportedSubscriptionFromTxn === 'function'){
      const sub = upsertImportedSubscriptionFromTxn(t);
      if(sub){
        t.sourceSubscriptionId = sub.id;
        importedSubscriptions.push(sub.id);
      }
    }
  });
  // Compras que ya habían entrado por Gmail: no se duplican
  let mergedFromGmail=[];
  if(!isGmail){
    const r=mergeStatementWithGmail(txns);
    txns=r.kept; mergedFromGmail=r.merged;
  }
  const before=state.transactions.length;
  const existingIds=new Set(state.transactions.map(t=>t.id));
  state.transactions=[...state.transactions,...txns];
  deduplicateTransactions();
  // Cuotas: alta / actualización del plan en state.cuotas (fuente única)
  assignCuotaGroupIds(txns);
  upsertCuotasFromTxns([...txns, ...mergedFromGmail]);
  if(importedSubscriptions.length && typeof syncProjectedSubscriptionTransactions === 'function') syncProjectedSubscriptionTransactions();
  const added=state.transactions.length-before;
  const duplicates=txns.length-added;
  const pi=detectPeriod(txns);
  const imp={id:Date.now().toString(36),label:pi.label,weekKey:pi.weekKey,monthKey:pi.monthKey,date:new Date().toLocaleDateString('es-AR'),count:added,source,txnIds:txns.map(t=>t.id),ownerProfileId:state.activeUserProfileId||'default-profile',bankProfileId:bankProfile?.id||null,parserMode:config.parserMode||'santander_auto'};
  state.imports.unshift(imp);
  if(pi.monthKey) state.dashMonth=pi.monthKey;
  saveState();
  const dupMsg=duplicates>0?' · '+duplicates+' duplicadas':'' ;
  const gmailMsg=mergedFromGmail.length?' · '+mergedFromGmail.length+' ya estaban (entraron por Gmail, se confirmaron con el resumen)':'';
  showToast('Importación completada · '+added+' movimiento'+(added===1?'':'s')+dupMsg+gmailMsg+' — '+pi.label,'success');
  afterDataLoad();
  // Gmail imports: don't auto-categorize, just render
  if(isGmail){
    saveState();renderDashboard();renderTransactions();updateQrBadge();
  } else {
    categorizePendingTxns();saveState();renderDashboard();renderTransactions();
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  ensureImportConfig();
  setTimeout(renderImportConfigPanel,0);
});
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
    // Generate stable cuotaGroupId for auto-projection
    let cuotaGroupId=null;
    if(cuotaTotal && cuotaTotal>=2){
      const _baseDesc=ds.replace(/\s*\(?(?:Cuota\s+\d+\s+de\s+\d+|\d+\/\d+)\)?\s*$/i,'').trim();
      const _slug=_baseDesc.toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,15);
      cuotaGroupId='cg_'+_slug+'_'+amount+'_'+cuotaTotal;
    }
    txns.push({id,date:new Date(lastDate),description:ds,amount,currency,category:'Procesando...',week:getWeekKey(lastDate),month:getMonthKey(lastDate),cuotaNum,cuotaTotal,cuotaGroupId});
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

const BRAND_LOGO_PRESETS = {
  rappi:{label:'R',bg:'#20BFA9',text:'#FFFFFF',match:['rappi']},
  pedidosya:{label:'P',bg:'#EF4354',text:'#FFFFFF',match:['pedidosya','pedido ya','dlo*pedidos','dlo*pedidosya']},
  mcdonalds:{label:'M',bg:'#DA1E2A',text:'#FFC928',match:['mcdonald','mc donald']},
  mercadopago:{label:'MP',bg:'#009EE3',text:'#FFFFFF',match:['mercadopago','merpago','mercado pago']},
  ypf:{label:'YPF',bg:'#1F64D8',text:'#FFFFFF',match:['ypf']},
  netflix:{label:'N',bg:'#F5F5F8',text:'#E30C18',match:['netflix']},
  starbucks:{label:'S',bg:'#0B7A52',text:'#FFFFFF',match:['starbucks']},
  uber:{label:'U',bg:'#111111',text:'#FFFFFF',match:['uber']},
  cabify:{label:'C',bg:'#5B2CF6',text:'#FFFFFF',match:['cabify']},
  farmacity:{label:'F',bg:'#6A5CFF',text:'#FFFFFF',match:['pharmacity','farmacity']},
  personal:{label:'P',bg:'#0A2F6B',text:'#FFFFFF',match:['personal']},
  movistar:{label:'M',bg:'#00A9E0',text:'#FFFFFF',match:['movistar']},
  claro:{label:'C',bg:'#D52B1E',text:'#FFFFFF',match:['claro']},
  shell:{label:'S',bg:'#F7D417',text:'#D71920',match:['shell']},
  axion:{label:'A',bg:'#1B5FA9',text:'#FFFFFF',match:['axion']},
  amazon:{label:'a',bg:'#131A22',text:'#FF9900',match:['amazon']}
};

function normalizeSearchText(v){
  return String(v||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeRuleKeyword(v){
  return normalizeSearchText(v).replace(/\s+/g,' ');
}

function txnRuleHaystack(t){
  return normalizeSearchText([
    t.description,
    t._baseDesc,
    t.gmailMerchantRaw,
    t.comercio_detectado
  ].filter(Boolean).join(' | '));
}

function isGmailSourceTransaction(t){
  return !!(t && (t.source==='gmail' || t.origen_del_movimiento==='importado_desde_gmail' || t.gmailId || t.payMethod==='visa' || t.payMethod==='amex'));
}

function getGmailOriginalMerchantName(t){
  return String(t?.gmailMerchantRaw || t?.originalGmailMerchantName || '').trim();
}

function restoreGmailOriginalMerchantName(t){
  if(!isGmailSourceTransaction(t)) return false;
  const original = getGmailOriginalMerchantName(t);
  if(!original) return false;
  let changed = false;
  t.originalGmailMerchantName = original;
  if(t.description !== original){ t.description = original; changed = true; }
  if(t._baseDesc !== original){ t._baseDesc = original; changed = true; }
  return changed;
}

function getNameRulesSorted(){
  const rules = Array.isArray(state.nameRules) ? state.nameRules : [];
  return [...rules]
    .filter(r=>r && r.active!==false && normalizeRuleKeyword(r.keyword))
    .sort((a,b)=>(b.priority||0)-(a.priority||0));
}

function getLogoRulesSorted(){
  const rules = Array.isArray(state.logoRules) ? state.logoRules : [];
  return [...rules]
    .filter(r => r && r.active !== false && normalizeRuleKeyword(r.keyword) && (r.logoKey || r.logoCustomUrl))
    .sort((a,b)=>(b.priority||0)-(a.priority||0));
}

function splitTxnDescriptionSuffix(desc){
  let core = String(desc||'').trim();
  let suffix = '';
  const cuota = core.match(/\s*\(Cuota\s*\d+\/\d+\)\s*$/i);
  if(cuota){
    suffix = cuota[0] + suffix;
    core = core.slice(0, -cuota[0].length).trim();
  }
  const hour = core.match(/\s+\d{2}:\d{2}\s*$/);
  if(hour){
    suffix = hour[0] + suffix;
    core = core.slice(0, -hour[0].length).trim();
  }
  return { core, suffix };
}

function applyNameRulesToTransaction(t){
  const rules = getNameRulesSorted();
  if(!rules.length) return false;
  const haystack = txnRuleHaystack(t);
  if(!haystack) return false;
  for(const rule of rules){
    const keyword = normalizeRuleKeyword(rule.keyword);
    const renameTo = String(rule.renameTo||'').trim();
    if(!keyword || !renameTo) continue;
    if(!haystack.includes(keyword)) continue;
    const parts = splitTxnDescriptionSuffix(t.description || t.gmailMerchantRaw || t._baseDesc || '');
    t.description = (renameTo + (parts.suffix||'')).trim();
    t._baseDesc = renameTo;
    t.appliedNameRuleId = rule.id || null;
    return true;
  }
  return false;
}

function detectBuiltinLogoKey(t){
  const haystack = txnRuleHaystack(t);
  if(!haystack) return null;
  for(const [logoKey, preset] of Object.entries(BRAND_LOGO_PRESETS)){
    if((preset.match||[]).some(term => haystack.includes(normalizeRuleKeyword(term)))) return logoKey;
  }
  return null;
}

function applyLogoRulesToTransaction(t){
  const haystack = txnRuleHaystack(t);
  const logoRules = getLogoRulesSorted();
  for(const rule of logoRules){
    const keyword = normalizeRuleKeyword(rule.keyword);
    if(!keyword || !haystack || !haystack.includes(keyword)) continue;
    if(rule.logoCustomUrl){
      // Custom uploaded image takes priority — overrides any existing logo
      t.customLogoUrl = rule.logoCustomUrl;
      t.logoKey = null;
    } else if(rule.logoKey){
      t.logoKey = rule.logoKey;
      // Clear custom logo only if it came from another rule (not user-set per-txn)
      if(t.customLogoUrl && t._customLogoFromRule) t.customLogoUrl = null;
    }
    t.appliedLogoRuleId = rule.id || null;
    t._customLogoFromRule = !!rule.logoCustomUrl;
    return true;
  }
  // No rule matched — fall back to built-in detection only if no logo present
  const hasCustomLogo = !!(t.customLogoUrl || t.logoUrl || t.merchantLogoUrl);
  if(hasCustomLogo) return false;
  const builtin = detectBuiltinLogoKey(t);
  if(builtin){
    t.logoKey = builtin;
    return true;
  }
  return false;
}

window.getBrandLogoPresets = function(){
  return BRAND_LOGO_PRESETS;
};

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
    {patterns:['mercado pago'],name:'MercadoPago'},
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
  const tokens = clean.split(/[\s*/-]+/).filter(Boolean);
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
  const sug = suggestCategory(desc);
  return sug.source==='regla_usuario' ? sug.category : 'Procesando...';
}

// Enriquecer transacción con campos nuevos si no los tiene
function enrichTransaction(t, origen){
  // Gmail-sourced transactions: detect via source field OR payMethod (visa/amex = came from Gmail email)
  const _isGmailSource=isGmailSourceTransaction(t);
  const _VALID_ORIGINS=['importado_desde_gmail','importado_desde_resumen','pegado_manualmente'];
  if(!t.origen_del_movimiento || !_VALID_ORIGINS.includes(t.origen_del_movimiento)){
    // Set for new txns OR migrate invalid values ('paste', etc.)
    t.origen_del_movimiento=_isGmailSource?'importado_desde_gmail':(origen&&_VALID_ORIGINS.includes(origen)?origen:'importado_desde_resumen');
  } else if(_isGmailSource && t.origen_del_movimiento!=='importado_desde_gmail'){
    // Retroactively fix already-stored Gmail transactions with wrong origin
    t.origen_del_movimiento='importado_desde_gmail';
  }
  if(!t.description) t.description = t._baseDesc || t.gmailMerchantRaw || 'Movimiento';
  if(!t._baseDesc) t._baseDesc = t.gmailMerchantRaw || t.description;
  // RESPECT manual edits: if the user has explicitly renamed the description,
  // don't auto-restore the original Gmail merchant name or apply rename rules.
  // This flag is set by confirmEditTxn / confirmEditMerchant when the user
  // manually edits, and it survives saveState/loadState cycles.
  const _userEdited = t._descEditedByUser === true;
  if(_isGmailSource && !_userEdited) restoreGmailOriginalMerchantName(t);
  const nameRuleApplied = !_userEdited && applyNameRulesToTransaction(t);
  if(_isGmailSource && !nameRuleApplied && !_userEdited){
    t.appliedNameRuleId = null;
    restoreGmailOriginalMerchantName(t);
  }
  // Respect manual comercio edits: only auto-detect if the user hasn't set it explicitly
  if (!t._comercioEditedByUser) {
    t.comercio_detectado = detectComercio(t.gmailMerchantRaw || t.description) || t.comercio_detectado || null;
  }
  applyLogoRulesToTransaction(t);
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



function deduplicateTransactions(){
  // Step 1: Remove standalone "Cuota X de Y" entries — these are parser artifacts from old imports
  state.transactions=state.transactions.filter(t=>{
    const desc=String(t.description||'').trim();
    return !/^[Cc]uota\s+\d+\s+de\s+\d+$/.test(desc);
  });
  // Step 2: mismo día + misma descripción + mismo monto + misma moneda = el mismo movimiento
  // importado dos veces. Solo se descarta si viene de OTRA importación: dos compras idénticas
  // en el mismo resumen (dos cafés iguales el mismo día) son reales y se conservan.
  const importOf=new Map();
  (state.imports||[]).forEach(imp=>(imp.txnIds||[]).forEach(id=>{ if(!importOf.has(id)) importOf.set(id, imp.id); }));
  const firstImportByKey=new Map();
  state.transactions=state.transactions.filter(t=>{
    const d=dateToYMD(t.date);
    const descNorm=String(t.description||'').toLowerCase().trim().replace(/\s+/g,' ')
      .replace(/\s*\d{2}:\d{2}\s*/g,'')            // strip HH:MM timestamps
      .replace(/\s*\(cuota\s*\d+\/\d+\)\s*$/i,'')  // strip (Cuota X/Y) suffix
      .trim();
    // Los movimientos de Gmail tienen ID propio: mails distintos nunca se fusionan acá
    const suffix = t.gmailId ? '-gmail-'+t.gmailId : '';
    const k=d+'-'+descNorm+'-'+t.amount+'-'+t.currency+suffix;
    const imp=importOf.get(t.id)||'__nuevo__';
    if(!firstImportByKey.has(k)){ firstImportByKey.set(k, imp); return true; }
    return firstImportByKey.get(k)===imp;   // misma importación → compra real repetida
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

// ══ CATEGORIZACIÓN AUTOMÁTICA (reglas) ══
// Solo toca movimientos sin categoría: nunca pisa una categoría elegida o corregida por vos.
function isTxnUncategorized(t){
  return !t.category || t.category==='Procesando...' || t.category==='Uncategorized';
}
// Usa tu historial de confirmaciones, tus reglas y las reglas base (suggestCategory).
// Si nada coincide, el movimiento queda pendiente de revisión.
function categorizePendingTxns(){
  let n=0;
  (state.transactions||[]).forEach(t=>{
    if(!isTxnUncategorized(t)) return;
    const sug=suggestCategory(t.description);
    if(sug.source==='default') return;
    t.category=sug.category;
    n++;
  });
  return n;
}
function autoCategorizeAll(){
  const n=categorizePendingTxns();
  if(!n){showToast(state.transactions.some(isTxnUncategorized)?'Ningún movimiento pendiente coincide con tus reglas o historial':'No hay movimientos sin categoría','info');return;}
  saveState();refreshAll();showToast(n+' movimiento'+(n===1?'':'s')+' categorizado'+(n===1?'':'s'),'success');
}

// ══ AFTER IMPORT ══
function afterDataLoad(){
  if(typeof syncProjectedSubscriptionTransactions === 'function') syncProjectedSubscriptionTransactions();
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
