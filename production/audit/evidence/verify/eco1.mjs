import {marketValue} from '../../../../src/features/farm/rules.js';
const ps=[1,1.3,1.5];let ord=0;for(let i=0;i<60;i++)ord+=Math.round(200*.07*ps[i%3]*1.2);
let sold=0,mk=0;for(const p of ps){const base=4000*.07*p*1;mk+=marketValue(sold,base);sold+=base;}
console.log({orders60:ord,market12kg_q100:Math.round(mk),orderPerGramRobusta:Math.round(200*.07*1.2)/200,cafePhinPerGram:2.5/20});
