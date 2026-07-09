<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scan Viewer — Annotated 3D Inspection</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #14161a;
    --panel: #1b1e24;
    --panel-border: #2a2e37;
    --text: #e8e6e1;
    --text-dim: #8b8f99;
    --accent: #f2a63e;
    --accent-dim: #6b5227;
    --line: #5ee6c5;
    --danger: #e85c5c;
    --radius: 3px;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: 'Space Grotesk', system-ui, sans-serif;
    overflow: hidden;
  }
  #app { position: relative; width: 100vw; height: 100vh; }
  #viewer { position: absolute; inset: 0; }
  #viewer canvas { display: block; }

  /* ---- Top bar ---- */
  #topbar {
    position: absolute; top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px;
    background: linear-gradient(180deg, rgba(20,22,26,0.95), rgba(20,22,26,0));
    pointer-events: none;
    z-index: 10;
  }
  #topbar .brand { display: flex; align-items: baseline; gap: 10px; pointer-events: auto; }
  #topbar .brand .mark { color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: 0.08em; }
  #topbar .brand .name { font-weight: 700; font-size: 15px; letter-spacing: 0.01em; }
  #topbar .stat { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-dim); pointer-events: auto; }

  /* ---- Drop zone / loader ---- */
  #dropzone {
    position: absolute; inset: 0; z-index: 20;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 14px;
    background: var(--bg);
    transition: opacity 0.25s ease;
  }
  #dropzone.hidden { opacity: 0; pointer-events: none; }
  #dropzone .ring {
    width: 64px; height: 64px; border-radius: 50%;
    border: 1px solid var(--panel-border);
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace; color: var(--accent); font-size: 11px;
  }
  #dropzone h1 { font-size: 16px; font-weight: 600; margin: 0; }
  #dropzone p { font-size: 12px; color: var(--text-dim); margin: 0; max-width: 320px; text-align: center; line-height: 1.6; }
  #dropzone .filebtn {
    margin-top: 6px; padding: 9px 18px; border-radius: var(--radius);
    background: var(--accent); color: #1b1508; font-weight: 600; font-size: 12px;
    cursor: pointer; border: none; letter-spacing: 0.02em;
  }
  #dropzone.dragover { background: #1a1e18; }

  /* ---- Side panel (notes list) ---- */
  #panel {
    position: absolute; top: 0; right: 0; bottom: 0;
    width: 300px;
    background: var(--panel);
    border-left: 1px solid var(--panel-border);
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    z-index: 15;
  }
  #panel.open { transform: translateX(0); }
  #panel .panel-head {
    padding: 16px 18px 12px; border-bottom: 1px solid var(--panel-border);
  }
  #panel .panel-head .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent); letter-spacing: 0.12em; }
  #panel .panel-head h2 { font-size: 14px; margin: 4px 0 0; font-weight: 600; }
  #notesList { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; }
  #notesList li {
    padding: 10px 12px; margin-bottom: 4px; border-radius: var(--radius);
    cursor: pointer; border: 1px solid transparent;
  }
  #notesList li:hover { background: #22262e; border-color: var(--panel-border); }
  #notesList li.active { background: var(--accent-dim); border-color: var(--accent); }
  #notesList .tag {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent);
  }
  #notesList .txt { font-size: 12.5px; color: var(--text); margin-top: 3px; line-height: 1.4; }
  #notesList .empty { padding: 20px 12px; color: var(--text-dim); font-size: 12px; line-height: 1.6; }

  /* ---- Marker labels (CSS2D) ---- */
  .note-marker {
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--panel);
    border: 2px solid var(--accent);
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; user-select: none;
    box-shadow: 0 0 0 3px rgba(20,22,26,0.6);
    transition: transform 0.12s ease, background 0.12s ease;
  }
  .note-marker:hover, .note-marker.active { transform: scale(1.25); background: var(--accent); color: #1b1508; }

  .note-popup {
    position: absolute; transform: translate(14px, -50%);
    max-width: 220px; padding: 10px 12px;
    background: var(--panel); border: 1px solid var(--accent);
    border-radius: var(--radius); font-size: 12px; line-height: 1.5;
    pointer-events: none;
  }

  /* ---- Toggle button when panel closed ---- */
  #panelToggle {
    position: absolute; top: 16px; right: 16px; z-index: 16;
    background: var(--panel); border: 1px solid var(--panel-border);
    color: var(--text); padding: 8px 12px; border-radius: var(--radius);
    font-family: 'JetBrains Mono', monospace; font-size: 11px; cursor: pointer;
  }

  #fileInput { display: none; }
</style>
</head>
<body>
<div id="app">
  <div id="viewer"></div>

  <div id="topbar">
    <div class="brand"><span class="mark">◎</span><span class="name">Scan Viewer</span></div>
    <div class="stat" id="fileStat"></div>
  </div>

  <button id="panelToggle" style="display:none;">NOTES (<span id="noteCount">0</span>)</button>

  <div id="panel">
    <div class="panel-head">
      <div class="eyebrow">ANNOTATIONS</div>
      <h2>Notes on this scan</h2>
    </div>
    <ul id="notesList"><li class="empty">No file loaded yet.</li></ul>
  </div>

  <div id="dropzone">
    <div class="ring">GLB</div>
    <h1>Load an annotated scan</h1>
    <p>Drop a .glb file here, or choose one from disk. Lines and notes stored in the file's extras will render automatically.</p>
    <button class="filebtn" id="pickFile">Choose file</button>
    <input type="file" id="fileInput" accept=".glb,.gltf">
  </div>
</div>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------------------------------------------------------------
// EXPECTED DATA SCHEMA (produced by your annotation app on export)
// ---------------------------------------------------------------
// Document-level extras (gltf.asset.extras or root scene extras):
//   {
//     "notes": [
//       { "id": "n1", "line": "line_1", "t": 0.42, "text": "Crack visible here" },
//       { "id": "n2", "position": [0.1, 0.4, -0.2], "text": "Reference point" }
//     ]
//   }
// Lines are exported as separate nodes/meshes named "line_<id>" using
// a LINE_STRIP primitive (THREE turns these into THREE.Line automatically).
// "t" is 0..1 along the line's cumulative arc length. If a note gives an
// explicit "position" instead of line/t, that position is used directly.
// ---------------------------------------------------------------

const viewerEl = document.getElementById('viewer');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const pickFileBtn = document.getElementById('pickFile');
const fileStat = document.getElementById('fileStat');
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
const notesList = document.getElementById('notesList');
const noteCountEl = document.getElementById('noteCount');

let scene, camera, renderer, labelRenderer, controls;
let currentModel = null;
let markers = []; // { el, css2d, note }
let activePopup = null;

initThree();
animate();

// ---------- Three.js setup ----------
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(2, 1.6, 2.6);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  viewerEl.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  viewerEl.appendChild(labelRenderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const grid = new THREE.GridHelper(10, 20, 0x2a2e37, 0x22252b);
  scene.add(grid);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// ---------- File loading ----------
pickFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

['dragover', 'dragenter'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  fileStat.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const loader = new GLTFLoader();
    loader.parse(ev.target.result, '', (gltf) => {
      onModelLoaded(gltf);
    }, (err) => {
      console.error('Failed to parse GLB', err);
      alert('Could not load this file. Check that it is a valid .glb produced by the scan app.');
    });
  };
  reader.readAsArrayBuffer(file);
}

function onModelLoaded(gltf) {
  // Clear previous model + markers
  if (currentModel) scene.remove(currentModel);
  clearMarkers();

  currentModel = gltf.scene;
  scene.add(currentModel);
  frameCameraToObject(currentModel);

  // Pull document-level extras (notes)
  const rootExtras = gltf.parser.json.asset?.extras || gltf.parser.json.extras || {};
  let notes = rootExtras.notes || [];

  // Fallback: scan node userData for extras.notes attached per-node
  if (notes.length === 0) {
    currentModel.traverse((obj) => {
      if (obj.userData && obj.userData.notes) {
        notes = notes.concat(obj.userData.notes);
      }
    });
  }

  // Index line objects by name for t-based lookups
  const lineObjects = {};
  currentModel.traverse((obj) => {
    if (obj.isLine || obj.isLineSegments) {
      lineObjects[obj.name] = obj;
    }
  });

  buildMarkers(notes, lineObjects);
  buildNotesList(notes);

  dropzone.classList.add('hidden');
  panelToggle.style.display = 'block';
  if (notes.length > 0) panel.classList.add('open');
}

function frameCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.5, size * 0.6));
  camera.near = size / 100;
  camera.far = size * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

// ---------- Notes / markers ----------
function pointAtT(lineObject, t) {
  // Walk the line's vertex positions and interpolate by cumulative arc length
  const posAttr = lineObject.geometry.getAttribute('position');
  const pts = [];
  for (let i = 0; i < posAttr.count; i++) {
    pts.push(new THREE.Vector3().fromBufferAttribute(posAttr, i));
  }
  if (pts.length === 0) return new THREE.Vector3();
  if (pts.length === 1) return pts[0].clone();

  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const total = lengths[lengths.length - 1];
  const target = THREE.MathUtils.clamp(t, 0, 1) * total;

  for (let i = 1; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const segLen = lengths[i] - lengths[i - 1] || 1;
      const localT = (target - lengths[i - 1]) / segLen;
      return pts[i - 1].clone().lerp(pts[i], THREE.MathUtils.clamp(localT, 0, 1))
        .applyMatrix4(lineObject.matrixWorld);
    }
  }
  return pts[0].clone().applyMatrix4(lineObject.matrixWorld);
}

function resolveNotePosition(note, lineObjects) {
  if (note.position) return new THREE.Vector3(note.position[0], note.position[1], note.position[2]);
  if (note.line && lineObjects[note.line]) return pointAtT(lineObjects[note.line], note.t ?? 0);
  return null;
}

function clearMarkers() {
  markers.forEach(m => m.css2d.element.remove());
  markers = [];
  closePopup();
}

function buildMarkers(notes, lineObjects) {
  notes.forEach((note, i) => {
    const pos = resolveNotePosition(note, lineObjects);
    if (!pos) return;

    const el = document.createElement('div');
    el.className = 'note-marker';
    el.textContent = (i + 1).toString();
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectMarker(i);
    });

    const css2d = new CSS2DObject(el);
    css2d.position.copy(pos);
    currentModel.add(css2d);

    markers.push({ el, css2d, note });
  });
  noteCountEl.textContent = markers.length;
}

function buildNotesList(notes) {
  notesList.innerHTML = '';
  if (notes.length === 0) {
    notesList.innerHTML = '<li class="empty">This file has no notes attached — just geometry.</li>';
    return;
  }
  notes.forEach((note, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="tag">NOTE ${(i + 1).toString().padStart(2, '0')}</div><div class="txt">${escapeHtml(note.text || '(no text)')}</div>`;
    li.addEventListener('click', () => selectMarker(i));
    li.dataset.index = i;
    notesList.appendChild(li);
  });
}

function selectMarker(i) {
  markers.forEach((m, idx) => m.el.classList.toggle('active', idx === i));
  [...notesList.children].forEach((li, idx) => li.classList.toggle('active', idx === i));

  const m = markers[i];
  if (!m) return;
  panel.classList.add('open');
}

function closePopup() {
  if (activePopup) { activePopup.remove(); activePopup = null; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Panel toggle ----------
panelToggle.addEventListener('click', () => panel.classList.toggle('open'));
</script>
</body>
</html>
