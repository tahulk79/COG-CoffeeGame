import {discoveryCaseKey,loadDiscoveryLab} from './discovery-case.js';
import {cafePostcardArt} from './discovery-trail-ui.js';
export function cafeDialoguePages(text,limit=135){
 const sentences=String(text).trim().match(/[^.!?…]+[.!?…]+[”’"]?|[^.!?…]+$/gu)||[];
 const pages=[];let page='';
 for(const sentence of sentences){const normalized=sentence.trim().replace(/\s+/g,' ');if(!normalized)continue;if((page+' '+normalized).trim().length<=limit){page+=(page?' ':'')+normalized;continue;}if(page){pages.push(page);page='';}for(const word of normalized.split(' ')){if(page&&(page+' '+word).length>limit){pages.push(page);page='';}page+=(page?' ':'')+word;}}
 if(page)pages.push(page);return pages;
}
// View-only pagination. Original content and interactive nodes remain available.
export function frameCafeScene(host, lang='vi') {
 const card=host?.querySelector('.season-card');if(!card)return;
 const vi=lang==='vi', dialogue=card.querySelector('.scene-dialogue');
 const book=document.createElement('dialog');book.className='screen-notebook';
 const close=document.createElement('button');close.type='button';close.className='screen-close';close.textContent=vi?'Đóng sổ':'Close notebook';close.onclick=()=>book.close();
 const body=document.createElement('div');body.className='screen-book-body';book.append(close,body);card.append(book);
 const trigger=document.createElement('button');trigger.type='button';trigger.className='secondary screen-details';trigger.textContent=vi?'Mở sổ món':'Find notebook';trigger.onclick=()=>{host.dataset.screenNotebook='open';window.dispatchEvent(new Event('c6s-pause-cafe-tasting'));book.showModal();};
 card.querySelector('.scene-today-item').append(trigger);book.addEventListener('close',()=>{delete host.dataset.screenNotebook;});host.querySelectorAll('[data-season-archive],#season-accept').forEach(button=>button.addEventListener('click',()=>{delete host.dataset.screenNotebook;book.close();},{capture:true}));host.querySelectorAll('[data-season-discover],[data-season-inspect]').forEach(button=>button.addEventListener('click',()=>{host.dataset.screenNotebook='open';},{capture:true}));
 // Preserve every complete passage in the notebook, including archived stories.
 const passages=[...dialogue.querySelectorAll('.scene-speech,.season-owner-memory,.season-owner-answer')];
 body.append(dialogue.querySelector('.scene-speaker').cloneNode(true));
 const pages=[];const speaker=dialogue.querySelector('.scene-speaker strong'),originalSpeaker=speaker.textContent;
 for(const el of passages){body.append(el.cloneNode(true));if(el.matches('.season-owner-memory')&&card.querySelector('#season-investigate')){el.remove();continue;}for(const text of cafeDialoguePages(el.textContent))pages.push({text,speaker:el.matches('.season-owner-answer,.season-owner-memory')?(vi?'Chủ quán':'The owner'):originalSpeaker});el.remove();}
 if(pages.length){const speech=document.createElement('p');speech.className='screen-speech';speech.setAttribute('aria-live','polite');const pager=document.createElement('div');pager.className='screen-pages';let index=0;
 const prev=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');prev.type=next.type='button';prev.textContent='←';next.textContent='→';prev.setAttribute('aria-label',vi?'Đoạn trước':'Previous passage');next.setAttribute('aria-label',vi?'Đoạn tiếp':'Next passage');
 function paint(){speech.textContent=pages[index].text;speaker.textContent=pages[index].speaker;count.textContent=`${index+1}/${pages.length}`;prev.disabled=index===0;next.disabled=index===pages.length-1;}
 prev.onclick=()=>{index--;paint();};next.onclick=()=>{index++;paint();};pager.append(prev,count,next);dialogue.querySelector('.scene-speaker').after(speech,pager);paint();
 for(const id of ['season-next','season-goodbye'])dialogue.querySelector('#'+id)?.addEventListener('click',event=>{if(index<pages.length-1){event.stopImmediatePropagation();index++;paint();}},{capture:true});
 }
 for(const el of [...dialogue.children])if(el.matches('.season-guest-aside,.season-facts,.season-discovery-choices,.season-discovery-object,.season-souvenir,.season-invitation,.season-side-games,.ct-served,blockquote,#season-reference'))body.append(el);
 for(const [id,short] of Object.entries(vi?{'season-next':'Kể tiếp','season-try':'Tôi pha thử','season-watch':'Xem chú pha','season-skip':'Nghe đoạn kết','season-enter':'Vào quán','season-continue':'Ghé lượt tiếp','season-revisit':'Pha lại','season-read-current':'Đọc lại','season-goodbye':'Hẹn lần sau'}:{'season-next':'Continue','season-try':'Let me brew','season-watch':'Watch brewing','season-skip':'Hear the ending','season-enter':'Enter café','season-continue':'Next visit','season-revisit':'Brew again','season-read-current':'Read again','season-goodbye':'Until next time'})){const b=card.querySelector('#'+id);if(b){b.setAttribute('aria-label',b.textContent);b.textContent=short;}}
 if(card.querySelector('#season-investigate'))card.querySelectorAll('.scene-dialogue>.scene-actions>button:not(#season-investigate)').forEach(b=>b.classList.add('secondary'));
 let postcard=false;try{postcard=!!loadDiscoveryLab(localStorage.getItem(discoveryCaseKey)).store.trail?.postcard;}catch{}if(postcard){const note=document.createElement('div');note.className='scene-kept-postcard';note.innerHTML=cafePostcardArt(lang);card.querySelector('.scene-window')?.append(note);}
 const footer=card.querySelector('.season-footer');if(footer){const status=footer.querySelector('#season-status');if(status){card.querySelector('.scene-today-item').after(status);const retry=footer.querySelector('#season-retry');if(retry)status.after(retry);}body.append(footer);}
 // Keep the scene visible while the workbench occupies the same stage.
 if(host.dataset.screenNotebook==='open')book.showModal();
 card.classList.toggle('screen-brewing',!!card.querySelector('#cafe-tasting-host'));
 for(const el of card.querySelectorAll('.ct-context,.ct-origin,.ct-unit,.ct-owner-story,.ct-limits')){const copy=el.cloneNode(true);copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.removeAttribute('id');body.append(copy);}
}
export function frameCafeNotebook(root,lang='vi'){
 const main=root.querySelector('.cafe-main');if(!main)return;
 const book=document.createElement('dialog');book.className='screen-notebook screen-library';
 const close=document.createElement('button');close.type='button';close.className='screen-close';close.textContent=lang==='vi'?'Về quán':'Back to café';close.onclick=()=>book.close();const body=document.createElement('div');body.className='screen-book-body';book.append(close,body);
 for(const child of [...main.children])if(!child.matches('.cafe-header,#rebirth-entry-banner,#cafe-season,#rebirth-campaign'))body.append(child);
 main.append(book);const today=document.createElement('button');today.type='button';today.id='cafe-classic-today';today.textContent=lang==='vi'?'Tủ 14 lượt ghé & món hôm nay':'Fourteen-visit cabinet & today’s find';today.onclick=()=>{book.close();root.querySelector('.screen-details')?.click();};body.prepend(today);const rebirthEntry=body.querySelector('#open-rebirth-campaign');if(rebirthEntry)body.prepend(rebirthEntry);const webtoonPreview=body.querySelector('#preview-webtoon-opening');if(webtoonPreview)body.prepend(webtoonPreview);const button=document.createElement('button');button.id='cafe-notebook';button.type='button';button.className='secondary';button.textContent=lang==='vi'?'Sổ':'Book';button.onclick=()=>{window.dispatchEvent(new Event('c6s-pause-cafe-tasting'));window.dispatchEvent(new Event('c6s-pause-practice'));window.dispatchEvent(new Event('c6s-refresh-discovery-journal'));book.showModal();};main.querySelector('.cafe-header').append(button);
 if(!root.dataset.screenBindings){root.dataset.screenBindings='true';for(const name of ['c6s-open-first-pour','c6s-daily-practice','c6s-open-discovery-episode'])window.addEventListener(name,()=>{root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());});root.addEventListener('click',event=>{if(root.dataset.campaign==='hanoi'&&event.target.closest('#cafe-classic-today,#open-seven-visits,#open-first-pour,#counter-play-nav,#open-real-brew,#studio-toggle'))window.dispatchEvent(new Event('c6s-open-classic-cafe'));const currentBook=root.querySelector('.screen-library');if(event.target.closest('#season-reference')){event.target.closest('dialog')?.close();currentBook.showModal();}if(event.target.closest('#open-seven-visits,[data-season-archive],#open-first-pour,#open-real-brew,#studio-toggle'))currentBook.close();},{capture:true});}
}
export function frameCafeQuestion(host,key,lang,wasOpen=false){
 if(key==='finished'){const cup=host.querySelector('.ct-served');if(!cup)return;const dialog=document.createElement('dialog');dialog.className='screen-notebook';const close=document.createElement('button');close.type='button';close.className='screen-close';close.textContent=lang==='vi'?'Về tách cà phê':'Back to the cup';close.onclick=()=>dialog.close();const body=document.createElement('div');body.className='screen-book-body';cup.querySelectorAll('.ct-cup-takeaway,details').forEach(el=>body.append(el));dialog.append(close,body);const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=lang==='vi'?'Điều vừa khám phá':'Your discovery';button.onclick=()=>dialog.showModal();cup.append(button,dialog);return;}
 if(key!=='wait'&&key!=='prepare')return;
 const q=host.querySelector('#ct-qa');if(!q)return;
 const dialog=document.createElement('dialog');dialog.className='screen-notebook ct-question-dialog';
 const close=document.createElement('button');close.type='button';close.className='screen-close';close.textContent=lang==='vi'?'Về ly đang pha':'Back to the cup';close.onclick=()=>dialog.close();
 const body=document.createElement('div');body.className='screen-book-body';while(q.firstChild)body.append(q.firstChild);dialog.append(close,body);
 const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=lang==='vi'?'Hỏi chuyện cà phê · tùy chọn':'Coffee question · optional';button.onclick=()=>{window.dispatchEvent(new Event('c6s-pause-cafe-tasting'));host.querySelector('#ct-qa dialog')?.showModal();};q.append(button,dialog);if(wasOpen)dialog.showModal();
}
