import React from 'react'
import * as THREE from 'three'
import City from './City'

// Window opening in the brick wall, in the desk group's space (the wall faces
// +x). It's centered over the desk, just above the pipes; Desk trims the
// bricks around this opening.
export const WINDOW_OPENING = {
  yMin: 1.37,
  yMax: 2.32,
  zMin: -0.42,
  zMax: 0.42,
}

const WALL_FRONT_X = 0.094
const FRAME = 0.035 // frame border width
const OVERLAP = 0.015 // frame reaches past the opening to cover trimmed edges
const MUNTIN = 0.018 // cross bars between panes

const frameMaterial = new THREE.MeshStandardMaterial({ color: '#5a2e1f', roughness: 0.7, flatShading: true })
const trimMaterial = new THREE.MeshStandardMaterial({ color: '#8a4c32', roughness: 0.7, flatShading: true })
const sillMaterial = new THREE.MeshStandardMaterial({ color: '#6b3a26', roughness: 0.75, flatShading: true })
// Stencil value marking the window's pixels: the mask writes it, and the city
// only draws where it's set, so they never show past the room's edges.
const WINDOW_STENCIL = 1
const maskMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: WINDOW_STENCIL,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
})

// A faint diagonal reflection streak for the glass.
function paintGlassGlare() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 290
  const ctx = canvas.getContext('2d')
  const glare = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  glare.addColorStop(0.2, 'rgba(255, 255, 255, 0)')
  glare.addColorStop(0.32, 'rgba(255, 255, 255, 0.06)')
  glare.addColorStop(0.44, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = glare
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

const glareMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })

// An axis-aligned box from min/max corners (x, y, z) in the group's space.
function Box({ min, max, material }) {
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  return (
    <mesh position={center} material={material}>
      <boxGeometry args={size} />
    </mesh>
  )
}

export default function Window() {
  const { yMin, yMax, zMin, zMax } = WINDOW_OPENING
  const y0 = yMin - OVERLAP
  const y1 = yMax + OVERLAP
  const z0 = zMin - OVERLAP
  const z1 = zMax + OVERLAP
  const back = -0.02
  const front = WALL_FRONT_X + 0.01
  const glassX = 0.03
  const yMid = (yMin + yMax) / 2
  const zMid = (zMin + zMax) / 2

  const openW = zMax - zMin
  const openH = yMax - yMin
  React.useMemo(() => {
    glareMaterial.map ??= new THREE.CanvasTexture(paintGlassGlare())
  }, [])

  return (
    <group>
      {/* Stencil mask over the opening; drawn first so the city can test
          against it. */}
      <mesh position={[glassX, yMid, zMid]} rotation={[0, Math.PI / 2, 0]} material={maskMaterial} renderOrder={-1}>
        <planeGeometry args={[openW, openH]} />
      </mesh>

      {/* The city outside, drawn only through the mask. */}
      <City stencilRef={WINDOW_STENCIL} />

      {/* Faint reflection on the glass. */}
      <mesh position={[glassX + 0.001, yMid, zMid]} rotation={[0, Math.PI / 2, 0]} material={glareMaterial}>
        <planeGeometry args={[openW, openH]} />
      </mesh>

      {/* Outer frame: top, bottom, and sides. */}
      <Box min={[back, y1 - FRAME, z0]} max={[front, y1, z1]} material={frameMaterial} />
      <Box min={[back, y0, z0]} max={[front, y0 + FRAME, z1]} material={frameMaterial} />
      <Box min={[back, y0, z0]} max={[front, y1, z0 + FRAME]} material={frameMaterial} />
      <Box min={[back, y0, z1 - FRAME]} max={[front, y1, z1]} material={frameMaterial} />

      {/* Lighter inner trim, like the reference's inset edge. */}
      <Box min={[back, y0 + FRAME, z0 + FRAME]} max={[front - 0.012, y0 + FRAME + 0.008, z1 - FRAME]} material={trimMaterial} />
      <Box min={[back, y1 - FRAME - 0.008, z0 + FRAME]} max={[front - 0.012, y1 - FRAME, z1 - FRAME]} material={trimMaterial} />
      <Box min={[back, y0 + FRAME, z0 + FRAME]} max={[front - 0.012, y1 - FRAME, z0 + FRAME + 0.008]} material={trimMaterial} />
      <Box min={[back, y0 + FRAME, z1 - FRAME - 0.008]} max={[front - 0.012, y1 - FRAME, z1 - FRAME]} material={trimMaterial} />

      {/* Cross bars splitting the glass into four panes. */}
      <Box min={[glassX, yMid - MUNTIN / 2, zMin]} max={[0.055, yMid + MUNTIN / 2, zMax]} material={frameMaterial} />
      <Box min={[glassX, yMin, zMid - MUNTIN / 2]} max={[0.055, yMax, zMid + MUNTIN / 2]} material={frameMaterial} />

      {/* Ledge under the window, sticking out from the wall. */}
      <Box min={[back, y0 - 0.025, z0 - 0.04]} max={[0.14, y0, z1 + 0.04]} material={sillMaterial} />
    </group>
  )
}
