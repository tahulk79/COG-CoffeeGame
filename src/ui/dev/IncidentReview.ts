import type { HazardKind } from '../../gameplay/story/RunService';
import type { WorldScene } from '../../scenes/WorldScene';

export const INCIDENT_CASES: Array<{ kind: HazardKind; label: string; branches: string[] }> = [
  { kind: 'cat', label: 'Mèo', branches: ['base'] },
  { kind: 'dog', label: 'Chó nhỏ → chó lớn', branches: ['base'] },
  { kind: 'sinkhole', label: 'Ổ voi / nắp cống', branches: ['base', 'twist'] },
  { kind: 'durian', label: 'Sầu riêng', branches: ['base', 'smell'] },
  { kind: 'motorbike', label: 'Xe chở hàng → gà', branches: ['base'] },
  { kind: 'pigeons', label: 'Bồ câu', branches: ['base', 'bread'] },
  { kind: 'banana', label: 'Vỏ chuối', branches: ['base', 'twist'] },
  { kind: 'water', label: 'Chậu nước', branches: ['base'] },
  { kind: 'laundry', label: 'Dây phơi / quần đùi', branches: ['base'] },
  { kind: 'shuttlecock', label: 'Đá cầu', branches: ['base'] },
  { kind: 'slipper', label: 'Dép tổ ong', branches: ['base', 'return'] },
  { kind: 'chickens', label: 'Gà sổng chuồng', branches: ['base'] },
];
const BRANCH_LABEL: Record<string, string> = { base: 'Cảnh chính', twist: 'Bẫy thứ hai', smell: 'Rơi cạnh / mùi', bread: 'Có bánh mì', return: 'Lượt dép quay lại' };

export function readIncidentReview(): { kind: HazardKind; branch: string } | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search);
  const item = INCIDENT_CASES.find(c => c.kind === q.get('incidentReview'));
  if (!item) return null;
  const branch = q.get('branch') ?? 'base';
  return { kind: item.kind, branch: item.branches.includes(branch) ? branch : 'base' };
}

/** Review controls never ship to the normal HUD; selecting a case reloads a throwaway session. */
export function installIncidentReview(scene: WorldScene): void {
  const review = readIncidentReview();
  if (!review || !scene.sim.run) return;
  scene.sim.run?.reviewHazard(review.kind, review.branch);
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Duyệt 12 sự cố');
  panel.style.cssText = 'box-sizing:border-box;position:fixed;left:8px;top:72px;z-index:10000;max-width:calc(100vw - 16px);padding:8px;background:#fff4e0f2;color:#543c2b;border:2px solid #76563c;border-radius:8px;font:13px sans-serif';
  const title = document.createElement('div');
  title.textContent = 'DEV · 12 sự cố · không ghi save thật';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Tình huống cần duyệt');
  for (const item of INCIDENT_CASES) for (const branch of item.branches) {
    const option = document.createElement('option');
    option.value = `${item.kind}:${branch}`;
    option.textContent = `${item.label} — ${BRANCH_LABEL[branch]}`;
    option.selected = item.kind === review.kind && branch === review.branch;
    select.append(option);
  }
  select.style.cssText = 'display:block;max-width:100%;margin:6px 0;font:inherit';
  const load = () => {
    const [kind, branch] = select.value.split(':');
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('incidentReview', kind!);
    url.searchParams.set('branch', branch!);
    window.location.assign(url);
  };
  select.addEventListener('change', load);
  const again = document.createElement('button');
  again.textContent = 'Chơi lại tình huống'; again.onclick = load;
  const next = document.createElement('button');
  next.textContent = 'Tình huống kế';
  next.onclick = () => { select.selectedIndex = (select.selectedIndex + 1) % select.options.length; load(); };
  const play = document.createElement('button');
  play.textContent = 'Bắt đầu / tiếp tục';
  play.onclick = () => { if (scene.sim.run) scene.sim.run.paused = false; };
  const status = document.createElement('div');
  const refresh = () => {
    panel.hidden = !!(scene.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen;
    const run = scene.sim.run?.view();
    status.textContent = !run ? `Đã chuyển: ${scene.sim.story.chapterId}` : run.down ? 'Nằm chờ / cứu hộ' : run.hit ? `Trúng: ${run.hit.kind}` : [run.paused ? 'Đang chờ bắt đầu' : 'Đang chơi', run.hazards.map(h => `${h.kind}:${h.phase}`).join(', '), run.dazed].filter(Boolean).join(' · ');
  };
  panel.append(title, select, play, again, next, status);
  for (const type of ['pointerdown', 'pointerup', 'keydown']) panel.addEventListener(type, event => event.stopPropagation());
  document.body.append(panel);
  refresh();
  const timer = scene.time.addEvent({ delay: 200, loop: true, callback: refresh });
  scene.events.once('shutdown', () => { timer.remove(); panel.remove(); });
}
