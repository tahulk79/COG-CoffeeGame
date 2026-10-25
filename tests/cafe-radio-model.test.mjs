import test from 'node:test';import assert from 'node:assert/strict';import {parseCafeRadioLink,cafeIdleDelay,cafeRadioSuggestions} from '../src/cafe-radio-model.js';
test('accepts supplied video and official playlist links without forwarding arbitrary URL text',()=>{
 assert.equal(parseCafeRadioLink('https://youtu.be/m95-M7a59MI?si=share').id,'m95-M7a59MI');assert.equal(parseCafeRadioLink('https://music.youtube.com/watch?v=m95-M7a59MI').kind,'video');const x=parseCafeRadioLink('https://www.youtube.com/playlist?list=PL1234567890abc&evil=discard');assert.equal(x.kind,'playlist');assert.equal(x.id,'PL1234567890abc');assert.ok(!x.embed.includes('evil'));assert.equal(parseCafeRadioLink('https://www.youtube.com/shorts/m95-M7a59MI').kind,'video');
});
test('rejects non-provider hosts, credentials, ports, malformed ids and script URLs',()=>{
 for(const url of ['javascript:alert(1)','http://youtube.com/watch?v=m95-M7a59MI','https://youtube.com.evil.test/watch?v=m95-M7a59MI','https://evil.test/?list=PL1234567890abc','https://u:p@youtube.com/watch?v=m95-M7a59MI','https://youtube.com:8443/watch?v=m95-M7a59MI','https://youtube.com/playlist?list=<iframe>','garbage','https://youtube.com/watch?v=x'])assert.equal(parseCafeRadioLink(url),null,url);
});
test('idle defaults are bounded and only supplied video is presented as a directly playable suggestion',()=>{
 assert.equal(cafeIdleDelay(123),90000);assert.equal(cafeIdleDelay('0'),0);assert.equal(cafeIdleDelay('30000'),30000);assert.equal(cafeIdleDelay(180000),180000);assert.equal(cafeRadioSuggestions.filter(x=>x.url).length,1);assert.ok(cafeRadioSuggestions.filter(x=>x.search).length>=3);
});
