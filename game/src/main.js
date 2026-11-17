// main.js — Solmar Heat: boots the renderer, owns the game state machine
// (menu / playing / paused / busted / wasted), and wires every system together.
import * as THREE from 'three';
import { mulberry32 } from './utils.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity, Car } from './city.js';
import { Player } from './player.js';
import { VehicleManager } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { loadSave, writeSave, saveSummary } from './save.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261118);
const shot = params.get('shot') || '';
const rng = mulberry32(seed);

// ---------- Renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x9fc8e8, 220, 620);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 40, 180);

const sun = new THREE.DirectionalLight(0xfff2cc, 2.4);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x5a7a4a, 1.1));

// ---------- World ----------
const { colliders } = buildCity(scene, rng);
const input = new Input(canvas);
const audio = new AudioSys();
const hud = new HUD();
const player = new Player(scene);
const vehicles = new VehicleManager(scene, rng);
const traffic = new Traffic(scene, rng);
const pedestrians = new Pedestrians(scene, rng);
const police = new Police(scene, vehicles, rng);
const combat = new Combat(scene);
const missions = new MissionManager(scene);

// The gold Comet for mission 3, parked by the plaza.
const comet = new Car(scene, 34, 20, Math.PI, 0xffd700);
vehicles.cars.push(comet);

// ---------- Game state ----------
const G = {
  state: 'menu',           // menu | playing | paused | busted | wasted
  money: 40,
  missionIndex: 0,
  missionsDone: 0,
  inCar: false,
  wantedFlashT: 0,
};
missions.index = 0;

function playerPos() {
  return G.inCar && vehicles.driven ? vehicles.driven.pos : player.pos;
}

function showScreen(id) {
  for (const s of ['menu', 'pause', 'busted', 'wasted']) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  if (!id) for (const s of ['menu', 'pause', 'busted', 'wasted']) document.getElementById(s).classList.add('hidden');
}

function setState(s) {
  G.state = s;
  if (s === 'playing') { showScreen(null); hud.show(); }
  else if (s === 'paused') { showScreen('pause'); }
  else if (s === 'menu') { showScreen('menu'); hud.hide(); }
  else if (s === 'busted' || s === 'wasted') { showScreen(s); hud.hide(); }
}

function saveGame() {
  writeSave({ money: G.money, missionIndex: missions.index, missionsDone: G.missionsDone, health: player.health, playerPos: player.pos });
}

// ---------- Mission hooks ----------
const missionHooks = {
  onStart(m, active) {
    hud.toast(m.brief, 5000);
    audio.pickup();
    if (m.wantedOnStart) police.setWanted(m.wantedOnStart);
    if (m.setup === 'shootout') {
      const base = m.target;
      for (let i = 0; i < (m.enemies || 4); i++) {
        combat.spawnEnemy(base.x + (rng() - 0.5) * 24, base.z + (rng() - 0.5) * 24, 60);
      }
    }
    if (m.setup === 'chase') {
      hud.toast('Every cop in Solmar is coming. DRIVE!', 4000);
    }
  },
  onPhase(phase, m) {
    if (phase === 'escape') hud.toast('Car secured! Now lose the heat and reach the hideout.', 4000);
  },
  isWantedClear: () => police.wanted === 0,
  onComplete(m) {
    G.money += m.reward;
    G.missionsDone += 1;
    audio.missionDone();
    hud.toast(`JOB DONE — +$${m.reward}`, 4000);
    combat.clearEnemies();
    police.setWanted(Math.max(0, police.wanted - 2));
    saveGame();
    if (missions.done) hud.toast('ALL JOBS DONE — Solmar is yours, Rico!', 6000);
  },
  onFail(reason) {
    audio.missionFail();
    hud.toast(`JOB FAILED — ${reason} Press N to retry.`, 4000);
    combat.clearEnemies();
  },
};

function startMission(i) {
  const m = missions.start(i, missionHooks);
  if (m) hud.setHint('');
  return m;
}

// ---------- Flow ----------
function startGame(fromSave) {
  audio.ensure();
  const save = fromSave ? loadSave() : null;
  if (save) {
    G.money = save.money; missions.index = save.missionIndex; G.missionsDone = save.missionsDone || 0;
    player.health = save.health ?? 100;
    player.pos.set(save.px ?? 0, 0, save.pz ?? 96);
  } else {
    G.money = 40; missions.index = 0; G.missionsDone = 0;
    player.health = 100; player.pos.set(0, 0, 96);
  }
  player.camYaw = Math.PI; player.yaw = Math.PI;
  police.clearAll(); combat.clearEnemies();
  setState('playing');
  if (missions.index < MISSIONS.length) {
    hud.toast(MISSIONS[missions.index].brief, 5000);
  }
  stageShot();
}

function bustPlayer() {
  const fine = Math.min(G.money, 150);
  G.money -= fine;
  audio.missionFail();
  police.clearAll();
  document.getElementById('endStats').innerHTML =
    `Bail: -$${fine} &nbsp;·&nbsp; Cash left: $${Math.round(G.money)} &nbsp;·&nbsp; Jobs done: ${G.missionsDone}/5`;
  player.health = 100;
  if (G.inCar) exitCar();
  player.pos.set(0, 0, 96); player.camYaw = Math.PI;
  saveGame();
  setState('busted');
}
function wastePlayer() {
  const fee = Math.min(G.money, 100);
  G.money -= fee;
  audio.missionFail();
  police.clearAll(); combat.clearEnemies();
  document.getElementById('endStats2').innerHTML =
    `Hospital bill: -$${fee} &nbsp;·&nbsp; Cash left: $${Math.round(G.money)} &nbsp;·&nbsp; Jobs done: ${G.missionsDone}/5`;
  player.health = 100;
  if (G.inCar) exitCar();
  player.pos.set(0, 0, 96); player.camYaw = Math.PI;
  saveGame();
  setState('wasted');
}

// ---------- Car enter / exit ----------
function enterCar(car) {
  vehicles.enter(car);
  G.inCar = true;
  player.camYaw = car.yaw;
  audio.door(); audio.engineStart(0);
  if (!car.stolen) {
    // stealing in the open draws the law
    police.addWanted(1, 'stolen car');
    hud.toast('Car stolen! The cops noticed — lose them!', 3000);
  }
  if (missions.active && missions.active.def === MISSIONS[2] && car === comet) {
    police.addWanted(1, 'gold comet');
  }
}
function exitCar() {
  const car = vehicles.exit();
  G.inCar = false;
  audio.engineStop();
  if (car) {
    player.pos.set(car.pos.x + Math.sin(car.yaw + Math.PI / 2) * 2.5, 0, car.pos.z + Math.cos(car.yaw + Math.PI / 2) * 2.5);
    player.mesh.position.copy(player.pos);
  }
}

// ---------- Deterministic screenshot staging (?shot=) ----------
function stageShot() {
  if (!shot) return;
  if (shot === 'menu') { setState('menu'); return; }
  if (shot === 'street') {
    player.pos.set(-9, 0, 52); player.camYaw = Math.PI * 0.92;
    return;
  }
  if (shot === 'chase') {
    // Rico in a car, 3-star wanted, police closing in, mission 5 live.
    const car = vehicles.cars[vehicles.cars.length - 2]; // starter car
    car.pos.set(0, 0, 60); car.yaw = Math.PI; car.speed = 18;
    car.mesh.position.copy(car.pos); car.mesh.rotation.y = car.yaw;
    enterCar(car);
    police.setWanted(3);
    startMission(4);
    return;
  }
  if (shot === 'mission') {
    // Dockside shootout: Rico on foot, enemies in sight, 2 stars.
    player.pos.set(-84, 0, 132); player.camYaw = Math.PI * 0.78;
    police.setWanted(2);
    startMission(3);
    return;
  }
}

// ---------- UI wiring ----------
document.getElementById('btnPlay').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => setState('playing'));
document.getElementById('btnSaveQuit').addEventListener('click', () => { saveGame(); setState('menu'); refreshMenu(); });
document.getElementById('btnBustedRetry').addEventListener('click', () => setState('playing'));
document.getElementById('btnBustedMenu').addEventListener('click', () => { setState('menu'); refreshMenu(); });
document.getElementById('btnWastedRetry').addEventListener('click', () => setState('playing'));
document.getElementById('btnWastedMenu').addEventListener('click', () => { setState('menu'); refreshMenu(); });

function refreshMenu() {
  const s = saveSummary();
  document.getElementById('saveNote').textContent = s ? `Saved game: ${s}` : 'No saved game yet — your progress autosaves after every job.';
  document.getElementById('btnContinue').style.display = s ? '' : 'none';
}
refreshMenu();
if (shot === 'menu') {
  // keep the menu up but render the city behind it
  setState('menu');
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let menuOrbit = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (G.state === 'menu') {
    // slow cinematic orbit over Solmar behind the menu
    menuOrbit += dt * 0.05;
    camera.position.set(Math.sin(menuOrbit) * 150, 55, Math.cos(menuOrbit) * 150);
    camera.lookAt(0, 8, 20);
    traffic.update(dt, player.pos, null);
    pedestrians.update(dt);
    renderer.render(scene, camera);
    return;
  }
  if (G.state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape')) setState('playing');
    renderer.render(scene, camera);
    return;
  }
  if (G.state !== 'playing') { renderer.render(scene, camera); return; }

  // --- global keys ---
  if (input.pressed('KeyP') || input.pressed('Escape')) { setState('paused'); return; }
  if (input.pressed('KeyM')) { const m = audio.toggleMute(); hud.toast(m ? 'Sound muted' : 'Sound on', 1200); }
  if (input.pressed('KeyN')) {
    if (!missions.active && !missions.done) startMission(missions.index);
    else if (!missions.active && missions.done) hud.toast('All jobs done — free roam!', 2000);
    else hud.toast('Finish the current job first.', 2000);
  }
  if (input.pressed('KeyR') && !G.inCar) { combat.reload(); hud.toast('Reloaded', 900); }

  // --- enter / exit car ---
  if (input.pressed('KeyE')) {
    if (G.inCar) exitCar();
    else {
      const car = vehicles.nearestCar(player.pos.x, player.pos.z, 5);
      if (car) enterCar(car);
      else hud.toast('No car close enough — walk up to one and press E.', 1800);
    }
  }

  const pos = playerPos();
  const anchor = G.inCar && vehicles.driven ? vehicles.driven.pos : player.pos;

  // --- update systems ---
  if (G.inCar) {
    player.update(dt, input, colliders, true);
    const crash = vehicles.update(dt, input, colliders, police.wanted);
    if (crash === 'crash') { audio.crash(); hud.toast('You clipped a building!', 1200); }
    audio.engineStart(Math.abs((vehicles.driven?.speed || 0) / 34));
  } else {
    player.update(dt, input, colliders, false);
    audio.engineStop();
  }
  traffic.update(dt, pos, vehicles.driven);
  pedestrians.update(dt);
  police.update(dt, pos, G.inCar, vehicles.driven,
    () => bustPlayer(),
    () => { audio.crash(); });
  combat.update(dt, pos, player.health > 0, (enemy, d) => {
    // enemy fire: hit chance falls with distance
    if (Math.random() < (d < 15 ? 0.55 : d < 30 ? 0.3 : 0.15)) {
      audio.enemyShoot();
      if (player.damage(6 + Math.random() * 6)) wastePlayer();
    }
  });

  // --- shooting ---
  if (!G.inCar && input.consumeClick()) {
    audio.ensure();
    const res = combat.shoot(camera, pos, (enemy) => {
      missions.onKill();
      G.money += 25;
      police.addWanted(1, 'shooting');
      pedestrians.scare(enemy.pos.x, enemy.pos.z, 30);
      hud.toast('Red Jack down — +$25', 1200);
    });
    if (res.empty) { hud.toast('Out of ammo — press R to reload', 1500); }
    else {
      audio.shoot();
      if (res.hit) audio.hit();
      else pedestrians.scare(pos.x, pos.z, 18);
    }
  }

  // --- missions ---
  missions.update(dt, pos, G.inCar, missionHooks);

  // --- camera ---
  player.updateCamera(camera, dt, anchor, 0);

  // --- audio: siren follows wanted level ---
  audio.siren(dt, police.wanted);

  // --- HUD ---
  const obj = missions.objectiveText();
  hud.update({
    money: G.money, wanted: police.wanted, health: player.health, ammo: combat.ammo,
    objective: obj, speed: G.inCar && vehicles.driven ? vehicles.driven.speed : 0,
    inCar: G.inCar, playing: true, px: pos.x, pz: pos.z, camYaw: player.camYaw,
    target: missions.targetPos(),
    traffic: traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
    police: police.chasers.map((c) => ({ x: c.pos.x, z: c.pos.z })),
  });
  // contextual hint
  if (!G.inCar) {
    const car = vehicles.nearestCar(player.pos.x, player.pos.z, 5);
    hud.setHint(car ? 'Press E to steal this car' : (missions.active ? '' : 'Press N to start the next job · E near a car to steal it'));
  } else {
    hud.setHint(missions.active ? '' : 'Press N to start the next job · E to get out');
  }

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Screenshot staging (?shot=chase|street|mission) auto-starts the game so a
// headless render shows live play; ?shot=menu stays on the start screen.
if (shot && shot !== 'menu') startGame(false);

frame();
