import { useRef, useEffect } from 'react';
import * as THREE from 'three';

const vertexShaderSource = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform float u_time;
uniform vec2 u_res;
uniform float u_gooey;
uniform vec2 u_mouse;
uniform float u_mode;

#define PI 3.14159265359
#define MAX_BUBBLES 12

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float orb(vec2 p, float t) {
  float a = atan(p.y, p.x);
  float l = length(p);
  float d = l - 0.35;
  
  float n1 = noise(vec2(a * 3.0, t * 0.3) + 10.0) * 0.06;
  float n2 = noise(vec2(a * 7.0 + 5.0, t * 0.5) + 20.0) * 0.03;
  float n3 = noise(vec2(a * 15.0 + 10.0, t * 0.8) + 30.0) * 0.015;
  
  d -= n1 + n2 + n3;
  
  float pulse = sin(t * 1.5) * 0.02 + sin(t * 2.3 + 1.0) * 0.015;
  d += pulse;
  
  float md = length(p - u_mouse * 0.5) * 2.0;
  d += (1.0 - smoothstep(0.0, 0.5, md)) * -0.08;
  
  return smoothstep(0.0, 0.06 + u_gooey * 0.04, d);
}

float bubble(vec2 p, float t, float idx) {
  float fi = float(idx);
  float phase = fi * 1.047;
  float spd = 0.3 + fi * 0.1;
  float bx = sin(t * spd + phase) * 0.2;
  float by = -0.3 + mod(t * (0.08 + fi * 0.02) + fi * 0.3, 0.9) - 0.15;
  float bs = 0.03 + sin(t * 0.5 + phase) * 0.008;
  return smoothstep(0.0, bs, length(p - vec2(
    bx + sin(t * 1.5 + phase) * 0.015,
    by + cos(t * 1.2 + phase + 1.0) * 0.01
  )));
}

float gooeyMin(float a, float b) {
  return min(a, b);
}

float scene(vec2 p, float t) {
  float d = orb(p, t);
  for (int i = 0; i < MAX_BUBBLES; i++) {
    d = gooeyMin(d, bubble(p, t, float(i)));
  }
  return d;
}

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float halftone(vec2 p, float size, float t) {
  float scale = size * (1.0 + sin(t * 0.5) * 0.1);
  vec2 sp = p / scale;
  vec2 grid = floor(sp + 0.5);
  vec2 cp = (grid + 0.5) * scale;
  float dist = length(p - cp);
  float radius = scale * 0.5 * (0.6 + 0.4 * sin(t * 0.8 + grid.x * 0.5 + grid.y * 0.3));
  return smoothstep(radius, radius * 0.8, dist);
}

float pattern(vec2 p, float t) {
  p = rot(p, t * 0.1);
  float g1 = halftone(p, 0.05 + sin(t * 0.3) * 0.01, t);
  vec2 off = vec2(0.02 * cos(t * 0.2), 0.02 * sin(t * 0.3));
  float g2 = halftone(p + off, 0.03, t * 1.2);
  float pat = g1 * 0.5;
  if (g2 > 0.0) pat += 0.3;
  pat += smoothstep(0.48, 0.5, abs(fract(p.x * 20.0 + t * 0.05) - 0.5)) * 0.1;
  pat += smoothstep(0.48, 0.5, abs(fract(p.y * 20.0 + t * 0.07) - 0.5)) * 0.1;
  return pat;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / min(u_res.x, u_res.y);
  float t = u_time;
  vec2 mouseShift = vec2(0.0);
  if (u_mode > 0.5) {
    mouseShift = (u_mouse - 0.5) * 0.1;
  }
  
  float pat = pattern(rot(uv + mouseShift, t * 0.05), t);
  float d = scene(rot(uv, t * 0.15), t);
  float gooeyMask = 1.0 - smoothstep(0.0, 0.1 + u_gooey * 0.05, d);
  
  vec3 col1 = vec3(0.54, 0.36, 0.96);
  vec3 col2 = vec3(0.31, 0.27, 0.89);
  vec3 orbColor = mix(col1, col2, sin(atan(uv.y, uv.x) * 3.0 + t * 0.5) * 0.5 + 0.5);
  
  float tex = pat * 0.3 + 0.7;
  float edge = smoothstep(0.0, 0.15 + u_gooey * 0.08, d) * (1.0 - smoothstep(0.15 + u_gooey * 0.08, 0.3 + u_gooey * 0.15, d));
  
  vec3 col = orbColor * tex * gooeyMask;
  col += vec3(0.8, 0.7, 1.0) * edge * 0.5;
  
  if (u_gooey > 0.5) {
    float gooeyEdge = smoothstep(0.0, 0.2, d) * (1.0 - smoothstep(0.2, 0.4, d));
    col += vec3(0.9, 0.8, 1.0) * gooeyEdge * 0.3 * (u_gooey - 0.5) * 2.0;
  }
  
  col += orbColor * (1.0 - smoothstep(0.0, 0.5, d)) * 0.15;
  col += orbColor * exp(-length(uv) * 3.0) * 0.08;
  
  gl_FragColor = vec4(col, gooeyMask * 0.95 + edge * 0.3);
}
`;

export default function DataOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, 500);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0 },
      u_res: { value: new THREE.Vector2(window.innerWidth, 500) },
      u_gooey: { value: 1.0 },
      u_mode: { value: 1.0 },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
      uniforms,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const clock = new THREE.Clock();

    const animate = () => {
      uniforms.u_time.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      uniforms.u_mouse.value.set(x, y);
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      renderer.setSize(window.innerWidth, 500);
      uniforms.u_res.value.set(window.innerWidth, 500);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-[500px]"
      style={{ zIndex: 0 }}
    />
  );
}
