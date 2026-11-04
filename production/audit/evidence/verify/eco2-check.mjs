import {ASSETS,upgradePrice,efficiency,capacityScale,assetMaxLevel} from '../../../../src/features/farm/rules.js';
import {MACHINES} from '../../../../src/features/farm/content.js';
const tp=(m,l)=>Math.round(m.capacity*capacityScale(l)/(m.duration/efficiency(l))*60000);
for(const m of MACHINES)console.log(m.id,'g/min lv1..5:',[1,2,3,4,5].map(l=>tp(m,l)).join(' '));
console.log('fence 100->25 seconds lv1:',75/.0001,' lv20:',75/(.0001/efficiency(20)),' offline cap 8h decay lv1:',8*3600*.0001);
const total=ASSETS.reduce((s,a)=>{let t=0;for(let l=1;l<assetMaxLevel(a);l++)t+=upgradePrice(a.id,l);return s+t;},0);
console.log('total upgrade cost:',total);
