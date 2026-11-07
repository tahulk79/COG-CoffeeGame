// Teacher phase: scene + speech overlay + sequence (lines → World Gate opens).
// createTeacher({ character, name, level, onTalked, onDone }) → { scene, camera, update, resize, start, clearInput, dispose }
//  - onTalked(): called exactly once, after the last line OR when the player skips (the app dispatches story/teacherDone).
//  - onDone(): called once after the gate opening; the app opens the atlas.
import { createTeacherScene } from './scene.js';
import { createTeacherUi } from './ui.js';
import { t } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';

export async function createTeacher({ character, name, level = 10, onTalked, onDone }) {
  const view = await createTeacherScene({ character });
  let skipped = false, talked = false, finished = false, disposed = false;
  const doneTalking = () => { if (talked) return; talked = true; onTalked?.(); };
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
    ['claim', t('story.teacher.line5')],
  ];

  async function start() {
    view.setShot('wide');
    await new Promise(resolve => setTimeout(resolve, 900)); // let the establishing shot breathe
    for (const [shot, line] of lines) {
      if (skipped || disposed) break;
      view.setShot(shot);
      await ui.line(line);
    }
    if (disposed) return;
    doneTalking();
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
