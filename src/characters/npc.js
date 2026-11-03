import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadPlayer } from './load-player.js';
import { createPlayerMotion } from './motion.js';

const cache = new Map();
const right = new THREE.Vector3(), local = new THREE.Vector3(), turn = new THREE.Quaternion();

// Thay khối tạm của createPerson bằng rig GLB khi tải xong. Code cũ vẫn xoay userData.legs;
// ở đây chỉ đọc lại để chọn đi/đứng, nên luật chơi và đường đi không đổi. Lỗi tải giữ khối tạm.
export function dressPerson(person, file) {
  if (!cache.has(file)) cache.set(file, loadPlayer(file).catch(error => { console.warn(`Không tải được ${file}, giữ khối tạm.`, error); return null; }));
  const blocks = [...person.children]; // chỉ ẩn khối của createPerson; đồ gắn thêm sau (dụng cụ, ly) vẫn hiện
  cache.get(file).then(source => {
    if (!source || person.userData.dressed) return;
    const model = clone(source); model.animations = source.animations;
    const motion = createPlayerMotion(model);
    for (const child of blocks) child.visible = false;
    person.add(model); person.userData.dressed = true;
    let skin = null; model.traverse(object => { skin ??= object.isSkinnedMesh ? object : null; });
    // Ngồi: gập hông/gối theo cùng chiều trục với tư thế ngã trong motion.js.
    const sitBones = [];
    // Lưu tư thế gốc của từng xương chân: mixer.update(0) không ghi đè lại xương mỗi frame, gập thẳng lên sẽ cộng dồn (xoay vòng).
    model.traverse(bone => { const bend = /(Left|Right)UpLeg$/.test(bone.name) ? -1.45 : /(Left|Right)Leg$/.test(bone.name) ? 1.45 : 0; const rest = motion.restPose.find(pose => pose.name === bone.name); if (bone.isBone && bend && rest) sitBones.push([bone, bend, new THREE.Quaternion().fromArray(rest.quaternion)]); });
    let time = 0, last = performance.now(), lastStride = 0;
    // Chỉ cập nhật khi được vẽ: NPC ngoài màn hình không tốn công animation.
    skin.onBeforeRender = () => {
      const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
      // Code cũ để nguyên góc chân bước cuối khi tới nơi làm việc; chỉ coi là đi khi góc chân còn đổi.
      const stride = person.userData.legs[0].rotation.x, walking = Math.abs(stride - lastStride) > 1e-4; lastStride = stride;
      if (walking) time += dt;
      motion.update(walking ? 'walk' : 'rest', time);
      const seated = !walking && person.userData.seated;
      if (seated) {
        // Gập quanh trục ngang của nhân vật (không phải trục cục bộ của xương, vốn lệch theo rig).
        const side = right.set(1, 0, 0).applyQuaternion(model.getWorldQuaternion(turn));
        for (const [bone, bend, rest] of sitBones) {
          bone.quaternion.copy(rest);
          const axis = local.copy(side).applyQuaternion(bone.parent.getWorldQuaternion(turn).invert());
          bone.quaternion.premultiply(turn.setFromAxisAngle(axis, bend));
        }
      }
      else if (model.position.y) for (const [bone, , rest] of sitBones) bone.quaternion.copy(rest); // vừa đứng dậy
      model.position.y = seated ? -.3 : 0;
    };
  });
}
