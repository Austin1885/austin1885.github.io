// The 1887 Koch map on a flat plane, lit by the lantern shader:
// the city sits in cool moonless dark; inside the lantern radius the full
// parchment-and-ink map shows through, with a faint flickering amber rim.
// Texture derivation is recorded in web/README.md.
//
// Color note: no texture.colorSpace is set on purpose. A ShaderMaterial does no
// automatic color conversion, so raw sRGB pixels in → raw sRGB pixels out is an
// identity round-trip; setting SRGBColorSpace here would wash the map out.
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uLantern;   // lantern center in UV
  uniform float uRadius;   // lantern radius, in v-units (map height = 1)
  uniform float uTime;
  uniform float uAspect;   // map width/height, so the light pool stays circular
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uMap, vUv).rgb;

    // the unlit city: desaturated and cooled way down
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 night = mix(color, vec3(lum), 0.65) * vec3(0.14, 0.17, 0.24);

    // gaslight flicker: two slow sines beat against each other
    float flicker = 1.0 + 0.025 * sin(uTime * 11.0) + 0.015 * sin(uTime * 17.3);
    float r = uRadius * flicker;
    float d = length((vUv - uLantern) * vec2(uAspect, 1.0));

    float light = 1.0 - smoothstep(r * 0.45, r, d);
    vec3 lamplit = color * vec3(1.08, 1.0, 0.88); // warm inside the pool
    vec3 outc = mix(night, lamplit, light);

    // amber rim right at the edge of the light
    float rim = smoothstep(r * 0.55, r * 0.85, d) * (1.0 - smoothstep(r * 0.85, r * 1.05, d));
    outc += vec3(0.91, 0.63, 0.24) * rim * 0.10;

    gl_FragColor = vec4(outc, 1.0);
  }
`;

export function loadMapPlane(scene, onReady, onError) {
  new THREE.TextureLoader().load('assets/map-1887-web.jpg', (texture) => {
    texture.anisotropy = 8;

    const aspect = texture.image.width / texture.image.height;
    const planeW = aspect, planeD = 1;

    const uniforms = {
      uMap: { value: texture },
      uLantern: { value: new THREE.Vector2(0.5, 0.5) },
      uRadius: { value: 0.16 },
      uTime: { value: 0 },
      uAspect: { value: aspect },
    };

    const geometry = new THREE.PlaneGeometry(planeW, planeD);
    geometry.rotateX(-Math.PI / 2); // lay flat, image top toward -Z

    const mesh = new THREE.Mesh(geometry,
      new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
    scene.add(mesh);

    // calibrated UV (bottom-left origin) → 3D point on the plane
    const uvToWorld = (u, v) => new THREE.Vector3((u - 0.5) * planeW, 0, (0.5 - v) * planeD);

    onReady({ mesh, planeW, planeD, uvToWorld, uniforms });
  }, undefined, onError);
}
