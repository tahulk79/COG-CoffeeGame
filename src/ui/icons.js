// Game icon family (docs/design/godbean-gdd.md §11): 24px grid, ink stroke = currentColor, fixed two-tone fill.
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
  globe: `<circle cx="12" cy="12" r="8.5" ${f(Y)}/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/>`,
  disk: `<path d="M5 4h11.5L20 7.5V20H5z" ${f(W)}/><rect x="8" y="4" width="7" height="5" ${f(C)}/><rect x="8" y="13" width="8" height="7" ${f(C)}/>`,
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
  // Steam locomotive, side view facing right: red cab, teal boiler, chimney with a puff, three wheels.
  train: `<circle cx="17.2" cy="3.6" r="1.5" ${f(S)}/><path d="M15.6 6.4h3v3.6h-3z" ${f(B)}/><rect x="9.6" y="9.6" width="10" height="6.4" rx="1.6" ${f(J)}/><path d="M12.6 9.6v6.4" stroke="${G}" stroke-width="1.6"/><rect x="3" y="5.6" width="7" height="10.4" rx="1" ${f(R)}/><rect x="4.7" y="7.6" width="3.6" height="3.2" rx=".6" ${f(Y)}/><path d="M2.3 5.6h8.4M19.6 16l1.9 2.6h-2.6M3 16h16.6"/><circle cx="6.4" cy="18.2" r="2.3" ${f(S)}/><circle cx="12.6" cy="18.6" r="1.7" ${f(S)}/><circle cx="16.8" cy="18.6" r="1.7" ${f(S)}/>`,
  // Drawstring sack: tied neck, flared top, round gold body with a coin mark.
  moneybag: `<path d="M8.6 3.6c1.1.8 2.2.8 3.4 0 1.2.8 2.3.8 3.4 0l-1.5 3.4h-3.8z" ${f(O)}/><path d="M10.1 7c-3.6 2.2-6.1 5.8-6.1 9.1 0 3 2.6 4.4 8 4.4s8-1.4 8-4.4c0-3.3-2.5-6.9-6.1-9.1z" ${f(G)}/><path d="M9.6 7h4.8"/><circle cx="12" cy="14.6" r="3.2" ${f(C)}/><path d="M12 12.9v3.4"/>`,
  crate: `<path d="M3.5 8L12 4l8.5 4v8.5L12 20.5l-8.5-4z" ${f(K)}/><path d="M3.5 8L12 12l8.5-4M12 12v8.5M7.8 6l8.5 4"/>`,
  cart: `<path d="M6.5 7.5h13l-2 7h-10z" ${f(C)}/><path d="M3 4.5h2.5l2 10h10"/><circle cx="9" cy="18.5" r="1.5"/><circle cx="16" cy="18.5" r="1.5"/>`,
  shop: `<path d="M4.5 10h15v10h-15z" ${f(C)}/><path d="M3 10l2-5.5h14L21 10z" ${f(R)}/><path d="M10 20v-5h4v5"/>`,
  truck: `<path d="M2.5 6.5h11v9h-11z" ${f(G)}/><path d="M13.5 9.5h4l3 3v3h-7z" ${f(C)}/><circle cx="7" cy="17" r="1.8" ${f(S)}/><circle cx="17" cy="17" r="1.8" ${f(S)}/>`,
  bag: `<path d="M6 8.5h12l-1 11.5H7z" ${f(R)}/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5M9 13h6"/>`,
  basket: `<path d="M3.5 10.5h17l-2 9h-13z" ${f(K)}/><path d="M7 10.5l3-6M17 10.5l-3-6M8 14v3M12 14v3M16 14v3"/>`,
  chair: `<path d="M7.5 4v8M8.5 13.5V20M15.5 13.5V20"/><rect x="7.5" y="11" width="9" height="2.5" rx=".8" ${f(K)}/><rect x="7" y="3.5" width="3" height="8" rx="1" ${f(K)}/>`,
  door: `<path d="M6 3.5h12v17H6z" ${f(K)}/><circle cx="15" cy="12.5" r=".9" ${f(I)}/><path d="M4 20.5h16"/>`,
  'bell-desk': `<path d="M4.5 17a7.5 7.5 0 0 1 15 0z" ${f(G)}/><path d="M3 17h18M12 9.5v-2M10.5 7.5h3"/>`,
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
  // Finance UI (by name).
  usd: `<rect x="2.5" y="6.5" width="19" height="11" rx="1.5" ${f(L)}/><circle cx="12" cy="12" r="3" ${f(C)}/><path d="M12 10.4v3.2M5.8 12h.01M18.2 12h.01"/>`,
  gold: `<path d="M5 8v8.5c0 1.7 3.1 3 7 3s7-1.3 7-3V8z" ${f(O)}/><path d="M5 11c0 1.7 3.1 3 7 3s7-1.3 7-3M5 13.8c0 1.7 3.1 3 7 3s7-1.3 7-3"/><ellipse cx="12" cy="8" rx="7" ry="3" ${f(G)}/>`,
  bell: `<path d="M6 16.5c1.2-1.4 1.5-3 1.5-5.5a4.5 4.5 0 0 1 9 0c0 2.5.3 4.1 1.5 5.5z" ${f(G)}/><path d="M4.5 16.5h15M12 6.5V3.5M10 19.8a2.2 2.2 0 0 0 4 0"/>`,
  ledger: `<rect x="5" y="3.5" width="14.5" height="17" rx="1.5" ${f(J)}/><path d="M8.5 3.5v17M11.5 14.5h5M11.5 17.3h3.5"/><rect x="11" y="6.8" width="6" height="4.4" rx=".6" ${f(C)}/>`,
  plus: `<circle cx="12" cy="12" r="8.5" ${f(L)}/><path d="M12 7.5v9M7.5 12h9"/>`,
  farm: `<path d="M2.5 20.5l3-7h13l3 7z" ${f(K)}/><path d="M8.5 13.5L7 20.5M15.5 13.5l1.5 7M12 13.5v7"/><path d="M12 13.5V9.5"/><path d="M12 10.5C12 7.5 10 5.5 6.5 5.5c0 3 2 5 5.5 5z" ${f(L)}/><path d="M12 9.5c0-3 2-5.5 5.5-5.5 0 3-2 5.5-5.5 5.5z" ${f(L)}/>`,
  // Marks and controls.
  check: `<circle cx="12" cy="12" r="8.5" ${f(L)}/><path d="M7.5 12.5l3 3 6-6.5"/>`,
  cross: `<circle cx="12" cy="12" r="8.5" ${f(R)}/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>`,
  minus: `<circle cx="12" cy="12" r="8.5" ${f(S)}/><path d="M7.5 12h9"/>`,
  alert: `<path d="M12 4v10.5" stroke="${R}" stroke-width="3.6"/><circle cx="12" cy="19" r="1.6" ${f(R)}/>`,
  play: `<path d="M7 4.5l13 7.5-13 7.5z" ${f(L)}/>`,
  stop: `<rect x="5.5" y="5.5" width="13" height="13" rx="2" ${f(R)}/>`,
  'chevron-down': `<path d="M5.5 9.5L12 16l6.5-6.5"/>`,
  updown: `<path d="M12 3.5v17M8 7.5l4-4 4 4M8 16.5l4 4 4-4"/>`,
  'dot-brown': `<circle cx="12" cy="12" r="6" ${f(B)}/>`,
  sparkle: `<path d="M11 3.5c.8 4.7 2.8 6.7 7.5 7.5-4.7.8-6.7 2.8-7.5 7.5-.8-4.7-2.8-6.7-7.5-7.5 4.7-.8 6.7-2.8 7.5-7.5z" ${f(G)}/><path d="M18.5 16v4.5M16.2 18.2h4.6"/>`,
  burst: `<path d="M12 2.5l2 5.2 5.5-2.2-2.2 5.5 4.2 1.8-4.2 1.8 2.2 5.4-5.5-2.2-2 5.2-2-5.2-5.5 2.2 2.2-5.4-4.2-1.8 4.2-1.8-2.2-5.5 5.5 2.2z" ${f(O)}/>`,
  bolt: `<path d="M13.5 2.5L5 13.5h6l-1 8L19 10h-6.5z" ${f(G)}/>`,
  heart: `<path d="M12 20s-8.5-5-8.5-11A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 20.5 9c0 6-8.5 11-8.5 11z" ${f(R)}/>`,
  // Land.
  soil: `<path d="M3 17l3-9h12l3 9z" ${f(B)}/><path d="M9.5 8l-1.5 9M14.5 8l1.5 9M4.6 12.5h14.8"/>`,
  grain: `<path d="M12 21.5V7"/><g ${f(G)}><ellipse cx="12" cy="5" rx="2" ry="3"/><ellipse cx="8.8" cy="9.4" rx="1.9" ry="3" transform="rotate(-40 8.8 9.4)"/><ellipse cx="15.2" cy="9.4" rx="1.9" ry="3" transform="rotate(40 15.2 9.4)"/><ellipse cx="8.8" cy="14.2" rx="1.9" ry="3" transform="rotate(-40 8.8 14.2)"/><ellipse cx="15.2" cy="14.2" rx="1.9" ry="3" transform="rotate(40 15.2 14.2)"/></g>`,
  tree: `<path d="M12 21.5V13M8.5 21.5h7"/><circle cx="12" cy="9" r="6.5" ${f(L)}/>`,
  palm: `<path d="M10 21.5c.8-3.5 1-7.5.6-11h2.4c.6 3.5.6 7.5.5 11z" ${f(K)}/><g ${f(L)}><path d="M12 10.5C9 6.5 6 5.5 2.5 8c3.5-.2 6.5.6 9.5 2.5z"/><path d="M12 10.5c3-4 6-5 9.5-2.5-3.5-.2-6.5.6-9.5 2.5z"/><path d="M12 10.5C8.5 10 5.5 11.5 4.5 15.5c2.5-2.5 5-4 7.5-5z"/><path d="M12 10.5c3.5-.5 6.5 1 7.5 5-2.5-2.5-5-4-7.5-5z"/></g>`,
  hill: `<path d="M2.5 20C5 13 8 8.5 10.5 8.5c2 0 3.5 2.5 5 5 1-1.2 2-1.5 3-.5 1.3 1.5 2.5 4.5 3 7z" ${f(L)}/>`,
  mountain: `<path d="M2.5 20L9 7.5l4 6 2.5-3.5L21.5 20z" ${f(S)}/><path d="M9 7.5L6.8 11.8l2.6-1 2.5 1z" ${f(C)}/>`,
  terrace: `<path d="M3 20.5V16h4.5v-3.5H12V9h4.5V5.5H21v15z" ${f(K)}/><path d="M3.5 16h4M8 12.5h4M12.5 9h4M17 5.5h4" stroke="${L}" stroke-width="2.8"/>`,
  land: `<circle cx="17.5" cy="6.5" r="2.5" ${f(G)}/><path d="M2.5 19l5-8 3.5 4.5 3-3 7.5 6.5z" ${f(L)}/><path d="M11 19c.5-1.5 2.5-2 2-3.5" stroke="${W}" stroke-width="2.4"/>`,
  sunrise: `<path d="M6.5 17.5a5.5 5.5 0 0 1 11 0z" ${f(O)}/><path d="M12 5.5v3M4 9.5l2 2M20 9.5l-2 2M2.5 17.5h19M7 21h10"/>`,
  moon: `<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" ${f(G)}/>`,
  snow: `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.8 4.6L12 6.6l2.2-2M9.8 19.4l2.2-2 2.2 2"/>`,
  // Buildings and places.
  hut: `<path d="M5 12h14v8.5H5z" ${f(K)}/><path d="M2.5 13L12 4l9.5 9z" ${f(G)}/><path d="M10 20.5V16h4v4.5"/>`,
  gate: `<rect x="3.5" y="5.5" width="3.5" height="15" rx=".8" ${f(K)}/><rect x="17" y="5.5" width="3.5" height="15" rx=".8" ${f(K)}/><path d="M2 5c6 2 14 2 20 0v3.5H2z" ${f(R)}/><path d="M7 13h10M7 16.5h10M10.5 13v3.5M13.5 13v3.5"/>`,
  city: `<rect x="3.5" y="10" width="7" height="10.5" ${f(S)}/><rect x="10.5" y="4" width="10" height="16.5" ${f(Y)}/><path d="M13.5 8h1M16.5 8h1M13.5 11.5h1M16.5 11.5h1M13.5 15h1M16.5 15h1M6 13.5h1M6 17h1"/>`,
  factory: `<path d="M3 20.5V11l6 3.5V11l6 3.5V4h5.5v16.5z" ${f(S)}/><path d="M7 17.5h1.5M12 17.5h1.5M17 17.5h1"/>`,
  crane: `<rect x="5.5" y="8" width="3" height="12.5" ${f(O)}/><path d="M3.5 20.5h7M3 8h18M7 4.5L3 8M7 4.5L21 8M17 8v4.5"/><rect x="14.5" y="12.5" width="5" height="4" rx=".6" ${f(G)}/>`,
  // Tools and things.
  saw: `<path d="M2.5 15v-5l13-2v7z" ${f(S)}/><path d="M2.5 15l2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5"/><path d="M15.5 6.5h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4z" ${f(K)}/><circle cx="18.5" cy="11.5" r="1.4"/>`,
  broom: `<path d="M20 3.5L12 11.5"/><path d="M11 10.5l3 3c-1 3.5-3.5 6-7.5 7.5-.8-.6-2-1.8-3.5-3.5 3.5-1.5 6-4 8-7z" ${f(G)}/><path d="M8.2 15.5l2.5 2.5"/>`,
  trash: `<path d="M6 8h12l-1 12.5H7z" ${f(S)}/><path d="M4 8h16M9.5 8V4.5h5V8M10 11.5v6M14 11.5v6"/>`,
  bucket: `<path d="M5.5 9.5h13l-1.5 11H7z" ${f(S)}/><path d="M5.5 9.5a6.5 6.5 0 0 1 13 0"/><ellipse cx="12" cy="9.5" rx="6.5" ry="1.8" ${f(W)}/>`,
  shower: `<path d="M5 21V8a4.5 4.5 0 0 1 9 0v1"/><path d="M9 13a5 5 0 0 1 10 0z" ${f(S)}/><path d="M10.5 16v1.5M14 16v4M17.5 16v1.5" stroke="${W}"/>`,
  'no-water': `<path d="M12 3.5c3.5 4.5 6 7.8 6 10.5a6 6 0 0 1-12 0c0-2.7 2.5-6 6-10.5z" ${f(W)}/><path d="M4.5 5l15 15" stroke-width="2.6"/>`,
  key: `<circle cx="8" cy="8" r="4.5" ${f(G)}/><circle cx="7" cy="7" r="1.2"/><path d="M11.2 11.2l9.3 9.3M16.3 16.3l2.5-2.5M19 19l1.8-1.8"/>`,
  tag: `<path d="M3.5 12V4.5H11L20.5 14l-7 7z" ${f(G)}/><circle cx="8" cy="9" r="1.5" ${f(C)}/>`,
  voucher: `<path d="M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3z" ${f(G)}/><path d="M15 7.5v1.5M15 11.2v1.6M15 15v1.5M6.5 12h5"/>`,
  briefcase: `<rect x="3" y="8" width="18" height="12" rx="2" ${f(K)}/><path d="M9 8V5.5h6V8M3 13h18M12 12v2"/>`,
  gem: `<path d="M7 4.5h10L21 10l-9 10.5L3 10z" ${f(Y)}/><path d="M3 10h18M9 10l3 10.5L15 10M7 4.5L9 10M17 4.5L15 10"/>`,
  medal: `<path d="M7 3l3.5 7h3L17 3h-3.5L12 6.5 10.5 3z" ${f(R)}/><circle cx="12" cy="15" r="6" ${f(G)}/><path d="M12 12.2v5.6"/>`,
  crown: `<path d="M4 18.5L3 7.5l5 4.5 4-7 4 7 5-4.5-1 11z" ${f(G)}/><path d="M4 21h16"/>`,
  shield: `<path d="M12 3l7.5 2.8V12c0 4.5-3.3 7.5-7.5 9-4.2-1.5-7.5-4.5-7.5-9V5.8z" ${f(W)}/><path d="M8.5 11.5l2.5 2.5 4.5-4.5"/>`,
  puzzle: `<path d="M5 8h4a2.5 2.5 0 1 1 5 0h4v4a2.5 2.5 0 1 1 0 5v3.5H5z" ${f(J)}/>`,
  map: `<path d="M3.5 6.5L9 4l6 2.5L20.5 4v14L15 20.5 9 18l-5.5 2.5z" ${f(L)}/><path d="M9 4v14M15 6.5v14"/>`,
  compass: `<circle cx="12" cy="12" r="8.5" ${f(C)}/><path d="M15.5 8.5l-2 5-5 2 2-5z" ${f(R)}/>`,
  scales: `<path d="M12 4v16M7.5 20.5h9M4.5 6.5h15M5 6.5L2 13M5 6.5L8 13M19 6.5L16 13M19 6.5l3 6.5"/><path d="M2 13a3 3 0 0 0 6 0zM16 13a3 3 0 0 0 6 0z" ${f(G)}/>`,
  search: `<circle cx="10.5" cy="10.5" r="6.5" ${f(Y)}/><path d="M15.5 15.5l5 5" stroke-width="2.6"/>`,
  note: `<rect x="4" y="3.5" width="13" height="17" rx="1.5" ${f(C)}/><path d="M7 8h7M7 11.5h4"/><path d="M11 18.5l.7-3L19 8.2l2.4 2.4-7.3 7.3z" ${f(G)}/>`,
  inbox: `<path d="M3.5 13.5l2.5-7h12l2.5 7v6h-17z" ${f(C)}/><path d="M3.5 13.5h5a3.5 3.5 0 0 0 7 0h5M12 3v7M9.2 7.6l2.8 2.8 2.8-2.8"/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2" ${f(C)}/><path d="M3.5 10V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3z" ${f(R)}/><path d="M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>`,
  clock: `<circle cx="12" cy="12" r="8.5" ${f(C)}/><path d="M12 7v5l3.5 2"/>`,
  hourglass: `<path d="M8 3.5h8c0 4-2 6-4 8.5 2 2.5 4 4.5 4 8.5H8c0-4 2-6 4-8.5-2-2.5-4-4.5-4-8.5z" ${f(C)}/><path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M9.8 18.6h4.4L12 15.4z" ${f(G)}/>`,
  chart: `<rect x="4" y="12" width="4" height="8" rx=".6" ${f(W)}/><rect x="10" y="8" width="4" height="12" rx=".6" ${f(L)}/><rect x="16" y="4" width="4" height="16" rx=".6" ${f(G)}/><path d="M2.5 20.5h19"/>`,
  spend: `<rect x="5" y="4" width="15" height="9" rx="1.2" transform="rotate(-10 12.5 8.5)" ${f(L)}/><circle cx="12.5" cy="8.5" r="2" ${f(C)}/><path d="M7 16.5l-2.5 3.5M12 16.5L9.5 20.5M17 15.5l-2.5 4"/>`,
  card: `<rect x="2.5" y="5.5" width="19" height="13" rx="2" ${f(J)}/><path d="M2.5 10h19M6 15h4"/>`,
  battery: `<rect x="2.5" y="7.5" width="17" height="10" rx="2" ${f(C)}/><rect x="5" y="10" width="12" height="5" rx=".6" stroke="none" ${f(L)}/><path d="M21.5 11v3"/>`,
  'battery-low': `<rect x="2.5" y="7.5" width="17" height="10" rx="2" ${f(C)}/><rect x="5" y="10" width="3.5" height="5" rx=".6" stroke="none" ${f(R)}/><path d="M21.5 11v3"/>`,
  plug: `<path d="M8 8.5h8v4a4 4 0 0 1-8 0z" ${f(S)}/><path d="M9.5 8.5v-5M14.5 8.5v-5M12 16.5V21"/>`,
  antenna: `<path d="M4 8.5A8.5 8.5 0 0 0 15.5 20z" ${f(S)}/><path d="M9.7 14.3l-4.7 6.2h7M9.7 14.3l4-4M15 4.5a5 5 0 0 1 5 5M15 7.5a2 2 0 0 1 2 2"/>`,
  mic: `<rect x="8.5" y="3" width="7" height="11.5" rx="3.5" ${f(S)}/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21M8.5 21h7"/>`,
  camera: `<rect x="3" y="7.5" width="12.5" height="10" rx="2" ${f(S)}/><path d="M15.5 11l5.5-3v9l-5.5-3z" ${f(J)}/><circle cx="9.2" cy="12.5" r="2.2" ${f(C)}/>`,
  gamepad: `<path d="M7 7.5h10a5 5 0 0 1 5 5.2c0 3-1 5.8-3 5.8-1.6 0-2.4-2-3.5-3h-7c-1.1 1-1.9 3-3.5 3-2 0-3-2.8-3-5.8a5 5 0 0 1 5-5.2z" ${f(S)}/><path d="M6 12h3.5M7.75 10.2v3.6M15.5 11.5h.01M18 13h.01"/>`,
  drone: `<path d="M8 11.5L4.5 8M16 11.5L19.5 8"/><ellipse cx="4.5" cy="7" rx="3" ry="1.1" ${f(Y)}/><ellipse cx="19.5" cy="7" rx="3" ry="1.1" ${f(Y)}/><rect x="8" y="10" width="8" height="5.5" rx="1.8" ${f(S)}/><path d="M12 15.5V18M8.5 20.5c1.5-1.5 5.5-1.5 7 0" stroke="${W}"/>`,
  // Wearables.
  boot: `<path d="M7 3.5h8V12l4 2.2c1.3.7 2 1.7 2 3.3H7z" ${f(K)}/><path d="M6.5 17.5h15v3h-15z" ${f(B)}/>`,
  hat: `<ellipse cx="12" cy="16" rx="10" ry="3" ${f(G)}/><path d="M6.5 15c0-5 2.5-8 5.5-8s5.5 3 5.5 8c-3 1.2-8 1.2-11 0z" ${f(G)}/><path d="M6.8 12.8c3.2 1.2 7.2 1.2 10.4 0" stroke="${R}" stroke-width="2"/>`,
  apron: `<path d="M9 3.5h6v4l5 3v10H4v-10l5-3z" ${f(C)}/><path d="M9 3.5C9 2.5 9.5 2 12 2s3 .5 3 1.5M8 14h8v3.5H8z"/>`,
  // Food and drink.
  tea: `<path d="M4.5 9.5h15c0 6-3 10-7.5 10s-7.5-4-7.5-10z" ${f(J)}/><path d="M9.5 3.5c-1 1.2 1 2 0 3.5M14 3.5c-1 1.2 1 2 0 3.5M8.5 20.5h7"/>`,
  beer: `<path d="M5.5 8H16v12.5H5.5z" ${f(G)}/><path d="M16 11h2.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H16M9 12v5.5M12.5 12v5.5"/><path d="M4.5 8A2.5 2.5 0 0 1 7 5a3 3 0 0 1 5-1 3 3 0 0 1 4.5 2c.7.5 1 1.2 1 2z" ${f(C)}/>`,
  cocktail: `<path d="M4 4.5h16l-8 9z" ${f(R)}/><path d="M12 13.5v7M8 20.5h8M16 2.5L14 7"/>`,
  plate: `<circle cx="12" cy="12" r="5.8" ${f(C)}/><circle cx="12" cy="12" r="2.8"/><path d="M3 4v4c0 1 .6 1.5 1.5 1.5V20M4.5 4v3M6 4v4c0 1-.6 1.5-1.5 1.5M20.5 20V4c-1.5 1-2 3-2 6h2"/>`,
  burger: `<path d="M4 11c0-4 4-6.5 8-6.5s8 2.5 8 6.5z" ${f(K)}/><path d="M3.5 14.2c1.5-1.3 3-1.3 4.3 0s3 1.3 4.2 0 3-1.3 4.2 0 3 1.3 4.3 0" stroke="${L}" stroke-width="2.4"/><path d="M4.5 17h15v.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z" ${f(K)}/>`,
  croissant: `<path d="M4 16.5C3 10 7 4.5 12 4.5s9 5.5 8 12c-.2 1-1.4 1.2-2 .4-1.2-2-3-3.4-6-3.4s-4.8 1.4-6 3.4c-.6.8-1.8.6-2-.4z" ${f(O)}/><path d="M8.5 6.2l.5 7.6M15.5 6.2l-.5 7.6"/>`,
  flan: `<path d="M6 17l1.8-9h8.4L18 17z" ${f(G)}/><path d="M7.8 8h8.4l-.6 2.5H8.4z" ${f(B)}/><path d="M3.5 17h17c-.3 2-2 3-3.5 3H7c-1.5 0-3.2-1-3.5-3z" ${f(C)}/>`,
  mooncake: `<rect x="3.5" y="3.5" width="17" height="17" rx="5" ${f(K)}/><circle cx="12" cy="12" r="4.5" ${f(O)}/><path d="M12 9.5v5M9.5 12h5"/>`,
  icecream: `<path d="M7.5 12.5h9L12 21.5z" ${f(K)}/><path d="M6.5 12.5a5.5 5.5 0 1 1 11 0z" ${f(C)}/>`,
  chocolate: `<rect x="5" y="3.5" width="14" height="17" rx="1.5" ${f(B)}/><path d="M5 9.5h14M5 15h14M12 3.5v17"/>`,
  candy: `<path d="M7.5 9.8L3 7v10l4.5-2.8M16.5 9.8L21 7v10l-4.5-2.8" ${f(G)}/><circle cx="12" cy="12" r="5" ${f(R)}/>`,
  honey: `<path d="M7 8h10l1.5 2.5v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-8z" ${f(O)}/><rect x="7" y="4" width="10" height="4" rx="1" ${f(C)}/><path d="M9 14h6"/>`,
  nut: `<path d="M12 8.5c4.5 0 7 3 6.5 6-.7 3.5-4 5.5-6.5 7-2.5-1.5-5.8-3.5-6.5-7-.5-3 2-6 6.5-6z" ${f(K)}/><path d="M4.5 9.5C5.5 6 8.5 4 12 4s6.5 2 7.5 5.5c-2-1-4.8-1.5-7.5-1.5s-5.5.5-7.5 1.5z" ${f(B)}/>`,
  fruit: `<path d="M12 8C9 6 4.5 7 4.5 12c0 4.5 3 8.5 5.5 8.5.9 0 1.2-.5 2-.5s1.1.5 2 .5c2.5 0 5.5-4 5.5-8.5 0-5-4.5-6-7.5-4z" ${f(R)}/><path d="M12 8c0-2 .5-3.5 2-4.5"/>`,
  lemon: `<ellipse cx="12" cy="12.5" rx="8" ry="6.5" transform="rotate(-25 12 12.5)" ${f(G)}/><path d="M18.8 6.6l1.7-1.6"/>`,
  banana: `<path d="M4.5 6.5C5 12.5 9.5 19 20 18c.8-.1 1-1.2.2-1.5-6-2-10-5.5-12-10.5z" ${f(G)}/><path d="M4.5 6.5L4 4"/>`,
  coconut: `<circle cx="12" cy="12" r="8.5" ${f(B)}/><circle cx="12" cy="12" r="5.5" ${f(C)}/>`,
  strawberry: `<path d="M12 21c-4-2-7.5-6.5-7.5-10 0-2.5 3.5-3.5 7.5-3.5s7.5 1 7.5 3.5c0 3.5-3.5 8-7.5 10z" ${f(R)}/><path d="M7 7.5c2-2.5 3.5-2.5 5-2s3-.5 5 2c-3 1-7 1-10 0z" ${f(L)}/><path d="M12 5.5V3M9 12h.01M15 12h.01M12 14.5h.01M9.5 16.8h.01M14.5 16.8h.01"/>`,
  // Creatures and people.
  bird: `<ellipse cx="10.5" cy="14" rx="7.5" ry="5.5" ${f(C)}/><circle cx="16.5" cy="8.5" r="3.5" ${f(C)}/><path d="M19.8 8l2.5 1-2.5 1z" ${f(O)}/><path d="M7 13c2 2.5 5 2.5 6.5 0"/><circle cx="17" cy="8" r=".6" ${f(I)}/>`,
  cow: `<path d="M7 7C5 7 3.5 6 3 4M17 7c2 0 3.5-1 4-3"/><path d="M7 7h10l1.5 6.5c0 4-2.5 7-6.5 7s-6.5-3-6.5-7z" ${f(C)}/><ellipse cx="12" cy="16.5" rx="4.2" ry="3" ${f(P)}/><circle cx="9.3" cy="11" r=".8" ${f(I)}/><circle cx="14.7" cy="11" r=".8" ${f(I)}/><path d="M10.5 16.5h.01M13.5 16.5h.01"/>`,
  turtle: `<circle cx="20" cy="13.5" r="2" ${f(L)}/><path d="M6.5 16v2.5M15 16v2.5"/><path d="M3.5 16a7.5 7.5 0 0 1 15 0z" ${f(J)}/><path d="M8 12.5l3-3 3 3"/>`,
  arm: `<path d="M7 20c-2-3-2.5-7-1-12 .5-2 2-4.5 4-4.5 1.5 0 3 1 3 2.5s-1.5 2-3 2c-.5 1.5-.5 3-.2 4.5 2-2.5 7-3 9 .5 1.5 3 0 7-4 7z" ${f(P)}/>`,
  thumb: `<path d="M8 11l3.5-7.5c1.8 0 2.8 1.2 2.4 3L13.5 10h5.2a1.8 1.8 0 0 1 1.7 2.3l-1.8 7a1.8 1.8 0 0 1-1.7 1.2H8z" ${f(P)}/><rect x="3.5" y="11" width="4.5" height="9.5" rx="1" ${f(J)}/>`,
  point: `<g transform="rotate(90 12 12)"><path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11l3.6.9a2 2 0 0 1 1.4 2.4L17 19.5h-6.5L7 15.2a1.4 1.4 0 0 1 2-2l1 1z" ${f(P)}/></g>`,
  manager: `<circle cx="12" cy="8" r="4" ${f(P)}/><path d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5z" ${f(S)}/><path d="M12 14l-1.4 1.6 1.4 4.9 1.4-4.9z" ${f(R)}/>`,
  sage: `<path d="M7.5 11v3c0 2 2 3 4.5 3s4.5-1 4.5-3v-3z" ${f(P)}/><path d="M7.5 14c.5 4 2.5 7 4.5 7.5 2-.5 4-3.5 4.5-7.5-1.5 1.5-3 1-4.5 1s-3 .5-4.5-1z" ${f(C)}/><path d="M12 2.5l5.5 8.5h-11z" ${f(J)}/><path d="M4 11h16"/>`,
  speech: `<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5z" ${f(C)}/><path d="M8 11h.01M12 11h.01M16 11h.01"/>`,
  'face-meh': `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M9 15.5h6"/><circle cx="9" cy="10" r=".8" ${f(I)}/><circle cx="15" cy="10" r=".8" ${f(I)}/>`,
  'face-sleepy': `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M7.5 10.5h3M13.5 10.5h3"/><ellipse cx="12" cy="15.5" rx="1.8" ry="1.5" ${f(B)}/>`,
  'face-dizzy': `<circle cx="12" cy="12" r="8.5" ${f(G)}/><path d="M7.7 8.7l2.6 2.6M10.3 8.7l-2.6 2.6M13.7 8.7l2.6 2.6M16.3 8.7l-2.6 2.6M8.5 16c1.2-1.2 2.3-1.2 3.5 0s2.3 1.2 3.5 0"/>`,
};
// Same triangle under the short name the finance UI uses.
ICONS.warn = ICONS.warning;

// Emoji (without U+FE0F) → icon name. 🪙 stays with ui/currency.js; ✓ ★ ☆ → ↗ and friends are typography, not emoji.
const NAMES = {
  settings: '⚙', book: '📖📚', scroll: '📜', help: '❓❔', lock: '🔒', unlock: '🔓', sound: '🔊', pin: '📌🚩📍',
  globe: '🌐🌍', disk: '💾', ticket: '📋📄🧾', refresh: '🔄🔁', bulb: '💡', target: '🎯', timer: '⏱', warning: '⚠', ban: '🚫⛔🙅', tap: '👆',
  hand: ['👋', '🙋‍♂️', '✋', '🖐', '✊', '🧤'], eye: '👀👁', pause: '⏸', forward: '⏭⏩', 'dot-green': '🟢', 'dot-yellow': '🟡',
  'dot-orange': '🟠', 'dot-white': '⚪', star: '⭐🌟', trophy: '🏆🎉', gift: '🎁', lesson: '🎓🧠',
  'face-happy': '😊🙂😍😀😄😂😅', 'face-sad': '😕😖😢😩', 'face-angry': '😤😠', sleep: '💤', sick: '🤒', phone: '📱', screen: '📺🖥',
  skull: '☠', coin: '💵', moneybag: '💰', train: '🚂🛤', crate: '📦', cart: '🛒', shop: '🏪', truck: '🚚', bag: '🎒🛍', basket: '🧺', chair: '🪑💺🛋',
  door: '🚪', 'bell-desk': '🛎', sprout: '🌱', leaf: '🌿', plant: '🪴', flower: '🌸💐🌼🌷🌻', water: '💧🌊', sun: '☀', cloud: '☁',
  fire: '🔥♨', thermo: '🌡', wind: '🌀💨', bean: '🫘', cherry: '🍒', tool: '⛏🪓🔨', wrench: '🔧🛠🧰🔩', scissors: '✂',
  sponge: '🧽', farmer: ['👩‍🌾', '🧑‍🌾', '👨‍🌾', '👷'], robot: '🤖', people: '👥',
  person: ['🧑', '👩', '👧', '👦', '👵', '👴', '🧕', '🧔', '👩‍🦰', '🚶', '🙇'], chef: ['👩‍🍳', '👨‍🍳', '🧑‍🍳'],
  handshake: '🤝🙏', house: '🏡🏠', sign: '🪧', lantern: '🏮', picture: '🖼', wood: '🪵', 'cup-hot': '☕', 'cup-iced': '🧋🥤',
  milk: '🥛🍶', kettle: '🫖', pour: '🫗', ice: '🧊', salt: '🧂', egg: '🥚', can: '🥫', spoon: '🥄', beaker: '🧪', empty: '📭',
  ledger: '📒📓', check: '✅✔', cross: '❌✖', minus: '➖', alert: '❗', play: '▶', stop: '⏹', 'chevron-down': '🔽', updown: '↕', 'dot-brown': '🟤',
  sparkle: '✨💫', burst: '💢💥', bolt: '⚡', heart: '💝', soil: '🟫', grain: '🌾', tree: '🌳', palm: '🌴', hill: '⛰', mountain: '🏔', terrace: '🪜',
  land: '🏞', sunrise: '🌅', moon: '🌙', snow: '❄', hut: '🏚🛖', gate: '⛩', city: '🏙🏢', factory: '🏭', crane: '🏗', saw: '🪚', broom: '🧹', trash: '🗑',
  bucket: '🪣', shower: '🚿', 'no-water': '🚱', key: '🔑🗝', tag: '🏷', voucher: '🎟', briefcase: '💼🧳', gem: '💎', medal: '🎖🏅🥇', crown: '👑',
  shield: '🛡', puzzle: '🧩', map: '🗺', compass: '🧭', scales: '⚖', search: '🔎', note: '📝✍', inbox: '📥', calendar: '🗓', clock: '🕓🕰⏰',
  hourglass: '⏳', chart: '📈📊', spend: '💸', card: '💳', battery: '🔋', 'battery-low': '🪫', plug: '🔌', antenna: '📡', mic: '🎤', camera: '🎥',
  gamepad: '🎮', drone: '🛸', boot: '👢👟🦶', hat: '👒', apron: '🎽', tea: '🍵', beer: '🍺🍻', cocktail: '🍸', plate: '🍽', burger: '🍔', croissant: '🥐',
  flan: '🍮', mooncake: '🥮', icecream: '🍨🍦', chocolate: '🍫', candy: '🍬', honey: '🍯', nut: '🌰', fruit: '🍎', lemon: '🍋', banana: '🍌', coconut: '🥥',
  strawberry: '🍓', bird: '🐔🦆🕊', cow: '🐄', turtle: '🐢', arm: '💪🦾', thumb: '👍', point: '👉', manager: ['👩‍💼', '👨‍💼', '🧑‍💼'], sage: ['🧙‍♂️'],
  speech: '💬🗣', 'face-meh': ['😒', '🙄', '🤦', '🤷', '😮‍💨'], 'face-sleepy': '🥱😴', 'face-dizzy': '😵🥴',
};
const EMOJI = new Map();
for (const [name, list] of Object.entries(NAMES)) for (const e of Array.isArray(list) ? list : [...list.replace(/\uFE0F/g, '')]) EMOJI.set(e.replace(/️/g, ''), name);
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

// Markup string for a named icon, the same <svg><use> that icon() builds; needs installIcons()' sprite in the page. Unknown name → ''.
export const iconSvg = name => Object.hasOwn(ICONS, name) ? `<svg class="ui-icon ui-icon--${name}" aria-hidden="true"><use href="#i-${name}"></use></svg>` : '';

// Icon element for one emoji (unknown → the emoji as text), for places that must keep their text intact right away.
export const iconFor = emoji => nameOf(emoji) ? icon(nameOf(emoji)) : document.createTextNode(emoji);

// Canvas copies with a fixed ink colour (canvas has no currentColor): dark ink for paper, light ink for the dark
// nameplates. Made on first use: decoding all ~200 icons × 2 inks up front held ~400 SVG documents in memory (each SVG
// <img> is a whole page inside the browser) and delayed the game start, while most of them are never drawn on canvas.
const INKS = { dark: '#4a3020', light: '#fff6dc' };
const images = { dark: new Map(), light: new Map() };
const svgUrl = (name, ink = INKS.dark) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG}" width="96" height="96" ${OPEN} stroke="${ink}">${ICONS[name].replaceAll(I, ink)}</svg>`)}`;
export const iconsReady = Promise.resolve(); // kept for callers that wait on it
/** The canvas image for an icon, or null while it is still decoding (the caller draws the text instead this time). */
function canvasIcon(name, tone) {
  if (!name || !ICONS[name] || typeof Image === 'undefined') return null; // typeof guard: node tests have no DOM
  let image = images[tone].get(name);
  if (!image) {
    image = new Image(96, 96);
    image.src = svgUrl(name, INKS[tone]);
    images[tone].set(name, image);
    image.decode().catch(() => {});
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

// fillText with emoji drawn as icons. Centre-aligned at (x, y); `size` = font px, used for icon size; `light` for dark plates.
export function fillRich(ctx, text, x, y, size, maxWidth = Infinity, light = false) {
  // 🪙 stays out of PATTERN (ui/currency.js owns it in the DOM); on canvas it is just the coin icon.
  const parts = String(text).replaceAll('🪙', '💵').split(PATTERN).filter(Boolean).map(part => {
    const image = canvasIcon(nameOf(part), light ? 'light' : 'dark'), plain = TEXT[part] ?? part;
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
