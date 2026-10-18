import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'

// Small seeded PRNG (mulberry32) so every load produces the same result.
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Builds a chunky low-poly block filling `box` (a THREE.Box3): a box with all
// edges chamfered, corners nudged irregularly, and flat faces. Sizes are
// fractions of the box's smallest side; `gap` shrinks it on every side so
// neighboring blocks read as separate pieces.
export function makeChamferedBlock(box, rand, { bevel = 0.22, jitter = 0.07, gap = 0.04 } = {}) {
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const minDim = Math.min(size.x, size.y, size.z)
  const half = size.clone().multiplyScalar(0.5).subScalar(gap * minDim)
  const b = bevel * minDim
  const j = jitter * minDim
  const nudge = () => (rand() - 0.5) * 2 * j

  const points = []
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = center.x + sx * half.x
        const cy = center.y + sy * half.y
        const cz = center.z + sz * half.z
        // Pulling each corner in along two axes at a time chamfers all edges.
        points.push(new THREE.Vector3(cx + nudge(), cy - sy * b + nudge(), cz - sz * b + nudge()))
        points.push(new THREE.Vector3(cx - sx * b + nudge(), cy + nudge(), cz - sz * b + nudge()))
        points.push(new THREE.Vector3(cx - sx * b + nudge(), cy - sy * b + nudge(), cz + nudge()))
      }
    }
  }
  return new ConvexGeometry(points)
}

// Splits an axis-aligned box around a rectangular opening in the y-z plane
// (through all of x), returning the pieces left over. A box that doesn't
// overlap the opening comes back whole.
export function subtractOpening(box, { yMin, yMax, zMin, zMax }) {
  const { min, max } = box
  if (max.y <= yMin || min.y >= yMax || max.z <= zMin || min.z >= zMax) return [box.clone()]
  const pieces = []
  if (min.y < yMin) pieces.push(new THREE.Box3(min.clone(), new THREE.Vector3(max.x, yMin, max.z)))
  if (max.y > yMax) pieces.push(new THREE.Box3(new THREE.Vector3(min.x, yMax, min.z), max.clone()))
  const y0 = Math.max(min.y, yMin)
  const y1 = Math.min(max.y, yMax)
  if (min.z < zMin) pieces.push(new THREE.Box3(new THREE.Vector3(min.x, y0, min.z), new THREE.Vector3(max.x, y1, zMin)))
  if (max.z > zMax) pieces.push(new THREE.Box3(new THREE.Vector3(min.x, y0, zMax), new THREE.Vector3(max.x, y1, max.z)))
  return pieces
}

// Adds box-projected UVs to a non-indexed geometry: each triangle is mapped
// onto the plane its normal faces most, with u running along local x.
export function addPlanarUVs(geometry) {
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  const size = new THREE.Vector3().subVectors(max, min)
  const pos = geometry.attributes.position
  const nrm = geometry.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - min.x) / size.x
    const y = (pos.getY(i) - min.y) / size.y
    const z = (pos.getZ(i) - min.z) / size.z
    const ax = Math.abs(nrm.getX(i))
    const ay = Math.abs(nrm.getY(i))
    const az = Math.abs(nrm.getZ(i))
    let u, v
    if (ay >= ax && ay >= az) [u, v] = [x, z] // top and bottom
    else if (az >= ax) [u, v] = [x, y] // long sides
    else [u, v] = [z, y] // ends
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

// Paints a stylized, hand-painted-looking wood plank texture: grain runs along
// the texture's width (u), with knots and darker board edges.
export function makeWoodTexture(seed = 3) {
  const rand = seededRandom(seed)
  const W = 1024
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#a8673a'
  ctx.fillRect(0, 0, W, H)

  // Broad lighter and darker bands for depth.
  for (let k = 0; k < 7; k++) {
    const y = rand() * H
    ctx.fillStyle = rand() > 0.5 ? 'rgba(196, 128, 76, 0.35)' : 'rgba(110, 62, 32, 0.3)'
    ctx.fillRect(0, y, W, 10 + rand() * 30)
  }

  // Wavy grain lines.
  for (let k = 0; k < 46; k++) {
    const y0 = rand() * H
    const amp = 2 + rand() * 6
    const freq = ((1 + rand() * 2.5) * Math.PI * 2) / W
    const phase = rand() * Math.PI * 2
    ctx.strokeStyle = rand() > 0.3 ? `rgba(84, 46, 22, ${0.35 + rand() * 0.4})` : `rgba(206, 142, 92, ${0.3 + rand() * 0.3})`
    ctx.lineWidth = 1 + rand() * 2.5
    ctx.beginPath()
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x * freq + phase) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Knots: concentric dark rings.
  for (let k = 0; k < 2; k++) {
    const cx = 120 + rand() * (W - 240)
    const cy = 50 + rand() * (H - 100)
    for (let r = 4; r <= 22; r += 4) {
      ctx.strokeStyle = `rgba(70, 36, 16, ${0.75 - r / 40})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 2.2, r, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(60, 30, 12, 0.85)'
    ctx.beginPath()
    ctx.ellipse(cx, cy, 6, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Darker edges along the board's long sides.
  const edge = ctx.createLinearGradient(0, 0, 0, H)
  edge.addColorStop(0, 'rgba(60, 32, 14, 0.55)')
  edge.addColorStop(0.08, 'rgba(60, 32, 14, 0)')
  edge.addColorStop(0.92, 'rgba(60, 32, 14, 0)')
  edge.addColorStop(1, 'rgba(60, 32, 14, 0.55)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, W, H)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}
