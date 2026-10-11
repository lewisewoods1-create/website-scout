import * as THREE from 'three';
import { LAYER_SMOKE } from './renderer';
import { flameTex, smokeTex } from './textures';

/**
 * Burning wrecks and oil drums: full-res flickering flame sprites, a rising smoke
 * column and (for the first few) a flickering point light. Purely visual.
 */
export function fireFx(root: THREE.Group, fires: THREE.Vector4[]) {
  const flame = flameTex();
  const smoke = smokeTex();
  const items = fires.map((f, i) => {
    const s = f.w;
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
    root.add(g);
    const flames = [0, 1, 2, 3].map((k) => {
      const m = new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
      const sp = new THREE.Sprite(m);
      sp.layers.set(LAYER_SMOKE);
      sp.center.set(0.5, 0.08);
      sp.position.set(Math.cos(k * 2.4) * 0.35 * s, 0, Math.sin(k * 2.4) * 0.3 * s);
      g.add(sp);
      return sp;
    });
    const puffs = Array.from({ length: 9 }, (_, k) => {
      const m = new THREE.SpriteMaterial({ map: smoke, color: 0x2c2826, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.layers.set(LAYER_SMOKE);
      g.add(sp);
      return { sp, life: k / 9, rot: Math.random() * 6 };
    });
    let light: THREE.PointLight | null = null;
    if (i < 5) {
      light = new THREE.PointLight(0xff7a2a, 22 * s, 16 * s, 1.7);
      light.position.set(f.x, f.y + 1.2 * s, f.z);
      light.layers.enableAll();
      root.add(light);
    }
    return { flames, puffs, light, s, seed: i * 1.93 };
  });
  return (dt: number, t: number) => {
    for (const it of items) {
      const { s, seed } = it;
      it.flames.forEach((sp, k) => {
        const a = Math.sin(t * 11 + seed + k * 1.7) * 0.5 + Math.sin(t * 23 + k * 3.1) * 0.25;
        sp.scale.set(0.9 * s * (1 + a * 0.18), 1.7 * s * (1 + a * 0.3) * (k === 0 ? 1.25 : 0.85), 1);
        (sp.material as THREE.SpriteMaterial).opacity = 0.75 + a * 0.2;
        (sp.material as THREE.SpriteMaterial).rotation = Math.sin(t * 3 + k) * 0.08;
      });
      for (const p of it.puffs) {
        p.life += dt / 5.5;
        if (p.life > 1) p.life -= 1;
        const l = p.life;
        p.sp.position.set(l * l * 4 * s, (1.3 + l * 9) * s, Math.sin(l * 4 + seed) * 0.6 * s);
        p.sp.scale.setScalar((1.2 + l * 4.5) * s);
        const m = p.sp.material as THREE.SpriteMaterial;
        m.opacity = Math.sin(Math.PI * Math.min(1, l * 1.4)) * 0.75 * (1 - l * 0.5);
        m.rotation = p.rot + l * 0.8;
      }
      if (it.light) it.light.intensity = 22 * s * (0.75 + Math.sin(t * 17 + seed) * 0.15 + Math.sin(t * 29 + seed * 2) * 0.1);
    }
  };
}
