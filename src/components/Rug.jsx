import React, { useMemo } from 'react'
import * as THREE from 'three'

// A low-poly purple rug on the floor in front of the desk, in the desk group's
// space: a twelve-sided slab with beveled edges and a lighter inset line.
const FLOOR_Y = 0.1 // top of the floor boards
const CENTER = [1.35, FLOOR_Y, 0]
const RADIUS = 0.85
const THICKNESS = 0.022
const BEVEL = 0.03
const SIDES = 12
const LINE_INSET = 0.035
const LINE_WIDTH = 0.012

const rugMaterial = new THREE.MeshStandardMaterial({ color: '#8b77c4', roughness: 0.95, flatShading: true })
const lineMaterial = new THREE.MeshStandardMaterial({ color: '#c3aef0', roughness: 0.95, flatShading: true })

export default function Rug() {
  const slab = useMemo(() => {
    // Lathed profile: flat bottom, short vertical edge, then a bevel up to the top.
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(RADIUS, 0),
      new THREE.Vector2(RADIUS, THICKNESS * 0.45),
      new THREE.Vector2(RADIUS - BEVEL, THICKNESS),
      new THREE.Vector2(0, THICKNESS),
    ]
    return new THREE.LatheGeometry(profile, SIDES)
  }, [])

  const outer = RADIUS - BEVEL - LINE_INSET
  return (
    <group position={CENTER}>
      <mesh geometry={slab} material={rugMaterial} />
      {/* Inset line, aligned with the slab's flat sides. */}
      <mesh position={[0, THICKNESS + 0.0005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={lineMaterial}>
        <ringGeometry args={[outer - LINE_WIDTH, outer, SIDES, 1]} />
      </mesh>
    </group>
  )
}
