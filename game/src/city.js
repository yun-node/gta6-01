// city.js — builds Solmar: a sun-soaked coastal grid city, and the low-poly
// car / character factories every other system shares. Also owns collision AABBs.
import * as THREE from 'three';
import { mulberry32, pick } from './utils.js';

export const ROAD_SPACING = 52;      // distance between road centre lines
export const ROAD_HALF = 7;          // half width of a road
export const CITY_EXTENT = 182;      // roads run -182..182, blocks between them
export const BEACH_Z = 210;          // ocean starts past this

const BUILDING_COLORS = [0xd8c9a3, 0xc9b8a0, 0xb8c4d4, 0xe0a080, 0x9fb8a0, 0xd4b8c8, 0xa8b8d0, 0xe8d8b0];
const ROOF_COLORS = [0x8a6f5c, 0x5c7a8a, 0x7a5c6e, 0x6e8a5c];
const CAR_COLORS = [0xd43a2f, 0x2f6fd4, 0xf2c230, 0x28a06a, 0x7a3fd4, 0xe8e8e8, 0x222831, 0xe07a2f];

export function buildCity(scene, rng) {
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grass-green city slab, sand band, blue ocean to the south.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EXTENT * 2 + 120, CITY_EXTENT * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x6f9e5a }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 20); group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EXTENT * 2 + 120, 46),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, BEACH_Z + 8); group.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EXTENT * 2 + 240, 120),
    new THREE.MeshLambertMaterial({ color: 0x2a7fc4 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.01, BEACH_Z + 78); group.add(ocean);

  // Roads: dark asphalt strips with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (let i = -3; i <= 3; i++) {
    const c = i * ROAD_SPACING;
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, CITY_EXTENT * 2 + 20), roadMat);
      road.rotation.x = -Math.PI / 2; road.rotation.z = vertical ? 0 : Math.PI / 2;
      road.position.set(vertical ? c : 0, 0.05, vertical ? 0 : c); group.add(road);
      for (let d = -CITY_EXTENT; d <= CITY_EXTENT; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.rotation.z = vertical ? 0 : Math.PI / 2;
        dash.position.set(vertical ? c : d, 0.07, vertical ? d : c); group.add(dash);
      }
    }
  }
  // Sidewalks: pale strips along each road edge.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (let i = -3; i <= 3; i++) {
    const c = i * ROAD_SPACING;
    for (const off of [-ROAD_HALF - 2, ROAD_HALF + 2]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(4, CITY_EXTENT * 2 + 20), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(c + off, 0.06, 0); group.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EXTENT * 2 + 20, 4), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(0, 0.06, c + off); group.add(s2);
    }
  }

  // Buildings: one or two low-poly towers per block, with lit windows and roofs.
  const winMat = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0x554411 });
  for (let bx = -3; bx < 3; bx++) {
    for (let bz = -3; bz < 3; bz++) {
      if (bx === 0 && bz === 0) continue; // central plaza
      const cx = bx * ROAD_SPACING + ROAD_SPACING / 2;
      const cz = bz * ROAD_SPACING + ROAD_SPACING / 2;
      const n = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = 12 + rng() * 10, d = 12 + rng() * 10;
        const h = 10 + rng() * rng() * 46;
        const ox = n === 2 ? (k === 0 ? -9 : 9) : 0;
        const oz = n === 2 ? (k === 0 ? -7 : 7) : 0;
        const x = cx + ox, z = cz + oz;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ color: pick(rng, BUILDING_COLORS) }));
        body.position.set(x, h / 2, z); group.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1),
          new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }));
        roof.position.set(x, h + 0.5, z); group.add(roof);
        // window strips
        const rows = Math.max(1, Math.floor(h / 6));
        for (let r = 0; r < rows; r++) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.9, 0.2), winMat);
          strip.position.set(x, 4 + r * 6, z + d / 2 + 0.1); group.add(strip);
        }
        if (h > 34) { // rooftop beacon on towers
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4040 }));
          beacon.position.set(x, h + 2, z); beacon.name = 'beacon'; group.add(beacon);
        }
        colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
      }
    }
  }

  // Central plaza: fountain + palms + benches.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb8d8 }));
  plaza.position.set(26, 0.6, 26); group.add(plaza);
  colliders.push({ minX: 16, maxX: 36, minZ: 16, maxZ: 36 });

  // Palm trees along the beach and plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  function palm(x, z) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    t.position.set(x, 3.5, z); group.add(t);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.6, 7.4, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
  }
  for (let x = -170; x <= 170; x += 28) palm(x + rng() * 6, BEACH_Z + 4 + rng() * 8);
  palm(14, 14); palm(38, 38); palm(14, 38); palm(38, 14);

  // Street lamps on the main roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (let i = -3; i <= 3; i++) {
    for (let d = -150; d <= 150; d += 52) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), lampMat);
      pole.position.set(i * ROAD_SPACING + ROAD_HALF + 1.5, 3, d); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lampGlow);
      bulb.position.set(i * ROAD_SPACING + ROAD_HALF + 1.5, 6.2, d); group.add(bulb);
    }
  }

  // Landmark names as floating signs (canvas textures, local only).
  function sign(text, x, y, z, color) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = color || '#12324a'; c.fillRect(0, 0, 512, 96);
    c.fillStyle = '#ffd23e'; c.font = 'bold 52px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 52);
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 5),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); group.add(m);
  }
  sign('SOLMAR  ·  PALM BOULEVARD', 0, 14, -156);
  sign('MARINA PIER', -60, 12, BEACH_Z - 6);
  sign('DOWNTOWN SOLMAR', 26, 30, 26);

  return { group, colliders, rng };
}

// --- Car factory: low-poly box car, returns {group, wheels[], color} ---
export function makeCar(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xffffff : 0x223344 }));
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const wheels = [];
  for (const [x, z] of [[-1, 1.45], [1, 1.45], [-1, -1.45], [1, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
  hl.position.set(0, 0.7, 2.22); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  tl.position.set(0, 0.7, -2.22); g.add(tl);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.75, -0.2); bar.name = 'lightbar'; g.add(bar);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    badge.position.set(0, 0.65, 0.4); g.add(badge);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, wheels };
}
export function randomCarColor(rng) { return pick(rng, CAR_COLORS); }

// --- Character factory: simple low-poly person ---
export function makePerson(shirt, pants, skin) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin ?? 0xd9a077 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), skinMat);
  head.position.y = 1.62; g.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.4), shirtMat);
  torso.position.y = 1.05; g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.32), pantsMat);
  legL.position.set(-0.18, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), shirtMat);
  armL.position.set(-0.48, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48; g.add(armR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legL, legR, armL, armR };
}

// Push a circle (x,z,r) out of building AABBs; returns corrected position.
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-6) { x = c.maxX + r; continue; }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r; z = nz + (dz / d) * r;
    }
  }
  return { x, z };
}
export function inCityBounds(x, z) {
  return { x: Math.max(-CITY_EXTENT - 8, Math.min(CITY_EXTENT + 8, x)),
           z: Math.max(-CITY_EXTENT - 8, Math.min(BEACH_Z + 22, z)) };
}
