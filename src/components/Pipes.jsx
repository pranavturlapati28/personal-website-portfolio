import React from 'react'
import * as THREE from 'three'

// Pipe layout in the desk group's space. Two pipes run along the wall just
// above the desk (tree-pot height), curve down past the desk's right end, and
// run to the floor. The bends are concentric quarter circles around one
// center, so the upper pipe becomes the outer vertical run.
const PIPE_RADIUS = 0.0254
const WALL_X = 0.056
const BEND_Y = 1.14 // bend center: desk-top height...
const BEND_Z = -0.976 // ...just past the desk's right end
const INNER_BEND = 0.06
const OUTER_BEND = 0.13
const UPPER_Y = BEND_Y + OUTER_BEND // 1.27
const LOWER_Y = BEND_Y + INNER_BEND // 1.20
const OUTER_Z = BEND_Z - OUTER_BEND // -1.106, the model's original vertical runs
const INNER_Z = BEND_Z - INNER_BEND // -1.036
const FLOOR_Y = 0.014
const LEFT_END_Z = 1.681 // disappears into the left pillar
const RUNS = [
  { axis: 'z', y: UPPER_Y, from: BEND_Z, to: LEFT_END_Z },
  { axis: 'z', y: LOWER_Y, from: BEND_Z, to: LEFT_END_Z },
  { axis: 'y', z: OUTER_Z, from: FLOOR_Y, to: BEND_Y },
  { axis: 'y', z: INNER_Z, from: FLOOR_Y, to: BEND_Y },
]
// Flange positions, staggered so neighboring pipes' flanges never collide.
const FLANGES = [
  ...[1.35, 0.35, -0.45].map((z) => ({ axis: 'z', at: [WALL_X, UPPER_Y, z] })),
  ...[1.1, 0.1, -0.7].map((z) => ({ axis: 'z', at: [WALL_X, LOWER_Y, z] })),
  ...[0.85, 0.35].map((y) => ({ axis: 'y', at: [WALL_X, y, OUTER_Z] })),
  { axis: 'y', at: [WALL_X, 0.6, INNER_Z] },
  { axis: 'y', at: [WALL_X, 0.03, OUTER_Z], radius: 0.034 },
  { axis: 'y', at: [WALL_X, 0.03, INNER_Z], radius: 0.034 },
]
const VALVE_Z = 0.75

// Rotation that turns a three.js cylinder (built along y) to lie along z.
const ALONG_Z = [Math.PI / 2, 0, 0]

let pipeMaterial
// Shared painted-metal material for the pipes and fittings.
export function getPipeMaterial() {
  pipeMaterial ??= new THREE.MeshStandardMaterial({ color: '#b4472b', roughness: 0.55, metalness: 0.3 })
  return pipeMaterial
}

const boltMaterial = new THREE.MeshStandardMaterial({ color: '#3b2418', roughness: 0.6, metalness: 0.5 })
// Moderate metalness: the scene has no environment map, so fully metallic
// surfaces would render nearly black.
const bronzeMaterial = new THREE.MeshStandardMaterial({ color: '#c8924f', roughness: 0.4, metalness: 0.45 })

function PipeRun({ axis, y, z, from, to }) {
  const length = to - from
  const mid = (from + to) / 2
  return (
    <mesh
      position={axis === 'z' ? [WALL_X, y, mid] : [WALL_X, mid, z]}
      rotation={axis === 'z' ? ALONG_Z : [0, 0, 0]}
      material={getPipeMaterial()}
    >
      <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, length, 20, 1, true]} />
    </mesh>
  )
}

// A bolted flange ring around the pipe.
function Flange({ axis, at, radius = 0.042 }) {
  const bolts = 6
  return (
    <group position={at} rotation={axis === 'z' ? ALONG_Z : [0, 0, 0]}>
      <mesh material={getPipeMaterial()}>
        <cylinderGeometry args={[radius, radius, 0.02, 20]} />
      </mesh>
      {Array.from({ length: bolts }, (_, i) => {
        const a = (i / bolts) * Math.PI * 2
        const r = radius - 0.0075
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} material={boltMaterial}>
            <cylinderGeometry args={[0.0042, 0.0042, 0.028, 6]} />
          </mesh>
        )
      })}
    </group>
  )
}

// A gate valve on the upper pipe: body, bonnet, stem, and a bronze handwheel.
// The bonnet points out from the wall so the wheel faces the camera.
function Valve({ at }) {
  const paint = getPipeMaterial()
  return (
    <group position={at}>
      <mesh rotation={ALONG_Z} material={paint}>
        <cylinderGeometry args={[0.038, 0.038, 0.07, 16]} />
      </mesh>
      <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh position={[0, 0.055, 0]} material={paint}>
          <cylinderGeometry args={[0.02, 0.028, 0.05, 12]} />
        </mesh>
        <mesh position={[0, 0.095, 0]} material={boltMaterial}>
          <cylinderGeometry args={[0.005, 0.005, 0.035, 6]} />
        </mesh>
        <group position={[0, 0.112, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={bronzeMaterial}>
            <torusGeometry args={[0.034, 0.0045, 6, 20]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 3, Math.PI / 2]} material={bronzeMaterial}>
              <cylinderGeometry args={[0.003, 0.003, 0.068, 5]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

// Quarter-circle bend from a horizontal run (along the wall) down into a
// vertical run, centered on the shared bend point.
const BEND_QUATERNION = new THREE.Quaternion().setFromRotationMatrix(
  // Torus arcs start on local +x and sweep to local +y; map those to world +y
  // (up to the horizontal run) and -z (out to the vertical run).
  new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(-1, 0, 0)
  )
)

function Bend({ radius }) {
  return (
    <mesh position={[WALL_X, BEND_Y, BEND_Z]} quaternion={BEND_QUATERNION} material={getPipeMaterial()}>
      <torusGeometry args={[radius, PIPE_RADIUS, 12, 20, Math.PI / 2]} />
    </mesh>
  )
}

export default function Pipes() {
  return (
    <group>
      <Bend radius={OUTER_BEND} />
      <Bend radius={INNER_BEND} />
      {RUNS.map((run, i) => (
        <PipeRun key={i} {...run} />
      ))}
      {FLANGES.map((f, i) => (
        <Flange key={i} {...f} />
      ))}
      <Valve at={[WALL_X, UPPER_Y, VALVE_Z]} />
    </group>
  )
}
