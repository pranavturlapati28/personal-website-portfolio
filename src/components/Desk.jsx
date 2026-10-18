import React, { Suspense, useEffect, useMemo, useState, useRef } from 'react'
import { useGLTF, useCursor, useVideoTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { addPlanarUVs, makeChamferedBlock, makeWoodTexture, seededRandom, subtractOpening } from '../lib/lowPoly'
import Mug from './Mug'
import Pipes from './Pipes'
import Window, { WINDOW_OPENING } from './Window'

// Monitor's front (blue) screen face in the desk group's space: it faces +x,
// spans 0.286 units square, and is centered at y = 1.383, z = 0.
const MONITOR_SCREEN_X = 0.5115
const MONITOR_SCREEN_SIZE = 0.286
const MONITOR_SCREEN_TOP = 1.383 + MONITOR_SCREEN_SIZE / 2
// The two stacked videos (0.1 + 0.146 tall) plus this gap leave equal margins.
const SCREEN_GAP = 0.006
const SCREEN_MARGIN = (MONITOR_SCREEN_SIZE - 0.16 / (2880 / 1800) - SCREEN_GAP - 0.22 / (1126 / 748)) / 2

// Name of the brick material in desk.glb, and the red-brick hue to paint it.
const BRICK_MATERIAL = 'Material.001'
const BRICK_HUE = 0.03
// Brick pieces left around the window thinner than this are dropped.
const MIN_BRICK_PIECE = 0.025
// Material shared by the floor boards in desk.glb.
const FLOOR_MATERIAL = 'Material.005'
// The model's straight pipe runs, and the material on its pipe elbows.
const PIPE_RUNS_MESH = 'Cylinder026'
const PIPE_ELBOW_MATERIAL = 'Material.013'
// The model's desk top (two overlapping slabs), replaced by a low-poly slab.
const DESK_TOP_MESHES = ['Cylinder001', 'Cylinder002']
const DESK_TOP_CENTER = [0.701, 1.095, 0]
const DESK_TOP_SIZE = [1.252, 0.094, 2.0] // depth (x), thickness (y), width (z)
const DESK_TOP_PLANKS = 1
// The monitor's blue screen mesh.
const MONITOR_SCREEN_MESH = 'Cube009_3'

// The desk top as low-poly wood running the desk's width (one slab by
// default), with chamfered edges, flat shading, and a hand-painted grain.
function DeskTop() {
  const planks = useMemo(() => {
    const rand = seededRandom(5)
    const wood = makeWoodTexture(9)
    const [depth, thick, width] = DESK_TOP_SIZE
    const plankDepth = depth / DESK_TOP_PLANKS
    return Array.from({ length: DESK_TOP_PLANKS }, (_, i) => {
      // Built with its length along local x so the grain (u) follows the plank,
      // then turned to run along the desk's width.
      const box = new THREE.Box3(
        new THREE.Vector3(-width / 2, -thick / 2, -plankDepth / 2),
        new THREE.Vector3(width / 2, thick / 2, plankDepth / 2)
      )
      const geometry = addPlanarUVs(makeChamferedBlock(box, rand, { bevel: 0.2, jitter: 0.05, gap: 0.04 }))
      const map = wood.clone()
      const material = new THREE.MeshStandardMaterial({ map, flatShading: true, roughness: 0.8 })
      material.color.setHSL(0.08, 0.25, 0.85)
      const x = DESK_TOP_CENTER[0] - depth / 2 + plankDepth * (i + 0.5)
      return { geometry, material, x }
    })
  }, [])

  return planks.map(({ geometry, material, x }, i) => (
    <mesh
      key={i}
      geometry={geometry}
      material={material}
      position={[x, DESK_TOP_CENTER[1], DESK_TOP_CENTER[2]]}
      rotation={[0, Math.PI / 2, 0]}
    />
  ))
}

// A video drawn on a plane just in front of the screen glass, so it stays
// locked to the monitor at any window size or camera angle.
function ScreenVideo({ src, width, aspect, centerY }) {
  const texture = useVideoTexture(src, { muted: true, loop: true, playsInline: true })
  return (
    <mesh position={[MONITOR_SCREEN_X + 0.001, centerY, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

export default function Desk({ onNotebookClick }) {
  const { scene, nodes } = useGLTF(import.meta.env.BASE_URL + 'desk.glb')

  // The wall's bricks share one white, smooth material in the model. Swap each
  // brick for a chunky low-poly stone in its own red-brick shade.
  useMemo(() => {
    const rand = seededRandom(7)
    // Bricks are checked against the window opening in the scene's own space,
    // which matches the desk group's space used by <Window />.
    scene.updateMatrixWorld(true)
    const sceneInverse = scene.matrixWorld.clone().invert()
    scene.traverse((obj) => {
      if (!obj.isMesh || obj.material?.name !== BRICK_MATERIAL || obj.userData.lowPolyStone) return
      obj.geometry.computeBoundingBox()
      const toScene = sceneInverse.clone().multiply(obj.matrixWorld)
      const toLocal = toScene.clone().invert()
      // Trim bricks around the window, dropping slivers too thin to read.
      const pieces = subtractOpening(obj.geometry.boundingBox.clone().applyMatrix4(toScene), WINDOW_OPENING)
        .filter((box) => box.max.y - box.min.y > MIN_BRICK_PIECE && box.max.z - box.min.z > MIN_BRICK_PIECE)
        .map((box) => makeChamferedBlock(box.applyMatrix4(toLocal), rand))
      if (pieces.length === 0) {
        obj.visible = false
        return
      }
      obj.geometry = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces)
      const t = rand()
      obj.material = obj.material.clone()
      obj.material.flatShading = true
      obj.material.color.setHSL(BRICK_HUE + (t - 0.5) * 0.02, 0.55, 0.3 + (t - 0.5) * 0.08)
      obj.userData.lowPolyStone = true
    })

    // Matte floor: the boards' material is glossy in the model.
    scene.traverse((obj) => {
      if (!obj.isMesh || obj.material?.name !== FLOOR_MATERIAL) return
      obj.material.roughness = 0.9
      obj.material.metalness = 0
    })

    // <DeskTop /> replaces the model's plain desk top; brighten the screen.
    scene.traverse((obj) => {
      if (DESK_TOP_MESHES.includes(obj.name)) obj.visible = false
      if (obj.name === MONITOR_SCREEN_MESH) obj.material.emissiveIntensity = 1.8
    })

    // <Pipes /> redraws the pipes lower down, so hide the model's pipe runs
    // and elbow bends.
    scene.traverse((obj) => {
      if (obj.name === PIPE_RUNS_MESH) obj.visible = false
      if (obj.isMesh && obj.material?.name === PIPE_ELBOW_MATERIAL) obj.visible = false
    })
  }, [scene])
  const needle1Ref = useRef()
  const needle2Ref = useRef()

  const [hoveredText001, setHoveredText001] = useState(false)
  const [hoveredText002, setHoveredText002] = useState(false)
  const [hoveredText003, setHoveredText003] = useState(false)
  const [hoveredText004, setHoveredText004] = useState(false)
  useCursor(hoveredText001 || hoveredText002 || hoveredText003 || hoveredText004)

  const baseScale = 0.2


  const angle1 = useRef(0)
  const targetAngle1 = useRef(0)

  const angle2 = useRef(0)
  const targetAngle2 = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      targetAngle1.current = Math.random() * 2 * Math.PI
      targetAngle2.current = Math.random() * 2 * Math.PI
    }, 2000)

    return () => clearInterval(interval)
  }, [nodes])

  useFrame(() => {
    angle1.current = THREE.MathUtils.lerp(angle1.current, targetAngle1.current, 0.05)
    angle2.current = THREE.MathUtils.lerp(angle2.current, targetAngle2.current, 0.05)

    if (needle1Ref.current) needle1Ref.current.rotation.x = angle1.current
    if (needle2Ref.current) needle2Ref.current.rotation.x = angle2.current
  })

  return (
    <group
      scale={1}
      position={[0, -1, 0]}
      rotation={[0, Math.PI * 3 / 2, 0]}
    >
      {/* 🖥 Monitor */}
      <primitive
        object={nodes.Text003}
        scale={hoveredText003 ? baseScale * 1.2 : baseScale}
        onClick={() => window.open('https://www.linkedin.com/in/pranavturlapati/', '_blank')}
        onPointerOver={() => setHoveredText003(true)}
        onPointerOut={() => setHoveredText003(false)}
      />

      {/* 🎨 Canvas */}
      <primitive
        object={nodes.Text004}
        scale={hoveredText004 ? baseScale * 1.1 : baseScale}
        onClick={() => onNotebookClick()}
        onPointerOver={() => setHoveredText004(true)}
        onPointerOut={() => setHoveredText004(false)}
      />

      {/* 📓 GitHub */}
      <primitive
        object={nodes.Text001}
        scale={hoveredText001 ? baseScale * 1.1 : baseScale}
        onClick={() => window.open('https://github.com/pranavturlapati28', '_blank')}
        onPointerOver={() => setHoveredText001(true)}
        onPointerOut={() => setHoveredText001(false)}
      />

      {/* 📧 Email */}
      <primitive
        object={nodes.Text002}
        scale={hoveredText002 ? baseScale * 1.1 : baseScale}
        onClick={() => window.open('mailto:pranavturlapati02@gmail.com')}
        onPointerOver={() => setHoveredText002(true)}
        onPointerOut={() => setHoveredText002(false)}
      />

      {/* 💻 Videos rendered as textures on the monitor's screen. Their own
          Suspense keeps the desk visible while the videos load. */}
      <Suspense fallback={null}>
      <ScreenVideo
        src={import.meta.env.BASE_URL + 'basket.mp4'}
        width={0.16}
        aspect={2880 / 1800}
        centerY={MONITOR_SCREEN_TOP - SCREEN_MARGIN - 0.16 / (2880 / 1800) / 2}
      />
      <ScreenVideo
        src={import.meta.env.BASE_URL + 'video.mp4'}
        width={0.22}
        aspect={1126 / 748}
        centerY={MONITOR_SCREEN_TOP - SCREEN_MARGIN - 0.16 / (2880 / 1800) - SCREEN_GAP - 0.22 / (1126 / 748) / 2}
      />
      </Suspense>


      {/* 🪵 Low-poly wooden desk top */}
      <DeskTop />

      {/* ☕ Coffee (or a beer on Fridays) */}
      <Mug />

      {/* 💡 Soft glow from the monitor onto the desk and keyboard */}
      <pointLight
        position={[MONITOR_SCREEN_X + 0.25, 1.3, 0]}
        color="#b8c8ff"
        intensity={0.3}
        distance={0.9}
        decay={2}
      />

      {/* 🪟 Window set into the brick wall, with a ledge */}
      <Window />

      {/* 🔧 Painted pipes with flanges and a valve */}
      <Pipes />

      {/* 🔁 Needle animation */}
      <primitive ref={needle1Ref} object={nodes.Cube136} />
      <primitive ref={needle2Ref} object={nodes.Cube137} />

      <primitive object={scene} />
    </group>
  )
}
