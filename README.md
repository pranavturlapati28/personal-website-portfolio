# pranavturlapati.com

Personal portfolio: an interactive 3D desk built with React Three Fiber. Click the notebook (or **About Me**) to zoom in on the bio, experience, projects, and publications.

## Stack
React 19, Three.js, @react-three/fiber and drei, Vite, deployed on Vercel.

## Run locally
```bash
npm install
npm run dev
```

## Project layout
- `src/App.jsx`: top bar, 3D canvas, and the camera zoom into the notebook
- `src/components/Desk.jsx`: loads `public/desk.glb` and wires up the clickable labels
- `src/components/NotebookOverlay.jsx`: notebook content (bio, experience, projects, publications)
- `public/`: assets served as-is (3D model, videos, images, resume PDF)
- `blender/`: Blender source for the scene (not deployed)

To update the resume, replace `public/Pranav_Turlapati_Resume.pdf`.
