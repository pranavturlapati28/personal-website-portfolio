import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildCity,
  makeBeaconMaterial,
  makeBuildingMaterial,
  makeGlowMaterial,
  makeGroundMaterial,
  makeSkyMaterial,
} from '../lib/nycCity'

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const SKY_RADIUS = 900

// The New York skyline outside the window, as real 3D geometry: thousands of
// instanced buildings with lit windows, the landmarks, glowing streets, and
// blinking beacons. It only draws through the window's stencil mask.
export default function City({ stencilRef }) {
  const gl = useThree((state) => state.gl)
  const city = useMemo(buildCity, [])
  const materials = useMemo(
    () => ({
      building: makeBuildingMaterial(stencilRef),
      glow: makeGlowMaterial(stencilRef),
      ground: makeGroundMaterial(stencilRef),
      sky: makeSkyMaterial(stencilRef),
      beacon: makeBeaconMaterial(stencilRef),
    }),
    [stencilRef]
  )

  const blocksRef = useRef()
  useLayoutEffect(() => {
    const mesh = blocksRef.current
    city.blocks.matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceColor = new THREE.InstancedBufferAttribute(city.blocks.params, 3)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [city])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    materials.ground.uniforms.uTime.value = t
    materials.building.uniforms.uTime.value = t
    materials.beacon.uniforms.uTime.value = t
    materials.beacon.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return (
    <group>
      <mesh material={materials.sky}>
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      </mesh>
      <mesh geometry={city.ground} material={materials.ground} />
      <instancedMesh
        ref={blocksRef}
        args={[UNIT_BOX, materials.building, city.blocks.matrices.length]}
        frustumCulled={false}
      />
      <mesh geometry={city.landmarkFacades} material={materials.building} />
      <mesh geometry={city.glows} material={materials.glow} />
      <points geometry={city.beacons} material={materials.beacon} frustumCulled={false} />
    </group>
  )
}
