import * as THREE from 'three';
import { asset } from './assets';

/**
 * Weapon camos from the Dead Pixels camo overlay pack (public/game/camos/).
 * Applied with a tri-planar shader so the pattern keeps one scale across every part
 * of a gun regardless of each mesh's UVs. Prism and Dead Signal animate from a padded
 * 6x4 flipbook (24 frames, 12 fps) built from the pack's frames.
 */
export type CamoId = 'none' | 'grunt_grid' | 'rubble' | 'sand_tiger' | 'frostbite' | 'red_static' | 'gold' | 'prism' | 'dead_signal';

interface CamoLook {
  metal: number;
  rough: number;
  /** keep pixel cells crisp */
  nearest?: boolean;
  animated?: boolean;
  /** metres per tile repeat */
  tile: number;
}

const LOOKS: Record<Exclude<CamoId, 'none'>, CamoLook> = {
  grunt_grid: { metal: 0.15, rough: 0.7, nearest: true, tile: 0.14 },
  rubble: { metal: 0.25, rough: 0.6, tile: 0.16 },
  sand_tiger: { metal: 0.15, rough: 0.65, tile: 0.16 },
  frostbite: { metal: 0.3, rough: 0.45, tile: 0.16 },
  red_static: { metal: 0.3, rough: 0.5, nearest: true, tile: 0.14 },
  gold: { metal: 1, rough: 0.28, tile: 0.14 },
  prism: { metal: 0.55, rough: 0.25, animated: true, tile: 0.15 },
  dead_signal: { metal: 0.35, rough: 0.35, animated: true, tile: 0.15 },
};

/** Swatch for menus: the tile itself. */
export const camoSwatch = (id: CamoId) => (id === 'none' ? '#1d1f21' : `url(${asset(`camos/${id}_tile.png`)}) center / 220%`);

// flipbook layout written by the asset build: 6x4 cells of 128px content + 4px wrap border
const FLIP = { cols: 6, rows: 4, cell: 136, gutter: 4, content: 128 };
const camoFrame = { value: 0 };
let clockRunning = false;
function startClock() {
  if (clockRunning) return;
  clockRunning = true;
  const tick = (t: number) => {
    camoFrame.value = Math.floor((t / 1000) * 12) % 24;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Camo paint for a gun's painted surfaces, shaded like the base finish it replaces. */
export function camoMaterial(id: CamoId, base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  if (id === 'none') return base;
  const key = `${id}:${base.uuid}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const look = LOOKS[id];
  const tex = loader.load(asset(`camos/${id}_${look.animated ? 'flip' : 'tile'}.png`));
  tex.colorSpace = THREE.SRGBColorSpace;
  if (look.animated) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    startClock();
  } else {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
  }
  if (look.nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: look.metal, roughness: look.rough, roughnessMap: base.roughnessMap });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tCamo = { value: tex };
    shader.uniforms.uCamoScale = { value: 1 / look.tile };
    shader.uniforms.uCamoFrame = camoFrame;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCamoP;\nvarying vec3 vCamoN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamoP = position;\nvCamoN = normal;');
    const sample = look.animated
      ? `vec4 camoTex(vec2 uv) {
          float cx = mod(uCamoFrame, ${FLIP.cols}.0);
          float cy = floor(uCamoFrame / ${FLIP.cols}.0);
          vec2 inside = fract(uv);
          vec2 px = vec2(cx, cy) * ${FLIP.cell}.0 + ${FLIP.gutter}.0 + inside * ${FLIP.content}.0;
          return texture2D(tCamo, px / vec2(${FLIP.cols * FLIP.cell}.0, ${FLIP.rows * FLIP.cell}.0));
        }`
      : 'vec4 camoTex(vec2 uv) { return texture2D(tCamo, uv); }';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D tCamo;\nuniform float uCamoScale;\nuniform float uCamoFrame;\nvarying vec3 vCamoP;\nvarying vec3 vCamoN;\n${sample}`)
      .replace(
        '#include <map_fragment>',
        `{
          vec3 w = pow(abs(normalize(vCamoN)), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vCamoP * uCamoScale;
          vec4 c = camoTex(p.zy) * w.x + camoTex(p.xz) * w.y + camoTex(p.xy) * w.z;
          diffuseColor.rgb *= c.rgb;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `camo-${look.animated ? 'anim' : 'static'}`;
  cache.set(key, mat);
  return mat;
}
