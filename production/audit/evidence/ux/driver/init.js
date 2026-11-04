(()=>{window.__ev=[];window.__lt=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())__ev.push({n:e.name,d:Math.round(e.duration),proc:Math.round(e.processingEnd-e.processingStart),delay:Math.round(e.processingStart-e.startTime),t:Math.round(e.startTime),tgt:(e.target&&(e.target.id||e.target.className||e.target.tagName))+''})}).observe({type:'event',durationThreshold:16,buffered:true});}catch(e){}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())__lt.push({d:Math.round(e.duration),t:Math.round(e.startTime)})}).observe({type:'longtask',buffered:true});}catch(e){}
window.addEventListener('error',e=>console.error('UNCAUGHT',e.message));window.addEventListener('unhandledrejection',e=>console.error('UNHANDLED',e.reason&&e.reason.message));})();
