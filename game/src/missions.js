// missions.js — Marisol Vega's job list: a 5-mission story arc with markers,
// timers, objectives and payouts. Missions drive the wanted system and combat.
import * as THREE from 'three';
import { dist2D } from './utils.js';

export const MISSIONS = [
  {
    name: '1 · FIRST WHEELS',
    brief: 'Marisol: "Rico, you need wheels. Grab any car on Palm Boulevard and bring it to the garage."',
    objective: 'Steal a car and drive it to the garage marker',
    target: { x: 52, z: 52 }, radius: 7, reward: 150, timeLimit: 0,
    needsCar: true, setup: 'drive',
  },
  {
    name: '2 · SUNSET DELIVERY',
    brief: 'Marisol: "A package for the Marina. No stops, no cops, 90 seconds. Go."',
    objective: 'Deliver the package to Marina Pier before the timer runs out',
    target: { x: -60, z: 195 }, radius: 7, reward: 250, timeLimit: 90,
    needsCar: false, setup: 'delivery',
  },
  {
    name: '3 · BORROWED WHEELS',
    brief: 'Marisol: "The gold Comet parked by the plaza belongs to a collector now. Take it — and lose the heat."',
    objective: 'Steal the gold Comet, then lose the police (wanted 0) at the hideout',
    target: { x: 26, z: 26 }, radius: 6, reward: 400, timeLimit: 0,
    needsCar: true, setup: 'steal', wantedOnSteal: 2,
    escapeTarget: { x: -156, z: -156 }, escapeRadius: 9,
  },
  {
    name: '4 · DOCKSIDE HEAT',
    brief: 'Marisol: "The Red Jacks jumped our dock deal. Clear them out — all of them."',
    objective: 'Take out all 4 Red Jacks at the docks',
    target: { x: -104, z: 156 }, radius: 12, reward: 500, timeLimit: 0,
    needsCar: false, setup: 'shootout', enemies: 4, wantedOnStart: 1,
  },
  {
    name: '5 · THE LONG CHASE',
    brief: 'Marisol: "Last job, Rico. Get the ledger to the north hideout — every cop in Solmar is coming."',
    objective: 'Reach the north hideout with the ledger while the police chase you',
    target: { x: 0, z: -156 }, radius: 8, reward: 1000, timeLimit: 150,
    needsCar: false, setup: 'chase', wantedOnStart: 3,
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.active = null;      // current mission runtime state
    this.marker = null;
    this.beacon = null;
    this.state = 'idle';     // idle | active | done
  }
  get current() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  start(index, hooks) {
    this.index = index;
    const m = MISSIONS[index];
    if (!m) { this.state = 'done'; this.active = null; this._clearMarker(); return null; }
    this.state = 'active';
    this.active = {
      def: m, timeLeft: m.timeLimit || 0, phase: 'go',
      kills: 0, killsNeeded: m.enemies || 0, inCarAtStart: false,
    };
    this._showMarker(m.target.x, m.target.z);
    hooks && hooks.onStart && hooks.onStart(m, this.active);
    return m;
  }
  _showMarker(x, z) {
    this._clearMarker();
    const geo = new THREE.CylinderGeometry(4.5, 4.5, 60, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(x, 30, z); this.scene.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.4, z);
    this.marker = ring; this.scene.add(ring);
  }
  _clearMarker() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
    if (this.marker) { this.scene.remove(this.marker); this.marker = null; }
  }
  moveMarker(x, z) { this._showMarker(x, z); }

  update(dt, playerPos, inCar, hooks) {
    if (this.state !== 'active' || !this.active) return;
    const a = this.active, m = a.def;
    if (this.beacon) this.beacon.rotation.y += dt * 1.2;
    if (this.marker) this.marker.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.08);
    if (a.timeLeft > 0) {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) { this.fail(hooks, 'Out of time.'); return; }
    }
    // Phase logic per mission type.
    if (m.setup === 'steal' && a.phase === 'go') {
      if (dist2D(playerPos.x, playerPos.z, m.target.x, m.target.z) < m.radius && inCar) {
        a.phase = 'escape';
        hooks && hooks.onPhase && hooks.onPhase('escape', m);
        this.moveMarker(m.escapeTarget.x, m.escapeTarget.z);
      }
    }
    const target = a.phase === 'escape' && m.escapeTarget ? m.escapeTarget : m.target;
    const radius = a.phase === 'escape' && m.escapeRadius ? m.escapeRadius : m.radius;
    if (m.setup === 'shootout') {
      if (a.kills >= a.killsNeeded) { this.complete(hooks); return; }
      return; // reaching the marker is not enough; the kills finish it
    }
    if (m.setup === 'steal' && a.phase === 'escape') {
      if (dist2D(playerPos.x, playerPos.z, target.x, target.z) < radius && hooks.isWantedClear && hooks.isWantedClear()) {
        this.complete(hooks); return;
      }
      return;
    }
    if (m.setup === 'chase' || m.setup === 'delivery' || m.setup === 'drive' || (m.setup === 'steal' && a.phase === 'go')) {
      const ok = dist2D(playerPos.x, playerPos.z, target.x, target.z) < radius;
      const carOk = !m.needsCar || inCar;
      if (ok && carOk) { this.complete(hooks); return; }
    }
  }
  onKill() { if (this.active) this.active.kills += 1; }
  complete(hooks) {
    const m = this.active.def;
    this.state = 'idle'; this.active = null; this._clearMarker();
    this.index += 1;
    hooks && hooks.onComplete && hooks.onComplete(m);
  }
  fail(hooks, reason) {
    this.state = 'idle'; this.active = null; this._clearMarker();
    hooks && hooks.onFail && hooks.onFail(reason);
  }
  objectiveText() {
    if (this.done) return { name: 'SOLMAR IS YOURS', text: 'All jobs done. Free roam — cause trouble, lose the heat, repeat.', timeLeft: 0 };
    if (!this.active) return { name: this.current.name, text: 'Press N to start the next job.', timeLeft: 0 };
    const a = this.active;
    let text = a.def.objective;
    if (a.def.setup === 'shootout') text += ` — ${a.kills}/${a.killsNeeded} down`;
    if (a.phase === 'escape') text = 'Now lose the police, then reach the hideout with wanted 0';
    return { name: a.def.name, text, timeLeft: a.timeLeft };
  }
  targetPos() {
    if (!this.active) return null;
    const a = this.active;
    return a.phase === 'escape' && a.def.escapeTarget ? a.def.escapeTarget : a.def.target;
  }
}
