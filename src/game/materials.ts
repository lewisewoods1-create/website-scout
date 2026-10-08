import * as THREE from 'three';
import * as T from './textures';

/** High-detail PBR materials shared by the viewmodel and the soldiers. Built once. */
export function createMaterials() {
  const scratches = T.scratchRoughness(41);
  const scratchesLight = T.scratchRoughness(42, 200);
  const stipple = T.stippleNormal(43);
  const camo = T.camoFabric(['#6f6a52', '#4d4a35', '#8a7a58', '#2f2d22', '#a39271'], 51);
  const camoAlt = T.camoFabric(['#55594a', '#3b3f33', '#6d6a55', '#24261f'], 52);
  const coyote = T.corduraTex('#7b6a4f', 61);
  const ranger = T.corduraTex('#4a4d3c', 62);
  const black = T.corduraTex('#202020', 63);
  const blackGear = T.corduraTex('#262626', 64);
  const camoUrban = T.camoFabric(['#7c8086', '#5a5e63', '#a0a4a8', '#3a3d41'], 53);
  const camoNight = T.camoFabric(['#2a2c2f', '#1c1d1f', '#3a3c40', '#121314'], 54);

  // cloth: sheen gives the soft fibre highlight real fabric has at grazing angles
  const fabric = (src: { map: THREE.Texture; normal: THREE.Texture }, rough = 0.92): THREE.MeshStandardMaterial =>
    new THREE.MeshPhysicalMaterial({
      map: src.map,
      normalMap: src.normal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: rough,
      metalness: 0,
      sheen: 0.7,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0x9a9282),
    });

  // viewmodel sleeves sit ~30cm from the camera, so tighten the pattern
  const camoClose = { map: camo.map.clone(), normal: camo.normal.clone() };
  camoClose.map.repeat.set(2.5, 2.5);
  camoClose.normal.repeat.set(10, 10);

  return {
    // gun
    anodized: new THREE.MeshPhysicalMaterial({ color: 0x1c1e20, metalness: 0.65, roughness: 0.45, roughnessMap: scratches, clearcoat: 0.25, clearcoatRoughness: 0.35 }) as THREE.MeshStandardMaterial,
    anodizedEdge: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, metalness: 0.8, roughness: 0.3, roughnessMap: scratchesLight }),
    polymer: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0, roughness: 0.72, normalMap: stipple, normalScale: new THREE.Vector2(0.4, 0.4) }),
    fde: new THREE.MeshStandardMaterial({ color: 0x8a7656, metalness: 0.05, roughness: 0.62, normalMap: stipple, normalScale: new THREE.Vector2(0.3, 0.3) }),
    fdeSmooth: new THREE.MeshStandardMaterial({ color: 0x86734f, metalness: 0.1, roughness: 0.5, roughnessMap: scratchesLight }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3b3d40, metalness: 0.95, roughness: 0.28, roughnessMap: scratchesLight }),
    parkerized: new THREE.MeshStandardMaterial({ color: 0x2b2d2b, metalness: 0.7, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0, roughness: 0.95 }),
    hole: new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.25 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb06a3a, metalness: 1, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fc4e0, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.07, depthWrite: false }),
    wood: new THREE.MeshStandardMaterial({ map: T.woodTex(), roughness: 0.45, metalness: 0, roughnessMap: scratchesLight }),
    bakelite: new THREE.MeshStandardMaterial({ color: 0x5a2418, roughness: 0.35, metalness: 0.05, roughnessMap: scratchesLight }),
    lens: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 }),
    laserRed: new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2, roughness: 0.2 }),
    // soldier
    camo: fabric(camo),
    camoClose: fabric(camoClose),
    camoAlt: fabric(camoAlt),
    camoUrban: fabric(camoUrban),
    camoNight: fabric(camoNight),
    gearBlack: fabric(blackGear, 0.82),
    coyote: fabric(coyote, 0.85),
    ranger: fabric(ranger, 0.85),
    webbing: fabric(black, 0.8),
    skin: new THREE.MeshStandardMaterial({ map: T.skinTex(), roughness: 0.6, metalness: 0 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x2b2a26, map: black.map, normalMap: black.normal, roughness: 0.75, metalness: 0 }),
    gloveKnuckle: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55, metalness: 0 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x6b5a42, map: coyote.map, normalMap: coyote.normal, roughness: 0.8 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.95 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0x5b5743, roughness: 0.75, metalness: 0.05, normalMap: stipple, normalScale: new THREE.Vector2(0.25, 0.25) }),
    visor: new THREE.MeshStandardMaterial({ color: 0x101418, metalness: 1, roughness: 0.05 }),
    nvgGlass: new THREE.MeshStandardMaterial({ color: 0x1a3a22, emissive: 0x0b3a12, emissiveIntensity: 0.5, metalness: 1, roughness: 0.05 }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;

export const rimUniforms = {
  rimColor: { value: new THREE.Color(0xffd9b0) },
  rimStrength: { value: 0.55 },
};

/**
 * Fresnel rim light so full-detail soldiers pop off the dithered low-res world.
 * Applied to soldier-only materials (gun materials are shared with the viewmodel).
 */
export function addRim(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = rimUniforms.rimColor;
    shader.uniforms.rimStrength = rimUniforms.rimStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += rimColor * pow(rimF, 2.5) * rimStrength;`,
      );
  };
  mat.customProgramCacheKey = () => 'rim';
}

/** Character-only copies of materials the viewmodel also uses, with rim light. */
export function soldierMaterials(m: Materials): Materials {
  const c = { ...m };
  for (const k of ['camo', 'camoAlt', 'camoUrban', 'camoNight', 'gearBlack', 'coyote', 'ranger', 'webbing', 'skin', 'glove', 'gloveKnuckle', 'boot', 'helmet', 'polymer', 'rubber'] as const) {
    const mat = m[k].clone();
    addRim(mat);
    c[k] = mat;
  }
  return c;
}
