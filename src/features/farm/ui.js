import { formatMass,formatCoins,workerLevel,workerStat,workerWage,contractPlan,contractPrice,contractLeft,WORK_DAY_MS,WORKER_CANDIDATES,packPrice } from './rules.js';
import { clock } from '../../ui/incidents.js';
import { editDragSelection } from './tools.js';
import { CROPS, TOOLS, xpForLevel } from './content.js';
import { flyTo, popNumber } from '../../shared/vfx/index.js';
import { sfx } from '../../shared/audio/index.js';
import { icon as iconNode, iconFor } from '../../ui/icons.js';
import { mountHudDrawer } from '../../ui/hud-drawer.js';
import { usesTouch } from '../../ui/dialogue.js';
import { t as tr, formatNumber } from '../../i18n/index.js';
const gameIcon = icon => ({'✦':'👆','❧':'🌱','◒':'💧','⌁':'🌿','✚':'🪴','♧':'🧺','▣':'🎒','▧':'🏡','☀':'☀️','◇':'📦','₫':'🪙','♨':'🔥','⚙':'⚙️'}[icon] || icon);
const $ = id => document.getElementById(id);
const isRobot = id => WORKER_CANDIDATES.some(c=>c.id===id&&c.kind==='robot');
// Sự cố đã kích hoạt (contracts mục 6): mải chơi còn waitUntil, ốm còn restUntil.
const phoneOf = (w,now) => w.incident?.type==='phone'&&w.incident.done&&w.waitUntil>now;
const sickOf = (w,now) => w.incident?.type==='sick'&&w.incident.done&&w.restUntil>now;

export function createFarmUI(callbacks) {
  const events = new AbortController(), options = { signal: events.signal };
  const purchaseQuantities=new Map();
  const operationEvents=[];let previousBlockers=new Map();
  let modalStructureKey = '';
  let modalKey = '', restoreFocus = null;
  // Trạng thái mở chỉ đọc từ thuộc tính hidden: cờ riêng từng lệch với DOM làm modal() bỏ qua bước hiện.
  const isModalOpen = () => !$('farm-modal').hidden;
  // Coin counter bumps on change (not on first paint): green when it grows, red when spent (04 §5 resource counter).
  let shownCoins = null;
  function showCoins(value) {
    const node = $('farm-coins'), text = formatCoins(Math.floor(value)); // HUD shows whole coins; the balance keeps its fraction
    if (node.textContent === text) return;
    node.textContent = text;
    if (shownCoins !== null) { const chip = node.parentElement; chip.dataset.trend = value > shownCoins ? 'up' : 'down'; chip.classList.remove('is-bump'); void chip.offsetWidth; chip.classList.add('is-bump'); }
    shownCoins = value;
  }
  let noticeUntil = 0, currentEntries = [], bagCategory = 'all', seedKey = '', bagSelection = null;
  let lastProgress = null, giftLinePending = false; // lastProgress = p của lần hud() gần nhất
  const seedStrip = document.createElement('section'); seedStrip.id = 'farm-seed-strip'; seedStrip.hidden = true; seedStrip.setAttribute('aria-label',tr('farm.ui.seedStripAria')); document.body.append(seedStrip);
  function syncSeedArrows(){
    const row=seedStrip.querySelector('.farm-seed-row'),left=seedStrip.querySelector('[data-scroll="left"]'),right=seedStrip.querySelector('[data-scroll="right"]');
    if(!row||!left||!right)return;left.disabled=row.scrollLeft<=1;right.disabled=row.scrollLeft+row.clientWidth>=row.scrollWidth-1;
  }
  const seedResize=new ResizeObserver(syncSeedArrows);seedResize.observe(seedStrip);
  const toolsPrompt = document.createElement('button'); toolsPrompt.id = 'farm-tools-prompt'; toolsPrompt.type = 'button'; toolsPrompt.hidden = true;
  toolsPrompt.textContent = '⛏️'; toolsPrompt.setAttribute('aria-label',tr('farm.blocker.openTools')); toolsPrompt.setAttribute('aria-haspopup','true');
  toolsPrompt.addEventListener('click',callbacks.tools,options); document.body.append(toolsPrompt);
  const operationHud=document.createElement('div');operationHud.id='farm-operation-hud';operationHud.setAttribute('aria-live','off');$('farm-hud').append(operationHud);
  const management=document.createElement('nav');management.id='farm-management';management.setAttribute('aria-label',tr('farm.ui.managementAria'));
  for(const [id,icon,label] of [['workers','👩‍🌾',tr('farm.blocker.staff')],['order-board','📦',tr('farm.ui.orders')],['build','🏡',tr('farm.ui.build')],['settings','⚙️',tr('farm.ui.settings')],['cafe-play','☕',tr('farm.blocker.goCafe')]]){const button=document.createElement('button');button.type='button';button.dataset.shortcut=id;if(id!=='cafe-play')button.dataset.sfx='none';const graphic=document.createElement('span');graphic.textContent=icon;const text=document.createElement('small');text.textContent=label;button.append(graphic,text);button.addEventListener('click',()=>callbacks.shortcut(id),options);management.append(button);}$('farm-shortcuts').append(management);
  // HUD buttons that open progressively (HUD_UNLOCKS ids in content.js); grabbed before quickNav moves some of them.
  const unlockButtons={'cafe-play':management.querySelector('[data-shortcut="cafe-play"]'),'seed-shop':$('farm-shop-toggle'),'order-board':management.querySelector('[data-shortcut="order-board"]'),upgrades:$('farm-upgrade-toggle'),workers:management.querySelector('[data-shortcut="workers"]'),build:management.querySelector('[data-shortcut="build"]')};
  for(const button of Object.values(unlockButtons))button.hidden=true;
  const panelOff={journal:false,blockers:false}; // player switches in Settings → Hiển thị
  let openedParts=new Set();
  const coachBox=document.createElement('p');coachBox.className='ui-coach';coachBox.setAttribute('role','status');coachBox.hidden=true;const coachText=document.createElement('span'),coachClose=document.createElement('button');
  coachClose.type='button';coachClose.className='ui-coach__close';coachClose.textContent='×';coachClose.setAttribute('aria-label',tr('farm.ui.hideCoach'));coachBox.append(coachText,coachClose);document.body.append(coachBox);let coachDone=null;
  coachClose.addEventListener('click',()=>coachDone?.(),options);
  const guideHint=document.createElement('p');guideHint.className='ui-guide-hint';
  const menuToggle=document.createElement('button');menuToggle.id='farm-menu-toggle';menuToggle.type='button';menuToggle.setAttribute('aria-controls','farm-main-nav');document.body.append(menuToggle);
  function setMenuOpen(open){document.body.classList.toggle('farm-menu-open',open);menuToggle.textContent=open?'›':'‹';menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?tr('farm.ui.collapseMenu'):tr('farm.ui.openMenu'));}
  setMenuOpen(true);
  menuToggle.addEventListener('click',()=>setMenuOpen(!document.body.classList.contains('farm-menu-open')),options);
  $('farm-help-toggle').querySelector('span').textContent='📖';
  const profileButton=document.querySelector('.farm-profile');
  profileButton.addEventListener('click',()=>callbacks.shortcut('center'),options);
  profileButton.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callbacks.shortcut('center');}},options);
  const viewControls=$('farm-view-controls');
  const journalPanel=document.createElement('details');journalPanel.id='farm-journal';journalPanel.hidden=true;const journalTitle=document.createElement('summary');journalTitle.textContent=tr('farm.ui.journalTitle');const journalBody=document.createElement('div');journalPanel.append(journalTitle,journalBody);document.body.append(journalPanel);let journalKey='',journalWorkerRows=[];
  const primaryNav=document.createElement('nav');primaryNav.id='farm-main-nav';primaryNav.setAttribute('aria-label',tr('farm.ui.mainMenu'));
  // Bottom menu: at most 6 buttons (Kho, Cửa hàng, Nâng cấp, Nhân viên, Đơn hàng, Xây dựng), no sideways scrolling.
  for(const [id,symbol,label]of [['farm-bag-toggle','🎒',tr('farm.ui.storage')],['farm-shop-toggle','🏪',tr('farm.tool.shop')],['farm-upgrade-toggle','🔧',tr('farm.ui.upgrade')]]){const button=$(id);button.replaceChildren();const icon=document.createElement('span');icon.textContent=symbol;const text=document.createElement('small');text.textContent=label;button.append(icon,text);primaryNav.append(button);}primaryNav.append($('farm-shortcuts'));document.body.append(primaryNav);
  const blockerPanel=document.createElement('details');blockerPanel.id='farm-blockers';blockerPanel.hidden=true;const blockerTitle=document.createElement('summary'),blockerBody=document.createElement('div');blockerPanel.append(blockerTitle,blockerBody);blockerTitle.addEventListener('animationend',()=>blockerTitle.classList.remove('ui-attention'),options);document.querySelector('.farm-left-hud').append(operationHud,blockerPanel);let blockersKey='';
  const quickNav=document.createElement('nav');quickNav.id='farm-quick-nav';quickNav.setAttribute('aria-label',tr('farm.ui.quickNav'));quickNav.append(management.querySelector('[data-shortcut="settings"]'),management.querySelector('[data-shortcut="cafe-play"]'),$('farm-help-toggle'));
  const rightHud=document.createElement('div');rightHud.id='farm-right-hud';rightHud.append(document.querySelector('.farm-resources'),quickNav);$('farm-hud').append(rightHud);document.querySelector('.farm-left-hud').append(journalPanel);
  // HUD v2 (docs/shared/design-system.md §6): bar = Kho, Cửa hàng, Vào quán, Quản lý; the rest moves into the drawer (same nodes).
  const drawer=mountHudDrawer(primaryNav,{signal:events.signal,id:'farm-drawer'});
  primaryNav.insertBefore(quickNav.querySelector('[data-shortcut="cafe-play"]'),$('farm-shortcuts'));
  drawer.grid.append($('farm-upgrade-toggle'),management,$('farm-help-toggle'),quickNav.querySelector('[data-shortcut="settings"]'));
  drawer.panel.append(operationHud,blockerPanel,journalPanel);
  let toolDrag=null,ignoreSeedClickUntil=0;
  const ghost=document.createElement('div');ghost.id='farm-drag-tool';ghost.hidden=true;document.body.append(ghost);
  seedStrip.addEventListener('dragstart',event=>event.preventDefault(),options);
  seedStrip.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button[data-drag-action]');
    if(!button || button.disabled || event.button!==0 || !event.isPrimary)return;
    toolDrag={id:event.pointerId,x:event.clientX,y:event.clientY,button,action:button.dataset.dragAction,cropId:button.dataset.cropId || null,icon:button.dataset.dragIcon,limit:callbacks.dragLimit(button.dataset.dragAction,button.dataset.cropId || null),ids:[],moved:false};
    event.preventDefault();button.setPointerCapture(event.pointerId);
  },options);
  document.addEventListener('pointermove',event=>{
    if(!toolDrag || event.pointerId!==toolDrag.id)return;
    if(!toolDrag.moved && Math.hypot(event.clientX-toolDrag.x,event.clientY-toolDrag.y)<8)return;
    if(!toolDrag.moved){toolDrag.moved=true;callbacks.dragStart();}
    event.preventDefault();ghost.hidden=false;ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;
    toolDrag.limit=Math.min(toolDrag.limit,callbacks.dragLimit(toolDrag.action,toolDrag.cropId));
    const id=callbacks.previewDrop(event.clientX,event.clientY,toolDrag.action,toolDrag.cropId);
    const valid=Boolean(id) && (toolDrag.ids.includes(id) || toolDrag.ids.length<toolDrag.limit);
    toolDrag.ids=editDragSelection(toolDrag.ids,id,toolDrag.limit);callbacks.dragSelection(toolDrag.ids);
    const full=toolDrag.ids.length>=toolDrag.limit;ghost.dataset.invalid=String(!valid);
    ghost.textContent=`${!valid ? '🚫 ' : ''}${toolDrag.icon} ${toolDrag.ids.length}/${toolDrag.limit}${full ? tr('farm.ui.dragFull') : ''}`;
  },{...options,passive:false,capture:true});
  function endToolDrag(event) {
    if(!toolDrag || event.pointerId!==toolDrag.id)return;
    const task=toolDrag;
    if(task.moved && event.type==='pointerup') {
      const id=callbacks.previewDrop(event.clientX,event.clientY,task.action,task.cropId);
      task.ids=editDragSelection(task.ids,id,Math.min(task.limit,callbacks.dragLimit(task.action,task.cropId)));
      callbacks.dragSelection(task.ids);
    }
    toolDrag=null;ghost.hidden=true;
    if(task.button.hasPointerCapture(event.pointerId))task.button.releasePointerCapture(event.pointerId);
    if(task.moved){ignoreSeedClickUntil=performance.now()+400;
      const returned=seedStrip.contains(document.elementFromPoint(event.clientX,event.clientY));
      if(event.type==='pointerup' && !returned && task.ids.length)callbacks.dropTool(task.action,task.cropId,task.ids);
      else callbacks.dragCancel();
    }
  }
  document.addEventListener('pointerup',endToolDrag,{...options,capture:true});
  document.addEventListener('pointercancel',endToolDrag,{...options,capture:true});
  document.addEventListener('lostpointercapture',endToolDrag,options);

  const tabs = document.createElement('nav'); tabs.id = 'farm-bag-tabs'; tabs.setAttribute('aria-label', tr('farm.ui.itemGroups'));
  $('farm-modal-items').before(tabs);
  const workerSheet=document.createElement('section');workerSheet.id='farm-worker-sheet';workerSheet.hidden=true;$('farm-modal-items').before(workerSheet);
  const stationPanel=document.createElement('section');stationPanel.id='farm-station-panel';stationPanel.hidden=true;tabs.before(stationPanel);
  const bagDetail=document.createElement('div');bagDetail.id='farm-bag-detail';bagDetail.hidden=true;$('farm-modal-items').after(bagDetail);
  function renderBagDetail() {
    bagDetail.hidden=$('farm-modal').dataset.kind !== 'bag';if(bagDetail.hidden)return;
    const visible=currentEntries.filter(entry=>bagCategory==='all'||entry.category===bagCategory);
    const entry=visible.find(item=>item.id===bagSelection)||visible[0];bagSelection=entry?.id;
    bagDetail.replaceChildren();
    const name=document.createElement('strong');name.textContent=entry?.label || tr('farm.ui.bagEmpty');
    const text=document.createElement('small');text.textContent=entry ? tr('farm.ui.bagQuantity',{n:entry.quantity,detail:entry.detail}) : tr('farm.ui.bagEmptyDetail');
    bagDetail.append(name,text);
    if(entry?.bagSale){
      const bar=document.createElement('div');bar.className='farm-purchase-bar farm-sale-bar';
      const minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),sell=document.createElement('button'),quoteText=document.createElement('small');
      minus.type=plus.type=sell.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label',tr('farm.ui.gramsLess'));plus.setAttribute('aria-label',tr('farm.ui.gramsMore'));
      input.type='number';input.min='1';input.max=entry.bagSale.owned;input.step='1';input.setAttribute('aria-label',tr('farm.ui.gramsToSell'));input.value=Math.min(entry.bagSale.keep?Math.max(1,entry.bagSale.owned-entry.bagSale.keep):entry.bagSale.owned,purchaseQuantities.get(entry.id)||entry.bagSale.owned);
      quoteText.className='farm-bag-sale-quote';sell.className='farm-purchase-buy ui-btn ui-btn--gold';sell.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span>';sell.append(Object.assign(document.createElement('span'),{textContent:tr('farm.ui.sell')}));
      function update(value,typing){const grams=Math.max(1,Math.min(entry.bagSale.owned,Math.floor(Number(value)||1)));if(!typing)input.value=grams;purchaseQuantities.set(entry.id,grams);minus.disabled=grams===1;plus.disabled=grams>=entry.bagSale.owned;const quote=callbacks.saleQuote(entry.id,grams);sell.disabled=!quote.ok;quoteText.textContent=quote.ok?tr('farm.ui.bagQuote',{mass:formatMass(grams),value:formatCoins(quote.value)})+(quote.discounted?tr('farm.ui.bagQuoteDiscount',{full:formatCoins(quote.full)}):''):quote.message;}
      minus.addEventListener('click',()=>update(Number(input.value)-1));plus.addEventListener('click',()=>update(Number(input.value)+1));input.addEventListener('input',()=>{if(input.value!=='')update(input.value,true);});input.addEventListener('change',()=>update(input.value));sell.addEventListener('click',()=>callbacks.sell(entry.id,purchaseQuantities.get(entry.id)));
      bar.append(minus,input,plus,sell);bagDetail.append(quoteText,bar);update(input.value);
    }

    for(const slot of $('farm-modal-items').querySelectorAll('button'))slot.setAttribute('aria-pressed',String(slot.dataset.entry===bagSelection));
  }
  const dismissDialog=document.createElement('dialog');dismissDialog.className='farm-dismiss-dialog';
  const dismissTitle=document.createElement('h3'),dismissText=document.createElement('p'),dismissActions=document.createElement('div'),dismissCancel=document.createElement('button'),dismissConfirm=document.createElement('button');
  const dismissArt=document.createElement('div');dismissArt.className='farm-dialog-art';dismissArt.textContent='👩‍🌾';dismissArt.setAttribute('aria-hidden','true');
  dismissTitle.textContent=tr('farm.ui.dismissTitle');dismissCancel.textContent=tr('farm.ui.dismissKeep');dismissConfirm.textContent=tr('farm.ui.dismissConfirm');dismissCancel.type=dismissConfirm.type='button';dismissActions.append(dismissCancel,dismissConfirm);dismissActions.className='farm-dialog-actions';dismissDialog.append(dismissTitle,dismissArt,dismissText,dismissActions);document.body.append(dismissDialog);
  let dismissId=null;
  dismissCancel.addEventListener('click',()=>dismissDialog.close(),options);
  dismissConfirm.addEventListener('click',()=>{const id=dismissId;dismissDialog.close();if(id)callbacks.shortcut(`dismiss-worker:${id}`);},options);
  function showDismiss(staff){dismissId=staff.id.slice(8);const robot=isRobot(dismissId);dismissArt.textContent=robot?'🤖':'👩‍🌾';dismissText.textContent=tr(robot?'farm.ui.dismissRobot':'farm.ui.dismissHuman',{name:staff.label});dismissConfirm.disabled=false;dismissDialog.showModal();dismissCancel.focus();}
  const tradeDialog=document.createElement('dialog');tradeDialog.className='farm-dismiss-dialog farm-trade-dialog';
  const tradeTitle=document.createElement('h3'),tradeText=document.createElement('p'),tradeArt=document.createElement('div'),tradeClose=document.createElement('button'),tradeActions=document.createElement('div'),tradeCancel=document.createElement('button'),tradeConfirm=document.createElement('button');
  tradeArt.className='farm-trade-art';tradeArt.setAttribute('aria-hidden','true');tradeClose.type='button';tradeClose.className='farm-trade-close';tradeClose.textContent='×';tradeClose.setAttribute('aria-label',tr('farm.ui.closeConfirm'));tradeCancel.type=tradeConfirm.type='button';tradeCancel.textContent=tr('farm.ui.later');tradeConfirm.textContent=tr('farm.ui.confirm');tradeActions.className='farm-trade-actions';tradeActions.append(tradeCancel,tradeConfirm);tradeDialog.append(tradeClose,tradeTitle,tradeArt,tradeText,tradeActions);document.body.append(tradeDialog);
  let tradeAction=null;
  tradeCancel.addEventListener('click',()=>tradeDialog.close(),options);tradeClose.addEventListener('click',()=>tradeDialog.close(),options);
  tradeDialog.addEventListener('close',()=>{tradeAction=null;},options);
  tradeConfirm.addEventListener('click',()=>{const action=tradeAction;tradeAction=null;tradeConfirm.disabled=true;tradeDialog.close();action?.();},options);
  function staffDragPreview(card){
    const source=card.closest('.farm-staff-tile'),clone=source.cloneNode(true),rect=source.getBoundingClientRect();
    function copyStyle(from,to){const style=getComputedStyle(from);for(const key of style)to.style.setProperty(key,style.getPropertyValue(key));to.removeAttribute('id');for(let i=0;i<from.children.length;i++)copyStyle(from.children[i],to.children[i]);}
    copyStyle(source,clone);clone.classList.add('farm-staff-drag');clone.style.cssText+=';position:fixed;z-index:100;pointer-events:none;';clone.style.width=`${rect.width}px`;clone.style.height=`${rect.height}px`;clone.style.margin='0';clone.style.opacity='.95';clone.style.transform='rotate(-3deg)';clone.setAttribute('aria-hidden','true');clone.inert=true;return clone;
  }
  let staffDrag=null,staffIgnoreClickUntil=0;
  document.addEventListener('pointermove',event=>{
    if(!staffDrag||event.pointerId!==staffDrag.pointer)return;
    if(!staffDrag.ghost&&Math.hypot(event.clientX-staffDrag.x,event.clientY-staffDrag.y)<8)return;
    if(!staffDrag.ghost){staffDrag.ghost=staffDragPreview(staffDrag.card);document.body.append(staffDrag.ghost);staffDrag.card.classList.add('farm-staff-lifted');document.body.classList.add('farm-staff-dragging');}
    document.querySelectorAll('.farm-staff-drop-hover').forEach(node=>node.classList.remove('farm-staff-drop-hover'));
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-staff-drop]');
    const valid=target&&(target.dataset.staffDrop==='main'?!staffDrag.card.dataset.staffDrop&&target.dataset.worker!==staffDrag.id:staffDrag.card.dataset.staffDrop==='main');
    if(valid)target.classList.add('farm-staff-drop-hover');
    event.preventDefault();staffDrag.ghost.style.left=`${event.clientX+12}px`;staffDrag.ghost.style.top=`${event.clientY+12}px`;
  },{...options,passive:false});
  function finishStaffDrag(event){
    if(!staffDrag||event.pointerId!==staffDrag.pointer)return;
    const drag=staffDrag;staffDrag=null;drag.ghost?.remove();drag.card.classList.remove('farm-staff-lifted');document.body.classList.remove('farm-staff-dragging');document.querySelectorAll('.farm-staff-drop-hover').forEach(node=>node.classList.remove('farm-staff-drop-hover'));
    if(!drag.ghost)return;staffIgnoreClickUntil=performance.now()+400;
    if(event.type==='pointercancel')return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-staff-drop]');
    const valid=target&&(target.dataset.staffDrop==='main'?!drag.card.dataset.staffDrop&&target.dataset.worker!==drag.id:drag.card.dataset.staffDrop==='main');
    if(!valid)return;
    const result=callbacks.staffMove({id:drag.id,deploy:target.dataset.staffDrop==='main',replaceId:target.dataset.worker||null});
    if(result?.ok){
      for(const card of $('farm-modal-items').querySelectorAll('.farm-staff-card'))if([drag.id,target.dataset.worker].includes(card.dataset.worker))card.classList.add('farm-staff-swapped');
      const message=document.createElement('p');message.className='farm-staff-swap-message';message.textContent='✓ '+result.message;
      $('farm-modal-items').prepend(message);
    }
  }
  document.addEventListener('pointerup',finishStaffDrag,options);document.addEventListener('pointercancel',finishStaffDrag,options);
  function formatMassIfNeeded(value,unit){return unit.startsWith('g')?`${formatMass(value)}${unit.includes('/')?'/'+unit.split('/')[1]:''}`:`${formatNumber(value)} ${unit}`;}
  let tabsKey = '';
  function configureTabs(filters) {
    const key = JSON.stringify(filters); if (tabsKey === key) return;
    $('farm-modal').dataset.tabbed=String(filters.length>0);
    tabsKey = key; bagCategory=filters.some(([id])=>id===bagCategory)?bagCategory:filters.some(([id])=>id==='all')?'all':filters[0]?.[0]||'all';tabs.replaceChildren(); tabs.hidden = !filters.length;
    for (const [id,label] of filters) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.category = id;
      button.addEventListener('click',()=>{bagCategory=id;filterBag();$('farm-modal-items').scrollTop=0;}); tabs.append(button);
    }
  }
  function filterBag() {
    $('farm-modal').dataset.staffTab=bagCategory;
    for (const item of $('farm-modal-items').children) item.hidden = !item.classList.contains('farm-bag-empty') && !tabs.hidden && bagCategory !== 'all' && item.dataset.category !== bagCategory;
    if($('farm-modal').dataset.kind==='jobs'){
      let help=$('farm-modal-items').querySelector('.farm-jobs-help');
      if(!help){help=document.createElement('p');help.className='farm-jobs-help';$('farm-modal-items').prepend(help);}
      help.textContent=$('farm-modal-title').textContent===tr('farm.ui.dailyTitle')?tr('farm.ui.jobsHelpDaily'):bagCategory==='transit'?tr('farm.ui.jobsHelpTransit'):bagCategory==='ready'?tr('farm.ui.jobsHelpReady'):tr('farm.ui.jobsHelpPending');
      // The café order list has no tabs and writes its own status per row, so the tab hints would only mislead there.
      const untabbed=$('farm-modal-title').textContent===tr('farm.menu.orders.title');
      help.hidden=untabbed;
      let empty=$('farm-modal-items').querySelector('.farm-jobs-empty');
      if(!empty){empty=document.createElement('p');empty.className='farm-jobs-empty';$('farm-modal-items').append(empty);}
      empty.textContent=$('farm-modal-title').textContent===tr('farm.ui.dailyTitle')?tr('farm.ui.jobsEmptyDaily'):bagCategory==='transit'?tr('farm.ui.jobsEmptyTransit'):bagCategory==='ready'?tr('farm.ui.jobsEmptyReady'):tr('farm.ui.jobsEmptyPending');
      empty.hidden=untabbed||[...$('farm-modal-items').children].some(item=>item.matches('button')&&!item.hidden);
    }
    for (const button of tabs.children) button.setAttribute('aria-pressed',String(button.dataset.category === bagCategory));
    workerSheet.hidden=$('farm-modal').dataset.kind!=='worker'||(workerSheet.dataset.profile!=='candidate'&&bagCategory!=='training');
    renderBagDetail();
  }
  document.body.classList.add('farm-active');
  $('farm-hud').hidden = false; $('farm-toolbelt').hidden = true;
  $('game').setAttribute('aria-label',tr('farm.aria.farm'));
  $('farm-tools').replaceChildren();
  for (const tool of TOOLS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.tool = tool.id;
    button.title = `${tool.name} · ${tool.help}`; button.setAttribute('aria-label', tool.name);
    const icon = document.createElement('span'); icon.textContent = gameIcon(tool.icon);
    const name = document.createElement('small'); name.textContent = tool.name;
    button.append(icon, name); button.addEventListener('click', () => callbacks.tool(tool.id), options); $('farm-tools').append(button);
  }
  $('farm-bag-toggle').addEventListener('click', callbacks.bag, options);
  document.querySelector('.farm-coin').addEventListener('click',()=>callbacks.shortcut('seed-shop'),options);
  for (const [button, id] of [['farm-help-toggle','help'],['farm-shop-toggle','seed-shop'],['farm-upgrade-toggle','upgrades'],['farm-zoom-in','zoom-in'],['farm-zoom-out','zoom-out']]) {
    $(button).addEventListener('click', () => callbacks.shortcut(id), options);
    if (!id.startsWith('zoom')) $(button).dataset.sfx = 'none'; // modal() tự kêu ui.open, tránh kêu đôi
  }
  $('farm-bag-toggle').dataset.sfx = 'none'; document.querySelector('.farm-coin').dataset.sfx = 'none';
  const backButton=document.createElement('button');backButton.id='farm-modal-back';backButton.type='button';backButton.textContent='‹';backButton.hidden=true;backButton.setAttribute('aria-label',tr('farm.ui.backToStaff'));backButton.title=tr('farm.ui.staffList');$('farm-modal-close').parentElement.prepend(backButton);
  backButton.addEventListener('click',()=>callbacks.back(),options);
  const profileAlert=document.createElement('div');profileAlert.id='farm-profile-alert';profileAlert.hidden=true;
  const profileAlertText=document.createElement('span'),profilePay=document.createElement('button');profilePay.type='button';profilePay.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span>';profilePay.append(Object.assign(document.createElement('span'),{textContent:tr('farm.ui.payWage')}));
  profileAlert.append(profileAlertText,profilePay);backButton.parentElement.after(profileAlert);
  const profileSummary=document.createElement('p');profileSummary.id='farm-profile-summary';profileSummary.hidden=true;profileAlert.after(profileSummary);
  profilePay.addEventListener('click',()=>callbacks.shortcut(`pay-worker:${profilePay.dataset.worker}`),options);

  $('farm-modal-close').addEventListener('click', () => callbacks.close(), options);
  $('farm-modal').addEventListener('click', event => { if (event.target === $('farm-modal')) callbacks.close(); }, options);
  function closeModal(silent=false) {
    const wasOpen=isModalOpen();
    if(dismissDialog.open)dismissDialog.close();if(tradeDialog.open)tradeDialog.close();
    staffDrag?.ghost?.remove();staffDrag=null;document.body.classList.remove('farm-staff-dragging');document.querySelectorAll('.farm-staff-drop-hover,.farm-staff-lifted').forEach(node=>node.classList.remove('farm-staff-drop-hover','farm-staff-lifted'));
    if(toolDrag){const drag=toolDrag;toolDrag=null;ghost.hidden=true;if(drag.button.hasPointerCapture(drag.id))drag.button.releasePointerCapture(drag.id);ignoreSeedClickUntil=performance.now()+400;}
    modalKey = ''; currentEntries = [];
    seedStrip.hidden = true; seedKey = '';
    $('farm-modal').hidden = true; $('farm-toolbelt').hidden = true; $('heaven-controls').hidden = false;
    if(wasOpen&&silent!==true)sfx('ui.close');
    if (restoreFocus?.isConnected && !restoreFocus.closest('[hidden]')) restoreFocus.focus({ preventScroll: true });
    else $('game').focus({ preventScroll: true });
    restoreFocus = null;
  }
  return {
    decorationDetails(item,spec,onBuild,onDemolish){
      const entries=[];
      if(item.state==='construction')entries.push({id:'resume-decoration',label:tr('farm.ui.decorResume'),detail:tr('farm.ui.decorResumeDetail',{pct:Math.floor(item.buildMs/item.buildDuration*100)}),icon:'🔨',badge:tr('farm.ui.decorResumeBtn'),onChoose:()=>{this.closeModal();onBuild();}});
      entries.push({id:'demolish-decoration',label:tr('farm.ui.demolish'),detail:tr('farm.ui.demolishDetail'),icon:'🪓',badge:tr('farm.ui.demolish'),onChoose:()=>{this.closeModal();this.confirmTrade(tr('farm.ui.demolishTitle'),tr('farm.ui.demolishBody',{name:spec.name}),onDemolish,spec.icon,'demolish');}});
      this.modal({title:spec.name,subtitle:item.state==='construction'?tr('farm.ui.decorInProgress'):tr('farm.ui.decorDone'),icon:spec.icon,kind:'confirm',entries,footer:''});
    },
    // kind: 'demolish' | 'build' | 'buy' | 'accept' | 'upgrade' | 'sell' (mặc định) — chọn nhãn nút xác nhận, không dò theo chữ tiêu đề.
    confirmTrade(title,text,action,itemIcon=null,kind='sell'){tradeTitle.textContent=title;tradeText.textContent=text;const buying=kind==='buy';tradeArt.textContent=gameIcon(itemIcon||currentEntries.find(entry=>text.includes(entry.label))?.icon||(buying?'🌱':'📦'));tradeConfirm.textContent=tr(`farm.ui.tradeBtn.${['demolish','build','buy','accept','upgrade'].includes(kind)?kind:'sell'}`);tradeAction=action;tradeConfirm.disabled=false;if(!tradeDialog.open)tradeDialog.showModal();tradeCancel.focus();},
    workerProfile(worker,assignment={orders:[],dailyTasks:[]}) {
      const robot=isRobot(worker.id),candidate=robot?!Number.isFinite(worker.shiftUntil):!Number.isFinite(worker.xp);
      // Robot gia hạn lẻ = gói 1 ngày công (workers/shift không gửi pack).
      const renewPrice=robot?packPrice(workerWage(worker),1):contractPrice(worker),now=Date.now();
      profileSummary.hidden=candidate;profileSummary.textContent=candidate?'':robot?tr('farm.ui.robotSummary',{left:contractLeft(worker.shiftUntil-now),price:renewPrice}):tr('farm.ui.humanSummary',{plan:contractPlan(worker).name.toLowerCase(),price:contractPrice(worker),left:contractLeft(worker.shiftUntil-now),days:Math.floor((worker.serviceMs||0)/WORK_DAY_MS)});
      if(!candidate){
        const unpaid=worker.shiftUntil<=now;
        profileAlert.dataset.warning=String(unpaid);profilePay.hidden=false;profilePay.dataset.worker=worker.id;
        profilePay.disabled=false;profilePay.title=robot?tr('farm.ui.renewOneDay',{price:renewPrice}):tr('farm.ui.signContract',{plan:contractPlan(worker).name.toLowerCase(),price:contractPrice(worker)});
        profilePay.lastElementChild.textContent=tr('farm.ui.renewPrice',{price:renewPrice});
        // Sự cố hiện ngay trên dải trạng thái hồ sơ; «Nhắc» nằm ở bong bóng HUD (cùng một callback).
        profileAlertText.textContent=unpaid?(robot?tr('farm.ui.planExpired',{price:renewPrice}):tr('farm.ui.contractStopped',{name:worker.name})):sickOf(worker,now)?tr('farm.ui.sick',{time:clock(worker.restUntil-now)}):phoneOf(worker,now)?tr('farm.ui.phone',{time:clock(worker.waitUntil-now)}):tr('farm.ui.profileStatus',{left:contractLeft(worker.shiftUntil-now),where:worker.farmId==='farm-0'?tr('farm.ui.onFarm'):tr('farm.ui.reserve'),state:worker.state||tr('farm.ui.awaitingWork')});
      }else profileAlert.dataset.warning='false';

      workerSheet.dataset.profile=candidate?'candidate':'employee';
      $('farm-modal').dataset.workerProfile=workerSheet.dataset.profile;
      workerSheet.hidden=!candidate&&bagCategory!=='training';workerSheet.replaceChildren();
      if(candidate){
        const bio=document.createElement('p');bio.className='farm-candidate-bio';bio.textContent=worker.bio||tr('farm.ui.defaultBio');workerSheet.append(bio);
        const summary=document.createElement('p');summary.className='farm-candidate-summary';summary.textContent=robot?tr('farm.ui.robotCandidate',{wage:workerWage(worker)}):tr('farm.ui.humanCandidate',{fee:worker.fee,wage:workerWage({...worker,xp:0}),week:workerWage({...worker,xp:0})*6});workerSheet.append(summary);
        const labels={speed:tr('farm.stat.speed'),intelligence:tr('farm.stat.intelligence'),strength:tr('farm.stat.strength'),dexterity:tr('farm.stat.dexterity'),constitution:tr('farm.stat.constitution')};
        const strengths=Object.entries(worker.stats).sort((a,b)=>b[1]-a[1]).slice(0,2);
        const specialty=document.createElement('p');specialty.className='farm-candidate-summary';specialty.textContent=tr('farm.ui.topStats')+strengths.map(([key,value])=>`${labels[key]} ${value}/100`).join(' · ');workerSheet.append(specialty);
      }
      const lv=workerLevel(worker.xp||0),heading=document.createElement('strong');heading.textContent=robot?tr('farm.ui.robotFixed'):tr('farm.ui.levelOf10',{level:lv});workerSheet.append(heading);
      if(robot){const lock=document.createElement('small');lock.className='farm-robot-lock';lock.textContent=tr('farm.ui.robotNoTraining');workerSheet.append(lock);}
      else if(Number.isFinite(worker.xp)){const xp=document.createElement('small');xp.textContent=lv<10?tr('farm.ui.xp',{xp:worker.xp,next:100*lv*lv}):tr('farm.upgrade.reachedMax');workerSheet.append(xp);}
      for(const [key,label]of ['speed','intelligence','strength','dexterity','constitution'].map(key=>[key,tr(`farm.stat.${key}`)])){
        const value=workerStat({...worker,xp:worker.xp||0},key),row=document.createElement('div'),name=document.createElement('span'),bar=document.createElement('meter'),number=document.createElement('b');
        name.textContent=label;bar.min=0;bar.max=100;bar.value=value;bar.setAttribute('aria-label',label);number.textContent=String(value);row.append(name,bar,number);workerSheet.append(row);
      }
      const assigned=[...assignment.orders.filter(o=>o.workers.includes(worker.id)&&o.status!=='delivered').map(o=>tr('farm.ui.assignedOrder',{mass:formatMass(o.grams),status:o.status==='transit'?tr('farm.order.delivering'):tr('farm.ui.preparing')}))];
      const tasks=document.createElement('p');tasks.className='farm-assigned-work';tasks.textContent=assigned.length?tr('farm.ui.assignedWork')+assigned.slice(0,3).join(' · ')+(assigned.length>3?tr('farm.ui.moreJobs',{n:assigned.length-3}):''):candidate?tr('farm.ui.afterHire'):tr('farm.ui.noAssigned');workerSheet.append(tasks);
    },
    currentFilter(){return bagCategory;},
    selectFilter(id){bagCategory=id;filterBag();$('farm-modal-items').scrollTop=0;},
    orderProgress(steps,info){
      $('farm-modal').dataset.orderDetail='true';profileAlert.hidden=true;profileSummary.hidden=true;backButton.setAttribute('aria-label',tr('farm.ui.backToOrders'));backButton.title=tr('farm.ui.orderList');
      workerSheet.hidden=false;workerSheet.replaceChildren();
      const summary=document.createElement('div');summary.className='farm-order-summary';
      const heading=document.createElement('strong'),detail=document.createElement('small');
      heading.textContent=info.status==='transit'?tr('farm.ui.progTransit'):info.status==='delivered'?tr('farm.ui.progDelivered'):info.ready?tr('farm.ui.progReady'):tr('farm.ui.progPreparing');
      detail.textContent=info.status==='transit'?tr('farm.ui.progTransitDetail',{n:info.seconds,pct:Math.floor(info.progress*100)}):info.status==='delivered'?tr('farm.ui.progDeliveredDetail'):info.ready?tr('farm.ui.progReadyDetail'):info.crew?tr('farm.ui.progCrew',{crew:info.crew}):tr('farm.ui.progPickStaff');
      summary.append(heading,detail);
      if(info.progress!==null){const progress=document.createElement('progress');progress.max=1;progress.value=info.progress;progress.className='farm-job-progress';progress.setAttribute('aria-label',tr('farm.ui.shippingProgress'));summary.append(progress);}
      workerSheet.append(summary);
      const list=document.createElement('ol');list.className='farm-order-timeline';
      for(const [index,step]of steps.entries()){
        const item=document.createElement('li'),marker=document.createElement('span'),text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');
        item.dataset.done=String(step.done);marker.className='farm-order-marker';marker.textContent=step.done?'✓':String(index+1);name.textContent=step.label;
        detail.textContent=info.status==='transit'&&index<4?tr('farm.ui.stepShipped'):info.status==='delivered'?tr('farm.ui.stepDone'):step.detail;
        text.append(name,detail);item.append(marker,text);list.append(item);
      }
      workerSheet.append(list);
    },
    operationHud({today,weather,workers,demand,storage,capacity}) {
      operationHud.replaceChildren();
      for(const line of [tr('farm.ui.todayHarvest',{mass:formatMass(today?.harvested||0)}),tr('farm.ui.todayProcess',{mass:formatMass(today?.processed||0),coins:formatCoins(today?.revenue||0)}),tr('farm.ui.todayStorage',{stock:formatMass(storage),cap:formatMass(capacity)})]){const text=document.createElement('span');text.textContent=line;operationHud.append(text);}
      operationHud.title=tr('farm.ui.cafeForecast',{cups:demand.cups,need:formatMass(demand.needed)});
    },
    blockers(items){
      const key=JSON.stringify(items);if(key===blockersKey)return;blockersKey=key;
      const current=new Map(items.map(item=>[item.id,item]));
      for(const item of items)if(!previousBlockers.has(item.id))operationEvents.push({text:tr('farm.ui.eventNeeds',{text:item.text}),at:Date.now()});
      for(const [id,item]of previousBlockers)if(!current.has(id))operationEvents.push({text:tr('farm.ui.eventResolved',{text:item.text}),at:Date.now()});
      // Folded by default; a new urgent item (wages unpaid, storage full) blinks the title 3 times instead of opening the panel.
      if(items.some(item=>item.urgent&&!previousBlockers.has(item.id))){blockerTitle.classList.remove('ui-attention');void blockerTitle.offsetWidth;blockerTitle.classList.add('ui-attention');}
      previousBlockers=current;if(operationEvents.length>60)operationEvents.splice(0,operationEvents.length-60);
      blockerPanel.hidden=panelOff.blockers||!items.length;drawer.refresh(blockerPanel.hidden?0:items.length);blockerTitle.textContent=tr('farm.ui.blockersTitle',{n:items.length});const scroll=blockerBody.scrollTop;blockerBody.replaceChildren();
      for(const item of items){const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');text.textContent=item.text;button.type='button';button.textContent=item.label;button.addEventListener('click',()=>callbacks.shortcut(item.action),options);row.append(text,button);blockerBody.append(row);}blockerBody.scrollTop=scroll;
    },
    journal(events,workers,reputation){
      events=[...events,...operationEvents].sort((a,b)=>a.at-b.at).slice(-100);
      const deployed=workers.filter(w=>w.farmId==='farm-0'),last=events.at(-1),line=w=>`${w.name}: ${w.state||tr('farm.ui.gettingReady')}`;
      // Rebuild only when events or the deployed team change; worker states (they tick every refresh) update their own row in place.
      const key=`${events.length}:${last?.at}:${last?.text}:${deployed.map(w=>w.id).join()}:${reputation}`;
      if(key===journalKey){deployed.forEach((w,i)=>{const row=journalWorkerRows[i];if(row&&row.textContent!==line(w))row.textContent=line(w);});return;}
      journalKey=key;journalBody.replaceChildren();const title=document.createElement('span');title.textContent=tr('farm.ui.journalShort');journalTitle.replaceChildren(title);
      journalWorkerRows=deployed.map(worker=>{const row=document.createElement('p');row.className='journal-worker';row.textContent=line(worker);journalBody.append(row);return row;});
      for(const event of events.slice().reverse()){const row=document.createElement('p');row.textContent=event.text;journalBody.append(row);}
    },
    toolsPrompt(visible, point) {
      if (toolsPrompt.hidden === visible) toolsPrompt.hidden = !visible;
      if (!visible) return;
      const left = `${Math.round(point.x)}px`, top = `${Math.round(point.y)}px`; // write only when the pixel changes
      if (toolsPrompt.style.left !== left) toolsPrompt.style.left = left;
      if (toolsPrompt.style.top !== top) toolsPrompt.style.top = top;
    },
    get modalOpen() { return isModalOpen(); },
    // Light coin-only refresh used while the café scene covers the farm (full hud() is skipped there).
    coins(value) { showCoins(value); },
    // Show HUD parts that are open; `fresh` (HUD_UNLOCKS rows opened during play) get one toast; `dots` = ids still showing "Mới" (until used).
    unlocks(opened, fresh, dots) {
      openedParts=opened;
      for(const [id,button]of Object.entries(unlockButtons)){if(button.hidden===opened.has(id))button.hidden=!opened.has(id);button.classList.toggle('ui-new',dots.has(id));}drawer.refresh();
      journalPanel.hidden=panelOff.journal||!opened.has('workers');operationHud.hidden=!opened.has('workers'); // "Hôm nay" board only matters once there is a crew
      menuToggle.hidden=primaryNav.querySelectorAll('button:not([hidden])').length<4;
      if(!fresh.length)return;
      this.notice(fresh.length>1?tr('farm.ui.unlockMany',{n:fresh.length,list:fresh.map(item=>item.name).join(', ')}):tr('farm.ui.unlockOne',{name:fresh[0].name,help:fresh[0].help}));
      $('farm-notice').classList.add('ui-toast--unlock');sfx('reward.quest');
      giftLinePending=fresh.some(item=>item.id==='workers'); // dòng 🎁 thêm ở hud() ngay sau, khi đã có robotGift của lượt này
    },
    // Quest guide: blinking card with a "tap to be guided" line; the HUD button the quest needs blinks too.
    guide(active, hudTarget) {
      const card=document.querySelector('#farm-hud .quest-tracker');card?.classList.toggle('ui-attention',active);
      if(active){const text=usesTouch()?tr('farm.ui.guideTouch'):tr('farm.ui.guideClick');if(guideHint.textContent!==text)guideHint.textContent=text;if(!guideHint.isConnected)card?.querySelector('div')?.append(guideHint);}else guideHint.remove();
      for(const [id,button]of Object.entries(unlockButtons))button.classList.toggle('ui-attention',id===hudTarget);
    },
    // First-visit controls hint; text null hides it. onClose runs when the player taps ×.
    coach(text, onClose) { coachText.textContent=text||'';coachBox.hidden=!text;coachDone=text?onClose:null; },
    hud(progress) {
      const { coins, level, xp, water, capacity, tool, quest, seedName, playerName, orders = [], order, workers = [], dailyTasks = [] } = progress;
      lastProgress = progress;
      // Gói thử robot (robot-staff mục 5): không toast riêng, gộp một dòng vào toast mở khóa Nhân viên vừa hiện.
      if (giftLinePending) { giftLinePending = false; if (progress.robotGift?.state === 'ready' && !$('farm-notice').hidden) $('farm-notice').append(tr('farm.ui.robotGiftLine')); }
      const staffButton=management.querySelector('[data-shortcut="workers"]');staffButton.querySelector('small').textContent=tr('farm.ui.staffCount',{n:workers.length});staffButton.setAttribute('aria-label',tr('farm.ui.staffAria',{n:workers.length,deployed:workers.filter(w=>w.farmId==='farm-0').length}));
      const orderCount=orders.filter(item=>item.source!=='shop'&&!['delivered','expired'].includes(item.status)).length;
      const orderButton=management.querySelector('[data-shortcut="order-board"]');
      orderButton.querySelector('small').textContent=tr('farm.ui.ordersCount',{n:orderCount});
      orderButton.setAttribute('aria-label',tr('farm.ui.ordersAria',{n:orderCount}));
      const newOrders=orders.filter(item=>item.source!=='shop'&&item.status==='open'&&!item.workers.length).length;
      orderButton.dataset.notification=String(newOrders>0);orderButton.setAttribute('aria-label',tr('farm.ui.ordersAria',{n:orderCount})+(newOrders?tr('farm.ui.ordersUnassigned',{n:newOrders}):''));

      showCoins(coins); $('farm-level').textContent = level;$('farm-level').setAttribute('aria-label',tr('farm.shop.level',{level}));
      $('farm-player-name').textContent = playerName || tr('farm.aria.farm');
      const base=xpForLevel(level),next=level<999?xpForLevel(level+1):null,ratio=next ? Math.max(0,Math.min(1,(xp-base)/(next-base))) : 1;
      $('farm-xp-fill').style.width=`${ratio*100}%`;
      $('farm-xp-label').textContent=next?`${xp-base} / ${next-base} XP`:tr('farm.upgrade.maxLevel');
      const track=$('farm-xp-fill').parentElement;track.setAttribute('aria-valuenow',String(Math.round(ratio*100)));track.title=next ? `${xp-base}/${next-base} XP` : tr('farm.upgrade.reachedMax');
      $('farm-objective').textContent = quest?.title || tr('farm.ui.defaultObjective');
      $('farm-detail').textContent = quest?.detail || tr('farm.ui.defaultDetail');
      $('farm-tool-hint').textContent = `${(TOOLS.find(item => item.id === tool)?.name || tr('farm.strip.tools'))} · ${seedName}`;
      for (const button of $('farm-tools').children) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    },
    modal({ title, subtitle = '', icon = '❧', entries, footer = '', kind = 'shop', filters = [], back = false, roster = false, station = null }) {
      stationPanel.hidden=!station;
      if(station){
        stationPanel.replaceChildren();
        const info=document.createElement('div'),level=document.createElement('strong'),capacity=document.createElement('p'),benefit=document.createElement('small');
        level.textContent=tr('farm.ui.stationLevel',{level:station.level,max:station.max,tier:station.tier});capacity.textContent=tr('farm.ui.stationCurrent',{value:formatMassIfNeeded(station.current,station.unit)});benefit.textContent=station.benefit;info.append(level,capacity,benefit);
        const upgrade=document.createElement('div'),next=document.createElement('small'),button=document.createElement('button');button.type='button';
        next.textContent=station.next===null?tr('farm.upgrade.reachedMax'):tr('farm.ui.stationNext',{value:formatMassIfNeeded(station.next,station.unit)});
        button.textContent=station.lock||tr('farm.ui.upgradeCost',{price:formatCoins(station.price)});button.disabled=Boolean(station.lock);button.addEventListener('click',()=>callbacks.upgradeStation(station.id));upgrade.append(next,button);stationPanel.append(info,upgrade);if(station.feedback){const feedback=document.createElement('p');feedback.className='farm-station-feedback';feedback.textContent=station.feedback;stationPanel.append(feedback);}
      }
      const key = JSON.stringify({ title, subtitle, icon, entries, footer, kind, filters, back, station });
      $('farm-modal').dataset.orderDetail='false';backButton.setAttribute('aria-label',tr('farm.ui.backToStaff'));backButton.title=tr('farm.ui.staffList');profileSummary.hidden=true;profileAlert.hidden=!back;profileAlertText.textContent=subtitle;profilePay.hidden=true;
      $('farm-modal').dataset.daily=String(title===tr('farm.ui.dailyTitle'));$('farm-modal').dataset.roster=String(roster);$('farm-modal').dataset.kind = kind;$('farm-modal').dataset.back=String(back);backButton.hidden=!back;workerSheet.hidden=true;
      configureTabs(kind === 'bag' ? [['all',tr('farm.tab.all')],['seeds',tr('farm.tab.seeds')],['products',tr('farm.tab.products')],...(entries.some(item=>item.category==='supplies')?[['supplies',tr('farm.tab.supplies')]]:[])] : filters);
      $('farm-toolbelt').hidden = true;
      if (!isModalOpen()) {
        restoreFocus = document.activeElement;
        $('farm-modal').hidden = false; $('heaven-controls').hidden = true;
        $('farm-modal-close').focus({ preventScroll: true });
        sfx('ui.open');
      }
      if (key === modalKey) return;
      const structureKey=JSON.stringify({title,kind,filters,entries:entries.map(item=>[item.id,item.label,item.category,item.enabled,item.badge,item.progress!==undefined,item.timerRatio!==undefined])});
      if((kind==='jobs'||station)&&structureKey===modalStructureKey){
        modalKey=key;currentEntries=entries;
        for(const item of entries){
          const button=[...$('farm-modal-items').children].find(node=>node.dataset.entry===item.id);if(!button||button.classList.contains('farm-station-empty'))continue;
          button.querySelector('small').textContent=item.detail||'';
          const status=button.querySelector('.farm-job-status');if(status)status.textContent=item.status||'';
          const timerLabel=button.querySelector('.farm-job-deadline');if(timerLabel)timerLabel.textContent=item.timerLabel;
          for(const progress of button.querySelectorAll('progress')){const timer=progress.classList.contains('farm-job-timer');progress.value=timer?item.timerRatio:item.progress;if(timer)progress.setAttribute('aria-label',item.timerLabel);}
          button.dataset.urgent=String(Boolean(item.urgent));
          button.setAttribute('aria-label',[item.label,item.detail,item.badge].filter(Boolean).join(' · '));
        }
        return;
      }
      modalStructureKey=structureKey;
      const focused = document.activeElement?.dataset?.entry;
      const scroll = $('farm-modal-items').scrollTop;
      modalKey = key; currentEntries = entries;
      $('farm-modal-title').replaceChildren(iconFor(gameIcon(icon)), title); /* svg adds no text: title checks on textContent still match */ $('farm-modal-subtitle').textContent = subtitle;
      $('farm-modal-icon').textContent = gameIcon(icon); $('farm-modal-footer').textContent = footer; $('farm-modal-footer').hidden = !footer;
      $('farm-modal-items').replaceChildren();
      for (const entry of entries) {
        if(entry.emptyState){
          const empty=document.createElement('div');empty.className='farm-station-empty';empty.dataset.category=entry.category;empty.dataset.entry=entry.id;
          const icon=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');icon.textContent='📦';icon.setAttribute('aria-hidden','true');title.textContent=tr('farm.ui.noBatch');detail.textContent=tr('farm.ui.noBatchDetail');empty.append(icon,title,detail);$('farm-modal-items').append(empty);continue;
        }
        const button = document.createElement(entry.purchase||entry.sale||entry.saleFixed||entry.readOnly||entry.processing||entry.collectOne?'div':'button'); if(!entry.purchase&&!entry.sale&&!entry.saleFixed&&!entry.readOnly&&!entry.processing&&!entry.collectOne)button.type = 'button'; button.dataset.entry = entry.id; if(entry.sfx)button.dataset.sfx=entry.sfx;
        button.setAttribute('aria-label',[entry.label,entry.detail,entry.badge].filter(Boolean).join(' · '));
        button.className = 'farm-menu-item';if(entry.readOnly)button.dataset.readOnly='true'; button.dataset.category = entry.category || 'seeds'; button.disabled = kind !== 'bag' && entry.enabled === false;
        const itemIcon = document.createElement('span'); itemIcon.className = 'farm-item-icon'; const seedOf = gameIcon(entry.icon || '◇') === '🌱' && [entry.cropId, entry.choice].find(id => CROPS.some(crop => crop.id === id)); itemIcon.replaceChildren(seedOf ? iconNode(`seed-${seedOf}`) : gameIcon(entry.icon || '◇')); // each crop gets its own sapling icon
        const text = document.createElement('span');
        const name = document.createElement('strong'); name.textContent = entry.label;
        const detail = document.createElement('small'); detail.textContent = entry.detail || '';
        if(entry.staffState){const state=document.createElement('span');state.className='farm-staff-state';state.textContent=entry.staffState;text.append(state);button.dataset.deployed=String(entry.staffDeployed);button.dataset.unpaid=String(entry.staffUnpaid);button.classList.add('farm-staff-card');}
        if(entry.staffAlert)button.classList.add('farm-staff-alert');
        text.append(name);
        if(entry.batchState){button.classList.add('farm-batch-card');button.dataset.batchState=entry.batchState;const state=document.createElement('span');state.className='farm-batch-state';state.textContent=entry.batchState;text.prepend(state);}
        if(entry.taskDay!==undefined){
          button.classList.add('farm-daily-task');
          const day=document.createElement('span');day.className='farm-task-day';day.textContent=tr('farm.ui.day',{day:entry.taskDay});text.append(day);
          const reward=document.createElement('span');reward.className='farm-task-reward';reward.textContent=tr('farm.ui.reward',{n:entry.taskReward});text.append(reward);
        }

        if (entry.level) { const level = document.createElement('span'); level.className='farm-item-level'; level.textContent=tr('farm.shop.level',{level:entry.level}); text.append(level); }
        text.append(detail);
        if((kind==='jobs'||entry.batchProgress!==undefined)&&entry.progress!==undefined){const progress=document.createElement('progress');progress.className='farm-job-progress';progress.max=1;progress.value=entry.progress;progress.setAttribute('aria-label',entry.label+tr('farm.ui.progressSuffix'));text.append(progress);}
        if(kind==='jobs'&&entry.timerRatio!==undefined){
          const label=document.createElement('span');label.className='farm-job-deadline';label.textContent=entry.timerLabel;
          const timer=document.createElement('progress');timer.className='farm-job-progress farm-job-timer';timer.max=1;timer.value=entry.timerRatio;timer.setAttribute('aria-label',entry.timerLabel);
          button.dataset.urgent=String(Boolean(entry.urgent));text.append(label,timer);
        }
        if(kind==='jobs'&&entry.status){const status=document.createElement('span');status.className='farm-job-status';status.textContent=entry.status;text.append(status);button.dataset.ready=String(Boolean(entry.ready));}

        const action = document.createElement('span'); action.className = 'farm-item-action'; action.textContent = entry.enabled === false && entry.lockReason ? `🔒 ${entry.lockReason}` : entry.badge || tr('farm.menu.choose');
        if(kind==='upgrades'&&!roster&&entry.priced&&!entry.lockReason){
          const coin=document.createElement('span');coin.className='farm-gold-coin';coin.textContent='₫';coin.setAttribute('aria-hidden','true');
          const price=document.createElement('span');price.textContent=entry.badge;action.replaceChildren(coin,price);action.classList.add('farm-upgrade-price');
        }
        if(entry.switchValue!==undefined){button.classList.add('farm-switch-row');button.setAttribute('role','switch');button.setAttribute('aria-checked',String(entry.switchValue));action.textContent=entry.switchValue?tr('farm.on'):tr('farm.off');}
        button.append(itemIcon, text, action);
        if(entry.id==='deliver-order'){
          button.classList.add('farm-order-deliver');
          const label=document.createElement('span');label.textContent=tr('farm.order.ship');
          const cost=document.createElement('span');cost.className='farm-order-delivery-cost';
          const coin=document.createElement('span');coin.className='farm-gold-coin';coin.textContent='₫';coin.setAttribute('aria-hidden','true');cost.append(coin,document.createTextNode(tr('farm.coins',{n:2})));
          button.replaceChildren(label,cost);
        }

        if(entry.collectOne){const receive=document.createElement('button');receive.type='button';receive.className='farm-item-action farm-batch-receive';receive.textContent=tr('farm.batch.collect');receive.setAttribute('aria-label',tr('farm.ui.collectBatch',{label:entry.label}));receive.addEventListener('click',()=>callbacks.choose(entry.id),options);action.replaceWith(receive);}
        if(entry.processing){
          const config=entry.processing,bar=document.createElement('div'),minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),start=document.createElement('button'),estimate=document.createElement('small');
          bar.className='farm-purchase-bar farm-processing-bar';button.classList.add('farm-processing-card');estimate.className='farm-processing-estimate';
          minus.type=plus.type=start.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label',tr('farm.ui.processLess'));plus.setAttribute('aria-label',tr('farm.ui.processMore'));input.type='number';input.min='1';input.max=Math.max(1,Math.min(99,config.maximum));input.step='1';input.value=purchaseQuantities.get(entry.id)||Math.max(1,Math.min(99,config.maximum));input.setAttribute('aria-label',tr('farm.ui.processPortions'));start.className='farm-purchase-buy ui-btn ui-btn--gold';start.textContent=tr('farm.station.start');
          function update(value,typing){const n=Math.max(1,Math.min(99,Math.max(1,config.maximum),Math.floor(Number(value)||1)));if(!typing)input.value=n;if(config.maximum>=1)purchaseQuantities.set(entry.id,n); // never remember the forced 1 shown while ingredients are missing
minus.disabled=config.maximum<1||n<=1;plus.disabled=config.maximum<1||n>=Math.min(99,config.maximum);start.disabled=config.maximum<1;estimate.textContent=config.maximum<1?tr('farm.ui.processUnavailable'):tr('farm.ui.processEstimate',{n,input:formatMass(n*config.input),inputName:config.inputName.toLowerCase(),output:formatMass(n*config.output),outputName:config.outputName.toLowerCase(),batches:Math.ceil(n/config.perBatch)});}
          minus.addEventListener('click',()=>update(Number(input.value)-1));plus.addEventListener('click',()=>update(Number(input.value)+1));input.addEventListener('input',()=>{if(input.value!=='')update(input.value,true);});input.addEventListener('change',()=>update(input.value));start.addEventListener('click',()=>callbacks.process(entry.id,purchaseQuantities.get(entry.id)));bar.append(minus,input,plus,start);text.append(estimate);action.replaceWith(bar);update(input.value);
        }
        if(entry.purchase||entry.sale){
          const selling=Boolean(entry.sale),config=entry.sale||entry.purchase;
          const owned=document.createElement('small');owned.className='farm-purchase-owned';owned.textContent=tr('farm.ui.owned',{n:selling?formatMass(config.owned):config.owned});text.append(owned);
          if(selling&&config.keep){const keep=document.createElement('small');keep.className='farm-purchase-owned';keep.textContent=tr('farm.ui.keepForCafe',{mass:formatMass(config.keep)});text.append(keep);}
          const quoteText=document.createElement('small');quoteText.className='farm-sale-quote';if(selling)text.append(quoteText);
          const bar=document.createElement('div');bar.className='farm-purchase-bar';button.classList.add('farm-purchase-card');
          if(selling)bar.classList.add('farm-sale-bar');
          const minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),buy=document.createElement('button');
          minus.type=plus.type=buy.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label',tr('farm.ui.qtyLess'));plus.setAttribute('aria-label',tr('farm.ui.qtyMore'));
          const maximum=Math.max(0,selling?config.owned:Math.min(99,Math.floor(config.coins/config.unitPrice))),step=1;
          // Short of coins: still quote one item at its real price and say how much is missing (AGENTS.md).
          const short=!selling&&!config.locked&&maximum<1,cap=short?1:maximum,missing=short?config.unitPrice-config.coins:0;if(short){quoteText.textContent=tr('farm.short.coins',{n:formatCoins(missing)});text.append(quoteText);}
          input.type='number';input.min=cap>0?'1':'0';input.max=String(cap);input.disabled=maximum<1;input.step='1';input.value=Math.min(selling&&config.keep?Math.max(1,maximum-config.keep):cap,purchaseQuantities.get(entry.id)||(selling?maximum:1));input.setAttribute('aria-label',`${selling?tr('farm.ui.gramsToSell'):tr('farm.ui.qtyToBuy')} ${entry.label}`);
          buy.className='farm-purchase-buy ui-btn ui-btn--gold';
          // Built once: replacing them on the input's blur/change (fired by pressing «Bán») detached the pressed node and swallowed that first click.
          const coin=document.createElement('span');coin.className='farm-gold-coin';coin.setAttribute('aria-hidden','true');coin.textContent='₫';
          const price=document.createElement('span');buy.append(coin,price);
          function updateQuantity(value,typing){
            const quantity=Math.max(cap>0?1:0,Math.min(cap,Math.floor(Number(value)||1)));if(!typing)input.value=quantity;purchaseQuantities.set(entry.id,quantity);minus.disabled=quantity<=1;plus.disabled=quantity>=cap;
            const quote=selling?callbacks.saleQuote(entry.id,quantity):{ok:!config.locked&&config.unitPrice*quantity<=config.coins,value:config.unitPrice*quantity};
            buy.disabled=!short&&(maximum<1||!quote.ok); // short stays tappable so the tap explains the missing coins
            price.textContent=selling?tr('farm.ui.sell'):config.locked?entry.badge:tr('farm.coins',{n:formatCoins(quote.value)});
            if(selling){quoteText.textContent=quote.ok?tr('farm.ui.saleQuote',{value:formatCoins(quote.value),grams:formatNumber(quantity)})+(quote.discounted?tr('farm.ui.saleQuoteDiscount',{full:formatCoins(quote.full)}):''):quote.message;buy.setAttribute('aria-label',tr('farm.ui.sellAria',{grams:quantity,label:entry.label})+(quote.ok?tr('farm.ui.sellAriaValue',{value:formatCoins(quote.value)}):''));}
            else buy.setAttribute('aria-label',tr('farm.ui.buyAria',{n:quantity,label:entry.label,value:formatCoins(quote.value)}));
          }
          minus.addEventListener('click',()=>updateQuantity(Number(input.value)-step));plus.addEventListener('click',()=>updateQuantity(Number(input.value)+step));input.addEventListener('input',()=>{if(input.value!=='')updateQuantity(input.value,true);});input.addEventListener('change',()=>updateQuantity(input.value));
          buy.addEventListener('click',()=>{if(short)this.notice(tr('farm.expand.needCoins',{price:formatCoins(config.unitPrice),short:formatCoins(missing)}),false);else if(selling)callbacks.sell(entry.id,purchaseQuantities.get(entry.id));else callbacks.purchase(entry.id,purchaseQuantities.get(entry.id));});bar.append(minus,input,plus,buy);action.replaceWith(bar);updateQuantity(input.value);
        }else if(entry.saleFixed){
          const sell=document.createElement('button');sell.type='button';sell.className='farm-item-action';sell.textContent=entry.badge;sell.disabled=entry.enabled===false;sell.addEventListener('click',()=>callbacks.choose(entry.id));action.replaceWith(sell);
        }

        if(kind==='bag'){const count=document.createElement('b');count.className='bag-count';count.textContent=entry.quantity;button.append(count);}
        button.addEventListener('click', () => {if(entry.purchase||entry.sale||entry.saleFixed||entry.readOnly||entry.processing||entry.collectOne)return;if(performance.now()<staffIgnoreClickUntil)return;if(entry.onChoose){entry.onChoose();return;}if(kind==='settings'){if(entry.action){callbacks.shortcut(entry.action);return;}const key=entry.id==='setting-journal'?'journal':'blockers';panelOff[key]=!panelOff[key];journalPanel.hidden=panelOff.journal||!openedParts.has('workers');blockerPanel.hidden=panelOff.blockers||!previousBlockers.size;this.showSettings();return;}if(kind==='bag'){bagSelection=entry.id;renderBagDetail();}else callbacks.choose(entry.id);});
        $('farm-modal-items').append(button);
      }
      if(roster){
        const list=$('farm-modal-items'),cards=[...list.querySelectorAll('.farm-staff-card')];
        const main=document.createElement('section'),reserve=document.createElement('section');
        for(const zone of [main,reserve]){zone.className='farm-staff-zone';zone.dataset.category='local';}
        main.classList.add('farm-main-team');reserve.classList.add('farm-reserve-team');
        main.innerHTML=`<h3>${tr('farm.ui.mainTeam')} <small>${tr('farm.ui.mainTeamNote')}</small></h3>`;reserve.innerHTML=`<h3>${tr('farm.ui.reserveTeam')} <small>${tr('farm.ui.reserveTeamNote')}</small></h3>`;
        const mainGrid=document.createElement('div'),reserveGrid=document.createElement('div');mainGrid.className=reserveGrid.className='farm-staff-zone-grid';reserveGrid.dataset.staffDrop='reserve';
        for(const card of cards){
          const id=card.dataset.entry.slice(8),deployed=card.dataset.deployed==='true';
          card.dataset.worker=id;
          if(isRobot(id))card.dataset.kind='robot';
          const worker=lastProgress?.workers.find(w=>w.id===id),incident=worker&&(sickOf(worker,Date.now())?tr('farm.ui.incidentSick'):phoneOf(worker,Date.now())?tr('farm.ui.incidentPhone'):'');
          if(incident){const state=card.querySelector('.farm-staff-state');if(state)state.textContent=incident;card.dataset.incident='true';}
          const tile=document.createElement('div');tile.className='farm-staff-tile';tile.append(card);
          const staff=entries.find(item=>item.id===card.dataset.entry),unpaid=card.dataset.unpaid==='true';tile.dataset.unpaid=String(unpaid);
          if(unpaid){
            const pay=document.createElement('button');pay.type='button';pay.className='farm-staff-pay-coin';pay.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span>';const payLabel=document.createElement('small');payLabel.textContent=tr('farm.ui.payWageCost',{n:staff.staffWage});pay.append(payLabel);
            pay.title=tr('farm.ui.payTitle',{n:staff.staffWage,name:staff.label});pay.setAttribute('aria-label',pay.title);
            pay.addEventListener('click',()=>callbacks.shortcut(`pay-worker:${id}`),options);tile.append(pay);
          }
          // No reserve bench any more: every hired worker sits in a farm slot and can be let go from its tile.
          const remove=document.createElement('button');remove.type='button';remove.className='farm-staff-dismiss';remove.textContent='×';remove.title=tr('farm.ui.dismissTitleName',{name:staff.label});remove.setAttribute('aria-label',remove.title);
          remove.addEventListener('click',()=>showDismiss(staff),options);tile.append(remove);
          card.dataset.staffDrop='main';card.dataset.slot=String(mainGrid.children.length+1);mainGrid.append(tile);
          card.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary)return;staffDrag={pointer:event.pointerId,id,card,x:event.clientX,y:event.clientY,ghost:null};},options);
        }
        main.querySelector('small').textContent=tr('farm.ui.mainSlots',{n:mainGrid.children.length});
        while(mainGrid.children.length<2){const slot=document.createElement('div');slot.className='farm-staff-empty-slot';slot.dataset.staffDrop='main';slot.textContent=tr('farm.ui.emptySlot',{n:mainGrid.children.length+1});mainGrid.append(slot);}
        main.append(mainGrid);list.append(main);
      }
      if(kind==='bag') for(let i=entries.length;i<Math.ceil(Math.max(1,entries.length)/6)*6;i++){const empty=document.createElement('div');empty.className='farm-bag-empty';empty.setAttribute('aria-hidden','true');$('farm-modal-items').append(empty);}
      filterBag();
      $('farm-modal-items').scrollTop = scroll;
      if (focused) [...$('farm-modal-items').children].find(button => button.dataset.entry === focused)?.focus({ preventScroll: true });
    },
    seedStrip({ title, entries, selected = null, persistent = false, hint = null }) {
      if(toolDrag)return;
      $('farm-modal').hidden = true; modalKey = '';
      $('heaven-controls').hidden = false; seedStrip.hidden = false;
      const key = JSON.stringify({title, entries, selected, persistent, hint}); if (key === seedKey) return; seedKey = key;
      const previousScroll=seedStrip.querySelector('.farm-seed-row')?.scrollLeft||0;
      seedStrip.replaceChildren();
      if(hint){const line=document.createElement('small');line.textContent=hint;seedStrip.append(line);} // first ⛏️ use only (flag `tools`)
      const row = document.createElement('div');row.className='farm-seed-row';seedStrip.append(row);
      for(const [direction,symbol,label]of [['left','‹',tr('farm.ui.scrollLeft')],['right','›',tr('farm.ui.scrollRight')]]){
        const arrow=document.createElement('button');arrow.type='button';arrow.className='seed-scroll-arrow';arrow.dataset.scroll=direction;arrow.textContent=symbol;arrow.setAttribute('aria-label',label);
        arrow.addEventListener('click',()=>row.scrollBy({left:(direction==='left'?-1:1)*Math.max(65,row.clientWidth*.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),options);seedStrip.append(arrow);
      }
      row.addEventListener('scroll',syncSeedArrows,options);
      requestAnimationFrame(()=>{if(row.isConnected){row.scrollLeft=previousScroll;syncSeedArrows();}});

      for (const entry of entries) {
        if(entry.emptyState){
          const empty=document.createElement('div');empty.className='farm-station-empty';empty.dataset.category=entry.category;empty.dataset.entry=entry.id;
          const icon=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');icon.textContent='📦';icon.setAttribute('aria-hidden','true');title.textContent=tr('farm.ui.noBatch');detail.textContent=tr('farm.ui.noBatchDetail');empty.append(icon,title,detail);$('farm-modal-items').append(empty);continue;
        }
        const button = document.createElement('button'); button.type = 'button'; button.disabled = entry.enabled === false;
        button.draggable=false;button.setAttribute('aria-pressed',String(entry.id===selected));button.title = `${entry.label} · ${entry.detail || ''}`; button.setAttribute('aria-label',button.title);
        const icon = document.createElement('span'); icon.className = 'seed-packet';
        if(entry.cropId){
          icon.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#6b482c" opacity=".3" d="M13 54q21 10 40 0l-2 5H15z"/><path fill="#b67b3f" stroke="#6d4727" stroke-width="2" d="m17 13 30 0-3 9q10 14 8 31-20 10-40 0-2-17 8-31z"/><path fill="#edc57d" d="m20 23 24 0q8 16 5 28-17 7-34 0-2-14 5-28"/><path fill="#f5daa2" d="m21 24 4 0q-7 17-6 27l-4-1q0-16 6-26"/><path fill="#659548" d="M17 13h30v7H17z"/><path stroke="#80502a" stroke-width="2" fill="none" d="M18 22h28M17 51q15 5 30 0"/><ellipse fill="#6c442b" cx="32" cy="37" rx="8" ry="11" transform="rotate(30 32 37)"/><path fill="none" stroke="#d8a15c" stroke-width="2" d="M36 28q-9 8-8 18"/><path stroke="#fff0bc" stroke-width="1.5" d="m21 55 2 1m4 0 2 1m4 0h2m4-1h2"/></svg>';
        } else if(entry.action==='clear'){icon.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path stroke="#503521" stroke-width="10" stroke-linecap="round" d="m15 55 32-43"/><path stroke="#bd8c4f" stroke-width="6" stroke-linecap="round" d="m15 54 32-43"/><path fill="#899da0" stroke="#42565a" stroke-width="2" d="m38 12 5-6 17 14-9 14-6-4 5-9z"/><path stroke="#d8e8dc" stroke-width="2" d="m48 31 8-11"/></svg>';} else icon.textContent=gameIcon(entry.icon);
        if(!entry.noDrag && (entry.cropId || ['water','clear','fertilize','weed','prune','harvest'].includes(entry.action))){button.dataset.dragAction=entry.cropId ? 'plant' : entry.action;button.dataset.cropId=entry.cropId || '';button.dataset.dragIcon=entry.cropId ? '🌱' : entry.action==='clear' ? '⛏️' : entry.action==='fertilize' ? '🪴' : {water:'💧',weed:'🌿',prune:'✂️',harvest:'🧺'}[entry.action];}
        if (entry.cropId || ['water','clear','fertilize','weed','prune','harvest'].includes(entry.action)) {
          button.classList.add('seed-slot'); button.style.setProperty('--seed-color',entry.color);
          if(Number.isFinite(entry.quantity)){const count = document.createElement('b'); count.className='seed-count'; count.textContent=entry.quantity; button.append(count);}
        }
        const label = document.createElement('small'); label.textContent = entry.shortName || entry.label;
        button.append(icon,label); button.addEventListener('click',()=>{if(performance.now()>=ignoreSeedClickUntil)callbacks.choose(entry.id);}); row.append(button);
      }
      const close = document.createElement('button'); close.type = 'button'; close.className = 'seed-strip-close'; close.textContent = '×'; close.setAttribute('aria-label',tr('farm.ui.deselectPlot'));
      close.addEventListener('click',callbacks.close); if(!persistent)seedStrip.append(close);
    },
    showSettings() {
      this.modal({title:tr('farm.ui.settings'),subtitle:tr('farm.set.subtitle'),icon:'⚙️',kind:'settings',filters:[['display',tr('farm.set.tabDisplay')],['controls',tr('farm.set.tabControls')],['info',tr('farm.set.tabInfo')]],entries:[
        {id:'setting-game',label:tr('farm.set.game'),detail:tr('farm.set.gameDetail'),icon:'🔊',category:'display',action:'game-settings',badge:tr('farm.set.open'),sfx:'ui.open'},
        {id:'setting-journal',label:tr('farm.set.journal'),detail:tr('farm.set.journalDetail'),icon:'📖',category:'display',switchValue:!panelOff.journal},
        {id:'setting-blockers',label:tr('farm.set.blockers'),detail:tr('farm.set.blockersDetail'),icon:'📌',category:'display',switchValue:!panelOff.blockers},
        {id:'setting-display-note',label:tr('farm.set.displayNote'),detail:tr('farm.set.displayNoteDetail'),icon:'🌿',category:'display',readOnly:true},
        {id:'setting-movement',label:tr('farm.set.movement'),detail:usesTouch()?tr('farm.set.movementTouch'):tr('farm.set.movementMouse'),icon:'👆',category:'controls',readOnly:true},
        {id:'setting-tools',label:tr('farm.set.tools'),detail:tr('farm.set.toolsDetail'),icon:'🌱',category:'controls',readOnly:true},
        {id:'setting-camera',label:tr('farm.set.camera'),detail:tr('farm.set.cameraDetail'),icon:'🎯',category:'controls',readOnly:true},
        {id:'setting-guide',label:tr('farm.set.guide'),detail:tr('farm.set.guideDetail'),icon:'📖',category:'controls',action:'help',badge:tr('farm.set.guideBtn')},
        {id:'setting-about',label:tr('farm.set.about'),detail:tr('farm.set.aboutDetail'),icon:'☕',category:'info',readOnly:true},
        {id:'setting-team-info',label:tr('farm.set.team'),detail:tr('farm.set.teamDetail'),icon:'👩‍🌾',category:'info',readOnly:true}
      ],footer:''});
    },
    showGuide(notebook=[]) {
      this.modal({title:tr('farm.help.title'),icon:'📖',kind:'help',entries:[],footer:tr('farm.help.footer')});
      const sections=tr('farm.help.sections');
      for(const [heading,text] of sections){const section=document.createElement('section'),title=document.createElement('h3'),body=document.createElement('p');title.textContent=heading;body.textContent=text;section.append(title,body);$('farm-modal-items').append(section);}
      // Heaven notebook (onboarding-flow 3.1): learned tips with their effect, or a button to answer again now.
      const book=document.createElement('section'),bookTitle=document.createElement('h3'),bookIntro=document.createElement('p');
      bookTitle.textContent=tr('farm.help.notebook',{n:notebook.filter(item=>item.learned).length,total:notebook.length});bookIntro.textContent=tr('farm.help.notebookIntro');book.append(bookTitle,bookIntro);
      for(const item of notebook){
        const row=document.createElement('div'),text=document.createElement('p');row.className='farm-notebook-row';text.textContent=`${item.learned?'✓':'○'} ${item.name} · ${item.effect}`;row.append(text);
        if(!item.learned){const button=document.createElement('button');button.type='button';button.className='ui-btn ui-btn--go ui-btn--sm';button.disabled=item.wait>0;button.textContent=item.wait?tr('farm.help.reviewIn',{n:item.wait}):tr('farm.help.review');button.addEventListener('click',()=>callbacks.shortcut(`lesson:${item.id}`),options);row.append(button);}
        book.append(row);
      }
      $('farm-modal-items').append(book);
    },
    rejectDrop(x,y,icon) { popNumber(`🚫 ${icon}`,{x,y},'bad'); },
    flyReward(kind,quantity,point) {
      if(quantity<=0)return;
      const coins=kind==='coins',format=coins?formatCoins:formatMass;
      flyTo(point,coins?$('farm-coins').parentElement:$('farm-bag-toggle'),{icon:coins?'🪙':'🧺',text:`+${format(quantity)}`,amount:quantity,format});
    },
    closeSeedStrip() { seedStrip.hidden = true; seedKey = ''; },
    closeModal,
    // action = { label, action }: một nút trong toast (vd «Nhắc», «Thuê robot thay»), chạy callbacks.shortcut(action); toast có nút đứng 6 s.
    notice(text, success = true, action = null) {
      const notice=$('farm-notice');
      const message=String(text);
      notice.classList.remove('ui-toast--unlock');notice.textContent=message;notice.dataset.success=String(success);notice.setAttribute('role',success?'status':'alert');notice.hidden=false;noticeUntil=performance.now()+(action?6000:3000);
      if(action){const button=document.createElement('button');button.type='button';button.className='ui-btn ui-btn--sm ui-btn--go ui-toast__action';button.textContent=action.label;button.addEventListener('click',()=>{notice.hidden=true;noticeUntil=0;callbacks.shortcut(action.action);},{once:true});notice.append(' ',button);}
    },
    update() { if (noticeUntil && performance.now() > noticeUntil) { $('farm-notice').hidden = true; noticeUntil = 0; } },
    handleModalKey(event) {
      if (!isModalOpen()) return false;
      // A confirm <dialog> closes itself on Escape; keep the modal underneath open.
      if (event.code === 'Escape' && document.querySelector('dialog[open]')) return true;
      if (event.code === 'Escape') { event.preventDefault(); callbacks.close(); return true; }
      if (event.code === 'Tab') {
        const buttons = [...(!backButton.hidden?[backButton]:[]),$('farm-modal-close'), ...(!profileAlert.hidden&&!profilePay.hidden&&!profilePay.disabled?[profilePay]:[]), ...(!tabs.hidden ? tabs.children : []), ...$('farm-modal-items').querySelectorAll('button:not(:disabled):not([hidden])'), ...(!bagDetail.hidden ? bagDetail.querySelectorAll('button') : [])];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
      return true;
    },
    activate() { $('farm-hud').hidden = false; $('farm-toolbelt').hidden = true; $('heaven-controls').hidden = isModalOpen(); },
    dispose() {
      staffDrag?.ghost?.remove();staffDrag=null;document.body.classList.remove('farm-staff-dragging');document.querySelectorAll('.farm-staff-drop-hover,.farm-staff-lifted').forEach(node=>node.classList.remove('farm-staff-drop-hover','farm-staff-lifted'));dismissDialog.remove();tradeDialog.remove();seedResize.disconnect();events.abort(); document.body.classList.remove('farm-active'); $('farm-hud').hidden = true; $('farm-toolbelt').hidden = true; $('farm-modal').hidden = true;
      $('farm-notice').hidden = true; document.body.classList.remove('farm-menu-open');for(const id of ['farm-bag-toggle','farm-shop-toggle','farm-upgrade-toggle','farm-help-toggle'])$('farm-shortcuts').append($(id));coachBox.remove();for(const button of Object.values(unlockButtons))button.classList.remove('ui-new','ui-attention');guideHint.remove();document.querySelector('#farm-hud .quest-tracker')?.classList.remove('ui-attention');document.body.append($('farm-shortcuts'));primaryNav.remove();backButton.remove();profileAlert.remove();profileSummary.remove();blockerPanel.remove();menuToggle.remove();$('farm-hud').append(document.querySelector('.farm-resources'));journalPanel.remove();rightHud.remove();document.body.append(viewControls);tabs.remove();stationPanel.remove();workerSheet.remove(); operationHud.remove();management.remove();drawer.remove(); toolsPrompt.remove(); seedStrip.remove();bagDetail.remove();ghost.remove();
    },
  };
}
