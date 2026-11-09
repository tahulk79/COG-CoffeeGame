// Every static farm asset that can be regenerated with Meshy (docs/design/meshy-pipeline.md).
// file   : the GLB in public/models/gedeo/<file>.glb the game already loads: the new model REPLACES it under the same name.
// fit    : how the new model is scaled to the model it replaces (read from the backup in public/models/gedeo-originals):
//          'height' (trees, props), 'footprint' (buildings: width and depth), 'box' (machines / vehicles: all three).
// tris   : triangle budget after fitting (mobile).  lods: extra files made from the same model by decimation { file, ratio }.
// Left out on purpose (the game needs what Meshy cannot make): rigged people, robots, villagers and animals (skeleton + clips),
// coffee in its growth stages and drying beds (named parts the game switches on and off), terrain, ground pieces,
// terrace and tier walls, fences and gates, stone steps, dirt path / ramp, stream, irrigation channel, gate plaza, mist
// (modular or ground-following pieces cut to the terrain), farm-props (named nodes), tier-sign, drip-line (thin hoses).

export const STYLE = 'polished mobile farming game 3D asset, single object on its own, bright clean colours, soft rounded shapes, tidy simple detail, '
  + 'Ethiopian Gedeo highland coffee farm, warm cheerful palette, very readable silhouette from a high angled camera, no ground plane, no text, no people';
export const NEGATIVE = 'low quality, dark, gritty, photorealistic, floating parts, background, ground, text, watermark, people';

const a = (file, group, fit, tris, prompt, tex, extra = {}) => ({ file, group, fit, tris, prompt, tex: tex || prompt, ...extra });

export const ASSETS = [
  // ---- buildings ----
  a('tukul-farmhouse-lod0', 'buildings', 'footprint', 9000, 'Traditional Ethiopian Gedeo tukul farmhouse: round mud-and-straw walls on a dry stone base, tall conical thatched roof with a deep overhang and a clay finial, wooden door slightly open, wooden veranda posts around the eaves',
    'weathered golden thatch, red-brown mud walls, grey dry stone base, aged dark wood', { lods: [{ file: 'tukul-farmhouse-lod1', ratio: 0.5 }] }),
  a('coffee-warehouse-lod0', 'buildings', 'footprint', 8000, 'Rural coffee warehouse: corrugated rusty tin walls and gabled roof on a timber frame, concrete floor slab, two wide wooden double doors, a few jute coffee sacks on a pallet by the door',
    'rusty galvanised tin, grey timber, pale concrete, brown jute'),
  a('wet-mill', 'buildings', 'footprint', 8000, 'Small coffee wet-mill station: a hand pulper with hopper, drum and crank wheel under a tin roof on timber posts, two concrete fermentation tanks and a washing channel beside it',
    'grey concrete, galvanised tin, dark wood, wet stains'),
  a('compost-house', 'buildings', 'footprint', 6000, 'Open thatched compost shelter on wooden posts with a heap of dark coffee-pulp compost and a wooden fork leaning on it',
    'golden thatch, dark brown compost, weathered wood'),
  a('roastery-shed', 'buildings', 'footprint', 7000, 'Small coffee roasting shed: red brick walls, tin gabled roof, a short chimney, an open front showing a drum roaster and a cooling tray',
    'red brick, dark tin, black iron roaster'),
  a('packing-shed', 'buildings', 'footprint', 7000, 'Open-sided coffee packing shed: tin roof on timber posts, wooden tables with a weighing scale, stitched jute sacks and a stack of empty sacks',
    'galvanised tin, pale timber, brown jute'),
  a('worker-shelter-lod0', 'buildings', 'footprint', 5000, 'Open workers rest shelter: double-layer thatched roof on six round wooden posts, split-log bench seats, a clay water pot in the corner',
    'golden thatch, weathered posts, terracotta pot'),
  a('water-tank-lod0', 'buildings', 'footprint', 5000, 'Corrugated galvanised water tank with a conical lid on a dry stone plinth, a brass tap, and two yellow jerrycans beside it',
    'zinc corrugated metal, grey stone, bright yellow plastic'),
  a('stilt-house', 'buildings', 'footprint', 8000, 'Wooden highland stilt house on timber legs with a ladder, plank walls and a steep thatched roof, a small porch with a bench',
    'dark weathered planks, golden thatch'),
  a('wooden-house', 'buildings', 'footprint', 8000, 'Simple Ethiopian highland wooden house with plank walls, a corrugated tin roof, a small window with wooden shutters and a plank door',
    'grey weathered planks, rusty tin'),
  a('wood-kitchen', 'buildings', 'footprint', 6000, 'Small outdoor wooden kitchen hut with a thatched roof, a clay stove, a hanging coffee pot, firewood stacked beside it and a clay jebena coffee set on a stool',
    'dark wood, golden thatch, black soot, terracotta'),
  a('hill-cistern', 'buildings', 'footprint', 6000, 'Round stone-lined water cistern with a low wall, a wooden cover half open and a small spout channel',
    'grey fieldstone, dark water, weathered planks'),
  a('market-stall', 'buildings', 'footprint', 7000, 'Bamboo market stall with a striped canvas awning, wooden counter, open jute sacks of coffee beans and cherries, a hand scale',
    'faded striped canvas, bamboo, brown jute, green and red beans'),
  a('drying-rack-covered', 'buildings', 'footprint', 6000, 'Raised coffee drying rack with a wooden frame, fine mesh bed, a half-open translucent plastic cover and coffee beans laid out evenly',
    'pale wood, white mesh, clear plastic, tan beans'),
  a('nursery-bed', 'buildings', 'footprint', 6000, 'Coffee seedling nursery bed: raised soil beds with rows of small seedlings in black pots under a shade net on a bamboo frame',
    'dark soil, bamboo, green net, bright green seedlings'),
  // ---- machines, vehicles, tools ----
  a('pulper-machine', 'machines', 'box', 7000, 'Coffee cherry pulping machine: red cast-iron hopper, steel pulping drum, flywheel with V-belt to a small diesel motor on a steel frame',
    'red enamel, bare steel, black rubber belt, oily dark metal'),
  a('power-tiller-cart', 'machines', 'box', 7000, 'Two-wheel walking tractor with a horizontal diesel engine and radiator, long handlebars, and a wooden-sided trailer loaded with coffee sacks',
    'green and red paint, dark steel, brown wood, jute'),
  a('farm-truck', 'machines', 'box', 8000, 'Light cab-over farm truck, about 1.5 tonne, white faded cab, wooden cargo bed with side rails loaded with jute coffee sacks, dual rear wheels',
    'chipped white paint, dark wood, brown jute, black tyres'),
  a('motorbike-sacks', 'machines', 'box', 6000, 'Underbone 110cc motorbike loaded with four large jute coffee sacks tied on a rear rack, spoked wheels',
    'red plastic body, chrome, brown jute, black tyres'),
  a('wheelbarrow', 'machines', 'box', 3000, 'Old steel wheelbarrow with a wooden handle and a single rubber wheel, a few coffee cherries inside',
    'rusty green paint, dark wood, black rubber'),
  a('winnow-tray', 'machines', 'box', 2000, 'Large round woven winnowing tray full of green coffee beans, resting on a low wooden stand',
    'straw weave, pale green beans, dark wood'),
  a('sack-stack', 'machines', 'box', 3000, 'Neat stack of stitched jute coffee sacks on a wooden pallet, three layers high',
    'brown jute, pale stitching, grey pallet'),
  a('coffee-sacks-lod0', 'machines', 'box', 4000, 'Eight jute coffee sacks on a wooden pallet, some standing, some lying, one open showing green beans',
    'brown jute, pale beans, grey wood'),
  a('back-basket', 'machines', 'box', 2000, 'Woven picking basket with leather shoulder straps, half full of ripe red coffee cherries',
    'straw weave, brown leather, red cherries'),
  a('beehive', 'machines', 'box', 3000, 'Traditional Ethiopian log beehive hanging from a rope under a small thatched cover, with a few bees',
    'dark smoked wood, golden thatch, rope'),
  a('stone-pond', 'machines', 'box', 7000, 'Small natural farm pond ringed with fieldstones, clear dark water, reeds and a flat stone to sit on',
    'grey stones, dark green water, green reeds'),
  a('lamp-post', 'machines', 'height', 2500, 'Old wooden lamp post with a metal hurricane lantern hanging from an iron hook, glowing warm',
    'dark wood, black iron, warm yellow glass'),
  a('lantern-string', 'machines', 'box', 3000, 'String of paper lanterns hanging between two wooden poles, warm glowing colours',
    'warm orange and red paper, dark wood, thin rope'),
  a('flag-pole', 'machines', 'height', 2500, 'Tall wooden flag pole with a rope and a green-yellow-red cloth flag blowing gently, on a small stone base',
    'pale wood, soft green yellow red cloth, grey stone'),
  a('farm-gate-sign', 'machines', 'box', 4000, 'Farm entrance gate: two thick log posts with a wooden crossbeam carrying a plain carved wooden signboard, hanging coffee cherries garland, no lettering',
    'weathered logs, pale carved board, red cherries'),
  // ---- nature ----
  a('rock', 'nature', 'height', 1500, 'One mossy weathered boulder, rounded, grey-brown with green moss on top', 'grey granite, green moss'),
  a('rocks', 'nature', 'box', 3000, 'Group of five rocks of different sizes in a cluster, mossy grey stone', 'grey granite, green moss'),
  a('stump', 'nature', 'height', 1500, 'Old cut tree stump with exposed roots, bark and a few mushrooms', 'brown bark, pale cut wood, small mushrooms'),
  a('shrub', 'nature', 'height', 2500, 'Dense wild highland shrub with small dark green leaves', 'dark green leaves, brown twigs'),
  a('grass-clump', 'nature', 'height', 2000, 'Clump of tall highland grass with seed heads, natural uneven blades', 'green and straw-yellow grass'),
  a('daisy-clump', 'nature', 'height', 2500, 'Clump of Meskel daisies with bright yellow petals, green stems and leaves', 'bright yellow flowers, green leaves'),
  a('bamboo-clump', 'nature', 'height', 7000, 'Dense clump of green highland bamboo with tall culms and leaf sprays', 'green and yellow-green bamboo'),
  a('banana', 'nature', 'height', 6000, 'Banana plant with a pseudostem, large torn green leaves and a hanging bunch of green bananas', 'green leaves, pale pseudostem'),
  a('avocado', 'nature', 'height', 9000, 'Mature avocado tree with a rounded dark green crown and a few avocados hanging, sturdy trunk', 'dark green crown, grey-brown bark'),
  a('durian', 'nature', 'height', 9000, 'Tall durian tree with a layered crown of leathery leaves and a few spiky fruits', 'dark green leaves, brown bark, olive fruit'),
  a('pepper-vine', 'nature', 'height', 6000, 'Black pepper vine climbing a wooden post, heart-shaped leaves and hanging green pepper spikes', 'glossy green leaves, grey post'),
  a('albizia-schimperiana-lod0', 'nature', 'height', 12000, 'Mature Albizia schimperiana shade tree: tall straight trunk and a wide flat umbrella crown with fine feathery layered foliage',
    'fresh green feathery foliage, grey-brown bark', { lods: [{ file: 'albizia-schimperiana-lod1', ratio: 0.4 }, { file: 'albizia-schimperiana-lod2', ratio: 0.2 }, { file: 'albizia-schimperiana-lod3', ratio: 0.07 }] }),
  a('cordia-africana-lod0', 'nature', 'height', 12000, 'Mature Cordia africana tree: short thick trunk and a dense rounded crown of large rough leaves with clusters of white flowers',
    'deep green large leaves, white flower clusters, grey bark', { lods: [{ file: 'cordia-africana-lod1', ratio: 0.4 }, { file: 'cordia-africana-lod2', ratio: 0.2 }, { file: 'cordia-africana-lod3', ratio: 0.07 }] }),
  a('ensete-ventricosum-lod0', 'nature', 'height', 7000, 'Ensete ventricosum false banana: swollen pale pseudostem with leaf sheaths, big paddle leaves with red midribs, a ragged old leaf and a skirt of dry leaves',
    'green leaves with red midribs, pale straw pseudostem', { lods: [{ file: 'ensete-ventricosum-lod1', ratio: 0.4 }] }),
  // ---- map pieces (placed by mountain-dressing / the landscape) ----
  a('wooden-bridge', 'map', 'box', 6000, 'Rustic wooden footbridge with a gentle arch, thick log beams, plank deck and simple rope-and-post railings, moss on the posts',
    'weathered dark planks, mossy logs, pale rope'),
  a('drying-yard', 'map', 'box', 5000, 'Flat coffee drying yard: raised clay platform edged with stones, coffee beans spread in neat rows, wooden rakes leaning at one corner',
    'terracotta clay, grey edge stones, tan beans, pale wood'),
  a('harvest-tarp', 'map', 'box', 4000, 'Large blue tarp laid flat on the ground heaped with freshly picked red coffee cherries, a few woven baskets at the edge',
    'faded blue plastic, bright red cherries, straw baskets'),
  a('cliff-face', 'map', 'box', 9000, 'Rugged highland rock cliff face with layered grey-brown stone, small ledges, moss patches and ferns in the cracks, flat back so it can sit against a slope',
    'layered grey brown rock, green moss, ferns'),
  a('grass', 'map', 'height', 2500, 'Wide patch of lush highland grass with small wildflowers, natural uneven blades', 'green grass, tiny white and yellow flowers'),
];

export const CREDITS = { preview: 20, refine: 10 }; // an ASSUMPTION for the cost estimate: confirm on Meshy's pricing page
export const byGroup = g => ASSETS.filter(x => x.group === g);
