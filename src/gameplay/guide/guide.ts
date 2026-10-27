import type { SimulationSnapshot } from '../GameSimulation';

export interface GuideStep {
  title: string;
  text: string;
}

const TUTORIAL = ['q_harvest', 'q_serve5', 'q_sell'];
const STATION: Record<string, string> = { grinder: 'máy xay', cafe_espresso: 'máy espresso' };
const has = (s: SimulationSnapshot, prefix: string): boolean => Object.entries(s.economy.inventory).some(([id, st]) => id.startsWith(prefix) && st.qty > 0);

/** Live instruction for the story's espresso lesson: always says what to do next. */
export function masterStep(s: SimulationSnapshot): string | null {
  const cafe = s.cafe;
  if (s.story.chapter !== 'S05' || !cafe) return null;
  const master = cafe.customers.find((c) => c.archetype === 'master');
  if (!master) return 'Bậc thầy đang bước ra quầy, chờ chút…';
  if (cafe.heldDrink) return 'Ly espresso đã xong. Mang ra cho bậc thầy!';
  const step = cafe.brew?.current;
  if (step) {
    const at = STATION[step.station] ?? step.station;
    if (step.kind === 'choose_bean') return `Chọn hạt cà phê rang tại ${at}`;
    return `Bước ${(cafe.brew?.stepIndex ?? 0) + 1}/${cafe.brew?.steps.length}: bấm đúng lúc kim vào vùng xanh tại ${at}`;
  }
  if (master.orderStatus === 'CREATED') return 'Ra quầy, bấm vào bậc thầy (bong bóng "Espresso?") để nhận order';
  if (master.orderStatus === 'ACCEPTED' || master.orderStatus === 'PREPARING') return 'Đến máy xay (cạnh quầy) để bắt đầu pha espresso';
  return 'Bậc thầy đang đi tới quầy…';
}

/** What to do with the farm right now, from the plots and the inventory. */
function farmStep(s: SimulationSnapshot, goal: 'harvest' | 'sell'): string {
  const plots = s.farm.plots.filter((p) => !p.locked);
  if (goal === 'sell') {
    if (has(s, 'roasted_')) return 'Bán hạt rang ở sạp chợ (bấm vào sạp để bán)';
    if (has(s, 'green_')) return 'Rang hạt nhân xanh ở máy rang';
    if (has(s, 'cherry_')) return 'Phơi quả cà phê ở giàn phơi';
  }
  if (plots.some((p) => p.phase === 'READY')) return 'Thu hoạch ô cà phê đã chín (bấm vào ô đất)';
  if (plots.some((p) => p.needsWater)) return s.farm.can.water > 0 ? 'Tưới nước cho cây (bấm vào ô đất đang khát)' : 'Bình tưới hết nước: ra giếng lấy nước';
  if (plots.some((p) => p.phase === 'PREPARED')) return s.farm.seedToPlant ? 'Gieo hạt: bấm vào ô đất đã cuốc' : 'Chọn hạt giống ở bảng Nông trại (hoặc mua ở sạp hạt giống)';
  if (plots.some((p) => p.phase === 'PLANTED' || p.phase === 'GROWING')) return 'Cây đang lớn. Chờ đến khi chín, hoặc làm việc khác';
  return 'Cuốc đất: bấm vào ô đất trống';
}

/** What to do at the café: take, brew, serve. */
function cafeStep(s: SimulationSnapshot): string {
  const cafe = s.cafe!;
  if (!has(s, 'roasted_')) return 'Cần hạt rang để pha: ra nông trại thu hoạch → phơi → rang';
  if (cafe.heldDrink) return 'Mang ly vừa pha ra cho khách';
  const step = cafe.brew?.current;
  if (step) return `Đang pha: làm theo bảng ở góc phải (${STATION[step.station] ?? step.station})`;
  if (cafe.customers.some((c) => c.orderStatus === 'CREATED')) return 'Bấm vào khách đang chờ ở quầy để nhận order';
  if (cafe.orders.some((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING')) return 'Đến máy xay để pha đơn đã nhận';
  return 'Chờ khách bước vào quán…';
}

/**
 * After the story: the next small thing to do, from the first unfinished tutorial quest.
 * Ends once the first three missions are claimed; the quest card carries on from there.
 */
export function nextGuide(s: SimulationSnapshot): GuideStep | null {
  if (s.story.chapter !== 'done') return null;
  const onCafe = !!s.cafe;
  const onFarm = s.farm.plots.length > 0;
  if (!onCafe && !onFarm) return null;
  // Same pick as the quest card on the left, so the two never disagree.
  const counters = new Set(onCafe ? ['served', 'fiveStar', 'placed', 'hired', 'brewed', 'level'] : ['harvest', 'sold', 'hired', 'level']);
  const quest = s.meta.quests.filter((q) => TUTORIAL.includes(q.id) && !q.claimed && !q.locked && counters.has(q.counter)).sort((x, y) => Number(y.done) - Number(x.done))[0];
  if (!quest) return null;
  const title = `${quest.label} (${Math.min(quest.progress, quest.target)}/${quest.target})`;
  if (quest.done) return { title, text: 'Hoàn thành! Bấm Nhận ở thẻ Nhiệm vụ để lấy thưởng' };
  if (quest.id === 'q_serve5') return { title, text: cafeStep(s) };
  return { title, text: farmStep(s, quest.id === 'q_sell' ? 'sell' : 'harvest') };
}
