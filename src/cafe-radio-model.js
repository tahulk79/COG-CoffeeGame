export const cafeRadioSuggestions=[
 {id:'rico',title:['Rico Latino · bạn đã chọn','Rico Latino · your selection'],url:'https://www.youtube.com/watch?v=m95-M7a59MI'},
 {id:'bossa',title:['Bossa nova · café nhẹ nhàng','Bossa nova · gentle café'],search:'bossa nova cafe playlist'},
 {id:'latin',title:['Latin jazz · vui vẻ','Latin jazz · cheerful'],search:'happy latin jazz cafe playlist'},
 {id:'lofi',title:['Lo-fi · góc quán mưa','Lo-fi · rainy café'],search:'lofi rainy coffee shop playlist'}
];
export function parseCafeRadioLink(raw){
 try{const u=new URL(String(raw).trim());if(u.protocol!=='https:'||u.username||u.password||u.port)return null;const hosts=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'];if(!hosts.includes(u.hostname))return null;
 const list=u.searchParams.get('list');if(list&&/^[A-Za-z0-9_-]{10,100}$/.test(list))return {kind:'playlist',id:list,embed:`https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1&playsinline=1`,url:`https://www.youtube.com/playlist?list=${list}`};
 const parts=u.pathname.split('/').filter(Boolean);const id=u.hostname==='youtu.be'?parts[0]:u.pathname==='/watch'?u.searchParams.get('v'):['shorts','live','embed'].includes(parts[0])?parts[1]:null;
 return /^[A-Za-z0-9_-]{11}$/.test(id||'')?{kind:'video',id,embed:`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`,url:`https://www.youtube.com/watch?v=${id}`}:null;
 }catch{return null;}
}
export function cafeIdleDelay(value){const n=Number(value);return [0,30000,90000,180000].includes(n)?n:90000;}
