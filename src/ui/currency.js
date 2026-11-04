// Decorate displayed currency without changing gameplay messages or price calculations.
export function installCurrencyIcons(root=document.body) {
  const excluded='script,style,textarea,option,.farm-gold-coin,.game-currency';
  function decorate(node){
    if(node.nodeType===Node.ELEMENT_NODE&&node.closest(excluded))return;
    const texts=[];
    if(node.nodeType===Node.TEXT_NODE)texts.push(node);
    else{const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walker.nextNode())texts.push(walker.currentNode);}
    for(const text of texts){
      const parent=text.parentElement;
      // \b chỉ hiểu ASCII nên "xu" trong "xuống/xuất" bị khớp; dùng ranh giới chữ Unicode.
      if(!parent||parent.closest(excluded)||!/(?:(?<![\p{L}\p{N}])(?:xu|coins?)(?![\p{L}\p{N}])|🪙)/u.test(text.data))continue;
      if(parent.previousElementSibling?.classList.contains('farm-gold-coin')||[...parent.children].some(child=>child.classList.contains('farm-gold-coin')))continue;
      const fragment=document.createDocumentFragment(),pattern=/(?:(?:(?<![\p{L}\d])[+\-−])?\d[\d.,]*\s*(?:xu|coins?)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])xu(?![\p{L}\p{N}])|🪙)/gu;
      // "coins" (tiếng Anh) chỉ trang trí khi đi sau số; không khớp gì thì bỏ qua để không thay node vô ích (MutationObserver lặp).
      const matches=[...text.data.matchAll(pattern)];if(!matches.length)continue;
      let end=0;
      for(const match of matches){
        fragment.append(text.data.slice(end,match.index));
        const amount=document.createElement('span');amount.className='game-currency';
        const coin=document.createElement('span');coin.className='farm-gold-coin';coin.setAttribute('aria-hidden','true');coin.textContent='₫';amount.append(coin);
        if(match[0]!=='🪙')amount.append(document.createTextNode(' '+match[0]));
        fragment.append(amount);end=match.index+match[0].length;
      }
      fragment.append(text.data.slice(end));text.replaceWith(fragment);
    }
  }
  decorate(root);
  const observer=new MutationObserver(records=>{
    const nodes=new Set();for(const record of records){if(record.type==='characterData')nodes.add(record.target);else for(const node of record.addedNodes)nodes.add(node);}
    for(const node of nodes)if(node.isConnected)decorate(node);
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true});
}
