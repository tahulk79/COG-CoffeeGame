import {cafeSeasonEpisodes} from './cafe-season-data.js';
import {tastingProfile,tastingWaitQuestion} from './cafe-tasting.js';
export const cafeFocusChoices=[
 {id:'flow',title:['Thử nhịp rót','Try the pouring rhythm'],description:['Tự chọn một nhịp nghỉ, rồi nhìn cân và ly.','Choose a rest, then watch the scale and cup.']},
 {id:'scale',title:['Khám phá chiếc cân','Explore the scale'],description:['Nhìn lượng còn cần thêm trước mỗi nhịp.','See how much more water each stage needs.']},
 {id:'quiet',title:['Một ly yên tĩnh','A quiet cup'],description:['Không đố giữa lượt, chỉ ngắm và pha.','No mid-brew questions; just watch and brew.']}
];
const cupOwnerLines={
 's1-yemen':['“Tôi giữ bản đồ Mocha trong tủ; còn tách mở đầu này dành cho bạn.”','“The Mocha map stays in the cabinet; this first cup is yours.”'],
 's1-aeropress':['“Chiếc ống đã xong chuyến đi nhỏ của nó. Kéo ghế lại gần, tách này còn ấm.”','“The little tube has finished its journey. Pull up a chair; this cup is still warm.”'],
 's1-yirgacheffe':['“Hai túi vẫn để riêng. Tấm thẻ này sẽ nhắc hôm nay mình đã mở túi nào.”','“The bags stay separate. This card will remember which one we opened.”'],
 's1-v60':['“Tôi treo chiếc phễu lại đây. Lần sau ghé, bạn cứ nhận chỗ đứng cạnh bình rót.”','“The dripper goes back here. Next visit, the spot by the kettle is yours.”'],
 's1-hoffmann':['“Trang Hoffmann có thêm dấu lần mình thử; vẫn giữ tên người đã chia sẻ ở đầu trang.”','“Hoffmann’s page has a mark from our try, with its creator’s name still at the top.”'],
 's1-sl28':['“Hôm nay số 28 đã có câu chuyện. Tách này không cần một bảng điểm để được giữ lại.”','“Twenty-eight has a story now. This cup needs no score sheet to be worth keeping.”'],
 's1-geisha':['“Chừa chiếc ghế này nhé. Lần tới mình còn một tấm bản đồ để mở.”','“Keep this chair for next time. There is another map waiting to be opened.”'],
 's1-honey':['“Chiếc thìa mật ong vẫn nằm trên kệ. Mình vừa tìm được một ý nghĩa khác của chữ Honey.”','“The honey spoon stays on the shelf. We found another meaning of Honey.”'],
 's1-kasuya':['“Tôi cất mười chiếc cúc lại. Hai nhóm nước giờ thành một câu chuyện có thể nhớ được.”','“I’ll put the ten buttons away. Two water groups have become a story we can remember.”'],
 's1-bourbon':['“Tôi kẹp tấm bưu thiếp Guatemala cạnh tách này, để cái tên không còn đi một mình.”','“The Guatemala postcard goes beside this cup, so the name no longer travels alone.”'],
 's1-origami':['“Bóng phễu vẫn nằm trên bàn. Tôi để chiếc tách bên cạnh cho bạn nhìn thêm một lúc.”','“The dripper’s shadow stays on the table. I’ll leave your cup beside it for a little while.”'],
 's1-yellow-bourbon':['“Tấm ảnh quả vàng có chỗ trong tủ rồi. Còn chiếc ghế này, bạn ngồi thêm cũng được.”','“The yellow-cherry picture has its place. Stay in this chair a little longer if you like.”'],
 's1-one-cup':['“Đúng một tách cho buổi ghé này. Không phải lúc nào quán cũng cần một bình lớn.”','“One cup for this visit. The café does not always need a large server.”'],
 's1-pacamara':['“Mười bốn ngăn đã có tên. Tôi vẫn chừa một chiếc ghế cho câu chuyện tiếp theo của mình.”','“Fourteen drawers have names now. I’m keeping a chair for our next story.”']
};
export function cupTakeaway(s,lang='vi'){
 const tx=(vi,en)=>lang==='vi'?vi:en,p=tastingProfile(s.episodeId);
 if(s.ritualVersion!==2)return tx('Một lần thử đã được giữ lại trong sổ.','A little experience kept in the notebook.');
 if(s.role==='watch')return s.focus==='quiet'?tx('Bạn chọn ngồi xem một ly yên tĩnh.','You chose to watch a quiet cup.'):tx('Bạn đã ngồi xem chủ quán thao tác, không cần tự pha.','You watched the owner’s hands without having to brew.');
 if(s.focus==='quiet')return tx('Bạn chọn một ly yên tĩnh, không câu đố giữa lượt.','You chose a quiet cup with no mid-brew questions.');
 if(s.focus==='flow')return s.manualPauses>0?tx(`Bạn đã tự chọn ngừng dòng ${s.manualPauses} lần. Nhịp nghỉ này là của bạn.`,`You chose to stop the flow ${s.manualPauses} time(s). Those rests were yours.`):tx('Bạn để cân hỗ trợ dừng ở mốc. Lần sau có thể thử tự thả tay một lần.','You let the scale help at the targets. Next time, try choosing a rest yourself.');
 const q=tastingWaitQuestion(s.episodeId,'scale');return s.answers.wait===q.correct?tx('Bạn đã đối chiếu tổng trên cân với lượng cần rót thêm.','You compared the scale total with the amount still to add.'):p.method==='aeropress'?tx('Bạn quan sát cân giữ tổng nước trong lúc ép.','You watched the scale retain input water while plunging.'):tx('Bạn chọn xem lượng nước còn cần thêm trên cân.','You chose to see the water still needed on the scale.');
}
export function servedCup(s,lang='vi',compact=false){
 const at=x=>x[lang==='vi'?0:1],tx=(vi,en)=>lang==='vi'?vi:en,e=cafeSeasonEpisodes.find(x=>x.id===s.episodeId);if(!e)return '';
 const glaze=s.focus==='quiet'?'#92a8a0':s.focus==='scale'?'#c4ad77':'#d4b29c',sample=e.id==='s1-yirgacheffe'?` · ${s.sample==='natural'?'Natural':'Washed'}`:'';
 return `<aside class="ct-served ${compact?'is-compact':''}" data-cup-focus="${s.focus||'classic'}"><span class="eyebrow">${s.role==='watch'?tx('Bạn vừa xem chủ quán pha','You watched the owner brew'):tx('TÁCH CỦA BẠN XONG RỒI','YOUR CUP IS READY')}</span>${compact?'':`<svg class="ct-served-art" viewBox="0 0 320 190" role="img" aria-label="${tx('Tách cà phê trên đĩa','Coffee cup on a saucer')}"><ellipse cx="157" cy="161" rx="118" ry="13" fill="#121c1755"/><ellipse cx="157" cy="153" rx="103" ry="13" fill="#d7c5a0"/><path d="M88 65h133l-12 74q-52 24-108 0z" fill="${glaze}" stroke="#f4dfb6" stroke-width="3"/><path d="M220 81q49-10 35 28-6 16-40 13" fill="none" stroke="${glaze}" stroke-width="12"/><ellipse cx="155" cy="65" rx="66" ry="13" fill="#e8d7b4"/><ellipse cx="155" cy="65" rx="58" ry="9" fill="#67442a"/><path d="M112 89q-4 23 5 38" stroke="#fff0d288" stroke-width="4" fill="none"/><g class="scene-steam" stroke="#f4e6c788" stroke-width="3" fill="none"><path d="M134 41q-12-12 0-26m23 26q12-12 0-26m23 26q-12-12 0-26"/></g><text x="155" y="113" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="#344d3d">C6S</text></svg>`}<h4>${at(e.item)}${sample}</h4><p class="ct-cup-owner">${at(cupOwnerLines[e.id])}</p><p class="ct-cup-takeaway">${cupTakeaway(s,lang)}</p><details><summary>${tx('Xem lại thao tác','Look back at the actions')}</summary><p>${Math.round(s.water)} g* · ${Math.floor(s.elapsed)} ${tx('giây trò chơi','game seconds')} · ${s.role==='watch'?tx('đã xem','watched'):tx('đã tự thử','tried yourself')}. ${tx('Không phải đánh giá hương vị hay chất lượng.','This is not a flavor or quality assessment.')}</p></details></aside>`;
}
export function cafeOwnerMemory(store,lang='vi'){
 const previous=store.visits.filter(v=>v.closed).at(-1);if(!previous)return '';const s=previous.experience,tx=(vi,en)=>lang==='vi'?vi:en;
 if(!s||s.phase!=='finished')return tx('“Lần trước bạn ghé nghe chuyện. Tôi vẫn để chiếc ghế này cho bạn.”','“Last time you came for a story. I’ve kept this chair for you.”');
 if(s.role==='watch')return tx('“Lần trước bạn ngồi xem tôi pha. Hôm nay vẫn có thể ngồi cạnh, hoặc tự thử một lượt.”','“Last time you watched me brew. You can sit beside me again, or try your own hands today.”');
 if(s.ritualVersion===2&&s.focus==='scale')return tx('“Lần trước mình cùng đọc chiếc cân. Hôm nay tôi để mốc nước sẵn để bạn thử tiếp.”','“Last time we explored the scale together. Today I’ve left the water targets ready for you.”');
 if(s.ritualVersion===2&&s.focus==='quiet')return tx('“Tôi nhớ lần trước bạn chọn một ly yên tĩnh. Hôm nay mình cũng không cần vội.”','“I remember your quiet cup last time. There’s no need to hurry today either.”');
 if(s.manualPauses>0)return tx('“Lần trước bạn đã tự chọn nhịp nghỉ. Tôi chừa chỗ cạnh bình cho bạn nhé?”','“Last time you chose your own rests. Shall I keep the spot by the kettle for you?”');
 return tx('“Tôi nhớ tách bạn tự pha lần trước. Hôm nay có một món khác để cùng thử.”','“I remember the cup you tried yourself. Today there is another find to try together.”');
}
export function cafeDiscovery(value,lang='vi'){
 const tx=(vi,en)=>lang==='vi'?vi:en;
 if(value==='map')return `<div class="season-discovery-object"><svg viewBox="0 0 320 155" role="img" aria-label="${tx('Sơ đồ cảng Mocha và tách cà phê','A sketch of Mocha port and a coffee cup')}"><rect x="4" y="4" width="312" height="147" rx="12" fill="#d7bf8e"/><path d="m80 29 86 4 28 60-47 21-22-30-49-13z" fill="#7c9169"/><circle cx="133" cy="96" r="6" fill="#9c5236"/><path d="M139 98q35 45 107 11" fill="none" stroke="#7e5937" stroke-width="3" stroke-dasharray="5 6"/><path d="M235 80h45l-6 34h-33z" fill="#f0dfbd" stroke="#6f7650" stroke-width="2"/><text x="95" y="132" fill="#443e2a" font-size="14">Mocha · Yemen</text></svg><p>${tx('“Chấm này là cảng Mocha ở Yemen, không phải ký hiệu thêm sôcôla. Tôi giữ sơ đồ này để nhớ một cái tên cũng có hành trình.”','“This dot is the port of Mocha in Yemen, not a chocolate ingredient symbol. I keep the sketch because a name can carry a journey.”')}</p></div>`;
 if(value==='seed')return `<div class="season-discovery-object"><p>${tx('Chủ quán đặt một hạt rang cạnh hình quả đỏ. “Hạt mình pha vốn nằm bên trong quả. Lần tới nhìn túi hạt, thử nhớ cả cái cây nhé.”','The owner sets a roasted bean beside a red cherry sketch. “The seed we brew lived inside a fruit. Next time you see a bag, remember the tree too.”')}</p><span class="season-seed-pair" aria-hidden="true">● → ◐</span></div>`;
 return `<div class="season-discovery-object"><dl><dt>${tx('Xuất xứ','Origin')}</dt><dd>Yemen</dd><dt>${tx('Loài','Species')}</dt><dd>Arabica</dd><dt>${tx('Hồ sơ lô','Lot record')}</dt><dd>${tx('Để dành một câu hỏi cho người gửi hạt','A question saved for the sender')}</dd></dl><p>${tx('“Đọc được hai dòng này rồi. Dòng chưa rõ thì lần sau mình hỏi tiếp.”','“We can read these two fields. We’ll ask about the missing one next time.”')}</p></div>`;
}
