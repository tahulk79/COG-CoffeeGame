import type Phaser from 'phaser';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { PagedListModal, type RowData } from '../components/PagedListModal';

export class TableUpgradeModal extends PagedListModal {
  private message = 'Mỗi cấp thêm 2 thoải mái và 1 trang trí, giúp khách kiên nhẫn và tăng sức hút.';
  constructor(scene: Phaser.Scene, private readonly upgrade: (id: string) => { ok: true } | { ok: false; reason: string }) {
    super(scene, 'Nâng cấp bàn', 'tables', 560, 440);
  }
  protected rowsFor(s: SimulationSnapshot): RowData[] {
    return s.tables.map((t) => ({
      key: `${t.id}|${t.level}|${t.canBuy}`,
      icon: 'chair', title: `${t.label} · Cấp ${t.level}/${t.max}`,
      lines: [`+${t.comfort} thoải mái · +${t.decor} trang trí`, t.cost === null ? 'Đã nâng tối đa' : 'Nâng cấp: +2 thoải mái, +1 trang trí'],
      status: t.reason === 'levelTooLow' ? 'Cần tăng cấp' : t.reason === 'insufficientCoins' ? 'Thiếu xu' : '',
      statusTone: 'warn',
      ...(t.cost === null ? {} : { action: { name: `table.upgrade.${t.id}`, label: `${t.cost} xu`, enabled: t.canBuy, onClick: () => {
        const r = this.upgrade(t.id);
        this.message = r.ok ? 'Đã nâng bàn. Cấp bàn được giữ khi di chuyển và lưu game.' : `Chưa thể nâng bàn: ${r.reason}`;
      } } }),
    }));
  }
  protected override footer(): string { return this.message; }
}
