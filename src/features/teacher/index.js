// Teacher phase: scene + speech overlay + sequence (lines → claim credits → World Gate opens).
// createTeacher({ character, name, credits, level, onCredits, onDone }) → { scene, camera, update, resize, start, clearInput, dispose }
//  - onCredits(): called exactly once, when the credits are claimed OR when the player skips (the app dispatches story/teacherDone).
//  - onDone(): called once after the gate opening; the app opens the atlas.
import { createTeacherScene } from './scene.js';
import { createTeacherUi } from './ui.js';
import { t } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';

export async function createTeacher({ character, name, credits = 3, level = 10, onCredits, onDone }) {
  const view = await createTeacherScene({ character });
  let skipped = false, granted = false, finished = false, disposed = false;
  const grant = () => { if (granted) return; granted = true; onCredits?.(); };
  const ui = createTeacherUi({
    onSkip() {
      if (skipped) return;
      skipped = true; ui.cancel(); view.skipGate();
    },
  });
  const lines = [
    ['talk', t('story.teacher.line1', { name })],
    ['talk', t('story.teacher.line2')],
    ['claim', t('story.teacher.line3')],
    ['talk', t('story.teacher.line4', { level })],
    ['talk', t('story.teacher.line5')],
    ['claim', t('story.teacher.line6', { count: credits })],
  ];

  async function start() {
    view.setShot('wide');
    await new Promise(resolve => setTimeout(resolve, 900)); // let the establishing shot breathe
    for (const [shot, line] of lines) {
      if (skipped || disposed) break;
      view.setShot(shot);
      await ui.line(line);
    }
    if (!skipped && !disposed) await ui.claim(credits);
    if (disposed) return;
    grant();
    ui.notice(t('story.teacher.gate'));
    sfx('ui.open');
    const opened = view.openGate();
    if (skipped) view.skipGate();
    await opened;
    if (disposed || finished) return;
    finished = true; ui.hide(); onDone?.();
  }

  return {
    scene: view.scene, camera: view.camera,
    update: (dt, time) => view.update(dt, time),
    resize: (w, h) => view.resize(w, h),
    start,
    clearInput() {},
    dispose() { disposed = true; ui.dispose(); view.dispose(); },
  };
}
