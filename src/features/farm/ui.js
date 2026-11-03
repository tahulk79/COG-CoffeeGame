import { formatMass,formatCoins,workerLevel,workerStat,workerWage,contractPlan,contractPrice,contractLeft,WORK_DAY_MS } from './rules.js';
import { editDragSelection } from './tools.js';
import { TOOLS, xpForLevel } from './content.js';
import { flyTo, popNumber } from '../../shared/vfx/index.js';
import { sfx } from '../../shared/audio/index.js';
const gameIcon = icon => ({'✦':'👆','❧':'🌱','◒':'💧','⌁':'🌿','✚':'🪴','♧':'🧺','▣':'🎒','▧':'🏡','☀':'☀️','◇':'📦','₫':'🪙','♨':'🔥','⚙':'⚙️'}[icon] || icon);
const $ = id => document.getElementById(id);

export function createFarmUI(callbacks) {
  const events = new AbortController(), options = { signal: events.signal };
  const purchaseQuantities=new Map();
  const operationEvents=[];let previousBlockers=new Map();
  let modalStructureKey = '';
  let modalKey = '', restoreFocus = null;
  // Trạng thái mở chỉ đọc từ thuộc tính hidden: cờ riêng từng lệch với DOM làm modal() bỏ qua bước hiện.
  const isModalOpen = () => !$('farm-modal').hidden;
  let noticeUntil = 0, currentEntries = [], bagCategory = 'all', seedKey = '', bagSelection = null;
  const seedStrip = document.createElement('section'); seedStrip.id = 'farm-seed-strip'; seedStrip.hidden = true; seedStrip.setAttribute('aria-label','Chọn hạt giống cho ô đang sáng'); document.body.append(seedStrip);
  function syncSeedArrows(){
    const row=seedStrip.querySelector('.farm-seed-row'),left=seedStrip.querySelector('[data-scroll="left"]'),right=seedStrip.querySelector('[data-scroll="right"]');
    if(!row||!left||!right)return;left.disabled=row.scrollLeft<=1;right.disabled=row.scrollLeft+row.clientWidth>=row.scrollWidth-1;
  }
  const seedResize=new ResizeObserver(syncSeedArrows);seedResize.observe(seedStrip);
  const toolsPrompt = document.createElement('button'); toolsPrompt.id = 'farm-tools-prompt'; toolsPrompt.type = 'button'; toolsPrompt.hidden = true;
  toolsPrompt.textContent = '⛏️'; toolsPrompt.setAttribute('aria-label','Mở công cụ'); toolsPrompt.setAttribute('aria-haspopup','true');
  toolsPrompt.addEventListener('click',callbacks.tools,options); document.body.append(toolsPrompt);
  const operationHud=document.createElement('div');operationHud.id='farm-operation-hud';operationHud.setAttribute('aria-live','off');$('farm-hud').append(operationHud);
  const management=document.createElement('nav');management.id='farm-management';management.setAttribute('aria-label','Điều hành');
  for(const [id,icon,label] of [['workers','👩‍🌾','Nhân viên'],['farm-plan','🗂️','Quản lý'],['jobs','📋','Nhiệm vụ'],['order-board','📦','Đơn hàng'],['build','🏡','Xây dựng'],['settings','⚙️','Cài đặt'],['cafe-play','☕','Vào quán']]){const button=document.createElement('button');button.type='button';button.dataset.shortcut=id;if(id!=='cafe-play')button.dataset.sfx='none';const graphic=document.createElement('span');graphic.textContent=icon;const text=document.createElement('small');text.textContent=label;button.append(graphic,text);button.addEventListener('click',()=>callbacks.shortcut(id),options);management.append(button);}$('farm-shortcuts').append(management);
  const menuToggle=document.createElement('button');menuToggle.id='farm-menu-toggle';menuToggle.type='button';menuToggle.setAttribute('aria-controls','farm-main-nav');document.body.append(menuToggle);
  function setMenuOpen(open){document.body.classList.toggle('farm-menu-open',open);menuToggle.textContent=open?'›':'‹';menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Thu gọn menu':'Mở menu');}
  setMenuOpen(true);
  menuToggle.addEventListener('click',()=>setMenuOpen(!document.body.classList.contains('farm-menu-open')),options);
  $('farm-help-toggle').querySelector('span').textContent='📖';
  const profileButton=document.querySelector('.farm-profile');
  profileButton.addEventListener('click',()=>callbacks.shortcut('center'),options);
  profileButton.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callbacks.shortcut('center');}},options);
  const viewControls=$('farm-view-controls');
  const journalPanel=document.createElement('details');journalPanel.id='farm-journal';journalPanel.open=true;const journalTitle=document.createElement('summary');journalTitle.textContent='Hoạt động nông trại';const journalBody=document.createElement('div');journalPanel.append(journalTitle,journalBody);document.body.append(journalPanel);let journalKey='';
  const primaryNav=document.createElement('nav');primaryNav.id='farm-main-nav';primaryNav.setAttribute('aria-label','Menu chính');
  for(const [id,symbol,label]of [['farm-map-toggle','🗺️','Bản đồ'],['farm-bag-toggle','🎒','Kho'],['farm-shop-toggle','🏪','Cửa hàng'],['farm-upgrade-toggle','🔧','Nâng cấp']]){const button=$(id);button.replaceChildren();const icon=document.createElement('span');icon.textContent=symbol;const text=document.createElement('small');text.textContent=label;button.append(icon,text);primaryNav.append(button);}primaryNav.append($('farm-shortcuts'));document.body.append(primaryNav);
  // Dải menu cuộn ngang, mũi tên hai bên; mũi tên mờ khi đã tới đầu/cuối.
  const navTrack=document.createElement('div');navTrack.id='farm-main-nav-track';navTrack.append(...primaryNav.childNodes);
  const navArrow=(dir,label)=>{const button=document.createElement('button');button.type='button';button.className='farm-nav-arrow';button.textContent=dir<0?'‹':'›';button.setAttribute('aria-label',label);button.addEventListener('click',()=>navTrack.scrollBy({left:dir*navTrack.clientWidth*.75,behavior:'smooth'}),options);return button;};
  const navPrev=navArrow(-1,'Xem mục trước'),navNext=navArrow(1,'Xem mục sau');primaryNav.append(navPrev,navTrack,navNext);
  const syncNavArrows=()=>{navPrev.disabled=navTrack.scrollLeft<=1;navNext.disabled=navTrack.scrollLeft+navTrack.clientWidth>=navTrack.scrollWidth-1;};
  navTrack.addEventListener('scroll',syncNavArrows,{...options,passive:true});
  const navResize=new ResizeObserver(syncNavArrows);navResize.observe(navTrack);events.signal.addEventListener('abort',()=>navResize.disconnect());
  const blockerPanel=document.createElement('details');blockerPanel.id='farm-blockers';blockerPanel.open=true;const blockerTitle=document.createElement('summary'),blockerBody=document.createElement('div');blockerPanel.append(blockerTitle,blockerBody);document.querySelector('.farm-left-hud').append(operationHud,blockerPanel);let blockersKey='';
  const quickNav=document.createElement('nav');quickNav.id='farm-quick-nav';quickNav.setAttribute('aria-label','Đi lại và hướng dẫn');quickNav.append(management.querySelector('[data-shortcut="settings"]'),$('farm-map-toggle'),management.querySelector('[data-shortcut="cafe-play"]'),$('farm-help-toggle'));
  const rightHud=document.createElement('div');rightHud.id='farm-right-hud';rightHud.append(document.querySelector('.farm-resources'),quickNav);$('farm-hud').append(rightHud);document.querySelector('.farm-left-hud').append(journalPanel);
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
    ghost.textContent=`${!valid ? '🚫 ' : ''}${toolDrag.icon} ${toolDrag.ids.length}/${toolDrag.limit}${full ? ' · Đủ' : ''}`;
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

  const tabs = document.createElement('nav'); tabs.id = 'farm-bag-tabs'; tabs.setAttribute('aria-label', 'Nhóm vật phẩm');
  $('farm-modal-items').before(tabs);
  const workerSheet=document.createElement('section');workerSheet.id='farm-worker-sheet';workerSheet.hidden=true;$('farm-modal-items').before(workerSheet);
  const stationPanel=document.createElement('section');stationPanel.id='farm-station-panel';stationPanel.hidden=true;tabs.before(stationPanel);
  const bagDetail=document.createElement('div');bagDetail.id='farm-bag-detail';bagDetail.hidden=true;$('farm-modal-items').after(bagDetail);
  function renderBagDetail() {
    bagDetail.hidden=$('farm-modal').dataset.kind !== 'bag';if(bagDetail.hidden)return;
    const visible=currentEntries.filter(entry=>bagCategory==='all'||entry.category===bagCategory);
    const entry=visible.find(item=>item.id===bagSelection)||visible[0];bagSelection=entry?.id;
    bagDetail.replaceChildren();
    const name=document.createElement('strong');name.textContent=entry?.label || 'Túi đồ trống';
    const text=document.createElement('small');text.textContent=entry ? `Số lượng: ${entry.quantity} · ${entry.detail}` : 'Thu hoạch để cất sản phẩm vào túi.';
    bagDetail.append(name,text);
    if(entry?.bagSale){
      const bar=document.createElement('div');bar.className='farm-purchase-bar farm-sale-bar';
      const minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),sell=document.createElement('button'),quoteText=document.createElement('small');
      minus.type=plus.type=sell.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label','Giảm số gram bán');plus.setAttribute('aria-label','Tăng số gram bán');
      input.type='number';input.min='1';input.max=Math.min(99,entry.bagSale.owned);input.step='1';input.setAttribute('aria-label','Số gram muốn bán');input.value=purchaseQuantities.get(entry.id)||Math.min(99,entry.bagSale.owned);
      quoteText.className='farm-bag-sale-quote';sell.className='farm-purchase-buy ui-btn ui-btn--gold';sell.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span><span>Bán</span>';
      function update(value,typing){const grams=Math.max(1,Math.min(99,entry.bagSale.owned,Math.floor(Number(value)||1)));if(!typing)input.value=grams;purchaseQuantities.set(entry.id,grams);minus.disabled=grams===1;plus.disabled=grams>=Math.min(99,entry.bagSale.owned);const quote=callbacks.saleQuote(entry.id,grams);sell.disabled=!quote.ok;quoteText.textContent=quote.ok?`Bán ${formatMass(grams)} · Nhận ${formatCoins(quote.value)} xu`:quote.message;}
      minus.addEventListener('click',()=>update(Number(input.value)-1));plus.addEventListener('click',()=>update(Number(input.value)+1));input.addEventListener('input',()=>{if(input.value!=='')update(input.value,true);});input.addEventListener('change',()=>update(input.value));sell.addEventListener('click',()=>callbacks.sell(entry.id,purchaseQuantities.get(entry.id)));
      bar.append(minus,input,plus,sell);bagDetail.append(quoteText,bar);update(input.value);
    }

    for(const slot of $('farm-modal-items').querySelectorAll('button'))slot.setAttribute('aria-pressed',String(slot.dataset.entry===bagSelection));
  }
  const dismissDialog=document.createElement('dialog');dismissDialog.className='farm-dismiss-dialog';
  const dismissTitle=document.createElement('h3'),dismissText=document.createElement('p'),dismissActions=document.createElement('div'),dismissCancel=document.createElement('button'),dismissConfirm=document.createElement('button');
  const dismissArt=document.createElement('div');dismissArt.className='farm-dialog-art';dismissArt.textContent='👩‍🌾';dismissArt.setAttribute('aria-hidden','true');
  dismissTitle.textContent='Xóa nhân viên?';dismissCancel.textContent='Giữ lại';dismissConfirm.textContent='Xóa khỏi đội';dismissCancel.type=dismissConfirm.type='button';dismissActions.append(dismissCancel,dismissConfirm);dismissActions.className='farm-dialog-actions';dismissDialog.append(dismissTitle,dismissArt,dismissText,dismissActions);document.body.append(dismissDialog);
  let dismissId=null;
  dismissCancel.addEventListener('click',()=>dismissDialog.close(),options);
  dismissConfirm.addEventListener('click',()=>{const id=dismissId;dismissDialog.close();if(id)callbacks.shortcut(`dismiss-worker:${id}`);},options);
  function showDismiss(staff){dismissId=staff.id.slice(8);dismissText.textContent=staff.staffUnpaid?`${staff.label} chưa được trả lương. Hãy thanh toán trước khi xóa.`:`Xóa ${staff.label} khỏi đội ngũ? Nhân viên sẽ biến mất khỏi đội và danh sách tuyển dụng.`;dismissConfirm.disabled=staff.staffUnpaid;dismissDialog.showModal();dismissCancel.focus();}
  const tradeDialog=document.createElement('dialog');tradeDialog.className='farm-dismiss-dialog farm-trade-dialog';
  const tradeTitle=document.createElement('h3'),tradeText=document.createElement('p'),tradeArt=document.createElement('div'),tradeClose=document.createElement('button'),tradeActions=document.createElement('div'),tradeCancel=document.createElement('button'),tradeConfirm=document.createElement('button');
  tradeArt.className='farm-trade-art';tradeArt.setAttribute('aria-hidden','true');tradeClose.type='button';tradeClose.className='farm-trade-close';tradeClose.textContent='×';tradeClose.setAttribute('aria-label','Đóng xác nhận');tradeCancel.type=tradeConfirm.type='button';tradeCancel.textContent='Để sau';tradeConfirm.textContent='Xác nhận';tradeActions.className='farm-trade-actions';tradeActions.append(tradeCancel,tradeConfirm);tradeDialog.append(tradeClose,tradeTitle,tradeArt,tradeText,tradeActions);document.body.append(tradeDialog);
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
  function formatMassIfNeeded(value,unit){return unit.startsWith('g')?`${formatMass(value)}${unit.includes('/')?'/'+unit.split('/')[1]:''}`:`${value.toLocaleString('vi-VN')} ${unit}`;}
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
      help.textContent=$('farm-modal-title').textContent==='Nhiệm vụ của bạn'?'🎯 Bạn tự làm nhiệm vụ. Nhân viên chỉ xử lý đơn cho quán.':bagCategory==='transit'?'🚚 Hàng đang tới quán. Tự hoàn tất khi giao đến nơi.':bagCategory==='ready'?'📦 Kho đã đủ cà phê cho từng đơn bên dưới. Bấm Chuyển để gửi về quán.':'👩‍🌾 Đơn chưa đủ hàng. Bấm Giao nhân viên để chọn người chuẩn bị.';
      help.hidden=false;
      let empty=$('farm-modal-items').querySelector('.farm-jobs-empty');
      if(!empty){empty=document.createElement('p');empty.className='farm-jobs-empty';$('farm-modal-items').append(empty);}
      empty.textContent=$('farm-modal-title').textContent==='Nhiệm vụ của bạn'?'🌟 Bạn đã hoàn thành hết nhiệm vụ. Quay lại vào ngày mới nhé!':bagCategory==='transit'?'🚚 Không có chuyến hàng đang chuyển.':bagCategory==='ready'?'📦 Chưa có đơn đủ hàng để chuyển.':'🌱 Không có đơn cần chuẩn bị.';
      empty.hidden=[...$('farm-modal-items').children].some(item=>item.matches('button')&&!item.hidden);
    }
    for (const button of tabs.children) button.setAttribute('aria-pressed',String(button.dataset.category === bagCategory));
    workerSheet.hidden=$('farm-modal').dataset.kind!=='worker'||(workerSheet.dataset.profile!=='candidate'&&bagCategory!=='training');
    renderBagDetail();
  }
  document.body.classList.add('farm-active');
  $('farm-hud').hidden = false; $('farm-toolbelt').hidden = true;
  $('game').setAttribute('aria-label','Nông trại cà phê');
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
  for (const [button, id] of [['farm-help-toggle','help'],['farm-shop-toggle','seed-shop'],['farm-market-toggle','market'],['farm-upgrade-toggle','upgrades'],['farm-zoom-in','zoom-in'],['farm-zoom-out','zoom-out']]) {
    $(button).addEventListener('click', () => callbacks.shortcut(id), options);
    if (!id.startsWith('zoom')) $(button).dataset.sfx = 'none'; // modal() tự kêu ui.open, tránh kêu đôi
  }
  $('farm-bag-toggle').dataset.sfx = 'none'; document.querySelector('.farm-coin').dataset.sfx = 'none';
  const backButton=document.createElement('button');backButton.id='farm-modal-back';backButton.type='button';backButton.textContent='‹';backButton.hidden=true;backButton.setAttribute('aria-label','Quay lại danh sách nhân viên');backButton.title='Danh sách nhân viên';$('farm-modal-close').parentElement.prepend(backButton);
  backButton.addEventListener('click',()=>callbacks.back(),options);
  const profileAlert=document.createElement('div');profileAlert.id='farm-profile-alert';profileAlert.hidden=true;
  const profileAlertText=document.createElement('span'),profilePay=document.createElement('button');profilePay.type='button';profilePay.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span><span>Trả lương</span>';
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
      if(item.state==='construction')entries.push({id:'resume-decoration',label:'Tiếp tục xây',detail:`Đã xây ${Math.floor(item.buildMs/item.buildDuration*100)}% · Không thu thêm xu`,icon:'🔨',badge:'Tiếp tục',onChoose:()=>{this.closeModal();onBuild();}});
      entries.push({id:'demolish-decoration',label:'Phá dỡ',detail:'Nhân vật tới tháo đồ. Không hoàn lại xu.',icon:'🪓',badge:'Phá dỡ',onChoose:()=>{this.closeModal();this.confirmTrade('Phá dỡ trang trí',`Phá dỡ ${spec.name}? Đồ sẽ biến mất sau khi nhân vật tháo xong. Không hoàn lại xu.`,onDemolish,spec.icon);}});
      this.modal({title:spec.name,subtitle:item.state==='construction'?'Đang thi công · Có thể tiếp tục hoặc phá dỡ':'Trang trí đã hoàn tất',icon:spec.icon,kind:'confirm',entries,footer:''});
    },
    confirmTrade(title,text,action,itemIcon=null){tradeTitle.textContent=title;tradeText.textContent=text;const buying=title.includes('mua');tradeArt.textContent=gameIcon(itemIcon||currentEntries.find(entry=>text.includes(entry.label))?.icon||(buying?'🌱':'📦'));tradeConfirm.textContent=title.includes('Phá dỡ')?'Phá dỡ':title.includes('Xây')?'Xây ngay':buying?'Mua ngay':title.includes('Nhận')?'Nhận đơn':'Bán ngay';tradeAction=action;tradeConfirm.disabled=false;if(!tradeDialog.open)tradeDialog.showModal();tradeCancel.focus();},
    workerProfile(worker,assignment={orders:[],dailyTasks:[]}) {
      const candidate=!Number.isFinite(worker.xp);
      profileSummary.hidden=candidate;profileSummary.textContent=candidate?'':`Gói ${contractPlan(worker).name.toLowerCase()} ${contractPrice(worker)} xu · ${contractLeft(worker.shiftUntil-Date.now())} · Đã làm ${Math.floor((worker.serviceMs||0)/WORK_DAY_MS)} ngày`;
      if(!candidate){
        const unpaid=worker.shiftUntil<=Date.now();
        profileAlert.dataset.warning=String(unpaid);profilePay.hidden=false;profilePay.dataset.worker=worker.id;
        profilePay.disabled=false;profilePay.title=`Ký hợp đồng ${contractPlan(worker).name.toLowerCase()} · ${contractPrice(worker)} xu`;
        profilePay.lastElementChild.textContent=`Gia hạn ${contractPrice(worker)} xu`;
        profileAlertText.textContent=unpaid?`Hết hợp đồng · ${worker.name} đang dừng việc`:`${contractLeft(worker.shiftUntil-Date.now())} · ${worker.farmId==='farm-0'?'Tại farm':'Dự bị'} · ${worker.state||'Chờ nhận việc'}`;
      }else profileAlert.dataset.warning='false';

      workerSheet.dataset.profile=candidate?'candidate':'employee';
      $('farm-modal').dataset.workerProfile=workerSheet.dataset.profile;
      workerSheet.hidden=!candidate&&bagCategory!=='training';workerSheet.replaceChildren();
      if(candidate){
        const bio=document.createElement('p');bio.className='farm-candidate-bio';bio.textContent=worker.bio||'Sẵn sàng nhận việc, chỉ chờ chủ gật đầu!';workerSheet.append(bio);
        const summary=document.createElement('p');summary.className='farm-candidate-summary';summary.textContent=`Phí thuê ${worker.fee} xu · Lương ${workerWage({...worker,xp:0})} xu/ngày (6 phút) · Gói tuần ${workerWage({...worker,xp:0})*6} xu`;workerSheet.append(summary);
        const labels={speed:'Tốc độ',intelligence:'Thông minh',strength:'Sức mạnh',dexterity:'Khéo léo',constitution:'Thể lực gốc'};
        const strengths=Object.entries(worker.stats).sort((a,b)=>b[1]-a[1]).slice(0,2);
        const specialty=document.createElement('p');specialty.className='farm-candidate-summary';specialty.textContent='Chỉ số nổi bật: '+strengths.map(([key,value])=>`${labels[key]} ${value}/100`).join(' · ');workerSheet.append(specialty);
      }
      const lv=workerLevel(worker.xp||0),heading=document.createElement('strong');heading.textContent=`Cấp ${lv}/10${Number.isFinite(worker.energy)?` · Thể lực ${Math.round(worker.energy)}%`:''}`;workerSheet.append(heading);
      if(Number.isFinite(worker.xp)){const xp=document.createElement('small');xp.textContent=lv<10?`Kinh nghiệm ${worker.xp} / ${100*lv*lv} · Hoàn thành việc +5 XP`:'Đã đạt cấp tối đa';workerSheet.append(xp);}
      for(const [key,label]of [['speed','Tốc độ'],['intelligence','Thông minh'],['strength','Sức mạnh'],['dexterity','Khéo léo'],['constitution','Thể lực gốc']]){
        const value=workerStat({...worker,xp:worker.xp||0},key),row=document.createElement('div'),name=document.createElement('span'),bar=document.createElement('meter'),number=document.createElement('b');
        name.textContent=label;bar.min=0;bar.max=100;bar.value=value;bar.setAttribute('aria-label',label);number.textContent=String(value);row.append(name,bar,number);workerSheet.append(row);
      }
      const assigned=[...assignment.orders.filter(o=>o.workers.includes(worker.id)&&o.status!=='delivered').map(o=>`Đơn ${formatMass(o.grams)} · ${o.status==='transit'?'Đang giao':'Chuẩn bị'}`)];
      const tasks=document.createElement('p');tasks.className='farm-assigned-work';tasks.textContent=assigned.length?'Việc được giao: '+assigned.slice(0,3).join(' · ')+(assigned.length>3?` · +${assigned.length-3} việc`:''):candidate?'Sau khi thuê, bố trí vào nông trại; thợ tự làm theo chỉ thị trong Quản lý.':'Chưa có đơn cho quán được giao.';workerSheet.append(tasks);
    },
    currentFilter(){return bagCategory;},
    selectFilter(id){bagCategory=id;filterBag();$('farm-modal-items').scrollTop=0;},
    orderProgress(steps,info){
      $('farm-modal').dataset.orderDetail='true';profileAlert.hidden=true;profileSummary.hidden=true;backButton.setAttribute('aria-label','Quay lại danh sách đơn');backButton.title='Danh sách đơn';
      workerSheet.hidden=false;workerSheet.replaceChildren();
      const summary=document.createElement('div');summary.className='farm-order-summary';
      const heading=document.createElement('strong'),detail=document.createElement('small');
      heading.textContent=info.status==='transit'?'🚚 Đang chuyển về quán':info.status==='delivered'?'✓ Quán đã nhận hàng':info.ready?'📦 Đủ hàng · Chờ chuyển':'🌱 Đang chuẩn bị cà phê';
      detail.textContent=info.status==='transit'?`Còn ${info.seconds} giây · Đã đi ${Math.floor(info.progress*100)}%`:info.status==='delivered'?'Chuyến hàng đã hoàn tất.':info.ready?'Kho đã đủ cà phê. Bấm Chuyển về quán bên dưới.':info.crew?`Phụ trách: ${info.crew}`:'Chọn nhân viên bên dưới để chuẩn bị đơn.';
      summary.append(heading,detail);
      if(info.progress!==null){const progress=document.createElement('progress');progress.max=1;progress.value=info.progress;progress.className='farm-job-progress';progress.setAttribute('aria-label','Tiến độ vận chuyển');summary.append(progress);}
      workerSheet.append(summary);
      const list=document.createElement('ol');list.className='farm-order-timeline';
      for(const [index,step]of steps.entries()){
        const item=document.createElement('li'),marker=document.createElement('span'),text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');
        item.dataset.done=String(step.done);marker.className='farm-order-marker';marker.textContent=step.done?'✓':String(index+1);name.textContent=step.label;
        detail.textContent=info.status==='transit'&&index<4?'Đã chuẩn bị và xuất kho':info.status==='delivered'?'Đã hoàn tất':step.detail;
        text.append(name,detail);item.append(marker,text);list.append(item);
      }
      workerSheet.append(list);
    },
    operationHud({today,weather,workers,demand,storage,capacity}) {
      operationHud.replaceChildren();
      for(const line of [`Hôm nay · Hái ${formatMass(today?.harvested||0)}`,`Chế biến ${formatMass(today?.processed||0)} · Bán ${formatCoins(today?.revenue||0)} xu`,`Kho ${formatMass(storage)} / ${formatMass(capacity)}`]){const text=document.createElement('span');text.textContent=line;operationHud.append(text);}
      operationHud.title=`Quán dự báo ${demand.cups} ly/ngày · Cần giao thêm ${formatMass(demand.needed)}`;
    },
    blockers(items){
      const key=JSON.stringify(items);if(key===blockersKey)return;blockersKey=key;
      const current=new Map(items.map(item=>[item.id,item]));
      for(const item of items)if(!previousBlockers.has(item.id))operationEvents.push({text:`Cần xử lý: ${item.text}`,at:Date.now()});
      for(const [id,item]of previousBlockers)if(!current.has(id))operationEvents.push({text:`Không còn vướng mắc: ${item.text}`,at:Date.now()});
      previousBlockers=current;if(operationEvents.length>60)operationEvents.splice(0,operationEvents.length-60);
const title=document.createElement('span');title.textContent=items.length?'📌 Cần xử lý':'🌿 Nông trại ổn';const count=document.createElement('b');count.className='farm-hud-count';count.textContent=String(items.length);blockerTitle.replaceChildren(title,count);const scroll=blockerBody.scrollTop;blockerBody.replaceChildren();
      for(const item of items){const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');text.textContent=item.text;button.type='button';button.textContent=item.label;button.addEventListener('click',()=>callbacks.shortcut(item.action),options);row.append(text,button);blockerBody.append(row);}blockerBody.scrollTop=scroll;
    },
    journal(events,workers,reputation){
      events=[...events,...operationEvents].sort((a,b)=>a.at-b.at).slice(-100);
      const key=JSON.stringify([events,workers.map(w=>[w.name,w.state,w.farmId]),reputation]);if(key===journalKey)return;journalKey=key;journalBody.replaceChildren();const title=document.createElement('span');title.textContent='📖 Hoạt động';const score=document.createElement('small');score.textContent=`Uy tín ${reputation}/100`;journalTitle.replaceChildren(title,score);
      for(const worker of workers.filter(w=>w.farmId==='farm-0')){const row=document.createElement('p');row.className='journal-worker';row.textContent=`${worker.name}: ${worker.state||'Chuẩn bị làm'}`;journalBody.append(row);}
      for(const event of events.slice().reverse()){const row=document.createElement('p');row.textContent=event.text;journalBody.append(row);}
    },
    toolsPrompt(visible, point) {
      toolsPrompt.hidden = !visible;
      if (visible) { toolsPrompt.style.left = `${point.x}px`; toolsPrompt.style.top = `${point.y}px`; }
    },
    get modalOpen() { return isModalOpen(); },
    hud({ coins, level, xp, water, capacity, tool, quest, seedName, playerName, orders = [], order, workers = [], dailyTasks = [] }) {
      const staffButton=management.querySelector('[data-shortcut="workers"]');staffButton.querySelector('small').textContent=`Nhân viên (${workers.length})`;staffButton.setAttribute('aria-label',`Nhân viên · ${workers.length} đã thuê · ${workers.filter(w=>w.farmId==='farm-0').length}/2 đang bố trí`);
      const orderCount=orders.filter(item=>item.source!=='shop'&&!['delivered','expired'].includes(item.status)).length;
      const orderButton=management.querySelector('[data-shortcut="order-board"]');
      orderButton.querySelector('small').textContent=`Đơn hàng (${orderCount})`;
      orderButton.setAttribute('aria-label',`Đơn hàng · ${orderCount} đơn chưa hoàn thành`);
      const newOrders=orders.filter(item=>item.source!=='shop'&&item.status==='open'&&!item.workers.length).length;
      orderButton.dataset.notification=String(newOrders>0);orderButton.setAttribute('aria-label',`Đơn hàng · ${orderCount} đơn chưa hoàn thành${newOrders?` · ${newOrders} đơn chờ phân công`:''}`);
      const taskButton=management.querySelector('[data-shortcut="jobs"]'),rewards=dailyTasks.filter(task=>!task.claimed&&task.done>=task.goal).length;
      taskButton.dataset.notification=String(rewards>0);taskButton.setAttribute('aria-label',`Nhiệm vụ${rewards?` · ${rewards} phần thưởng chờ nhận`:''}`);

      $('farm-coins').textContent = formatCoins(coins); $('farm-level').textContent = level;$('farm-level').setAttribute('aria-label',`Cấp ${level}`);
      $('farm-player-name').textContent = playerName || 'Nông trại cà phê';
      const base=xpForLevel(level),next=level<999?xpForLevel(level+1):null,ratio=next ? Math.max(0,Math.min(1,(xp-base)/(next-base))) : 1;
      $('farm-xp-fill').style.width=`${ratio*100}%`;
      $('farm-xp-label').textContent=next?`${xp-base} / ${next-base} XP`:'Cấp tối đa';
      const track=$('farm-xp-fill').parentElement;track.setAttribute('aria-valuenow',String(Math.round(ratio*100)));track.title=next ? `${xp-base}/${next-base} XP` : 'Đã đạt cấp tối đa';
      $('farm-objective').textContent = quest?.title || 'Xây nông trại của bạn';
      $('farm-detail').textContent = quest?.detail || 'Mở đất, thử giống mới, nâng xưởng và hoàn thành đơn hàng.';
      $('farm-tool-hint').textContent = `${(TOOLS.find(item => item.id === tool)?.name || 'Công cụ')} · ${seedName}`;
      for (const button of $('farm-tools').children) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    },
    modal({ title, subtitle = '', icon = '❧', entries, footer = '', kind = 'shop', filters = [], back = false, roster = false, station = null }) {
      stationPanel.hidden=!station;
      if(station){
        stationPanel.replaceChildren();
        const info=document.createElement('div'),level=document.createElement('strong'),capacity=document.createElement('p'),benefit=document.createElement('small');
        level.textContent=`Cấp ${station.level}/${station.max} · ${station.tier}`;capacity.textContent=`Hiện tại: ${formatMassIfNeeded(station.current,station.unit)}`;benefit.textContent=station.benefit;info.append(level,capacity,benefit);
        const upgrade=document.createElement('div'),next=document.createElement('small'),button=document.createElement('button');button.type='button';
        next.textContent=station.next===null?'Đã đạt cấp tối đa':`Cấp tiếp: ${formatMassIfNeeded(station.next,station.unit)}`;
        button.textContent=station.lock||`Nâng cấp · ${formatCoins(station.price)} xu`;button.disabled=Boolean(station.lock);button.addEventListener('click',()=>callbacks.upgradeStation(station.id));upgrade.append(next,button);stationPanel.append(info,upgrade);if(station.feedback){const feedback=document.createElement('p');feedback.className='farm-station-feedback';feedback.textContent=station.feedback;stationPanel.append(feedback);}
      }
      const key = JSON.stringify({ title, subtitle, icon, entries, footer, kind, filters, back, station });
      $('farm-modal').dataset.orderDetail='false';backButton.setAttribute('aria-label','Quay lại danh sách nhân viên');backButton.title='Danh sách nhân viên';profileSummary.hidden=true;profileAlert.hidden=!back;profileAlertText.textContent=subtitle;profilePay.hidden=true;
      $('farm-modal').dataset.daily=String(title==='Nhiệm vụ của bạn');$('farm-modal').dataset.roster=String(roster);$('farm-modal').dataset.kind = kind;$('farm-modal').dataset.back=String(back);backButton.hidden=!back;workerSheet.hidden=true;
      configureTabs(kind === 'bag' ? [['all','Tất cả'],['seeds','Hạt giống'],['products','Nông sản'],...(entries.some(item=>item.category==='supplies')?[['supplies','Vật tư']]:[])] : filters);
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
      $('farm-modal-title').textContent = title; $('farm-modal-title').dataset.icon=gameIcon(icon); $('farm-modal-subtitle').textContent = subtitle;
      $('farm-modal-icon').textContent = gameIcon(icon); $('farm-modal-footer').textContent = footer; $('farm-modal-footer').hidden = !footer;
      $('farm-modal-items').replaceChildren();
      for (const entry of entries) {
        if(entry.emptyState){
          const empty=document.createElement('div');empty.className='farm-station-empty';empty.dataset.category=entry.category;empty.dataset.entry=entry.id;
          const icon=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');icon.textContent='📦';icon.setAttribute('aria-hidden','true');title.textContent='Chưa có mẻ đang chế biến';detail.textContent='Sang tab Chế biến, chọn lượng nguyên liệu rồi bấm Bắt đầu.';empty.append(icon,title,detail);$('farm-modal-items').append(empty);continue;
        }
        const button = document.createElement(entry.purchase||entry.sale||entry.saleFixed||entry.readOnly||entry.processing||entry.collectOne?'div':'button'); if(!entry.purchase&&!entry.sale&&!entry.saleFixed&&!entry.readOnly&&!entry.processing&&!entry.collectOne)button.type = 'button'; button.dataset.entry = entry.id; if(entry.sfx)button.dataset.sfx=entry.sfx;
        button.setAttribute('aria-label',[entry.label,entry.detail,entry.badge].filter(Boolean).join(' · '));
        button.className = 'farm-menu-item';if(entry.readOnly)button.dataset.readOnly='true'; button.dataset.category = entry.category || 'seeds'; button.disabled = kind !== 'bag' && entry.enabled === false;
        const itemIcon = document.createElement('span'); itemIcon.className = 'farm-item-icon'; itemIcon.textContent = gameIcon(entry.icon || '◇');
        const text = document.createElement('span');
        const name = document.createElement('strong'); name.textContent = entry.label;
        const detail = document.createElement('small'); detail.textContent = entry.detail || '';
        if(entry.staffState){const state=document.createElement('span');state.className='farm-staff-state';state.textContent=entry.staffState;text.append(state);button.dataset.deployed=String(entry.staffDeployed);button.dataset.unpaid=String(entry.staffUnpaid);button.classList.add('farm-staff-card');}
        if(entry.staffAlert)button.classList.add('farm-staff-alert');
        text.append(name);
        if(entry.batchState){button.classList.add('farm-batch-card');button.dataset.batchState=entry.batchState;const state=document.createElement('span');state.className='farm-batch-state';state.textContent=entry.batchState;text.prepend(state);}
        if(entry.taskDay!==undefined){
          button.classList.add('farm-daily-task');
          const day=document.createElement('span');day.className='farm-task-day';day.textContent=`Ngày ${entry.taskDay}`;text.append(day);
          const reward=document.createElement('span');reward.className='farm-task-reward';reward.textContent=`Thưởng ${entry.taskReward} xu`;text.append(reward);
        }

        if (entry.level) { const level = document.createElement('span'); level.className='farm-item-level'; level.textContent=`Cấp ${entry.level}`; text.append(level); }
        text.append(detail);
        if((kind==='jobs'||entry.batchProgress!==undefined)&&entry.progress!==undefined){const progress=document.createElement('progress');progress.className='farm-job-progress';progress.max=1;progress.value=entry.progress;progress.setAttribute('aria-label',entry.label+' · Tiến độ');text.append(progress);}
        if(kind==='jobs'&&entry.timerRatio!==undefined){
          const label=document.createElement('span');label.className='farm-job-deadline';label.textContent=entry.timerLabel;
          const timer=document.createElement('progress');timer.className='farm-job-progress farm-job-timer';timer.max=1;timer.value=entry.timerRatio;timer.setAttribute('aria-label',entry.timerLabel);
          button.dataset.urgent=String(Boolean(entry.urgent));text.append(label,timer);
        }
        if(kind==='jobs'&&entry.status){const status=document.createElement('span');status.className='farm-job-status';status.textContent=entry.status;text.append(status);button.dataset.ready=String(Boolean(entry.ready));}

        const action = document.createElement('span'); action.className = 'farm-item-action'; action.textContent = entry.enabled === false && entry.lockReason ? `🔒 ${entry.lockReason}` : entry.badge || 'Chọn ▸';
        if(kind==='upgrades'&&!roster&&/\d[\d.,]* xu/.test(entry.badge||'')&&!entry.lockReason){
          const coin=document.createElement('span');coin.className='farm-gold-coin';coin.textContent='₫';coin.setAttribute('aria-hidden','true');
          const price=document.createElement('span');price.textContent=entry.badge;action.replaceChildren(coin,price);action.classList.add('farm-upgrade-price');
        }
        if(entry.switchValue!==undefined){button.classList.add('farm-switch-row');button.setAttribute('role','switch');button.setAttribute('aria-checked',String(entry.switchValue));action.textContent=entry.switchValue?'Bật':'Tắt';}
        button.append(itemIcon, text, action);
        if(entry.id==='deliver-order'){
          button.classList.add('farm-order-deliver');
          const label=document.createElement('span');label.textContent='Chuyển về quán';
          const cost=document.createElement('span');cost.className='farm-order-delivery-cost';
          const coin=document.createElement('span');coin.className='farm-gold-coin';coin.textContent='₫';coin.setAttribute('aria-hidden','true');cost.append(coin,document.createTextNode('2 xu'));
          button.replaceChildren(label,cost);
        }

        if(entry.collectOne){const receive=document.createElement('button');receive.type='button';receive.className='farm-item-action farm-batch-receive';receive.textContent='Nhận';receive.setAttribute('aria-label',`Nhận mẻ ${entry.label}`);receive.addEventListener('click',()=>callbacks.choose(entry.id),options);action.replaceWith(receive);}
        if(entry.processing){
          const config=entry.processing,bar=document.createElement('div'),minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),start=document.createElement('button'),estimate=document.createElement('small');
          bar.className='farm-purchase-bar farm-processing-bar';button.classList.add('farm-processing-card');estimate.className='farm-processing-estimate';
          minus.type=plus.type=start.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label','Giảm lượng chế biến');plus.setAttribute('aria-label','Tăng lượng chế biến');input.type='number';input.min='1';input.max=Math.max(1,Math.min(99,config.maximum));input.step='1';input.value=purchaseQuantities.get(entry.id)||Math.max(1,Math.min(99,config.maximum));input.setAttribute('aria-label','Số phần nguyên liệu');start.className='farm-purchase-buy ui-btn ui-btn--gold';start.textContent='Bắt đầu';
          function update(value,typing){const n=Math.max(1,Math.min(99,Math.max(1,config.maximum),Math.floor(Number(value)||1)));if(!typing)input.value=n;purchaseQuantities.set(entry.id,n);minus.disabled=config.maximum<1||n<=1;plus.disabled=config.maximum<1||n>=Math.min(99,config.maximum);start.disabled=config.maximum<1;estimate.textContent=config.maximum<1?'Chưa đủ nguyên liệu hoặc hàng chờ đã đầy.':`${formatMass(n*config.input)} ${config.inputName.toLowerCase()} → ${formatMass(n*config.output)} ${config.outputName.toLowerCase()} · ${Math.ceil(n/config.perBatch)} mẻ`;}
          minus.addEventListener('click',()=>update(Number(input.value)-1));plus.addEventListener('click',()=>update(Number(input.value)+1));input.addEventListener('input',()=>{if(input.value!=='')update(input.value,true);});input.addEventListener('change',()=>update(input.value));start.addEventListener('click',()=>callbacks.process(entry.id,purchaseQuantities.get(entry.id)));bar.append(minus,input,plus,start);text.append(estimate);action.replaceWith(bar);update(input.value);
        }
        if(entry.purchase||entry.sale){
          const selling=Boolean(entry.sale),config=entry.sale||entry.purchase;
          const owned=document.createElement('small');owned.className='farm-purchase-owned';owned.textContent=`Trong kho: ${selling?formatMass(config.owned):config.owned}`;text.append(owned);
          const quoteText=document.createElement('small');quoteText.className='farm-sale-quote';if(selling)text.append(quoteText);
          const bar=document.createElement('div');bar.className='farm-purchase-bar';button.classList.add('farm-purchase-card');
          if(selling)bar.classList.add('farm-sale-bar');
          const minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input'),buy=document.createElement('button');
          minus.type=plus.type=buy.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label','Giảm số lượng');plus.setAttribute('aria-label','Tăng số lượng');
          const maximum=Math.max(0,Math.min(99,selling?config.owned:Math.floor(config.coins/config.unitPrice))),step=1;
          input.type='number';input.min=maximum>0?'1':'0';input.max=String(maximum);input.disabled=maximum<1;input.step='1';input.value=purchaseQuantities.get(entry.id)||(selling?Math.min(99,maximum):1);input.setAttribute('aria-label',`${selling?'Số gram bán':'Số lượng mua'} ${entry.label}`);
          buy.className='farm-purchase-buy ui-btn ui-btn--gold';
          function updateQuantity(value,typing){
            const quantity=Math.max(maximum>0?1:0,Math.min(maximum,Math.floor(Number(value)||1)));if(!typing)input.value=quantity;purchaseQuantities.set(entry.id,quantity);minus.disabled=quantity<=1;plus.disabled=quantity>=maximum;
            const quote=selling?callbacks.saleQuote(entry.id,quantity):{ok:!config.locked&&config.unitPrice*quantity<=config.coins,value:config.unitPrice*quantity};
            buy.disabled=maximum<1||!quote.ok;buy.replaceChildren();
            const coin=document.createElement('span');coin.className='farm-gold-coin';coin.setAttribute('aria-hidden','true');coin.textContent='₫';
            const price=document.createElement('span');price.textContent=selling?'Bán':config.locked?entry.badge:`${formatCoins(quote.value)} xu`;buy.append(coin,price);
            if(selling){quoteText.textContent=quote.ok?`Khách trả: ${formatCoins(quote.value)} xu · ${quantity.toLocaleString('vi-VN')} g`:quote.message;buy.setAttribute('aria-label',`Bán ${quantity} g ${entry.label}${quote.ok?' nhận '+formatCoins(quote.value)+' xu':''}`);}
            else buy.setAttribute('aria-label',`Mua ${quantity} ${entry.label} với giá ${formatCoins(quote.value)} xu`);
          }
          minus.addEventListener('click',()=>updateQuantity(Number(input.value)-step));plus.addEventListener('click',()=>updateQuantity(Number(input.value)+step));input.addEventListener('input',()=>{if(input.value!=='')updateQuantity(input.value,true);});input.addEventListener('change',()=>updateQuantity(input.value));
          buy.addEventListener('click',()=>{if(selling)callbacks.sell(entry.id,purchaseQuantities.get(entry.id));else callbacks.purchase(entry.id,purchaseQuantities.get(entry.id));});bar.append(minus,input,plus,buy);action.replaceWith(bar);updateQuantity(input.value);
        }else if(entry.saleFixed){
          const sell=document.createElement('button');sell.type='button';sell.className='farm-item-action';sell.textContent=entry.badge;sell.disabled=entry.enabled===false;sell.addEventListener('click',()=>callbacks.choose(entry.id));action.replaceWith(sell);
        }

        if(kind==='bag'){const count=document.createElement('b');count.className='bag-count';count.textContent=entry.quantity;button.append(count);}
        button.addEventListener('click', () => {if(entry.purchase||entry.sale||entry.saleFixed||entry.readOnly||entry.processing||entry.collectOne)return;if(performance.now()<staffIgnoreClickUntil)return;if(entry.onChoose){entry.onChoose();return;}if(kind==='settings'){if(entry.action){callbacks.shortcut(entry.action);return;}const panel=entry.id==='setting-journal'?journalPanel:blockerPanel;panel.hidden=!panel.hidden;this.showSettings();return;}if(kind==='bag'){bagSelection=entry.id;renderBagDetail();}else callbacks.choose(entry.id);});
        $('farm-modal-items').append(button);
      }
      if(roster){
        const list=$('farm-modal-items'),cards=[...list.querySelectorAll('.farm-staff-card')];
        const main=document.createElement('section'),reserve=document.createElement('section');
        for(const zone of [main,reserve]){zone.className='farm-staff-zone';zone.dataset.category='local';}
        main.classList.add('farm-main-team');reserve.classList.add('farm-reserve-team');
        main.innerHTML='<h3>🌿 Đội thợ chính <small>2 vị trí làm đơn cho quán</small></h3>';reserve.innerHTML='<h3>🪑 Đội dự bị <small>Chưa làm việc tại farm · Kéo lên để thay thợ chính</small></h3>';
        const mainGrid=document.createElement('div'),reserveGrid=document.createElement('div');mainGrid.className=reserveGrid.className='farm-staff-zone-grid';reserveGrid.dataset.staffDrop='reserve';
        for(const card of cards){
          const id=card.dataset.entry.slice(8),deployed=card.dataset.deployed==='true';
          card.dataset.worker=id;
          const tile=document.createElement('div');tile.className='farm-staff-tile';tile.append(card);
          const staff=entries.find(item=>item.id===card.dataset.entry),unpaid=card.dataset.unpaid==='true';tile.dataset.unpaid=String(unpaid);
          if(unpaid){
            const pay=document.createElement('button');pay.type='button';pay.className='farm-staff-pay-coin';pay.innerHTML='<span class="farm-gold-coin" aria-hidden="true">₫</span>';const payLabel=document.createElement('small');payLabel.textContent=`Trả lương · ${staff.staffWage} xu`;pay.append(payLabel);
            pay.title=`Trả ${staff.staffWage} xu cho ${staff.label}`;pay.setAttribute('aria-label',pay.title);
            pay.addEventListener('click',()=>callbacks.shortcut(`pay-worker:${id}`),options);tile.append(pay);
          }
          if(deployed){card.dataset.staffDrop='main';card.dataset.slot=String(mainGrid.children.length+1);mainGrid.append(tile);}else{
            const remove=document.createElement('button');remove.type='button';remove.className='farm-staff-dismiss';remove.textContent='×';remove.title=unpaid?'Trả lương trước khi xóa':`Xóa ${staff.label} khỏi đội ngũ`;remove.setAttribute('aria-label',remove.title);
            remove.addEventListener('click',()=>showDismiss(staff),options);tile.append(remove);reserveGrid.append(tile);
          }
          card.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary)return;staffDrag={pointer:event.pointerId,id,card,x:event.clientX,y:event.clientY,ghost:null};},options);
        }
        main.querySelector('small').textContent=`${mainGrid.children.length}/2 vị trí · Đang bố trí làm đơn cho quán`;reserve.querySelector('small').textContent=`${reserveGrid.children.length} người · Chưa làm tại farm · Kéo lên để thay người`;
        while(mainGrid.children.length<2){const slot=document.createElement('div');slot.className='farm-staff-empty-slot';slot.dataset.staffDrop='main';slot.textContent=`Vị trí ${mainGrid.children.length+1} · Kéo nhân viên vào đây`;mainGrid.append(slot);}
        if(!reserveGrid.children.length){const empty=document.createElement('p');empty.textContent='Chưa có người dự bị';reserveGrid.append(empty);}
        main.append(mainGrid);reserve.append(reserveGrid);list.append(main,reserve);
      }
      if(kind==='bag') for(let i=entries.length;i<Math.ceil(Math.max(1,entries.length)/6)*6;i++){const empty=document.createElement('div');empty.className='farm-bag-empty';empty.setAttribute('aria-hidden','true');$('farm-modal-items').append(empty);}
      filterBag();
      $('farm-modal-items').scrollTop = scroll;
      if (focused) [...$('farm-modal-items').children].find(button => button.dataset.entry === focused)?.focus({ preventScroll: true });
    },
    seedStrip({ title, entries, selected = null, persistent = false }) {
      if(toolDrag)return;
      $('farm-modal').hidden = true; modalKey = '';
      $('heaven-controls').hidden = false; seedStrip.hidden = false;
      const key = JSON.stringify({title, entries, selected, persistent}); if (key === seedKey) return; seedKey = key;
      const previousScroll=seedStrip.querySelector('.farm-seed-row')?.scrollLeft||0;
      seedStrip.replaceChildren();
      const row = document.createElement('div');row.className='farm-seed-row';seedStrip.append(row);
      for(const [direction,symbol,label]of [['left','‹','Cuộn công cụ sang trái'],['right','›','Cuộn công cụ sang phải']]){
        const arrow=document.createElement('button');arrow.type='button';arrow.className='seed-scroll-arrow';arrow.dataset.scroll=direction;arrow.textContent=symbol;arrow.setAttribute('aria-label',label);
        arrow.addEventListener('click',()=>row.scrollBy({left:(direction==='left'?-1:1)*Math.max(65,row.clientWidth*.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),options);seedStrip.append(arrow);
      }
      row.addEventListener('scroll',syncSeedArrows,options);
      requestAnimationFrame(()=>{if(row.isConnected){row.scrollLeft=previousScroll;syncSeedArrows();}});

      for (const entry of entries) {
        if(entry.emptyState){
          const empty=document.createElement('div');empty.className='farm-station-empty';empty.dataset.category=entry.category;empty.dataset.entry=entry.id;
          const icon=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');icon.textContent='📦';icon.setAttribute('aria-hidden','true');title.textContent='Chưa có mẻ đang chế biến';detail.textContent='Sang tab Chế biến, chọn lượng nguyên liệu rồi bấm Bắt đầu.';empty.append(icon,title,detail);$('farm-modal-items').append(empty);continue;
        }
        const button = document.createElement('button'); button.type = 'button'; button.disabled = entry.enabled === false;
        button.draggable=false;button.setAttribute('aria-pressed',String(entry.id===selected));button.title = `${entry.label} · ${entry.detail || ''}`; button.setAttribute('aria-label',button.title);
        const icon = document.createElement('span'); icon.className = 'seed-packet';
        if(entry.cropId){
          icon.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#6b482c" opacity=".3" d="M13 54q21 10 40 0l-2 5H15z"/><path fill="#b67b3f" stroke="#6d4727" stroke-width="2" d="m17 13 30 0-3 9q10 14 8 31-20 10-40 0-2-17 8-31z"/><path fill="#edc57d" d="m20 23 24 0q8 16 5 28-17 7-34 0-2-14 5-28"/><path fill="#f5daa2" d="m21 24 4 0q-7 17-6 27l-4-1q0-16 6-26"/><path fill="#659548" d="M17 13h30v7H17z"/><path stroke="#80502a" stroke-width="2" fill="none" d="M18 22h28M17 51q15 5 30 0"/><ellipse fill="#6c442b" cx="32" cy="37" rx="8" ry="11" transform="rotate(30 32 37)"/><path fill="none" stroke="#d8a15c" stroke-width="2" d="M36 28q-9 8-8 18"/><path stroke="#fff0bc" stroke-width="1.5" d="m21 55 2 1m4 0 2 1m4 0h2m4-1h2"/></svg>';
        } else if(entry.action==='clear'){icon.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path stroke="#503521" stroke-width="10" stroke-linecap="round" d="m15 55 32-43"/><path stroke="#bd8c4f" stroke-width="6" stroke-linecap="round" d="m15 54 32-43"/><path fill="#899da0" stroke="#42565a" stroke-width="2" d="m38 12 5-6 17 14-9 14-6-4 5-9z"/><path stroke="#d8e8dc" stroke-width="2" d="m48 31 8-11"/></svg>';} else icon.textContent=gameIcon(entry.icon);
        if(entry.cropId || ['water','clear','fertilize','weed','prune','harvest'].includes(entry.action)){button.dataset.dragAction=entry.cropId ? 'plant' : entry.action;button.dataset.cropId=entry.cropId || '';button.dataset.dragIcon=entry.cropId ? '🌱' : entry.action==='clear' ? '⛏️' : entry.action==='fertilize' ? '🪴' : {water:'💧',weed:'🌿',prune:'✂️',harvest:'🧺'}[entry.action];}
        if (entry.cropId || ['water','clear','fertilize','weed','prune','harvest'].includes(entry.action)) {
          button.classList.add('seed-slot'); button.style.setProperty('--seed-color',entry.color);
          if(Number.isFinite(entry.quantity)){const count = document.createElement('b'); count.className='seed-count'; count.textContent=entry.quantity; button.append(count);}
        }
        const label = document.createElement('small'); label.textContent = entry.shortName || entry.label;
        button.append(icon,label); button.addEventListener('click',()=>{if(performance.now()>=ignoreSeedClickUntil)callbacks.choose(entry.id);}); row.append(button);
      }
      const close = document.createElement('button'); close.type = 'button'; close.className = 'seed-strip-close'; close.textContent = '×'; close.setAttribute('aria-label','Bỏ chọn ô đất');
      close.addEventListener('click',callbacks.close); if(!persistent)seedStrip.append(close);
    },
    showSettings() {
      this.modal({title:'Cài đặt',subtitle:'Chọn nhóm tùy chỉnh bên dưới',icon:'⚙️',kind:'settings',filters:[['display','Hiển thị'],['controls','Điều khiển'],['info','Thông tin']],entries:[
        {id:'setting-game',label:'Âm thanh & đồ họa',detail:'Âm lượng, tắt tiếng và chất lượng hình. Được lưu cho lần chơi sau.',icon:'🔊',category:'display',action:'game-settings',badge:'Mở',sfx:'ui.open'},
        {id:'setting-journal',label:'Nhật ký hoạt động',detail:'Hiện diễn biến nông trại và công việc nhân viên ở bên trái.',icon:'📖',category:'display',switchValue:!journalPanel.hidden},
        {id:'setting-blockers',label:'Nhắc việc cần xử lý',detail:'Hiện lương chưa trả, đơn chờ chuyển và các việc đang vướng.',icon:'📌',category:'display',switchValue:!blockerPanel.hidden},
        {id:'setting-display-note',label:'Giao diện trong lượt chơi',detail:'Các thay đổi hiển thị áp dụng ngay. Bạn có thể thu gọn từng bảng bằng cách bấm tiêu đề bảng.',icon:'🌿',category:'display',readOnly:true},
        {id:'setting-movement',label:'Di chuyển & tương tác',detail:'Bấm mặt đất để đi. Bấm đối tượng để nhân vật tới gần rồi thao tác.',icon:'👆',category:'controls',readOnly:true},
        {id:'setting-tools',label:'Kéo công cụ để chăm cây',detail:'Chọn công cụ, kéo qua các ô đất phù hợp rồi thả để thực hiện. Số lượng vật tư giới hạn số ô được chọn.',icon:'🌱',category:'controls',readOnly:true},
        {id:'setting-camera',label:'Đưa camera về nhân vật',detail:'Bấm avatar hoặc tên của bạn ở góc trái để trở về vị trí nhân vật.',icon:'🎯',category:'controls',readOnly:true},
        {id:'setting-guide',label:'Hướng dẫn chơi',detail:'Xem cách trồng cây, chế biến và vận hành quán.',icon:'📖',category:'controls',action:'help',badge:'Xem hướng dẫn'},
        {id:'setting-about',label:'Nông trại & quán cà phê',detail:'Trồng và chăm cà phê tại nông trại, chế biến hạt rồi chuyển nguyên liệu sang quán của bạn.',icon:'☕',category:'info',readOnly:true},
        {id:'setting-team-info',label:'Đội ngũ nhân viên',detail:'Tối đa 2 thợ chính cùng làm tại farm. Người còn lại ở đội dự bị; nhiệm vụ cá nhân chỉ tính thao tác của bạn.',icon:'👩‍🌾',category:'info',readOnly:true}
      ],footer:''});
    },
    showGuide() {
      this.modal({title:'Cách chơi nông trại',icon:'📖',kind:'help',entries:[],footer:'Đóng để tiếp tục chơi.'});
      const sections=[
        ['Hai màn chơi liên kết','Nông trại và quán là hai không gian riêng. Bấm ☕ Vào quán để chuyển màn; tại quán bấm 🌱 Nông trại để quay về. Cây, mẻ và nhân viên tiếp tục vận hành khi bạn ở quán.'],
        ['Chọn và kéo công cụ','Bấm ô trống: ô sáng viền và nhân vật tới gần. Chọn cây giống ở dải icon dưới. Mở ⛏️ để chọn tưới, phân hoặc cuốc. Kéo qua ô hợp lệ; kéo ngược để bớt ô. Thả mới giao việc, mỗi ô dùng một vật tư; hết số lượng thì dừng chọn.'],
        ['Cây lâu năm','Cây giống khoảng 90–150 giây, cây trưởng thành cho vụ mới khoảng 3 phút nếu chăm tốt. Cây giống cần kiến thiết, rồi phục hồi → ra hoa → nuôi quả → hái chọn nhiều đợt. Hái không xóa cây. Theo icon nhu cầu; cây không cần chăm thì không tốn vật tư.'],
        ['Nước và dinh dưỡng','Nước mưa bổ sung độ ẩm; một giai đoạn ra hoa có kiểm soát khô. Chỉ tưới khi có 💧. Bón một liều trong đợt phục hồi hoặc nuôi quả khi đất đủ ẩm. Dọn cỏ 🌿; tỉa cành đầu vụ. Giếng lấy nước từ dự trữ, không tự đầy bình khi tải lại.'],
        ['Sơ chế đúng chuỗi','Quả chín → sơ chế khoảng 30 giây → nhân sạch → rang khoảng 18 giây → giao quán khoảng 10 giây. Khối lượng giảm qua công đoạn; không rang nguyên quả khô. Quán dùng hạt rang và xay lúc pha. Máy xay farm dành cho sản phẩm bột bán ngoài.'],
        ['Công suất và nhận hàng','Mỗi trạm có công suất theo cấp; nhiều nguyên liệu được chia mẻ và xếp hàng, không chạy vô hạn cùng lúc. Icon + tiến độ + giây ở trạm. Chỉ bấm giỏ để nhận mẻ xong; nhà mở thao tác. Mẻ chờ có thể hủy để nhận lại nguyên liệu. Kho đầy thì giao/bán bớt.'],
        ['Đội ngũ và hai người mỗi nông trại','Mở 👩‍🌾, chọn người để xem chỉ số, đào tạo và bật/tắt từng nhóm việc: trồng, tưới, phân, cỏ, tỉa, hái, chế biến, giao. Chọn giống cho từng người. Có thể thuê nhiều người, chỉ bố trí hai người vào nông trại. Ký hợp đồng tuần trả trước (7 ngày, 1 ngày làm việc = 6 phút); giá ngày cấp 1 là 30 xu, tăng 10 xu mỗi cấp, tuần trả 6 ngày. Nút Gia hạn nằm ở đầu hồ sơ cạnh thời gian còn lại; bật Tự gia hạn để không phải trả tay. Hết hợp đồng thì dừng việc; chấm dứt sớm không hoàn tiền. Thợ tự nghỉ giữa ca khi mệt. Nhân viên đi thật tới cây/trạm, tự lấy nước, không làm trùng việc. Họ không tự mua đất, cuốc cây hay nâng cấp. Đào tạo và công việc tăng cấp tối đa 10.'],
        ['Đơn quán và nhiệm vụ cá nhân','Đơn quán chỉ phát sinh khi đã bố trí thợ chính, tối đa 2 đơn mở. Mở 📦 để xem đơn, chọn đơn rồi chọn nhân viên phụ trách. Các bước từ cây đến rang hiện trong đơn. Đủ hàng bấm Giao, hoặc nhờ nhân viên giao. 🎯 là nhiệm vụ cá nhân: bạn tự làm rồi nhận thưởng, việc của nhân viên không được tính. Nhiệm vụ đổi mới mỗi 6 phút; việc đã xong vẫn giữ tới khi bạn nhận thưởng. Nhân viên phải được bố trí, bật đúng nhóm việc và đã trả lương.'],
        ['Quán và tiền','Mở quán, chờ khách rồi bấm bàn để tới phục vụ; cần 18 g hạt/ly và 0,7 xu vật tư. Giao hàng mất 2 xu/chuyến và có thời gian vận chuyển. Khi chưa có vụ mới có thể nhập 500 g dự phòng. Chỉ bán ra ngoài mới tạo doanh thu; chuyển farm–quán không nhân đôi hàng hoặc tiền.'],
        ['Nâng cấp và ao','🔧 có phúc lợi, đất, rào, ao, giếng, dụng cụ, sân, lò, máy xay, kho, vận chuyển và thiết bị quán; tối đa cấp 999 (thiết bị quán 10). Qua cấp 10 cần thêm 1 cấp nông trại cho mỗi 10 cấp; tốc độ tăng chậm dần tới tối đa gấp 3, công suất vẫn tăng đều. Công trình đổi diện mạo ở cấp 10, 50, 200, 500. Ao vẫn là ao dự trữ; có thể thả, cho ăn và thu cá, phải giữ nước tối thiểu.'],
        ['Lưu và khi rời game','Lưu khối lượng theo gram, lô theo nguồn gốc. Khi đóng game, cây/mẻ/chuyến giao tính tối đa 8 giờ; không tự bán ly hoặc cho nhân viên làm miễn phí offline.']
      ];
      for(const [heading,text] of sections){const section=document.createElement('section'),title=document.createElement('h3'),body=document.createElement('p');title.textContent=heading;body.textContent=text;section.append(title,body);$('farm-modal-items').append(section);}
    },
    rejectDrop(x,y,icon) { popNumber(`🚫 ${icon}`,{x,y},'bad'); },
    flyReward(kind,quantity,point) {
      if(quantity<=0)return;
      const coins=kind==='coins',format=coins?formatCoins:formatMass;
      flyTo(point,coins?$('farm-coins').parentElement:$('farm-bag-toggle'),{icon:coins?'🪙':'🧺',text:`+${format(quantity)}`,amount:quantity,format});
    },
    closeSeedStrip() { seedStrip.hidden = true; seedKey = ''; },
    closeModal,
    work(text, progress) {
      $('farm-work').hidden = !text;
      if (text) { $('farm-work-label').textContent = text; $('farm-work-fill').style.width = `${Math.min(100, progress * 100)}%`; }
    },
    notice(text, success = true) {
      const notice=$('farm-notice');
      const message=String(text);
      notice.textContent=message;notice.dataset.success=String(success);notice.setAttribute('role',success?'status':'alert');notice.hidden=false;noticeUntil=performance.now()+3000;
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
      $('farm-work').hidden = true; $('farm-notice').hidden = true; document.body.classList.remove('farm-menu-open');for(const id of ['farm-map-toggle','farm-bag-toggle','farm-shop-toggle','farm-upgrade-toggle','farm-help-toggle'])$('farm-shortcuts').append($(id));document.body.append($('farm-shortcuts'));primaryNav.remove();backButton.remove();profileAlert.remove();profileSummary.remove();blockerPanel.remove();menuToggle.remove();$('farm-hud').append(document.querySelector('.farm-resources'));journalPanel.remove();rightHud.remove();document.body.append(viewControls);tabs.remove();stationPanel.remove();workerSheet.remove(); operationHud.remove();management.remove(); toolsPrompt.remove(); seedStrip.remove();bagDetail.remove();ghost.remove();
    },
  };
}
