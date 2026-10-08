import * as THREE from 'three';

/** Low-res PS1 world geometry. */
export const LAYER_WORLD = 0;
/** Full-res, high-detail characters (depth-tested against the low-res world). */
export const LAYER_CHAR = 1;
/** Low-res effects that must not occlude characters (tracers, puffs, blob shadows). */
export const LAYER_FX = 3;

/** Shared uniform: half the low-res framebuffer size, used for vertex snapping. */
export const snapUniform = { value: new THREE.Vector2(160, 120) };

/**
 * Patch a built-in material with PS1 traits: vertices snapped to the low-res
 * pixel grid (the "wobble") and affine (non perspective-correct) texture mapping.
 */
export function ps1ify<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = snapUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnapRes;\nvarying vec3 vAffine;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        if (gl_Position.w > 0.0) {
          vec4 sp = gl_Position;
          sp.xyz /= sp.w;
          sp.xy = floor(sp.xy * uSnapRes + 0.5) / uSnapRes;
          sp.xyz *= sp.w;
          gl_Position = sp;
        }
        #ifdef USE_MAP
          vAffine = vec3(vMapUv * gl_Position.w, gl_Position.w);
        #else
          vAffine = vec3(0.0, 0.0, 1.0);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAffine;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= texture2D( map, vAffine.xy / vAffine.z );
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'ps1';
  return mat;
}

const BLIT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uLowRes;
uniform float uLevels;
uniform float uDither;
varying vec2 vUv;

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[x + y * 4] / 16.0;
}

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec2 px = floor(vUv * uLowRes);
  float d = (bayer4(px) - 0.5) * uDither;
  gl_FragColor.rgb = floor(gl_FragColor.rgb * uLevels + d + 0.5) / uLevels;
}
`;

const BLIT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * The hybrid pipeline:
 *  1. world + fx rendered into a ~240p target with vertex snapping & affine UVs
 *  2. upscaled with nearest filtering, 15-bit colour + Bayer dither
 *  3. world re-rendered depth-only at full res
 *  4. characters drawn at full res with full PBR, occluded by that depth
 *  5. depth cleared, viewmodel (gun + hands) drawn at full res on top
 */
export class HybridRenderer {
  readonly gl: THREE.WebGLRenderer;
  private lowRT: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blit: THREE.ShaderMaterial;
  private depthOnly = ps1ify(new THREE.MeshBasicMaterial({ colorWrite: false }));
  lowHeight = 240;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.1;
    this.gl.autoClear = false;
    this.lowRT = new THREE.WebGLRenderTarget(320, 240, {
      type: THREE.HalfFloatType,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.blit = new THREE.ShaderMaterial({
      vertexShader: BLIT_VERT,
      fragmentShader: BLIT_FRAG,
      uniforms: {
        tDiffuse: { value: this.lowRT.texture },
        uLowRes: { value: new THREE.Vector2(320, 240) },
        uLevels: { value: 31 },
        uDither: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blit);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  setSize(w: number, h: number) {
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.setSize(w, h, false);
    const lh = this.lowHeight;
    const lw = Math.round((lh * w) / h);
    this.lowRT.setSize(lw, lh);
    (this.blit.uniforms.uLowRes.value as THREE.Vector2).set(lw, lh);
    snapUniform.value.set(lw / 2, lh / 2);
  }

  setDither(on: boolean) {
    this.blit.uniforms.uDither.value = on ? 1 : 0;
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    sky: THREE.Texture,
    vmScene: THREE.Scene,
    vmCamera: THREE.PerspectiveCamera,
  ) {
    const r = this.gl;

    // 1. low-res world
    scene.background = sky;
    camera.layers.set(LAYER_WORLD);
    camera.layers.enable(LAYER_FX);
    r.setRenderTarget(this.lowRT);
    r.clear();
    r.render(scene, camera);
    scene.background = null;

    // 2. upscale + quantise
    r.setRenderTarget(null);
    r.clear();
    r.render(this.quadScene, this.quadCam);

    // 3. depth-only world at full res
    camera.layers.set(LAYER_WORLD);
    scene.overrideMaterial = this.depthOnly;
    r.render(scene, camera);
    scene.overrideMaterial = null;

    // 4. hi-detail characters
    camera.layers.set(LAYER_CHAR);
    r.render(scene, camera);

    // 5. viewmodel
    r.clearDepth();
    r.render(vmScene, vmCamera);

    camera.layers.set(LAYER_WORLD);
  }
}
