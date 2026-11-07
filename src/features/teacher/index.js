// Scene 2 (heaven): the Deity asks the hero's greatest dream, the hero answers, the Deity gives the God Bean; the hero
// sniffs it and it dissolves into their mind. The app then shows the God Bean splash and opens the world map.
// createTeacher({ character, name, onTalked, onDone }) → { scene, camera, update, resize, start, clearInput, dispose }
//  - onTalked(): called exactly once, after the last line OR when the player skips (the app dispatches story/teacherDone).
//  - onDone({ skipped }): called once after the bean has dissolved (or right away on skip); the app shows the splash.
import { createTeacherScene } from './scene.js';
import { createTeacherUi } from './ui.js';
import { t } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';

export async function createTeacher({ character, name, onTalked, onDone }) {
  const view = await createTeacherScene({ character });
  let skipped = false, talked = false, finished = false, disposed = false;
  const doneTalking = () => { if (talked) return; talked = true; onTalked?.(); };
  const finish = () => {
    if (disposed || finished) return;
    finished = true; ui.hide(); ui.hideSkip(); onDone?.({ skipped });
  };
  const ui = createTeacherUi({
    heroName: name,
    onSkip() {
      if (skipped) return;
      skipped = true; ui.cancel(); view.finish(); doneTalking(); finish();
    },
  });
  // [camera shot, speaker, text, bean step played before the line]
  const lines = [
    ['talk', 'god', t('story.teacher.line1', { name })],
    ['claim', 'god', t('story.teacher.line2')],
    ['hero', 'hero', t('story.teacher.answer')],
    ['claim', 'god', t('story.teacher.line3'), 'show'],
    ['talk', 'god', t('story.teacher.line4'), 'give'],
  ];
  const stop = () => skipped || disposed;

  async function start() {
    view.setShot('wide');
    await new Promise(resolve => setTimeout(resolve, 900)); // let the establishing shot breathe
    for (const [shot, who, line, bean] of lines) {
      if (stop()) return;
      view.setShot(shot);
      if (bean === 'show') { sfx('ui.open'); view.showBean(); }
      if (bean === 'give') view.giveBean();
      await ui.line(line, who);
    }
    if (stop()) return;
    doneTalking();
    ui.hide(); ui.hideSkip();
    await view.sniff();
    if (stop()) return;
    sfx('ui.open');
    await view.dissolve();
    finish();
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
