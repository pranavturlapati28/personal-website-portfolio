import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A small low-poly drink on the desk, in the desk group's space: a hexagonal
// mug of steaming coffee, or a beer on Fridays. Add ?drink=beer or
// ?drink=coffee to the URL to force one.
const DESK_SURFACE_Y = 1.142
const POSITION = [0.72, DESK_SURFACE_Y, -0.78]
const SCALE = 1.7
const SIDES = 6

const isFriday = () => {
  const forced = new URLSearchParams(window.location.search).get('drink')
  if (forced) return forced === 'beer'
  return new Date().getDay() === 5
}

// Hollow faceted vessel: outer wall, rim, inner wall, and floor, lathed with
// few sides so it reads as low poly.
function makeVessel({ bottom, top, height, wall, floor }) {
  const points = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(bottom, 0),
    new THREE.Vector2(top, height),
    new THREE.Vector2(top - wall, height),
    new THREE.Vector2(bottom - wall, floor),
    new THREE.Vector2(0, floor),
  ]
  return new THREE.LatheGeometry(points, SIDES, Math.PI / SIDES)
}

// Radius of the vessel's inside at height y.
const innerRadius = ({ bottom, top, height, wall, floor }, y) =>
  bottom - wall + ((top - bottom) * (y - floor)) / (height - floor)

// Half-ring handle on the mug's side (facing -z, toward the monitor's right).
function Handle({ radius, tube, y, x, material }) {
  return (
    <mesh position={[0, y, x]} rotation={[0, Math.PI / 2, 0]} material={material}>
      <torusGeometry args={[radius, tube, 4, 6, Math.PI]} />
    </mesh>
  )
}

// Small low-poly puffs that rise, swell, and fade, then start over.
function Steam({ y }) {
  const puffs = useRef([])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }),
    []
  )
  const materials = useMemo(() => [0, 1, 2, 3].map(() => material.clone()), [material])
  useFrame(({ clock }) => {
    puffs.current.forEach((puff, i) => {
      if (!puff) return
      const t = (clock.elapsedTime * 0.35 + i / 4) % 1
      puff.position.set(Math.sin(t * 6 + i * 2) * 0.008, y + t * 0.09, Math.cos(t * 5 + i) * 0.006)
      puff.scale.setScalar(0.006 + t * 0.012)
      puff.rotation.set(t * 2, t * 3 + i, 0)
      puff.material.opacity = Math.sin(t * Math.PI) * 0.35
    })
  })
  return materials.map((m, i) => (
    <mesh key={i} ref={(el) => (puffs.current[i] = el)} material={m}>
      <icosahedronGeometry args={[1, 0]} />
    </mesh>
  ))
}

const COFFEE_MUG = { bottom: 0.032, top: 0.036, height: 0.075, wall: 0.006, floor: 0.008 }
const BEER_MUG = { bottom: 0.032, top: 0.034, height: 0.1, wall: 0.005, floor: 0.012 }

function Coffee() {
  const { ceramic, coffee } = useMemo(
    () => ({
      ceramic: new THREE.MeshStandardMaterial({ color: '#efd9b4', roughness: 0.7, flatShading: true, side: THREE.DoubleSide }),
      coffee: new THREE.MeshStandardMaterial({ color: '#3b1c0e', roughness: 0.35, flatShading: true }),
    }),
    []
  )
  const vessel = useMemo(() => makeVessel(COFFEE_MUG), [])
  const surfaceY = COFFEE_MUG.height - 0.012
  return (
    <>
      <mesh geometry={vessel} material={ceramic} />
      <mesh position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, Math.PI / SIDES]} material={coffee}>
        <circleGeometry args={[innerRadius(COFFEE_MUG, surfaceY), SIDES]} />
      </mesh>
      <Handle radius={0.02} tube={0.006} y={0.038} x={-COFFEE_MUG.top - 0.002} material={ceramic} />
      <Steam y={COFFEE_MUG.height + 0.01} />
    </>
  )
}

function Beer() {
  const { glass, beer, foam } = useMemo(
    () => ({
      glass: new THREE.MeshStandardMaterial({
        color: '#f4f8ff',
        roughness: 0.15,
        transparent: true,
        opacity: 0.35,
        flatShading: true,
        depthWrite: false,
      }),
      beer: new THREE.MeshStandardMaterial({ color: '#f2a91c', emissive: '#7a4a00', emissiveIntensity: 0.25, roughness: 0.3, flatShading: true }),
      foam: new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.9, flatShading: true }),
    }),
    []
  )
  const vessel = useMemo(() => makeVessel(BEER_MUG), [])
  const beerTop = BEER_MUG.height - 0.02
  const r = innerRadius(BEER_MUG, beerTop)
  return (
    <>
      {/* Beer inside the glass: a faceted column up to the foam. */}
      <mesh position={[0, (BEER_MUG.floor + beerTop) / 2, 0]} rotation={[0, Math.PI / SIDES, 0]} material={beer}>
        <cylinderGeometry args={[r, innerRadius(BEER_MUG, BEER_MUG.floor), beerTop - BEER_MUG.floor, SIDES]} />
      </mesh>
      {/* Foam head spilling just over the rim. */}
      <mesh position={[0, beerTop + 0.012, 0]} rotation={[0, Math.PI / SIDES, 0]} material={foam}>
        <cylinderGeometry args={[BEER_MUG.top + 0.002, r, 0.024, SIDES]} />
      </mesh>
      <mesh position={[0.008, BEER_MUG.height + 0.006, -0.006]} scale={[0.022, 0.014, 0.02]} material={foam}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[-0.01, BEER_MUG.height + 0.004, 0.01]} scale={[0.018, 0.012, 0.018]} material={foam}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh geometry={vessel} material={glass} renderOrder={1} />
      <Handle radius={0.026} tube={0.007} y={0.05} x={-BEER_MUG.top - 0.002} material={glass} />
    </>
  )
}

export default function Mug() {
  const friday = useMemo(isFriday, [])
  return <group position={POSITION} scale={SCALE}>{friday ? <Beer /> : <Coffee />}</group>
}
