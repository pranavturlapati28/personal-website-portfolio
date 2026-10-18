import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seededRandom } from './lowPoly'

// A night-time New York seen through the window, built as real geometry in the
// desk group's space (the wall faces +x, so the city lies along -x). One unit
// is roughly 15 m. We look across the East River at Manhattan, with Midtown
// (Empire State, Chrysler) on the left and One World Trade Center on the right.
export const GROUND_Y = -3
const LOT = 3 // city block grid spacing
const STREET = 0.9 // street width between lots
const CITY_X = [-12, -380] // near and far edge of the city
const CITY_Z = 180 // half width of the city
// Rivers (x ranges) with no buildings: the East River in front of Manhattan,
// and the Hudson behind it.
// Landmarks are laid out at their original spots and slid this far toward us.
const MANHATTAN_SHIFT = 45
// Rivers as [near x, far x].
const RIVERS = [
  [-74 + MANHATTAN_SHIFT, -88 + MANHATTAN_SHIFT],
  [-188 + MANHATTAN_SHIFT, -205 + MANHATTAN_SHIFT],
]
const MIDTOWN = { x: -145 + MANHATTAN_SHIFT, z: 6, radius: 22, boost: 11 }
const DOWNTOWN = { x: -116 + MANHATTAN_SHIFT, z: -9, radius: 13, boost: 8 }
const MANHATTAN_X = [-74 + MANHATTAN_SHIFT, -188 + MANHATTAN_SHIFT]

// Haze on the horizon (city light pollution) and the dark sky overhead.
const HORIZON = new THREE.Color(0.17, 0.13, 0.21)
const ZENITH = new THREE.Color(0.015, 0.02, 0.055)
const FOG_DENSITY = 1 / 300

// Everything in the city only draws where the window's stencil mask is set,
// so none of it shows past the edges of the room.
export function cityStencil(ref) {
  return { stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc }
}

const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 color, vec3 worldPos) {
    float d = distance(worldPos, cameraPosition) * uFogDensity;
    return mix(color, uFogColor, 1.0 - exp(-d * d));
  }
`
const HASH_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
`
const fogUniforms = () => ({
  uFogColor: { value: HORIZON.clone() },
  uFogDensity: { value: FOG_DENSITY },
})

// Building facades with a grid of windows, each lit or dark at random. Per
// building params (seed, lit fraction, glass vs. stone) come from instanceColor
// on instanced meshes, or an aParams attribute on merged landmark geometry.
// Windows too small to resolve blend into their average glow so distant
// buildings shimmer less.
export function makeBuildingMaterial(stencilRef) {
  return new THREE.ShaderMaterial({
    ...cityStencil(stencilRef),
    uniforms: { ...fogUniforms(), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aParams;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vParams;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vParams = instanceColor;
        #else
          vParams = aParams;
        #endif
        vec4 w = modelMatrix * p;
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_GLSL}
      ${HASH_GLSL}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vParams;
      uniform float uTime;
      void main() {
        float seed = vParams.x * 97.0;
        float litFraction = vParams.y;
        float glass = step(0.5, vParams.z);
        vec3 n = normalize(vNormal);
        vec3 facade = mix(vec3(0.055, 0.05, 0.065), vec3(0.04, 0.06, 0.09), glass);
        vec3 color = facade * 0.7;
        if (abs(n.y) < 0.6) {
          float across = abs(n.x) > abs(n.z) ? vWorld.z : vWorld.x;
          vec2 uv = vec2(across / mix(0.2, 0.15, glass), vWorld.y / 0.22);
          vec2 cell = floor(uv);
          vec2 f = fract(uv);
          float lit = step(hash(cell + seed), litFraction);
          lit *= step(0.14, hash(vec2(cell.y, seed + 5.0))); // some floors fully dark
          // Every so often a few windows switch on or off, each on its own
          // staggered schedule.
          float epoch = floor(uTime / 20.0 + hash(cell + seed + 9.0) * 50.0);
          lit = abs(lit - step(hash(cell + seed + epoch * 0.731), 0.015));
          float tone = hash(cell * 1.7 + seed);
          vec3 warm = mix(vec3(1.0, 0.68, 0.34), vec3(1.0, 0.86, 0.62), tone);
          vec3 light = mix(warm, vec3(0.78, 0.88, 1.0), step(0.82, tone));
          light *= 0.55 + 0.6 * hash(cell + seed + 3.1);
          vec3 darkPane = facade * 1.5 + vec3(0.015, 0.02, 0.035);
          float pane = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.82);
          vec3 detail = mix(facade, mix(darkPane, light, lit), pane);
          vec3 average = mix(facade, mix(darkPane, vec3(1.0, 0.78, 0.5), litFraction * 0.8), 0.45);
          vec2 fw = fwidth(uv);
          color = mix(detail, average, smoothstep(0.35, 0.9, max(fw.x, fw.y)));
        }
        gl_FragColor = vec4(applyFog(color, vWorld), 1.0);
      }
    `,
  })
}

// Unlit, self-glowing surfaces (floodlit crowns, spires) colored per vertex.
export function makeGlowMaterial(stencilRef) {
  return new THREE.ShaderMaterial({
    ...cityStencil(stencilRef),
    vertexColors: true,
    uniforms: fogUniforms(),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vColor;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vColor = color;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_GLSL}
      varying vec3 vWorld;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(applyFog(vColor, vWorld), 1.0);
      }
    `,
  })
}

// The ground: dark blocks, glowing orange streets with moving traffic, and
// the two rivers. Built directly in the desk group's space so the street grid
// lines up with the building lots.
export function makeGroundMaterial(stencilRef) {
  return new THREE.ShaderMaterial({
    ...cityStencil(stencilRef),
    uniforms: {
      ...fogUniforms(),
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vWorld;
      void main() {
        vLocal = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_GLSL}
      ${HASH_GLSL}
      uniform float uTime;
      varying vec3 vLocal;
      varying vec3 vWorld;
      const float LOT = ${LOT.toFixed(2)};
      const float HALF_BLOCK = ${((LOT - STREET) / 2).toFixed(3)};
      bool inRiver(float x) {
        return ${RIVERS.map(([a, b]) => `(x < ${a.toFixed(1)} && x > ${b.toFixed(1)})`).join(' || ')};
      }
      void main() {
        vec2 p = vLocal.xz;
        vec3 color;
        if (inRiver(p.x)) {
          // Dark water with faint glints from the skyline.
          float glint = step(0.985, hash(floor(p * vec2(2.0, 0.6)) + floor(uTime * 2.0)));
          color = vec3(0.012, 0.018, 0.035) + glint * vec3(0.25, 0.2, 0.12);
        } else {
          vec2 g = p / LOT;
          vec2 offset = abs(g - floor(g + 0.5)) * LOT;
          float alongX = step(HALF_BLOCK, offset.y); // street running along x
          float alongZ = step(HALF_BLOCK, offset.x); // street running along z
          float street = max(alongX, alongZ);
          // Headlights and taillights drifting along each street.
          float laneX = floor(g.y + 0.5);
          float laneZ = floor(g.x + 0.5);
          float dirX = hash(vec2(laneX, 1.0)) > 0.5 ? 1.0 : -1.0;
          float dirZ = hash(vec2(laneZ, 2.0)) > 0.5 ? 1.0 : -1.0;
          float carX = step(0.965, fract(p.x * 0.35 + uTime * 0.6 * dirX + hash(vec2(laneX, 3.0))));
          float carZ = step(0.965, fract(p.y * 0.35 + uTime * 0.6 * dirZ + hash(vec2(laneZ, 4.0))));
          vec3 cars = alongX * carX * (dirX > 0.0 ? vec3(1.0, 0.9, 0.7) : vec3(1.0, 0.15, 0.1))
                    + alongZ * carZ * (dirZ > 0.0 ? vec3(1.0, 0.9, 0.7) : vec3(1.0, 0.15, 0.1));
          vec3 sodium = vec3(0.55, 0.3, 0.1);
          vec3 detail = mix(vec3(0.02, 0.02, 0.026), sodium + cars * 0.3, street);
          vec3 average = mix(vec3(0.02, 0.02, 0.026), sodium, ${(1 - ((LOT - STREET) / LOT) ** 2).toFixed(3)});
          vec2 fw = fwidth(g);
          color = mix(detail, average, smoothstep(0.08, 0.3, max(fw.x, fw.y)));
        }
        gl_FragColor = vec4(applyFog(color, vWorld), 1.0);
      }
    `,
  })
}

// Night sky: light-polluted haze at the horizon fading to near black.
export function makeSkyMaterial(stencilRef) {
  return new THREE.ShaderMaterial({
    ...cityStencil(stencilRef),
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: HORIZON.clone() },
      uZenith: { value: ZENITH.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(0.0, 0.3, vDir.y)), 1.0);
      }
    `,
  })
}

// Blinking red aircraft-warning lights on the tallest towers.
export function makeBeaconMaterial(stencilRef) {
  return new THREE.ShaderMaterial({
    ...cityStencil(stencilRef),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vOn;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(260.0 / -mv.z, 2.0, 7.0) * uPixelRatio;
        vOn = smoothstep(0.35, 0.5, fract(uTime * 0.45 + aPhase)) * (1.0 - smoothstep(0.75, 0.9, fract(uTime * 0.45 + aPhase)));
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vOn;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.0, 0.12, 0.08) * a * mix(0.12, 1.0, vOn), 1.0);
      }
    `,
  })
}

// Merged geometry needs matching attributes: non-indexed, no uvs.
function prep(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
  return g
}

function fill(geometry, name, values) {
  const count = geometry.attributes.position.count
  const array = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) array.set(values, i * 3)
  geometry.setAttribute(name, new THREE.BufferAttribute(array, 3))
  return geometry
}

// Vertex colors fading from `low` at the piece's base to `high` at its top.
function gradient(geometry, low, high) {
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  const pos = geometry.attributes.position
  const array = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(low).lerp(high, (pos.getY(i) - min.y) / (max.y - min.y || 1))
    array.set([c.r, c.g, c.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(array, 3))
  return geometry
}

// Shapes, positioned with their base at height y0 above the ground.
const box = (x, z, w, d, y0, y1) =>
  prep(new THREE.BoxGeometry(d, y1 - y0, w).translate(x, GROUND_Y + (y0 + y1) / 2, z))
// Tapered square (or n-sided) tower section; 4-sided ones face the axes.
const frustum = (x, z, rBottom, rTop, y0, y1, sides = 4) => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, sides)
  if (sides === 4) g.rotateY(Math.PI / 4)
  return prep(g.translate(x, GROUND_Y + (y0 + y1) / 2, z))
}

const hex = (h) => new THREE.Color(h)

// Landmarks: building-shader pieces (with params), glowing pieces (with vertex
// colors), and beacon positions.
function buildLandmarks() {
  const facades = []
  const glows = []
  const beacons = []
  const facade = (g, seed, lit, glass) => facades.push(fill(g, 'aParams', [seed, lit, glass ? 1 : 0]))
  const glow = (g, low, high = low) => glows.push(gradient(g, hex(low), hex(high)))
  const beacon = (x, z, y) => beacons.push(new THREE.Vector3(x, GROUND_Y + y, z))

  // Empire State Building: limestone setbacks up to a floodlit gold crown.
  {
    const [x, z] = [-140, 4]
    facade(box(x, z, 4.2, 3.0, 0, 1.6), 0.11, 0.45, false)
    facade(box(x, z, 3.0, 2.2, 1.6, 15.5), 0.12, 0.42, false)
    glow(box(x, z, 2.4, 1.8, 15.5, 17.4), '#6e5530', '#c9a463')
    glow(box(x, z, 1.85, 1.4, 17.4, 19.0), '#c9a463', '#f2d38f')
    glow(box(x, z, 1.3, 1.0, 19.0, 20.6), '#f2d38f', '#fff0c8')
    glow(frustum(x, z, 0.45, 0.32, 20.6, 22.3, 8), '#fff0c8', '#ffffff')
    glow(frustum(x, z, 0.08, 0.03, 22.3, 25.6, 6), '#d8dcff', '#9aa0c8')
    beacon(x, z, 25.7)
  }

  // Chrysler Building: tower topped by a stepped, brightly lit steel crown.
  {
    const [x, z] = [-153, 10.5]
    facade(box(x, z, 3.2, 3.2, 0, 2.5), 0.21, 0.4, false)
    facade(box(x, z, 2.2, 2.2, 2.5, 13.5), 0.22, 0.38, false)
    const tiers = [
      [1.5, 1.2, 13.5, 14.5],
      [1.2, 0.92, 14.5, 15.4],
      [0.92, 0.66, 15.4, 16.2],
      [0.66, 0.42, 16.2, 16.9],
      [0.42, 0.14, 16.9, 18.1],
    ]
    tiers.forEach(([rb, rt, y0, y1], i) => glow(frustum(x, z, rb, rt, y0, y1), i % 2 ? '#8e96a8' : '#b8c0d4', '#f4f7ff'))
    glow(frustum(x, z, 0.06, 0.01, 18.1, 20.0, 6), '#e8ecff', '#b0b6d0')
    beacon(x, z, 20.1)
  }

  // One World Trade Center: a square glass tower whose sides taper into
  // triangles, with a square top turned 45 degrees and a tall lit spire.
  {
    const [x, z] = [-116, -8]
    facade(box(x, z, 2.7, 2.7, 0, 3.2), 0.31, 0.6, true)
    const points = []
    const hb = 1.35
    const ht = 0.92
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      points.push(new THREE.Vector3(x + dx * hb, GROUND_Y + 3.2, z + dz * hb))
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      points.push(new THREE.Vector3(x + dx * ht * Math.SQRT2, GROUND_Y + 22.5, z + dz * ht * Math.SQRT2))
    }
    facade(prep(new ConvexGeometry(points)), 0.32, 0.62, true)
    glow(frustum(x, z, 1.32, 1.3, 22.5, 22.85, 4).rotateY(0), '#dfe8ff', '#ffffff')
    glow(frustum(x, z, 0.1, 0.035, 22.85, 30.5, 6), '#ffffff', '#c8d4ff')
    beacon(x, z, 30.6)
  }

  // Other Midtown and Downtown supertalls: [x, z, width, depth, height, glass, crown color].
  const towers = [
    [-137, 13.5, 1.0, 1.0, 23.5, false, '#fff6e6'], // 432 Park Avenue
    [-131, 9, 1.4, 1.2, 24, true, '#cfe0ff'], // Central Park Tower
    [-150, 7, 1.7, 1.7, 21.5, true, '#e6f0ff'], // One Vanderbilt
    [-146, -1.5, 1.9, 1.6, 19, true, '#9fd4ff'], // 30 Hudson Yards
    [-143, 7.5, 1.6, 1.4, 18.5, true, '#c8ffe8'], // Bank of America Tower
    [-160, 1, 1.5, 1.5, 15, false, '#ffd9a0'],
    [-112, -14, 1.6, 1.6, 15.5, true, '#ffffff'], // 3 WTC
    [-121, -3, 1.4, 1.4, 13, false, '#ffe2b0'], // Woolworth area
    [-109, -4.5, 1.8, 1.5, 12, true, '#bcd8ff'],
  ]
  towers.forEach(([x, z, w, d, h, glass, crown], i) => {
    if (i === 2) {
      // One Vanderbilt tapers toward its top.
      facade(frustum(x, z, w * 0.72, w * 0.5, 0, h), 0.4 + i * 0.03, 0.5, glass)
      glow(frustum(x, z, w * 0.5, w * 0.3, h, h + 1.2), '#ffffff', crown)
    } else {
      facade(box(x, z, w, d, 0, h), 0.4 + i * 0.03, 0.5, glass)
      glow(box(x, z, w * 0.92, d * 0.92, h, h + 0.35), crown, '#ffffff')
    }
    beacon(x, z, h + 1.3)
  })

  return {
    facades: mergeGeometries(facades).translate(MANHATTAN_SHIFT, 0, 0),
    glows: mergeGeometries(glows).translate(MANHATTAN_SHIFT, 0, 0),
    beacons: beacons.map((b) => b.setX(b.x + MANHATTAN_SHIFT)),
  }
}

const inRiver = (x) => RIVERS.some(([a, b]) => x < a && x > b)
const boost = (x, z, { x: cx, z: cz, radius, boost: b }) =>
  b * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * radius * radius))

// Fills the city grid with boxy buildings: low-rise across the river, dense
// towers in Midtown and Downtown, and mid-rise New Jersey behind.
function buildBlocks(rand) {
  const matrices = []
  const params = []
  const crowns = []
  const beacons = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const add = (x, z, w, d, h, glass, lit) => {
    m.compose(new THREE.Vector3(x, GROUND_Y, z), q, new THREE.Vector3(d, h, w))
    matrices.push(m.clone())
    params.push(rand(), lit, glass ? 1 : 0)
    if (h > 9 && rand() < 0.35) {
      const color = hex(['#ffffff', '#cfe0ff', '#ffd9a0', '#bfffe0'][Math.floor(rand() * 4)])
      crowns.push(gradient(box(x, z, w * 0.9, d * 0.9, h, h + 0.3), color, new THREE.Color(1, 1, 1)))
    }
    if (h > 10) beacons.push(new THREE.Vector3(x, GROUND_Y + h + 0.2, z))
  }

  const footprint = LOT - STREET
  for (let x = CITY_X[0] - LOT / 2; x > CITY_X[1]; x -= LOT) {
    if (inRiver(x - footprint / 2) || inRiver(x + footprint / 2)) continue
    const manhattan = x < MANHATTAN_X[0] && x > MANHATTAN_X[1]
    for (let z = -CITY_Z; z <= CITY_Z; z += LOT) {
      const cx = Math.round(x / LOT) * LOT
      const cz = Math.round(z / LOT) * LOT
      // Keep the landmarks' lots clear.
      if (manhattan && Math.abs(cz - 4) < 2 && Math.abs(cx + 140 - MANHATTAN_SHIFT) < 2) continue
      const r = rand()
      let h
      if (manhattan) {
        h = 1.5 + 4 * r * r + (boost(cx, cz, MIDTOWN) + boost(cx, cz, DOWNTOWN)) * (0.35 + 0.75 * rand())
      } else if (x > MANHATTAN_X[0]) {
        // Queens and Brooklyn: mostly low-rise, with Long Island City style
        // towers scattered in front of the skyline.
        h = rand() < 0.14 ? 4 + 7 * rand() : 0.6 + 2.2 * r * r
      } else {
        h = 1.0 + 4.5 * r * r * r // New Jersey
      }
      const glass = rand() < (h > 7 ? 0.6 : 0.2)
      const lit = 0.15 + 0.45 * rand()
      // Most lots hold one building; some split into two narrower ones.
      if (rand() < 0.25 && h < 8) {
        const half = footprint / 2
        add(cx, cz - half / 2, half * 0.9, footprint, h, glass, lit)
        add(cx, cz + half / 2, half * 0.9, footprint * (0.7 + 0.3 * rand()), h * (0.6 + 0.6 * rand()), !glass, lit)
      } else {
        const s = h > 8 ? 0.6 + 0.3 * rand() : 0.8 + 0.2 * rand()
        add(cx, cz, footprint * s, footprint * s, h, glass, lit)
      }
    }
  }
  return { matrices, params: new Float32Array(params), crowns, beacons }
}

// Builds everything once: geometry and per-instance data for the city.
export function buildCity() {
  const rand = seededRandom(1904)
  const blocks = buildBlocks(rand)
  const landmarks = buildLandmarks()
  const beacons = [...landmarks.beacons, ...blocks.beacons]
  const beaconGeometry = new THREE.BufferGeometry().setFromPoints(beacons)
  beaconGeometry.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from(beacons, () => rand()), 1))

  const [x0, x1] = [-8, -800]
  const ground = new THREE.PlaneGeometry(x0 - x1, 1200)
    .rotateX(-Math.PI / 2)
    .translate((x0 + x1) / 2, GROUND_Y, 0)

  return {
    blocks,
    landmarkFacades: landmarks.facades,
    glows: mergeGeometries([landmarks.glows, ...blocks.crowns]),
    beacons: beaconGeometry,
    ground,
  }
}
