// ══ BALANCE MENSUAL ══
(function(){
  const BALANCE_MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function balanceMonthLabel(monthKey){
    if(!monthKey) return '—';
    const [year,month]=String(monthKey).split('-');
    return `${BALANCE_MONTH_NAMES[Number(month)-1]||month} ${year}`;
  }

  function balanceFmtMoney(value, currency='ARS', decimals=0){
    const prefix=currency==='USD'?'U$D ':'$';
    return prefix+fmtN(Math.round((Number(value)||0)*Math.pow(10,decimals))/Math.pow(10,decimals),decimals);
  }

  function balancePct(part,total){
    if(!isFinite(total)||total<=0) return null;
    return Math.round((part/total)*100);
  }

  function balanceClamp(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  function balanceDeltaText(value, unit='$'){
    const abs=Math.abs(Math.round(value||0));
    if(!abs) return 'sin cambio';
    return `${value>=0?'+':'-'}${unit}${fmtN(abs,0)}`;
  }

  function balanceMonthlyAmount(item){
    if(!item) return 0;
    if(item.freq==='annual') return Number(item.price||0)/12;
    if(item.freq==='weekly') return Number(item.price||0)*4.3;
    return Number(item.price||item.amount||0);
  }

  function balanceConvert(amount,currency){
    const raw=Number(amount)||0;
    return currency==='USD'?raw*(USD_TO_ARS||state.usdRate||1420):raw;
  }

  function balanceMonthKeys(){
    const months=new Set();
    const currentMonth=getMonthKey(new Date());
    (state.transactions||[]).forEach(t=>{
      const month=t.month||getMonthKey(t.date);
      if(month&&month<currentMonth) months.add(month);
    });
    (state.incomeMonths||[]).forEach(m=>{
      if(!m?.month||m.month>=currentMonth) return;
      const hasIncome=(Number(m.extraArs)||0)>0 || (Number(m.extraUsd)||0)>0 || Object.values(m.sources||{}).some(v=>(Number(v)||0)>0);
      if(hasIncome) months.add(m.month);
    });
    return [...months].filter(Boolean).sort().reverse();
  }

  function balanceIncomeBreakdown(monthKey){
    const monthEntry=(state.incomeMonths||[]).find(m=>m.month===monthKey)||null;
    const rate=USD_TO_ARS||state.usdRate||1420;
    let fixedArs=0;
    let variableArs=0;
    let extraArs=0;
    let fixedUsd=0;
    let variableUsd=0;
    let extraUsd=0;

    if(monthEntry){
      Object.entries(monthEntry.sources||{}).forEach(([srcId,amount])=>{
        const source=(state.incomeSources||[]).find(s=>s.id===srcId);
        if(!source) return;
        const numeric=Number(amount)||0;
        const target=(source.type==='fijo') ? 'fixed' : 'variable';
        if(source.currency==='USD'){
          if(target==='fixed') fixedUsd+=numeric;
          else variableUsd+=numeric;
        }else{
          if(target==='fixed') fixedArs+=numeric;
          else variableArs+=numeric;
        }
      });
      // In the monthly logging modal these fields are the main salary in ARS/USD.
      fixedArs+=Number(monthEntry.extraArs)||0;
      fixedUsd+=Number(monthEntry.extraUsd)||0;
    }else if((state.incomeSources||[]).length){
      (state.incomeSources||[]).forEach(source=>{
        if(source.active===false) return;
        const base=Number(source.base)||0;
        if(source.currency==='USD'){
          if(source.type==='fijo') fixedUsd+=base;
          else variableUsd+=base;
        }else{
          if(source.type==='fijo') fixedArs+=base;
          else variableArs+=base;
        }
      });
    }else{
      fixedArs=(Number(state.income?.ars)||0);
      variableArs=(Number(state.income?.varArs)||0);
      fixedUsd=(Number(state.income?.usd)||0);
      variableUsd=(Number(state.income?.varUsd)||0);
    }

    const fixed= fixedArs + (fixedUsd*rate);
    const variable= variableArs + (variableUsd*rate);
    const extras= extraArs + (extraUsd*rate);
    return {
      fixed,
      variable,
      extras,
      total: fixed+variable+extras,
      fixedArs,
      variableArs,
      extraArs,
      fixedUsd,
      variableUsd,
      extraUsd
    };
  }

  function balanceCategoryHistory(category, monthKey, limit=3){
    const months=balanceMonthKeys().filter(m=>m<monthKey).slice(0,limit);
    if(!months.length) return 0;
    const values=months.map(month=>{
      return (state.transactions||[])
        .filter(t=>(t.month||getMonthKey(t.date))===month && !t.isPendingCuota && !t.isPendingSubscription)
        .filter(t=>t.category===category)
        .reduce((sum,t)=>sum+balanceConvert(t.amount,t.currency),0);
    });
    return values.reduce((sum,v)=>sum+v,0)/values.length;
  }

  function balanceMonthData(monthKey){
    const txns=(state.transactions||[])
      .filter(t=>(t.month||getMonthKey(t.date))===monthKey)
      .filter(t=>!t.isPendingCuota&&!t.isPendingSubscription);
    const prevMonth=balanceMonthKeys().find(m=>m<monthKey)||null;
    const prevTxns=prevMonth
      ? (state.transactions||[])
          .filter(t=>(t.month||getMonthKey(t.date))===prevMonth)
          .filter(t=>!t.isPendingCuota&&!t.isPendingSubscription)
      : [];
    const income=balanceIncomeBreakdown(monthKey);
    const prevIncome=prevMonth?balanceIncomeBreakdown(prevMonth):{total:0};
    const arsExpenses=txns.filter(t=>t.currency!=='USD').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
    const usdExpenses=txns.filter(t=>t.currency==='USD').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
    const totalExpenses=arsExpenses+(usdExpenses*(USD_TO_ARS||state.usdRate||1420));
    const prevTotalExpenses=prevTxns.reduce((sum,t)=>sum+balanceConvert(t.amount,t.currency),0);

    const savingsMovements=(state.savDeposits||[]).filter(d=>d.month===monthKey);
    const savingsNet=savingsMovements.reduce((sum,d)=>sum+balanceConvert(savSignedAmount(d),d.currency),0);

    const fixedBase=(state.fixedExpenses||[]).reduce((sum,item)=>sum+balanceConvert(item.amount,item.currency),0);
    const subscriptionsBase=(state.subscriptions||[])
      .filter(s=>s.active!==false)
      .reduce((sum,item)=>sum+balanceConvert(balanceMonthlyAmount(item),item.currency),0);

    const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
    const cuotaActual=(txns.filter(t=>t.cuotaNum||t.cuotaGroupId).reduce((sum,t)=>sum+balanceConvert(t.amount,t.currency),0));
    const cuotaProxima=autoGroups.reduce((sum,g)=>{
      const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g):null;
      if(!snap||snap.paid>=snap.total) return sum;
      return sum+balanceConvert(snap.amountPerCuota,g.currency);
    },0)+(state.cuotas||[]).reduce((sum,c)=>{
      if((c.paid||0)>=(c.total||0)) return sum;
      return sum+balanceConvert(c.amount,c.currency);
    },0);

    const categoryTotals={};
    txns.forEach(t=>{
      const key=t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'?t.category:'Sin clasificar';
      categoryTotals[key]=(categoryTotals[key]||0)+balanceConvert(t.amount,t.currency);
    });
    const topCategories=Object.entries(categoryTotals)
      .map(([name,total])=>{
        const avg=balanceCategoryHistory(name,monthKey,3);
        const delta=total-avg;
        return {
          name,
          total,
          avg,
          delta,
          pct: balancePct(total,totalExpenses)||0,
          group: typeof catGroup==='function'?catGroup(name):'Sin clasificar'
        };
      })
      .sort((a,b)=>b.total-a.total);

    const spendVelocity=income.total>0?Math.round((totalExpenses/income.total)*100):null;
    const savingsRate=income.total>0?Math.round(((income.total-totalExpenses)/income.total)*100):null;
    const committedBase=fixedBase+subscriptionsBase+cuotaProxima;
    const freeCash=income.total-totalExpenses;
    const bufferMonths=(state.savAccounts||[]).reduce((sum,acc)=>sum+balanceConvert(acc.balance,acc.currency),0)/(committedBase||1);
    const largestTxn=[...txns].sort((a,b)=>balanceConvert(b.amount,b.currency)-balanceConvert(a.amount,a.currency))[0]||null;
    const normalizedNet=freeCash-income.extras;
    const avgTicket=txns.length?Math.round(totalExpenses/txns.length):0;
    const usdExposure=totalExpenses>0?Math.round(((usdExpenses*(USD_TO_ARS||state.usdRate||1420))/totalExpenses)*100):0;
    const daysInMonth=new Date(Number(monthKey.split('-')[0]),Number(monthKey.split('-')[1]),0).getDate();
    const daysWithSpend=new Set(txns.map(t=>String(t.date).slice(0,10))).size;

    let score=78;
    if(savingsRate!==null){
      if(savingsRate<0) score-=26;
      else if(savingsRate<10) score-=12;
      else if(savingsRate>=20) score+=8;
    }else{
      score-=10;
    }
    if(spendVelocity!==null&&spendVelocity>100) score-=18;
    if(committedBase>0&&income.total>0&&committedBase/income.total>0.65) score-=10;
    if(income.extras>0&&normalizedNet<0) score-=8;
    if(bufferMonths>=6) score+=10;
    else if(bufferMonths<2) score-=8;
    if((state.subscriptions||[]).filter(s=>s.active!==false).length>=6) score-=5;
    score=Math.max(24,Math.min(96,score));

    return {
      monthKey,
      prevMonth,
      txns,
      income,
      prevIncome,
      arsExpenses,
      usdExpenses,
      totalExpenses,
      prevTotalExpenses,
      savingsNet,
      fixedBase,
      subscriptionsBase,
      cuotaActual,
      cuotaProxima,
      committedBase,
      topCategories,
      spendVelocity,
      savingsRate,
      freeCash,
      normalizedNet,
      avgTicket,
      usdExposure,
      score,
      bufferMonths,
      largestTxn,
      daysInMonth,
      daysWithSpend
    };
  }

  function balanceStatusLabel(data){
    if(data.freeCash<0) return {title:'Mes en tensión', tone:'danger', desc:'Gastaste por encima del ingreso del período y necesitás ajustar el próximo arranque.'};
    if((data.savingsRate||0)>=20) return {title:'Mes muy sólido', tone:'good', desc:'El cierre dejó ahorro real y margen para tomar decisiones con calma.'};
    if((data.savingsRate||0)>=10) return {title:'Mes ordenado', tone:'warn', desc:'Cerraste positivo, aunque todavía hay palancas claras para ahorrar más.'};
    return {title:'Mes frágil', tone:'warn', desc:'Cerraste arriba, pero con poco colchón y margen estrecho para el próximo mes.'};
  }

  function balanceDrivers(data){
    const items=[];
    const expenseDelta=data.totalExpenses-data.prevTotalExpenses;
    const incomeDelta=data.income.total-data.prevIncome.total;
    if(Math.abs(incomeDelta)>1000){
      items.push({
        label:incomeDelta>=0?'Ingreso mejorado':'Ingreso debilitado',
        text:`${incomeDelta>=0?'Entró':'Se perdió'} ${balanceDeltaText(incomeDelta)} frente a ${data.prevMonth?balanceMonthLabel(data.prevMonth):'el mes previo'}.`
      });
    }
    if(Math.abs(expenseDelta)>1000){
      items.push({
        label:expenseDelta>=0?'Más gasto que antes':'Menos gasto que antes',
        text:`El gasto total quedó ${balanceDeltaText(expenseDelta)} versus ${data.prevMonth?balanceMonthLabel(data.prevMonth):'el período anterior'}.`
      });
    }
    const top=data.topCategories[0];
    if(top){
      items.push({
        label:`Peso principal: ${top.name}`,
        text:`Explicó ${top.pct}% del gasto del mes con ${balanceFmtMoney(top.total)}.`
      });
    }
    if(data.income.extras>0){
      items.push({
        label:'Cierre impulsado por extras',
        text:`Tu resultado incluyó ${balanceFmtMoney(data.income.extras)} no recurrentes; sin eso, el neto sería ${balanceFmtMoney(data.normalizedNet)}.`
      });
    }
    if(data.savingsNet>0){
      items.push({
        label:'Ahorro ejecutado',
        text:`Trasladaste ${balanceFmtMoney(data.savingsNet)} a ahorro manual durante el mes.`
      });
    }
    return items.slice(0,4);
  }

  function balanceInlineInsights(data){
    const insights=[];
    const leaks=balanceLeaks(data);
    if(leaks[0]){
      insights.push(`"${leaks[0].category}" está ${leaks[0].multipleLabel} por encima de tu nivel normal.`);
    }
    const top=data.topCategories[0];
    if(top){
      insights.push(`${top.name} representa ${top.pct}% de tu gasto total.`);
    }
    if(data.daysWithSpend>(data.daysInMonth*0.75)){
      insights.push(`Gastaste en ${data.daysWithSpend}/${data.daysInMonth} días. La frecuencia ya es una palanca importante.`);
    }
    if(data.subscriptionsBase>0){
      insights.push(`Tus suscripciones consumen ${balancePct(data.subscriptionsBase,data.committedBase)||0}% de tu base comprometida.`);
    }
    return insights.slice(0,4);
  }

  function balanceOpportunities(data){
    const suggestions=[];
    const subscriptionCount=(state.subscriptions||[]).filter(s=>s.active!==false).length;
    if(subscriptionCount>=4){
      suggestions.push({
        title:'Podá suscripciones',
        body:`Tenés ${subscriptionCount} activas por ${balanceFmtMoney(data.subscriptionsBase)}/mes. Dar de baja 1 o 2 servicios recupera margen inmediato.`
      });
    }
    const runaway=data.topCategories
      .filter(cat=>cat.avg>0 && cat.total>cat.avg*1.2)
      .sort((a,b)=>(b.total-b.avg)-(a.total-a.avg))[0];
    if(runaway){
      suggestions.push({
        title:`Frená ${runaway.name}`,
        body:`Se fue ${balanceFmtMoney(runaway.total-runaway.avg)} por encima de su promedio reciente. Es la fuga más clara para intervenir.`
      });
    }
    if(data.committedBase>0 && data.income.total>0 && (data.committedBase/data.income.total)>0.55){
      suggestions.push({
        title:'Bajá la base comprometida',
        body:`Fijos, suscripciones y cuotas ya consumen ${Math.round((data.committedBase/data.income.total)*100)}% del ingreso antes del gasto variable.`
      });
    }
    if(data.avgTicket>0 && data.daysWithSpend>(data.daysInMonth*0.75)){
      suggestions.push({
        title:'Reducí microgasto recurrente',
        body:`Gastaste en ${data.daysWithSpend} de ${data.daysInMonth} días. Menos frecuencia suele bajar más que perseguir una sola compra grande.`
      });
    }
    if(!suggestions.length){
      suggestions.push({
        title:'Mes bastante limpio',
        body:'No aparece una fuga dominante. La mejora más rentable parece venir de una meta de ahorro automática y revisión semanal.'
      });
    }
    return suggestions.slice(0,4);
  }

  function balanceAlerts(data){
    const alerts=[];
    if(data.freeCash<0) alerts.push({tone:'danger', title:'Cierre negativo', text:`El mes terminó ${balanceFmtMoney(Math.abs(data.freeCash))} abajo.`});
    if(data.normalizedNet<0 && data.income.extras>0) alerts.push({tone:'warn', title:'Dependencia de extras', text:'Sin ingresos extraordinarios, el mes hubiera cerrado en negativo.'});
    if(data.usdExposure>=20) alerts.push({tone:'warn', title:'Exposición en USD', text:`El ${data.usdExposure}% del gasto quedó dolarizado.`});
    if(data.bufferMonths<2) alerts.push({tone:'danger', title:'Colchón corto', text:`Tu patrimonio cubre cerca de ${fmtN(data.bufferMonths,1)} meses de base comprometida.`});
    if(data.cuotaProxima>0) alerts.push({tone:'info', title:'Próximas cuotas', text:`Ya hay ${balanceFmtMoney(data.cuotaProxima)} comprometidos en cuotas para adelante.`});
    if(!alerts.length) alerts.push({tone:'info', title:'Sin alertas críticas', text:'No aparece un riesgo dominante en el cierre. La mejora pasa más por consistencia que por apagar incendios.'});
    return alerts.slice(0,4);
  }

  function balanceLeaks(data){
    return data.topCategories
      .filter(cat=>cat.avg>0 && cat.total>cat.avg*1.12)
      .map(cat=>{
        const ratio=cat.avg>0?(cat.total/cat.avg):1;
        const reducible=Math.max(0,cat.total-cat.avg);
        const savePotential=Math.round(cat.total*0.3);
        return {
          category: cat.name,
          current: cat.total,
          avg: cat.avg,
          delta: cat.delta,
          ratio,
          multipleLabel: ratio>=2 ? `${fmtN(ratio,1)}x` : `+${Math.round((ratio-1)*100)}%`,
          explanation: `${cat.name} está ${ratio>=2?`${fmtN(ratio,1)}x`:`${Math.round((ratio-1)*100)}%`} por encima de tu promedio. Recortar 30% liberaría ${balanceFmtMoney(savePotential)}.`,
          plainAction: `Reducir ${cat.name} en 30% te devolvería ${balanceFmtMoney(savePotential)}.`,
          savePotential,
          reducible
        };
      })
      .sort((a,b)=>b.savePotential-a.savePotential)
      .slice(0,3);
  }

  function balanceActionPlan(data){
    const leaks=balanceLeaks(data);
    const actions=[];
    if(leaks[0]){
      actions.push({
        title:`Bajá ${leaks[0].category}`,
        problem:`Está en ${leaks[0].multipleLabel} de tu ritmo normal.`,
        impact: leaks[0].savePotential,
        action:`Probá una reducción de 30% este mes y recuperás ${balanceFmtMoney(leaks[0].savePotential)}.`
      });
    }
    if(data.daysWithSpend>(data.daysInMonth*0.75)){
      const frequencySave=Math.round(data.avgTicket*2.5);
      actions.push({
        title:'Reducí frecuencia de compra',
        problem:`Gastaste en ${data.daysWithSpend}/${data.daysInMonth} días.`,
        impact: frequencySave,
        action:'Agrupá compras pequeñas en menos días. Suele rendir más que perseguir un gasto grande aislado.'
      });
    }
    if(data.subscriptionsBase>0){
      const subSave=Math.round(data.subscriptionsBase*0.2);
      actions.push({
        title:'Optimizar suscripciones',
        problem:`Tenés ${balanceFmtMoney(data.subscriptionsBase)} mensuales en servicios recurrentes.`,
        impact: subSave,
        action:`Con una poda de 20% liberarías cerca de ${balanceFmtMoney(subSave)} por mes.`
      });
    }
    if(data.committedBase>0&&data.income.total>0&&(data.committedBase/data.income.total)>0.55){
      actions.push({
        title:'Bajar base comprometida',
        problem:`La estructura fija consume ${Math.round((data.committedBase/data.income.total)*100)}% del ingreso.`,
        impact: Math.round(data.committedBase*0.08),
        action:'Mover una sola obligación recurrente o renegociar una cuota cambia mucho más de lo que parece.'
      });
    }
    return actions.slice(0,3);
  }

  function balanceSimulation(data){
    const leaks=balanceLeaks(data).slice(0,2);
    const baselineSavings=data.income.total-data.totalExpenses;
    const optimizedDelta=leaks.reduce((sum,leak)=>sum+Math.round(leak.current*0.25),0);
    const optimizedSavings=baselineSavings+optimizedDelta;
    return {
      baseline: {
        projectedSavings: baselineSavings,
        savingsRate: data.income.total>0?Math.round((baselineSavings/data.income.total)*100):null
      },
      optimized: {
        projectedSavings: optimizedSavings,
        savingsRate: data.income.total>0?Math.round((optimizedSavings/data.income.total)*100):null,
        delta: optimizedDelta,
        assumptions: leaks.map(leak=>({category: leak.category, reductionPct: 25, recovered: Math.round(leak.current*0.25)}))
      }
    };
  }

  function balanceNextMonth(data){
    const activeSubs=(state.subscriptions||[]).filter(s=>s.active!==false);
    const fixedCount=(state.fixedExpenses||[]).length;
    const projectedStart=data.income.total-data.committedBase;
    return {
      committed: data.committedBase,
      projectedStart,
      subscriptionCount: activeSubs.length,
      fixedCount,
      quotaLoad: data.cuotaProxima,
      runRate: data.totalExpenses,
      notes: [
        `Arrancás con ${balanceFmtMoney(data.committedBase)} ya comprometidos entre fijos, suscripciones y cuotas.`,
        `Si repetís el run-rate de ${balanceFmtMoney(data.totalExpenses)}, tu margen libre sería ${balanceFmtMoney(data.income.total-data.totalExpenses)}.`,
        `Tu colchón actual te cubre ${fmtN(data.bufferMonths,1)} meses de estructura base.`
      ]
    };
  }

  function balanceSecondaryCards(data){
    const fixedPct=balancePct(data.fixedBase+data.subscriptionsBase+data.cuotaProxima,data.totalExpenses)||0;
    const variablePct=balanceClamp(100-fixedPct,0,100);
    return [
      {
        title:'Ingresos vs gastos',
        value: balanceFmtMoney(data.freeCash),
        sub:`Tus gastos consumieron ${balancePct(data.totalExpenses,data.income.total)||0}% del ingreso.`,
        visual: `
          <div class="balance-mini-compare">
            <span style="width:100%"></span>
            <span class="expense" style="width:${balanceClamp(balancePct(data.totalExpenses,data.income.total)||0,2,100)}%"></span>
          </div>
        `
      },
      {
        title:'Estructura del gasto',
        value: `${fixedPct}% fijo`,
        sub:`La parte variable fue ${variablePct}% del gasto.`,
        visual: `
          <div class="balance-mini-stack">
            <span style="width:${balanceClamp(fixedPct,4,100)}%"></span>
            <span class="variable" style="width:${balanceClamp(variablePct,4,100)}%"></span>
          </div>
        `
      },
      {
        title:'Velocidad de gasto',
        value: `${data.spendVelocity===null?'—':data.spendVelocity+'%'}`,
        sub:'Qué tan rápido se fue el ingreso total durante el mes.',
        visual: `<div class="balance-mini-line"><span style="width:${balanceClamp(data.spendVelocity||0,8,100)}%"></span></div>`
      },
      {
        title:'Capacidad de ahorro',
        value: `${fmtN(data.bufferMonths,1)} meses`,
        sub:'Cobertura de tu estructura comprometida con tu patrimonio actual.',
        visual: `<div class="balance-capacity-dots">${new Array(6).fill(0).map((_,i)=>`<i class="${i<Math.round(balanceClamp(data.bufferMonths,0,6))?'on':''}"></i>`).join('')}</div>`
      },
      {
        title:'Exposición al dólar',
        value: `${data.usdExposure}%`,
        sub:'Porción del gasto expuesta a movimientos del tipo de cambio.',
        visual: `<div class="balance-mini-line fx"><span style="width:${balanceClamp(data.usdExposure,8,100)}%"></span></div>`
      },
      {
        title:'Días con gasto',
        value: `${data.daysWithSpend}/${data.daysInMonth}`,
        sub:'Mientras más frecuente el gasto, más difícil sostener ahorro.',
        visual: `<div class="balance-mini-calendar">${new Array(Math.min(data.daysInMonth,31)).fill(0).map((_,i)=>`<i class="${i<data.daysWithSpend?'on':''}"></i>`).join('')}</div>`
      }
    ];
  }

  function renderBalanceHero(data){
    const hero=document.getElementById('balance-hero');
    if(!hero) return;
    const status=balanceStatusLabel(data);
    const spendTone=data.freeCash<0?'danger':(data.savingsRate||0)>=15?'good':'warn';
    const rateText=data.savingsRate===null?'Sin ingreso configurado':`${data.savingsRate}% de ahorro`;
    const fixedPct=balancePct(data.income.fixed,data.income.total)||0;
    const variablePct=balancePct(data.income.variable,data.income.total)||0;
    const topSpots=data.topCategories.slice(0,6);
    const maxCat=Math.max(...topSpots.map(item=>item.total),1);
    const committedPct=balancePct(data.committedBase,data.income.total)||0;
    const expensePct=balancePct(data.totalExpenses,data.income.total)||0;
    const freePct=data.income.total>0?balanceClamp(100-committedPct,0,100):0;
    const inlineInsights=balanceInlineInsights(data).slice(0,3);
    const deltaVsPrev=data.freeCash-(data.prevIncome.total-data.prevTotalExpenses);
    const heroFacts=[
      {label:'Ingreso', value:balanceFmtMoney(data.income.total)},
      {label:'Gasto', value:balanceFmtMoney(data.totalExpenses)},
      {label:'Base comprometida', value:`${committedPct}%`}
    ];
    hero.innerHTML=`
      <section class="balance-hero-shell balance-tone-${status.tone}">
        <div class="balance-hero-copy">
          <div class="balance-hero-kicker">CIERRE DE ${balanceMonthLabel(data.monthKey).toUpperCase()}</div>
          <div class="balance-status-tag ${status.tone}">
            <span class="balance-status-dot"></span>${status.title}
          </div>
          <h2 class="balance-hero-title">${status.title}</h2>
          <p class="balance-hero-desc">${status.desc}</p>
          <div class="balance-hero-main ${spendTone}">
            <span class="balance-hero-main-label">Resultado final</span>
            <span class="balance-hero-main-value">${balanceFmtMoney(data.freeCash)}</span>
            <div class="balance-hero-main-meta">
              <span>${rateText}</span>
              <span>${balanceDeltaText(deltaVsPrev)} vs mes anterior</span>
            </div>
          </div>
          <div class="balance-inline-insights">
            ${inlineInsights.map(text=>`<div class="balance-inline-insight">${text}</div>`).join('')}
          </div>
          <div class="balance-hero-strip">
            ${heroFacts.map(item=>`
              <div class="balance-hero-fact">
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="balance-hero-cockpit">
          <div class="balance-score-card">
            <div class="balance-score-ring">
              <svg viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
                <circle cx="60" cy="60" r="46" fill="none" stroke="var(--border)" stroke-width="10"></circle>
                <circle id="balance-score-arc" cx="60" cy="60" r="46" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)"></circle>
              </svg>
              <div class="balance-score-center">
                <strong>${data.score}</strong>
                <span>puntaje</span>
              </div>
            </div>
            <div class="balance-score-meta">
              <div><span>Ingreso</span><strong>${balanceFmtMoney(data.income.total)}</strong></div>
              <div><span>Gasto</span><strong>${balanceFmtMoney(data.totalExpenses)}</strong></div>
              <div><span>Base fija</span><strong>${balanceFmtMoney(data.committedBase)}</strong></div>
              <div><span>Normalizado</span><strong>${balanceFmtMoney(data.normalizedNet)}</strong></div>
            </div>
            <details class="balance-score-details">
              <summary>Por qué dio este score</summary>
              <div>
                ${[
                  `Ahorro del mes: ${data.savingsRate===null?'sin ingreso cargado':data.savingsRate+'%'}.`,
                  `Base comprometida: ${committedPct}% del ingreso.`,
                  `Cobertura patrimonial: ${fmtN(data.bufferMonths,1)} meses.`,
                  `Exposición USD: ${data.usdExposure}% del gasto.`
                ].map(item=>`<p>${item}</p>`).join('')}
              </div>
            </details>
          </div>
          <div class="balance-visual-stack">
            <div class="balance-visual-card">
              <div class="balance-visual-head">
                <span>Mix de ingreso</span>
                <strong>${balanceFmtMoney(data.income.total)}</strong>
              </div>
              <div class="balance-mix-bar">
                <div class="balance-mix-seg fixed" style="width:${balanceClamp(fixedPct,0,100)}%"></div>
                <div class="balance-mix-seg variable" style="width:${balanceClamp(variablePct,0,100)}%"></div>
              </div>
              <div class="balance-mix-legend">
                <span><i class="fixed"></i>Fijo ${fixedPct}%</span>
                <span><i class="variable"></i>Variable ${variablePct}%</span>
              </div>
            </div>
            <div class="balance-visual-card">
              <div class="balance-visual-head">
                <span>Pista del mes</span>
                <strong>${expensePct}% usado</strong>
              </div>
              <div class="balance-runway">
                <div class="balance-runway-track">
                  <div class="balance-runway-seg committed" style="width:${balanceClamp(committedPct,0,100)}%"></div>
                  <div class="balance-runway-seg spent" style="width:${balanceClamp(expensePct,0,100)}%"></div>
                </div>
                <div class="balance-runway-foot">
                  <span>Estructura ${committedPct}%</span>
                  <span>Aire ${freePct}%</span>
                </div>
              </div>
            </div>
            <div class="balance-visual-card">
              <div class="balance-visual-head">
                <span>Pulso de categorías</span>
                <strong>${topSpots.length} focos</strong>
              </div>
              <div class="balance-pulse">
                ${topSpots.map(item=>`
                  <div class="balance-pulse-col">
                    <div class="balance-pulse-bar" style="height:${balanceClamp(Math.round((item.total/maxCat)*100),14,100)}%"></div>
                    <span>${esc(item.name).slice(0,3)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
    animateDonutStroke(document.getElementById('balance-score-arc'),data.score,46);
  }

  function renderBalanceGrid(data){
    const grid=document.getElementById('balance-grid');
    if(!grid) return;
    const cards=balanceSecondaryCards(data);
    const leaks=balanceLeaks(data);
    const actions=balanceActionPlan(data);
    const simulation=balanceSimulation(data);
    const cardsToShow=[cards[0],cards[1],cards[2],cards[3]];
    grid.innerHTML=`
      <section class="balance-secondary-grid">
        ${cardsToShow.map(card=>`
          <article class="balance-metric-card">
            <div class="balance-metric-top">
              <span>${card.title}</span>
              <strong>${card.value}</strong>
            </div>
            <div class="balance-metric-visual">${card.visual}</div>
            <p>${card.sub}</p>
          </article>
        `).join('')}
      </section>

      <section class="balance-panel" id="balance-leaks">
        <div class="balance-panel-head">
          <div>
            <div class="balance-panel-kicker">Fugas detectadas</div>
            <h3>Por dónde se te escapa la plata</h3>
          </div>
        </div>
        <div class="balance-leak-grid">
          ${leaks.map(leak=>`
            <article class="balance-leak-card">
              <div class="balance-leak-top">
                <strong>${esc(leak.category)}</strong>
                <span>${leak.multipleLabel}</span>
              </div>
              <div class="balance-leak-values">
                <div><label>Actual</label><strong>${balanceFmtMoney(leak.current)}</strong></div>
                <div><label>Promedio</label><strong>${balanceFmtMoney(leak.avg)}</strong></div>
              </div>
              <p>${leak.explanation}</p>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="balance-bottom-grid">
        <section class="balance-panel" id="balance-actions">
          <div class="balance-panel-head">
            <div>
              <div class="balance-panel-kicker">Acciones recomendadas</div>
              <h3>Qué haría ahora</h3>
            </div>
          </div>
          <div class="balance-action-grid compact">
            ${actions.map(action=>`
              <article class="balance-action-card">
                <span class="balance-action-impact">Impacto ${balanceFmtMoney(action.impact)}</span>
                <strong>${action.title}</strong>
                <p><b>Problema:</b> ${action.problem}</p>
                <p><b>Acción:</b> ${action.action}</p>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="balance-panel balance-simulation-shell" id="balance-simulation">
          <div class="balance-panel-head">
            <div>
              <div class="balance-panel-kicker">Simulación</div>
              <h3>Próximo mes</h3>
            </div>
          </div>
          <div class="balance-simulation-grid compact">
            <article class="balance-scenario-card">
              <span>Si seguís igual</span>
              <strong>${balanceFmtMoney(simulation.baseline.projectedSavings)}</strong>
              <small>${simulation.baseline.savingsRate===null?'Sin tasa disponible':`${simulation.baseline.savingsRate}% de ahorro estimado`}</small>
            </article>
            <article class="balance-scenario-card improved">
              <span>Si ajustás 2 fugas</span>
              <strong>${balanceFmtMoney(simulation.optimized.projectedSavings)}</strong>
              <small>${simulation.optimized.savingsRate===null?'Sin tasa disponible':`${simulation.optimized.savingsRate}% de ahorro estimado · ${balanceFmtMoney(simulation.optimized.delta)} mejor`}</small>
            </article>
          </div>
          <div class="balance-simulation-assumptions">
            ${simulation.optimized.assumptions.map(item=>`<div>${item.category}: -${item.reductionPct}% = ${balanceFmtMoney(item.recovered)} recuperados</div>`).join('')}
          </div>
        </section>
      </section>
    `;
  }

  function renderBalanceNext(data){
    const next=document.getElementById('balance-next');
    if(!next) return;
    const upcoming=balanceNextMonth(data);
    next.innerHTML=`
      <section class="balance-next-shell">
        <div class="balance-panel-head">
          <div>
            <div class="balance-panel-kicker">Próximo mes</div>
            <h3>Cómo arrancás y qué conviene hacer</h3>
          </div>
        </div>
        <div class="balance-next-grid">
          <div class="balance-next-card">
            <span>Base comprometida</span>
            <strong>${balanceFmtMoney(upcoming.committed)}</strong>
            <p>${upcoming.fixedCount} fijos, ${upcoming.subscriptionCount} suscripciones y ${balanceFmtMoney(upcoming.quotaLoad)} en cuotas pendientes.</p>
          </div>
          <div class="balance-next-card">
            <span>Margen si repetís ingreso</span>
            <strong>${balanceFmtMoney(upcoming.projectedStart)}</strong>
            <p>Es lo que te queda después de cubrir la estructura antes del gasto variable del mes.</p>
          </div>
          <div class="balance-next-card">
            <span>Regla operativa</span>
            <strong>${data.freeCash>=0?'Defendé el cierre':'Recuperá margen'}</strong>
            <p>${data.freeCash>=0?'Intentá convertir el resultado de este mes en ahorro automático al comienzo del próximo.':'Priorizá recortar una categoría y una suscripción antes de tocar ahorro.'}</p>
          </div>
        </div>
        <div class="balance-next-notes">
          ${upcoming.notes.map(note=>`<p>${note}</p>`).join('')}
        </div>
      </section>
    `;
  }

  window.renderBalancePage=function renderBalancePage(){
    const empty=document.getElementById('balance-empty');
    const content=document.getElementById('balance-content');
    const select=document.getElementById('balance-month-select');
    if(!empty||!content||!select) return;

    const months=balanceMonthKeys();
    if(!months.length){
      empty.style.display='flex';
      content.style.display='none';
      return;
    }

    const preferred=(select.value && months.includes(select.value))
      ? select.value
      : (state.balanceMonth && months.includes(state.balanceMonth) ? state.balanceMonth : months[0]);
    select.innerHTML=months.map(month=>`<option value="${month}" ${month===preferred?'selected':''}>${balanceMonthLabel(month)}</option>`).join('');
    state.balanceMonth=preferred;

    empty.style.display='none';
    content.style.display='flex';
    const data=balanceMonthData(preferred);
    renderBalanceHero(data);
    renderBalanceGrid(data);
    renderBalanceNext(data);
    replayFadeUp(content);
  };

  window.balanceJump=function balanceJump(id){
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  };
})();
