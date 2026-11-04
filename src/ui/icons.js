// Game icon family (docs/shared/design-system.md §4): 24px grid, ink stroke = currentColor, fixed two-tone fill.
// Gameplay strings keep their emoji; installIcons() swaps them for SVG in the DOM, fillRich() does it on canvas.
const G = '#f2c14e', L = '#8cbf5b', B = '#8a5a34', W = '#79bfe0', R = '#d9634a', C = '#fff4d8', S = '#cfc6b2',
  K = '#c99055', P = '#f3c9a2', Y = '#bfe0f0', O = '#eea04a', J = '#6fb3a3', I = 'currentColor';
const f = c => `fill="${c}"`;

const ICONS = {
  menu: `<rect x="4" y="4" width="7" height="7" rx="2" ${f(K)}/><rect x="13" y="4" width="7" height="7" rx="2" ${f(L)}/><rect x="4" y="13" width="7" height="7" rx="2" ${f(G)}/><rect x="13" y="13" width="7" height="7" rx="2" ${f(K)}/>`,
  settings: `<circle cx="12" cy="12" r="6.5" ${f(S)}/><circle cx="12" cy="12" r="2.6" ${f(C)}/><path d="M12 2.8v2.7M12 18.5v2.7M2.8 12h2.7M18.5 12h2.7M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>`,
  book: `<path d="M3 5.5c3-1 6-1 9 1v13c-3-2-6-2-9-1z" ${f(C)}/><path d="M21 5.5c-3-1-6-1-9 1v13c3-2 6-2 9-1z" ${f(C)}/>`,
  scroll: `<path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7H9V6a2 2 0 0 0-2-2z" ${f(C)}/><path d="M7 4h11a2 2 0 0 1 2 2v1H9M9 11h7M9 14.5h7"/>`,
  help: `<circle cx="12" cy="12" r="9" ${f(Y)}/><path d="M9.5 9.5a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1.2-1.5 2.3"/><circle cx="12" cy="17" r=".7" ${f(I)}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${f(G)}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5V17"/>`,
  unlock: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${f(G)}/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8M12 14.5V17"/>`,
  sound: `<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" ${f(S)}/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>`,
  pin: `<path d="M9 3.5h6l-1 5 3 3H7l3-3z" ${f(R)}/><path d="M12 11.5V20"/>`,
  ticket: `<path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" ${f(C)}/><path d="M9 8h6M9 11.5h6M9 15h4"/>`,
  refresh: `<path d="M19 12a7 7 0 1 1-2-5M19 4.5V8h-3.5"/>`,
  bulb: `<path d="M8.5 15a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2z" ${f(G)}/><path d="M9.5 20h5"/>`,
  target: `<circle cx="12" cy="12" r="8.5" ${f(C)}/><circle cx="12" cy="12" r="5" ${f(R)}/><circle cx="12" cy="12" r="1.6" ${f(C)}/>`,
  timer: `<circle cx="12" cy="13.5" r="7" ${f(C)}/><path d="M12 13.5V10M10 3.5h4M18 7l1.3-1.3"/>`,
  warning: `<path d="M12 4l9 15.5H3z" ${f(G)}/><path d="M12 10v4"/><circle cx="12" cy="16.8" r=".7" ${f(I)}/>`,
  ban: `<circle cx="12" cy="12" r="8.5" ${f(C)}/><path d="M6 6l12 12"/>`,
  tap: `<path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11l3.6.9a2 2 0 0 1 1.4 2.4L17 19.5h-6.5L7 15.2a1.4 1.4 0 0 1 2-2l1 1z" ${f(P)}/>`,
  hand: `<path d="M7 12.5V7a1.4 1.4 0 0 1 2.8 0v4.5V5a1.4 1.4 0 0 1 2.8 0v6.5V6a1.4 1.4 0 0 1 2.8 0v6V9a1.4 1.4 0 0 1 2.8 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 14.3a1.4 1.4 0 0 1 2-1.8z" ${f(P)}/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" ${f(C)}/><circle cx="12" cy="12" r="3" ${f(B)}/>`,
  pause: `<rect x="6.5" y="5" width="3.5" height="14" rx="1" ${f(S)}/><rect x="14" y="5" width="3.5" height="14" rx="1" ${f(S)}/>`,
  forward: `<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z" ${f(S)}/>`,
  'dot-green': `<circle cx="12" cy="12" r="6" ${f(L)}/>`,
  'dot-yellow': `<circle cx="12" cy="12" r="6" ${f(G)}/>`,
  'dot-orange': `<circle cx="12" cy="12" r="6" ${f(O)}/>`,
  'dot-white': `<circle cx="12" cy="12" r="6" ${f(C)}/>`,
  star: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" ${f(G)}/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0z" ${f(G)}/><path d="M7 6H4.5a3 3 0 0 0 3 4M17 6h2.5a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7l-1-3h-5z"/>`,
  gift: `<rect x="4" y="9" width="16" height="11" rx="1.5" ${f(R)}/><path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5-1.5.6 1.2 3 1.5 5 1.5zm0 0c1.5-4 6-4 5-1.5-.6 1.2-3 1.5-5 1.5z"/>`,
  lesson: `<path d="M2.5 9.5L12 5l9.5 4.5L12 14z" ${f(J)}/><path d="M6.5 11.5V16c3 2.5 8 2.5 11 0v-4.5M21.5 9.5v5"/>`,
  'face-happy': `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M8.5 13.5a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r=".8" ${f(I)}/><circle cx="15" cy="10" r=".8" ${f(I)}/>`,
  'face-sad': `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M8.5 16.5a4 4 0 0 1 7 0"/><circle cx="9" cy="10" r=".8" ${f(I)}/><circle cx="15" cy="10" r=".8" ${f(I)}/>`,
  'face-angry': `<circle cx="12" cy="12" r="8.5" ${f(O)}/><path d="M9 15.5h6M7.5 8l3 1.5M16.5 8l-3 1.5"/><circle cx="9.5" cy="11.5" r=".8" ${f(I)}/><circle cx="14.5" cy="11.5" r=".8" ${f(I)}/>`,
  sleep: `<path d="M4 9h5l-5 6h5M13 5h4l-4 5h4"/>`,
  sick: `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M9 15h3"/><circle cx="9" cy="10" r=".8" ${f(I)}/><circle cx="15" cy="10" r=".8" ${f(I)}/><path d="M14 18.5l5-5" stroke-width="2.6"/>`,
  phone: `<rect x="7" y="3" width="10" height="18" rx="2" ${f(S)}/><path d="M11 17.5h2"/>`,
  screen: `<rect x="3" y="4.5" width="18" height="12" rx="1.5" ${f(Y)}/><path d="M9 20h6M12 16.5V20"/>`,
  medic: `<circle cx="12" cy="12" r="8.5" ${f(C)}/><path d="M12 7.5v9M7.5 12h9" stroke="${R}" stroke-width="3"/>`,
  skull: `<path d="M5 11a7 7 0 0 1 14 0v3l-2 1.5V19H7v-3.5L5 14z" ${f(C)}/><circle cx="9.5" cy="11.5" r="1.6" ${f(I)}/><circle cx="14.5" cy="11.5" r="1.6" ${f(I)}/><path d="M11 19v-2M13 19v-2"/>`,
  coin: `<circle cx="12" cy="12" r="8.5" ${f(G)}/><circle cx="12" cy="12" r="5.5"/>`,
  crate: `<path d="M3.5 8L12 4l8.5 4v8.5L12 20.5l-8.5-4z" ${f(K)}/><path d="M3.5 8L12 12l8.5-4M12 12v8.5M7.8 6l8.5 4"/>`,
  cart: `<path d="M6.5 7.5h13l-2 7h-10z" ${f(C)}/><path d="M3 4.5h2.5l2 10h10"/><circle cx="9" cy="18.5" r="1.5"/><circle cx="16" cy="18.5" r="1.5"/>`,
  shop: `<path d="M4.5 10h15v10h-15z" ${f(C)}/><path d="M3 10l2-5.5h14L21 10z" ${f(R)}/><path d="M10 20v-5h4v5"/>`,
  truck: `<path d="M2.5 6.5h11v9h-11z" ${f(G)}/><path d="M13.5 9.5h4l3 3v3h-7z" ${f(C)}/><circle cx="7" cy="17" r="1.8" ${f(S)}/><circle cx="17" cy="17" r="1.8" ${f(S)}/>`,
  bag: `<path d="M6 8.5h12l-1 11.5H7z" ${f(R)}/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5M9 13h6"/>`,
  basket: `<path d="M3.5 10.5h17l-2 9h-13z" ${f(K)}/><path d="M7 10.5l3-6M17 10.5l-3-6M8 14v3M12 14v3M16 14v3"/>`,
  chair: `<path d="M7.5 4v8M8.5 13.5V20M15.5 13.5V20"/><rect x="7.5" y="11" width="9" height="2.5" rx=".8" ${f(K)}/><rect x="7" y="3.5" width="3" height="8" rx="1" ${f(K)}/>`,
  door: `<path d="M6 3.5h12v17H6z" ${f(K)}/><circle cx="15" cy="12.5" r=".9" ${f(I)}/><path d="M4 20.5h16"/>`,
  bell: `<path d="M4.5 17a7.5 7.5 0 0 1 15 0z" ${f(G)}/><path d="M3 17h18M12 9.5v-2M10.5 7.5h3"/>`,
  sprout: `<path d="M12 21v-9M7.5 21h9"/><path d="M12 13C12 8 8.5 5 3 5c0 5 3.5 8 9 8z" ${f(L)}/><path d="M12 11c0-4.5 3-8 9-8 0 4.5-3 8-9 8z" ${f(L)}/>`,
  // One sapling per crop so the shop/bag can tell them apart (vối: round leaves, chè: narrow, mít: broad + cherries).
  'seed-robusta': `<path d="M7 15h10l-1.5 5.5h-7z" ${f(O)}/><path d="M12 15V8"/><circle cx="8.3" cy="9.5" r="3.3" ${f('#5f8a3c')}/><circle cx="15.7" cy="9.5" r="3.3" ${f('#5f8a3c')}/><circle cx="12" cy="5.6" r="3.1" ${f('#5f8a3c')}/>`,
  'seed-arabica': `<path d="M7 15h10l-1.5 5.5h-7z" ${f(J)}/><path d="M12 15V6"/><path d="M12 11.5C8.8 11.5 6 9.5 5 5.5c3.6 0 6.2 2.3 7 6zM12 9.5c3.2-.3 5.8-2.4 7-6-3.6 0-6.2 2.3-7 6z" ${f(L)}/>`,
  'seed-liberica': `<path d="M7 15h10l-1.5 5.5h-7z" ${f(G)}/><path d="M12 15V9.5"/><path d="M12 10c-4.6 0-7.6-2.5-8.2-6.6 4.6 0 7.7 2.2 8.2 6.6zM12 10c4.6 0 7.6-2.5 8.2-6.6-4.6 0-7.7 2.2-8.2 6.6z" ${f('#5f8a3c')}/><circle cx="10.6" cy="12.4" r="1.5" ${f(R)}/><circle cx="13.4" cy="12.4" r="1.5" ${f(R)}/>`,
  leaf: `<path d="M5 19C5 10 10 5 19.5 4.5 19 14 14 19 5 19z" ${f(L)}/><path d="M5 19l9-9"/>`,
  plant: `<path d="M7 14h10l-1.5 6.5h-7z" ${f(O)}/><path d="M12 14V9"/><path d="M12 10c-1-3-3.5-4.5-6.5-4 .5 3 3 4.5 6.5 4zM12 9c1-3 3.5-4.5 6.5-4-.5 3-3 4.5-6.5 4z" ${f(L)}/>`,
  flower: `<g ${f('#f2a7b8')}><circle cx="12" cy="6.8" r="2.8"/><circle cx="16.6" cy="10.2" r="2.8"/><circle cx="14.9" cy="15.4" r="2.8"/><circle cx="9.1" cy="15.4" r="2.8"/><circle cx="7.4" cy="10.2" r="2.8"/></g><circle cx="12" cy="11.6" r="2" ${f(G)}/>`,
  water: `<path d="M12 3.5c3.5 4.5 6 7.8 6 10.5a6 6 0 0 1-12 0c0-2.7 2.5-6 6-10.5z" ${f(W)}/>`,
  sun: `<circle cx="12" cy="12" r="4.5" ${f(G)}/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  cloud: `<path d="M7 18.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.5-1.5 4.5 4.5 0 0 1 .5 9.5z" ${f(C)}/>`,
  fire: `<path d="M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8.5z" ${f(O)}/>`,
  thermo: `<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a3.5 3.5 0 1 1-4 0z" ${f(C)}/><circle cx="12" cy="17.3" r="1.6" ${f(R)}/><path d="M12 15.7V9"/>`,
  wind: `<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h6"/>`,
  bean: `<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(30 12 12)" ${f(B)}/><path d="M9 6.5c3 3 1 8 6 11"/>`,
  cherry: `<path d="M8.5 14.5C9 9 11 5.5 16 4M15.5 15.5C15 10 14.5 7 16 4"/><circle cx="8" cy="16.5" r="3.5" ${f(R)}/><circle cx="15.5" cy="17" r="3.5" ${f(R)}/>`,
  tool: `<path d="M12.5 8.5L20 20"/><path d="M4 9c4-4.5 10-5.5 16-3.5-5-.3-9 1.3-12.5 4.5z" ${f(S)}/>`,
  wrench: `<path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.6-.6-3 2.8-2.8A4.5 4.5 0 0 0 14.5 4z" ${f(S)}/>`,
  scissors: `<circle cx="6.5" cy="17" r="2.5" ${f(R)}/><circle cx="6.5" cy="7" r="2.5" ${f(R)}/><path d="M8.5 8.5L20 17M8.5 15.5L20 7"/>`,
  sponge: `<rect x="4" y="8" width="16" height="9" rx="2.5" ${f(G)}/><circle cx="9" cy="12" r="1"/><circle cx="14" cy="11" r=".9"/><circle cx="16" cy="14" r=".8"/>`,
  farmer: `<circle cx="12" cy="10.5" r="3.6" ${f(P)}/><path d="M5.5 20.5c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5z" ${f(L)}/><path d="M7 8.5c.5-3 2.5-4.5 5-4.5s4.5 1.5 5 4.5z" ${f(G)}/><path d="M4.5 8.5h15"/>`,
  person: `<circle cx="12" cy="8.5" r="4" ${f(P)}/><path d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5z" ${f(J)}/>`,
  people: `<circle cx="16" cy="8" r="2.8" ${f(P)}/><path d="M14.5 13.2c3.2-.6 6 1.4 6.5 5.3h-4"/><circle cx="9" cy="9" r="3.2" ${f(P)}/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5z" ${f(J)}/>`,
  chef: `<circle cx="12" cy="11.5" r="3.4" ${f(P)}/><path d="M5.5 20.5c.5-3.3 3.2-5.3 6.5-5.3s6 2 6.5 5.3z" ${f(C)}/><path d="M8 8.5h8v-2a2.5 2.5 0 0 0-1.5-2.3A2.6 2.6 0 0 0 12 3a2.6 2.6 0 0 0-2.5 1.2A2.5 2.5 0 0 0 8 6.5z" ${f(C)}/>`,
  robot: `<rect x="5" y="7.5" width="14" height="11" rx="3" ${f(S)}/><circle cx="9.5" cy="12.5" r="1.3" ${f(J)}/><circle cx="14.5" cy="12.5" r="1.3" ${f(J)}/><path d="M12 7.5v-3M3 12v3M21 12v3M9.5 16h5"/><circle cx="12" cy="4" r=".9" ${f(R)}/>`,
  handshake: `<path d="M2.5 9.5l4-2 4 1.5 3-1.5 4 .5 4 2v5l-3 .5-4.5 3.5a1.5 1.5 0 0 1-2-.2l-4-4-5.5-.3z" ${f(P)}/><path d="M10.5 9L8 11.5a1.2 1.2 0 0 0 1.7 1.7L12 11"/>`,
  house: `<path d="M5 11.5h14V20H5z" ${f(C)}/><path d="M2.5 11.5L12 4l9.5 7.5z" ${f(R)}/><path d="M10 20v-5h4v5"/>`,
  sign: `<rect x="4" y="4.5" width="16" height="9" rx="1.5" ${f(K)}/><path d="M12 13.5v7M8 8h8M9 10.5h6"/>`,
  lantern: `<ellipse cx="12" cy="12" rx="6" ry="7" ${f(R)}/><path d="M12 3v2M9.5 19.5V21h5v-1.5M8 6.5h8M8 17.5h8M12 5v14"/>`,
  picture: `<rect x="3.5" y="5" width="17" height="14" rx="1.5" ${f(Y)}/><path d="M3.5 16l5-5 4 4 3-3 4.5 4.5"/><circle cx="16" cy="9" r="1.5" ${f(G)}/>`,
  wood: `<rect x="3" y="8" width="15" height="8" rx="4" ${f(K)}/><ellipse cx="18" cy="12" rx="3" ry="4" ${f(C)}/><path d="M17.5 12h1"/>`,
  'cup-hot': `<path d="M4.5 10h12v4.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" ${f(C)}/><path d="M16.5 11.5H18a2.5 2.5 0 0 1 0 5h-2M8.5 4c-1 1.2 1 2 0 3.5M12.5 4c-1 1.2 1 2 0 3.5M3.5 20.5h14"/>`,
  'cup-iced': `<path d="M6 7.5h12l-1.5 13h-9z" ${f(C)}/><path d="M6.8 12h10.4l-.8 8.5H7.6z" ${f(B)}/><rect x="9" y="8.5" width="2.6" height="2.6" rx=".5" ${f(Y)}/><path d="M13.5 7.5L16 3"/>`,
  milk: `<path d="M8 3.5h8v3l2 3v11H6v-11l2-3z" ${f(C)}/><path d="M6 12h12M8 6.5h8"/>`,
  kettle: `<path d="M5 10.5h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" ${f(S)}/><path d="M16 12l4-3M8 10.5c0-2 1.5-3.5 2.5-3.5S13 8.5 13 10.5M10.5 5v2"/>`,
  pour: `<path d="M4 7l6-2 4 6-5 3z" ${f(C)}/><path d="M12.5 12.5c1 2 2 3.5 2 5M11 20.5h8"/>`,
  ice: `<rect x="4.5" y="8" width="9" height="9" rx="1.5" ${f(Y)}/><rect x="11" y="4.5" width="8" height="8" rx="1.5" ${f(Y)}/>`,
  salt: `<path d="M8 9.5h8v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" ${f(C)}/><path d="M8.5 9.5l1-5h5l1 5"/><circle cx="11" cy="6.8" r=".5" ${f(I)}/><circle cx="13" cy="6.8" r=".5" ${f(I)}/>`,
  egg: `<path d="M12 3.5c3.5 0 6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 2.5-10 6-10z" ${f(C)}/>`,
  can: `<rect x="6.5" y="4.5" width="11" height="15" rx="1.5" ${f(R)}/><path d="M6.5 8h11M6.5 16h11"/>`,
  spoon: `<ellipse cx="12" cy="7" rx="3.2" ry="4" ${f(S)}/><path d="M12 11v9.5"/>`,
  beaker: `<path d="M10.5 3.5v6L5.5 19a1.2 1.2 0 0 0 1 1.5h11a1.2 1.2 0 0 0 1-1.5l-5-9.5v-6" ${f(C)}/><path d="M9.5 3.5h5M7.5 15h9"/>`,
  empty: `<path d="M4 10a4 4 0 0 1 8 0v9H4z" ${f(C)}/><path d="M8 6h9a3.5 3.5 0 0 1 3.5 3.5V19H12M15 10V4h3"/>`,
};

// Emoji (without U+FE0F) → icon name. 🪙 stays with ui/currency.js; ✓ ★ ☆ → ↗ and friends are typography, not emoji.
const NAMES = {
  settings: '⚙', book: '📖📚', scroll: '📜', help: '❓❔', lock: '🔒', unlock: '🔓', sound: '🔊', pin: '📌🚩',
  ticket: '📋📄🧾', refresh: '🔄🔁', bulb: '💡', target: '🎯', timer: '⏱', warning: '⚠', ban: '🚫', tap: '👆',
  hand: ['👋', '🙋‍♂️', '✋', '🖐', '✊'], eye: '👀', pause: '⏸', forward: '⏭⏩', 'dot-green': '🟢', 'dot-yellow': '🟡',
  'dot-orange': '🟠', 'dot-white': '⚪', star: '⭐🌟', trophy: '🏆🎉', gift: '🎁', lesson: '🎓🧠',
  'face-happy': '😊🙂😍', 'face-sad': '😕😖', 'face-angry': '😤😠', sleep: '💤', sick: '🤒', phone: '📱', screen: '📺🖥',
  skull: '☠', coin: '💵💰', crate: '📦', cart: '🛒', shop: '🏪', truck: '🚚', bag: '🎒', basket: '🧺', chair: '🪑💺🛋',
  door: '🚪', bell: '🛎', sprout: '🌱', leaf: '🌿', plant: '🪴', flower: '🌸💐', water: '💧🌊', sun: '☀', cloud: '☁',
  fire: '🔥♨', thermo: '🌡', wind: '🌀', bean: '🫘', cherry: '🍒', tool: '⛏🪓🔨', wrench: '🔧🛠🧰', scissors: '✂',
  sponge: '🧽', farmer: ['👩‍🌾', '🧑‍🌾', '👨‍🌾'], robot: '🤖', people: '👥',
  person: ['🧑', '👩', '👧', '👦', '👵', '👴', '🧕', '🧔', '👩‍🦰', '👩‍💼', '🚶'], chef: ['👩‍🍳', '👨‍🍳', '🧑‍🍳'],
  handshake: '🤝', house: '🏡', sign: '🪧', lantern: '🏮', picture: '🖼', wood: '🪵', 'cup-hot': '☕', 'cup-iced': '🧋🥤',
  milk: '🥛🍶', kettle: '🫖', pour: '🫗', ice: '🧊', salt: '🧂', egg: '🥚', can: '🥫', spoon: '🥄', beaker: '🧪', empty: '📭',
};
const EMOJI = new Map();
for (const [name, list] of Object.entries(NAMES)) for (const e of Array.isArray(list) ? list : [...list]) EMOJI.set(e.replace(/️/g, ''), name);
// Arrow emoji become plain arrows (font glyphs), not icons.
const TEXT = { '⬇': '↓', '⬆': '↑', '↘': '↘' };
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keys = [...EMOJI.keys(), ...Object.keys(TEXT)].sort((a, b) => b.length - a.length).map(escape);
const PATTERN = new RegExp(`(${keys.join('|')})️?`, 'gu');
const nameOf = emoji => EMOJI.get(emoji.replace(/️/g, ''));

const SVG = 'http://www.w3.org/2000/svg';
const OPEN = 'viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export function icon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', `ui-icon ui-icon--${name}`); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use'); use.setAttribute('href', `#i-${name}`); svg.append(use);
  return svg;
}

// Icon element for one emoji (unknown → the emoji as text), for places that must keep their text intact right away.
export const iconFor = emoji => nameOf(emoji) ? icon(nameOf(emoji)) : document.createTextNode(emoji);

// Canvas copies with a fixed ink colour (canvas has no currentColor): dark ink for paper, light ink for the dark
// nameplates. Decoded before the game starts.
const INKS = { dark: '#4a3020', light: '#fff6dc' };
const images = { dark: new Map(), light: new Map() };
const svgUrl = (name, ink = INKS.dark) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG}" width="96" height="96" ${OPEN} stroke="${ink}">${ICONS[name].replaceAll(I, ink)}</svg>`)}`;
// typeof guard: node tests import the 3D scene (and this module) without a DOM.
export const iconsReady = typeof Image === 'undefined' ? Promise.resolve() : Promise.all(Object.keys(ICONS).flatMap(name => Object.entries(INKS).map(([tone, ink]) => {
  const image = new Image(96, 96);
  image.src = svgUrl(name, ink);
  images[tone].set(name, image);
  return image.decode().catch(() => images[tone].delete(name));
})));

// fillText with emoji drawn as icons. Centre-aligned at (x, y); `size` = font px, used for icon size; `light` for dark plates.
export function fillRich(ctx, text, x, y, size, maxWidth = Infinity, light = false) {
  // 🪙 stays out of PATTERN (ui/currency.js owns it in the DOM); on canvas it is just the coin icon.
  const parts = String(text).replaceAll('🪙', '💵').split(PATTERN).filter(Boolean).map(part => {
    const image = images[light ? 'light' : 'dark'].get(nameOf(part)), plain = TEXT[part] ?? part;
    return image ? { image, width: size * 1.15 } : { text: plain, width: ctx.measureText(plain).width };
  });
  const total = parts.reduce((sum, p) => sum + p.width, 0), k = Math.min(1, maxWidth / total);
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.textAlign = 'left';
  let left = -total / 2;
  for (const p of parts) {
    if (p.image) ctx.drawImage(p.image, left + size * .05, -size * .55, size * 1.05, size * 1.05); else ctx.fillText(p.text, left, 0);
    left += p.width;
  }
  ctx.restore();
}

// Swap emoji in DOM text for SVG icons, now and for every later update (same approach as installCurrencyIcons).
export function installIcons(root = document.body) {
  const sprite = document.createElementNS(SVG, 'svg');
  sprite.setAttribute('aria-hidden', 'true'); sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  sprite.innerHTML = Object.entries(ICONS).map(([name, body]) => `<symbol id="i-${name}" ${OPEN} stroke="currentColor">${body}</symbol>`).join('');
  document.body.prepend(sprite);
  // CSS can use icons too: background: var(--i-leaf) center/16px no-repeat (pseudo-elements cannot hold <use>).
  for (const name of Object.keys(ICONS)) document.documentElement.style.setProperty(`--i-${name}`, `url("${svgUrl(name)}")`);
  const excluded = 'script,style,textarea,option,svg';
  const warned = new Set();
  function decorate(node) {
    if (node.nodeType === Node.ELEMENT_NODE && node.closest(excluded)) return;
    const texts = [];
    if (node.nodeType === Node.TEXT_NODE) texts.push(node);
    else { const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); while (walker.nextNode()) texts.push(walker.currentNode); }
    for (const text of texts) {
      if (!text.parentElement || text.parentElement.closest(excluded)) continue;
      PATTERN.lastIndex = 0;
      if (!PATTERN.test(text.data)) {
        if (import.meta.env.DEV) for (const m of text.data.match(/\p{Emoji_Presentation}/gu) || []) if (m !== '🪙' && !warned.has(m)) { warned.add(m); console.warn('icons.js: chưa có icon cho', m); }
        continue;
      }
      const fragment = document.createDocumentFragment();
      for (const part of text.data.split(PATTERN)) {
        if (!part) continue;
        const name = nameOf(part), plain = TEXT[part];
        fragment.append(name ? icon(name) : plain ?? part);
      }
      text.replaceWith(fragment);
    }
  }
  decorate(root);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') { if (record.target.isConnected) decorate(record.target); }
      else for (const node of record.addedNodes) if (node.isConnected) decorate(node);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true });
}
