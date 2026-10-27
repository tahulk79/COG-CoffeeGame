import { t } from '../../core/i18n';
import type { EmployeeConfig } from '../../gameplay/employees/EmployeeService';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { MapData } from '../../gameplay/world/types';
import { PagedListModal, type RowData } from '../components/PagedListModal';

export interface EmployeeUiCommands {
  hire(role: string): { ok: true } | { ok: false; reason: string };
  fire(id: string): { ok: true } | { ok: false; reason: string };
}

/**
 * Staff: your team (portrait, name, role, status, workplace, wage, skills) and the
 * roles you can hire here (price, wage, requirement). Hire/dismiss are the real
 * EmployeeService commands, which refuse duplicates (team full) and missing coins.
 * The game has no employee levels or upgrades, so none are shown.
 */
export class EmployeeModal extends PagedListModal {
  private message = '';

  constructor(
    scene: Phaser.Scene,
    private readonly commands: EmployeeUiCommands,
    private readonly config: EmployeeConfig,
    private readonly maps: Record<string, MapData>,
    onClosed?: () => void,
  ) {
    super(scene, t('staff.title'), 'staff', 560, 440, onClosed);
  }

  private report(r: { ok: true } | { ok: false; reason: string }, ok: string): void {
    this.message = r.ok ? ok : t(`staff.fail.${r.reason}`);
  }

  protected rowsFor(s: SimulationSnapshot): RowData[] {
    const rows: RowData[] = [];
    for (const e of s.employees.hired) {
      const role = this.config.roles[e.role]!;
      const stats = [t('staff.speed', { n: role.speedTilesPerSec.toFixed(1) }), role.skill !== undefined ? t('staff.skill', { n: Math.round(role.skill * 100) }) : ''].filter(Boolean).join(' · ');
      rows.push({
        key: `h|${e.id}|${e.status}|${e.task ?? ''}`,
        icon: 'customer',
        title: `${e.name} · ${e.label}`,
        lines: [t('staff.workplace', { map: this.maps[role.map]?.name ?? role.map }), `${stats} · ${t('staff.wage', { n: role.wage })}`, role.duty ?? ''],
        status: t(`staff.status.${e.status}`),
        statusTone: e.status === 'unpaid' ? 'bad' : e.status === 'working' ? 'ok' : 'warn',
        action: { name: `employee.fire.${e.id}`, label: t('staff.fire'), enabled: true, onClick: () => this.report(this.commands.fire(e.id), t('staff.fired')) },
      });
    }
    for (const r of s.employees.roles) {
      const role = this.config.roles[r.role]!;
      const reason = r.count >= r.max ? t('staff.fail.teamFull') : s.progression.level < r.unlockLevel ? t('staff.fail.levelTooLow') + ` (${r.unlockLevel})` : s.economy.coins < r.cost ? t('staff.fail.insufficientCoins') : '';
      rows.push({
        key: `r|${r.role}|${r.count}|${reason}`,
        icon: 'people',
        title: `${r.label}  ${r.count}/${r.max}`,
        lines: [`${t('staff.hireCost', { n: r.cost })} · ${t('staff.wage', { n: r.wage })}`, role.duty ?? '', t('staff.workplace', { map: this.maps[role.map]?.name ?? role.map })],
        status: reason || t('staff.canHire'),
        statusTone: reason ? 'warn' : 'ok',
        dim: !!reason,
        action: { name: `employee.hire.${r.role}`, label: t('staff.hireShort'), enabled: !reason, onClick: () => this.report(this.commands.hire(r.role), t('staff.hired')) },
      });
    }
    return rows;
  }

  protected override footer(): string {
    return this.message;
  }
}
