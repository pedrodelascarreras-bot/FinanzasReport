// ══ CALENDARIO Y TAREAS ══
// Agenda (tareas + compromisos + ciclos de tarjeta) y la página Calendario.
function normalizeAgendaDate(value){
  if(!value) return null;
  let dt=null;
  if(value instanceof Date){
    dt=new Date(value);
  } else if(typeof value==='string'){
    const trimmed=value.trim();
    const match=trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(match){
      const [,yy,mm,dd]=match;
      dt=new Date(Number(yy), Number(mm)-1, Number(dd), 12, 0, 0, 0);
    } else {
      dt=new Date(trimmed);
    }
  } else {
    dt=new Date(value);
  }
  if(isNaN(dt)) return null;
  dt.setHours(12,0,0,0);
  return dt;
}
function dateToInputValue(value){
  const dt=normalizeAgendaDate(value);
  if(!dt) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function getTaskAgendaItems(baseDate=new Date(), opts={}){
  const includePast=!!opts.includePast;
  const includeDone=!!opts.includeDone;
  const today=normalizeAgendaDate(baseDate)||normalizeAgendaDate(new Date());
  return (state.tasks||[])
    .filter(task=>task && (includeDone || !task.done))
    .map(task=>{
      const date=normalizeAgendaDate(task.dueDate);
      if(!date) return null;
      const days=Math.round((date-today)/86400000);
      if(!includePast && days<0) return null;
      return {
        type:'task',
        title:task.text,
        shortLabel:task.text,
        date,
        days,
        page:'calendar',
        taskId:task.id,
        done:!!task.done
      };
    })
    .filter(Boolean);
}
function getCalendarAgendaItems(baseDate=new Date(), opts={}){
  const timeline=getDashboardTimelineData(baseDate);
  const includePast=!!opts.includePast;
  const includeDoneTasks=!!opts.includeDoneTasks;
  const merged=[
    ...(timeline.events||[]),
    ...getTaskAgendaItems(baseDate,{includePast,includeDone:includeDoneTasks})
  ];
  merged.sort((a,b)=>{
    const ad=normalizeAgendaDate(a.date);
    const bd=normalizeAgendaDate(b.date);
    return ad-bd || String(a.title||'').localeCompare(String(b.title||''),'es');
  });
  return merged;
}

function addTask(){
  const input=document.getElementById('notif-task-input');
  if(!input)return;
  const text=input.value.trim();
  if(!text)return;
  if(!state.tasks)state.tasks=[];
  state.tasks.push({id:Math.random().toString(36).substr(2,9),text,done:false,createdAt:Date.now(),doneAt:null});
  input.value='';
  saveState();if(typeof renderNotifications==='function')renderNotifications();
}
function addCalendarTask(){
  const input=document.getElementById('calendar-task-input');
  const dateInput=document.getElementById('calendar-task-date');
  if(!input||!dateInput)return;
  const text=input.value.trim();
  const dueDate=dateInput.value||dateToInputValue(state.calendarSelectedDate||state.calendarMonth||new Date());
  if(!text||!dueDate)return;
  if(!state.tasks)state.tasks=[];
  state.tasks.push({
    id:Math.random().toString(36).substr(2,9),
    text,
    done:false,
    createdAt:Date.now(),
    doneAt:null,
    dueDate
  });
  input.value='';
  dateInput.value=dueDate;
  saveState();
  if(typeof renderNotifications==='function')renderNotifications();
  refreshCalendarViews();
}
function toggleTask(id){
  const t=(state.tasks||[]).find(x=>x.id===id);
  if(!t)return;
  t.done=!t.done;
  t.doneAt=t.done?Date.now():null;
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  refreshCalendarViews();
}
function deleteTask(id){
  state.tasks=(state.tasks||[]).filter(x=>x.id!==id);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  refreshCalendarViews();
}
function clearDoneTasks(){
  state.tasks=(state.tasks||[]).filter(t=>!t.done);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function getCalendarMinMonth(){
  const today=normalizeAgendaDate(new Date())||new Date();
  return new Date(today.getFullYear(), today.getMonth()-1, 1, 12, 0, 0, 0);
}
function getCalendarMaxMonth(){
  const today=normalizeAgendaDate(new Date())||new Date();
  return new Date(today.getFullYear(), today.getMonth()+6, 1, 12, 0, 0, 0);
}
function clampCalendarMonth(date){
  const min=getCalendarMinMonth();
  const max=getCalendarMaxMonth();
  if(date < min) return new Date(min.getFullYear(), min.getMonth(), 1, 12, 0, 0, 0);
  if(date > max) return new Date(max.getFullYear(), max.getMonth(), 1, 12, 0, 0, 0);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}
function getCalendarItemToneClass(item){
  if(!item) return 'neutral';
  if(item.type==='task') return 'task';
  if(item.type==='due') return 'due';
  if(item.type==='close') return 'close';
  if(item.type==='subscription') return 'subscription';
  if(item.type==='fixed') return 'fixed';
  return 'cuota';
}
function getCalendarDayItems(dateValue){
  const selected=normalizeAgendaDate(dateValue);
  if(!selected) return [];
  return getCalendarAgendaItems(new Date(),{includePast:true,includeDoneTasks:false})
    .filter(item=>{
      const dt=normalizeAgendaDate(item.date);
      return dt && dateToInputValue(dt)===dateToInputValue(selected);
    })
    .sort((a,b)=>normalizeAgendaDate(a.date)-normalizeAgendaDate(b.date) || String(a.title||'').localeCompare(String(b.title||''),'es'));
}
function getCalendarItemMeta(item){
  const when=item.type==='task'
    ? 'Task'
    : item.type==='due'
      ? 'Vencimiento'
      : item.type==='close'
        ? 'Cierre TC'
        : item.type==='subscription'
          ? 'Suscripción'
          : item.type==='fixed'
            ? 'Gasto fijo'
            : 'Compromiso';
  const amount=item.amount?`$${fmtN(Math.round(item.amount))}`:'';
  return [when,amount].filter(Boolean).join(' · ');
}
function getCalendarAgendaItemKey(item, index){
  if(item?.taskId) return `task:${item.taskId}`;
  if(item?.subscriptionId) return `subscription:${item.subscriptionId}`;
  if(item?.fixedExpenseId) return `fixed:${item.fixedExpenseId}`;
  if(item?.manualCuotaId) return `cuota:${item.manualCuotaId}`;
  if(item?.tcCycleId) return `${item.type}:${item.tcCycleId}`;
  return `${item?.type||'item'}:${dateToInputValue(item?.date)||'nodate'}:${index}`;
}
function calendarSupportsDirectEdit(item){
  return !!(item?.taskId || item?.subscriptionId || item?.fixedExpenseId || item?.manualCuotaId);
}
function renderCalendarDayItems(items, opts={}){
  const emptyMessage=opts.emptyMessage || 'Este día está libre. Podés usarlo para programar una task.';
  if(!items.length) return `<div class="calendar-empty">${emptyMessage}</div>`;
  window._calendarAgendaItemsByKey={};
  return items.map((item, index)=>{
    const key=getCalendarAgendaItemKey(item,index);
    window._calendarAgendaItemsByKey[key]=item;
    const meta=getCalendarItemMeta(item);
    let actions='';
    if(item.type==='task'){
      actions=`<div class="calendar-item-actions">
        <button class="calendar-item-check ${item.done?'checked':''}" onclick="event.stopPropagation();toggleTask('${item.taskId}')">${item.done?'✓':''}</button>
        <button class="calendar-item-link calendar-item-secondary" onclick="event.stopPropagation();editCalendarTask('${item.taskId}')">Editar</button>
        <button class="calendar-item-delete" onclick="event.stopPropagation();deleteCalendarAgendaItem('${key}')">✕</button>
      </div>`;
    } else if(calendarSupportsDirectEdit(item)){
      actions=`<div class="calendar-item-actions">
        <button class="calendar-item-link" onclick="event.stopPropagation();editCalendarAgendaItem('${key}')">Editar</button>
        <button class="calendar-item-delete" onclick="event.stopPropagation();deleteCalendarAgendaItem('${key}')">✕</button>
      </div>`;
    } else {
      actions=`<button class="calendar-item-link" onclick="event.stopPropagation();openCalendarAgendaItem('${key}')">Abrir</button>`;
    }
    return `<div class="calendar-item-card ${getCalendarItemToneClass(item)}">
      <div class="calendar-item-main">
        <div class="calendar-item-title">${esc(item.shortLabel||item.title||'Item')}</div>
        <div class="calendar-item-meta">${meta}</div>
      </div>
      ${actions}
    </div>`;
  }).join('');
}
function setCalendarMonthOffset(offset){
  const base=normalizeAgendaDate(state.calendarMonth||new Date())||new Date();
  const next=clampCalendarMonth(new Date(base.getFullYear(),base.getMonth()+offset,1,12,0,0,0));
  if(base.getFullYear()===next.getFullYear() && base.getMonth()===next.getMonth()){
    renderCalendarPage();
    return;
  }
  state.calendarMonth=dateToInputValue(next);
  const selected=normalizeAgendaDate(state.calendarSelectedDate);
  if(!selected || selected.getMonth()!==next.getMonth() || selected.getFullYear()!==next.getFullYear()){
    state.calendarSelectedDate=dateToInputValue(next);
  }
  renderCalendarPage();
}
function jumpCalendarToToday(){
  const today=normalizeAgendaDate(new Date());
  state.calendarMonth=dateToInputValue(today);
  state.calendarSelectedDate=dateToInputValue(today);
  renderCalendarPage();
}
function selectCalendarDate(dateValue, openDetail){
  state.calendarSelectedDate=dateValue;
  renderCalendarPage();
  if(openDetail) openCalendarDayModal(dateValue);
}
function refreshCalendarViews(){
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('modal-calendar-day')?.classList.contains('open')) openCalendarDayModal(state.calendarSelectedDate||dateToInputValue(new Date()));
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function openCalendarNewTask(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  document.getElementById('modal-calendar-task-title').textContent='Nueva task';
  document.getElementById('modal-calendar-task-editing').value='';
  document.getElementById('modal-calendar-task-text').value='';
  document.getElementById('modal-calendar-task-date').value=safeDate;
  document.getElementById('btn-del-calendar-task').style.display='none';
  openModal('modal-calendar-task');
  setTimeout(()=>document.getElementById('modal-calendar-task-text')?.focus(),80);
}
function editCalendarTask(taskId){
  const task=(state.tasks||[]).find(x=>x.id===taskId);
  if(!task) return;
  closeModal('modal-calendar-day');
  document.getElementById('modal-calendar-task-title').textContent='Editar task';
  document.getElementById('modal-calendar-task-editing').value=task.id;
  document.getElementById('modal-calendar-task-text').value=task.text||'';
  document.getElementById('modal-calendar-task-date').value=task.dueDate||dateToInputValue(state.calendarSelectedDate||new Date());
  document.getElementById('btn-del-calendar-task').style.display='inline-flex';
  openModal('modal-calendar-task');
  setTimeout(()=>document.getElementById('modal-calendar-task-text')?.focus(),80);
}
function saveCalendarTaskModal(){
  const text=document.getElementById('modal-calendar-task-text').value.trim();
  const dueDate=document.getElementById('modal-calendar-task-date').value||dateToInputValue(state.calendarSelectedDate||new Date());
  const editing=document.getElementById('modal-calendar-task-editing').value||'';
  if(!text||!dueDate){ showToast('Completá la task y la fecha','warn'); return; }
  if(!state.tasks) state.tasks=[];
  if(editing){
    const task=state.tasks.find(x=>x.id===editing);
    if(task){
      task.text=text;
      task.dueDate=dueDate;
    }
  } else {
    state.tasks.push({id:Math.random().toString(36).substr(2,9),text,done:false,createdAt:Date.now(),doneAt:null,dueDate});
  }
  state.calendarSelectedDate=dueDate;
  saveState();
  closeModal('modal-calendar-task');
  refreshCalendarViews();
  if(typeof renderNotifications==='function') renderNotifications();
  showToast(editing?'Task actualizada':'Task agregada','success');
}
function deleteCalendarTaskModal(){
  const taskId=document.getElementById('modal-calendar-task-editing').value||'';
  if(!taskId) return;
  deleteTask(taskId);
  closeModal('modal-calendar-task');
  refreshCalendarViews();
}
function openCalendarSubscriptionModal(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  const dt=normalizeAgendaDate(safeDate);
  closeModal('modal-calendar-day');
  openNewSubModal();
  if(dt){
    document.getElementById('sub-day').value=dt.getDate();
    document.getElementById('sub-start-date').value=safeDate;
  }
}
function openCalendarCuotaModal(dateValue){
  const dt=normalizeAgendaDate(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  openNewCuotaModal();
  if(dt) document.getElementById('cuota-day').value=dt.getDate();
}
function openCalendarFixedModal(dateValue){
  const dt=normalizeAgendaDate(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  openNewFixedModal();
  if(dt) document.getElementById('fixed-day').value=dt.getDate();
}
function openCalendarDayModal(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  const selectedDate=normalizeAgendaDate(safeDate);
  const labelEl=document.getElementById('calendar-day-modal-label');
  const subEl=document.getElementById('calendar-day-modal-sub');
  const listEl=document.getElementById('calendar-day-modal-list');
  const dateInput=document.getElementById('calendar-day-modal-date');
  if(!selectedDate||!labelEl||!subEl||!listEl||!dateInput) return;
  const items=getCalendarDayItems(safeDate);
  const taskCount=items.filter(item=>item.type==='task').length;
  dateInput.value=safeDate;
  labelEl.textContent=selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  subEl.textContent=items.length
    ? `${items.length} item${items.length!==1?'s':''}${taskCount?` · ${taskCount} task${taskCount!==1?'s':''}`:''}`
    : 'No hay items para este día';
  listEl.innerHTML=renderCalendarDayItems(items,{emptyMessage:'No hay nada cargado para este día. Podés sumar una task o un compromiso nuevo.'});
  openModal('modal-calendar-day');
}
function openCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  if(item.page) nav(item.page);
}
function editCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  closeModal('modal-calendar-day');
  if(item.taskId) return editCalendarTask(item.taskId);
  if(item.subscriptionId) return editSub(item.subscriptionId);
  if(item.fixedExpenseId) return editFixed(item.fixedExpenseId);
  if(item.manualCuotaId) return editCuota(item.manualCuotaId);
  openCalendarAgendaItem(itemKey);
}
function deleteCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  if(item.taskId){
    if(!confirm('¿Eliminar esta task?')) return;
    deleteTask(item.taskId);
    refreshCalendarViews();
    return;
  }
  if(item.subscriptionId){
    if(!confirm('¿Eliminar esta suscripción?')) return;
    requestDeleteSubscription(item.subscriptionId, ok=>{ if(!ok) return; refreshCalendarViews(); showToast('Suscripción eliminada','info'); });
    return;
  }
  if(item.fixedExpenseId){
    if(!confirm('¿Eliminar este gasto fijo?')) return;
    state.fixedExpenses=(state.fixedExpenses||[]).filter(f=>f.id!==item.fixedExpenseId);
    saveState();
    refreshCalendarViews();
    showToast('Gasto fijo eliminado','info');
    return;
  }
  if(item.manualCuotaId){
    if(!confirm('¿Eliminar esta cuota?')) return;
    requestDeleteCuota(item.manualCuotaId, ok=>{ if(!ok) return; refreshCalendarViews(); showToast('Cuota eliminada','info'); });
    return;
  }
}
function renderCalendarPage(){
  const page=document.getElementById('page-calendar');
  if(!page) return;
  const baseMonth=clampCalendarMonth(normalizeAgendaDate(state.calendarMonth||new Date())||normalizeAgendaDate(new Date()));
  const monthStart=new Date(baseMonth.getFullYear(),baseMonth.getMonth(),1,12,0,0,0);
  const monthEnd=new Date(baseMonth.getFullYear(),baseMonth.getMonth()+1,0,12,0,0,0);
  const monthLabel=document.getElementById('calendar-month-label');
  const gridEl=document.getElementById('calendar-grid');
  const selectedLabelEl=document.getElementById('calendar-selected-label');
  const selectedSubEl=document.getElementById('calendar-selected-sub');
  const dayListEl=document.getElementById('calendar-day-list');
  const upcomingEl=document.getElementById('calendar-upcoming-list');
  const taskDateEl=document.getElementById('calendar-task-date');
  const prevBtn=document.getElementById('calendar-prev-btn');
  const nextBtn=document.getElementById('calendar-next-btn');
  if(!gridEl||!selectedLabelEl||!selectedSubEl||!dayListEl||!upcomingEl) return;

  state.calendarMonth=dateToInputValue(monthStart);
  if(prevBtn){
    const minMonth=getCalendarMinMonth();
    prevBtn.disabled=monthStart.getFullYear()===minMonth.getFullYear() && monthStart.getMonth()===minMonth.getMonth();
  }
  if(nextBtn){
    const maxMonth=getCalendarMaxMonth();
    nextBtn.disabled=monthStart.getFullYear()===maxMonth.getFullYear() && monthStart.getMonth()===maxMonth.getMonth();
  }
  if(monthLabel){
    monthLabel.textContent=monthStart.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  }

  const allItems=getCalendarAgendaItems(new Date(),{includePast:true,includeDoneTasks:false});
  const monthItems=allItems.filter(item=>{
    const dt=normalizeAgendaDate(item.date);
    return dt && dt.getMonth()===monthStart.getMonth() && dt.getFullYear()===monthStart.getFullYear();
  });
  const itemsByDay=new Map();
  monthItems.forEach(item=>{
    const key=dateToInputValue(item.date);
    if(!itemsByDay.has(key)) itemsByDay.set(key,[]);
    itemsByDay.get(key).push(item);
  });

  const selectedDate=normalizeAgendaDate(
    state.calendarSelectedDate && normalizeAgendaDate(state.calendarSelectedDate)?.getMonth()===monthStart.getMonth() && normalizeAgendaDate(state.calendarSelectedDate)?.getFullYear()===monthStart.getFullYear()
      ? state.calendarSelectedDate
      : monthStart
  ) || monthStart;
  state.calendarSelectedDate=dateToInputValue(selectedDate);
  if(taskDateEl) taskDateEl.value=state.calendarSelectedDate;

  const startWeekday=(monthStart.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<startWeekday;i++) cells.push(null);
  for(let d=1;d<=monthEnd.getDate();d++){
    cells.push(new Date(monthStart.getFullYear(),monthStart.getMonth(),d,12,0,0,0));
  }
  while(cells.length%7!==0) cells.push(null);

  gridEl.innerHTML=cells.map((cell,idx)=>{
    if(!cell) return `<div class="calendar-cell calendar-cell-empty" aria-hidden="true"></div>`;
    const key=dateToInputValue(cell);
    const items=itemsByDay.get(key)||[];
    const isToday=key===dateToInputValue(new Date());
    const isSelected=key===state.calendarSelectedDate;
    const itemCount=items.length;
    const priorities=['due','close','subscription','fixed','task'];
    const primaryType=priorities.find(type=>items.some(item=>item.type===type)) || (items[0]?.type || '');
    const toneClass=items.length?`has-${getCalendarItemToneClass({type:primaryType})}`:'';
    const preview=items.slice(0,2).map(item=>`<span class="calendar-chip ${getCalendarItemToneClass(item)}">${esc((item.shortLabel||item.title||'').slice(0,18))}</span>`).join('');
    return `<button class="calendar-cell ${isToday?'is-today':''} ${isSelected?'is-selected':''} ${toneClass}" onclick="selectCalendarDate('${key}', true)">
      <span class="calendar-cell-day">${cell.getDate()}</span>
      ${itemCount?`<span class="calendar-cell-count">${itemCount}</span>`:''}
      <span class="calendar-cell-preview">${preview}</span>
    </button>`;
  }).join('');

  const selectedItems=(itemsByDay.get(state.calendarSelectedDate)||[]).sort((a,b)=>normalizeAgendaDate(a.date)-normalizeAgendaDate(b.date));
  selectedLabelEl.textContent=selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  const selectedTasks=selectedItems.filter(item=>item.type==='task').length;
  selectedSubEl.textContent=selectedItems.length
    ? `${selectedItems.length} item${selectedItems.length!==1?'s':''}${selectedTasks?` · ${selectedTasks} task${selectedTasks!==1?'s':''}`:''}`
    : 'No hay items para este día';
  dayListEl.innerHTML=renderCalendarDayItems(selectedItems);

  const upcoming=getCalendarAgendaItems(new Date(),{includePast:false,includeDoneTasks:false}).slice(0,8);
  upcomingEl.innerHTML=upcoming.length ? upcoming.map(item=>{
    const dt=normalizeAgendaDate(item.date);
    const when=item.days===0?'Hoy':item.days===1?'Mañana':`En ${item.days} días`;
    return `<div class="calendar-upcoming-item ${getCalendarItemToneClass(item)}">
      <div class="calendar-upcoming-date">${dt?dt.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.',''):'—'}</div>
      <div class="calendar-upcoming-copy">
        <div class="calendar-upcoming-title">${esc(item.shortLabel||item.title||'Item')}</div>
        <div class="calendar-upcoming-meta">${when}</div>
      </div>
    </div>`;
  }).join('') : '<div class="calendar-empty">No hay nada próximo en la agenda.</div>';
}
// Botones Mes / VISA / AMEX del dashboard
