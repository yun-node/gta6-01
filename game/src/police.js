// police.js — the Solmar Police Department: wanted stars (1-5), patrol cars
// that chase and ram, and foot officers who chase and arrest. Wanted decays
// when the player lays low; getting caught means BUSTED.
import * as THREE from 'three';
import { dist2D, clamp, angleLerp } from './utils.js';
import { makePerson } from './city.js';

export class Police {
  constructor(scene, vehicles, rng) {
    this.scene = scene; this.vehicles = vehicles; this.rng = rng;
    this.wanted = 0;
    this.coolTimer = 0;      // time since last crime
    this.chasers = [];       // police cars actively chasing
    this.officers = [];      // foot police
    this.arrestTimer = 0;
    this.spawnTimer = 0;
  }
  addWanted(n, reason) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.coolTimer = 0;
    return this.wanted;
  }
  setWanted(n) { this.wanted = clamp(n, 0, 5); this.coolTimer = 0; }
  // How many chasers the current wanted level calls for.
  desiredChasers() { return this.wanted === 0 ? 0 : this.wanted <= 1 ? 1 : this.wanted <= 2 ? 2 : this.wanted <= 3 ? 3 : this.wanted <= 4 ? 4 : 5; }
  update(dt, playerPos, playerInCar, drivenCar, onArrested, onRam) {
    // Wanted decays after 25s without new crimes (slower at high stars).
    this.coolTimer += dt;
    if (this.wanted > 0 && this.coolTimer > 25) {
      this.wanted -= 1; this.coolTimer = 0;
    }
    const want = this.desiredChasers();
    // Spawn chasers at the city edge near the player.
    this.spawnTimer -= dt;
    if (this.chasers.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const a = this.rng() * Math.PI * 2;
      const x = playerPos.x + Math.sin(a) * 70;
      const z = playerPos.z + Math.cos(a) * 70;
      const car = this.vehicles.addPoliceCar(x, z);
      this.chasers.push(car);
    }
    // Chase: steer toward the player, ram on contact.
    for (const car of [...this.chasers]) {
      const d = dist2D(car.pos.x, car.pos.z, playerPos.x, playerPos.z);
      const targetYaw = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
      car.yaw = angleLerp(car.yaw, targetYaw, Math.min(1, dt * 1.6));
      car.speed = clamp(car.speed + dt * 22, 0, 26 + this.wanted * 1.5);
      car.pos.x += Math.sin(car.yaw) * car.speed * dt;
      car.pos.z += Math.cos(car.yaw) * car.speed * dt;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.yaw;
      for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
      if (d < 3.2) {
        if (drivenCar) { // ram the player's car (throttled so it is one thud, not a buzz)
          this._ramT = (this._ramT || 0) - dt;
          if (this._ramT <= 0) { this._ramT = 0.9; onRam && onRam(); }
          car.speed *= 0.4;
          if (drivenCar) drivenCar.speed *= 0.7;
        } else if (!playerInCar) {
          // foot arrest: officer closes in and holds the player
          this.arrestTimer += dt;
          if (this.arrestTimer > 1.6) { this.arrestTimer = 0; onArrested && onArrested(); }
        }
      } else {
        this.arrestTimer = Math.max(0, this.arrestTimer - dt * 2);
      }
      if (d > 220) { this.vehicles.removeCar(car); this.chasers = this.chasers.filter((c) => c !== car); }
    }
    // Foot officers spawn at 2+ stars when the player is on foot.
    if (this.wanted >= 2 && !playerInCar && this.officers.length < this.wanted - 1 && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const a = this.rng() * Math.PI * 2;
      const built = makePerson(0x1a2a4a, 0x1a2a4a, 0xc98a6a);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10),
        new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
      cap.position.y = 1.9; built.group.add(cap);
      built.group.position.set(playerPos.x + Math.sin(a) * 26, 0, playerPos.z + Math.cos(a) * 26);
      this.scene.add(built.group);
      this.officers.push({ ...built, pos: built.group.position, yaw: 0, phase: 0 });
    }
    for (const o of [...this.officers]) {
      const d = dist2D(o.pos.x, o.pos.z, playerPos.x, playerPos.z);
      if (this.wanted === 0 || d > 90) { this.scene.remove(o.group); this.officers = this.officers.filter((x) => x !== o); continue; }
      o.yaw = Math.atan2(playerPos.x - o.pos.x, playerPos.z - o.pos.z);
      const sp = 7.5;
      o.pos.x += Math.sin(o.yaw) * sp * dt;
      o.pos.z += Math.cos(o.yaw) * sp * dt;
      o.phase += dt * sp * 2.2;
      const swing = Math.sin(o.phase) * 0.6;
      o.legL.rotation.x = swing; o.legR.rotation.x = -swing;
      o.group.position.set(o.pos.x, 0, o.pos.z);
      o.group.rotation.y = o.yaw;
      if (d < 2.2) {
        this.arrestTimer += dt;
        if (this.arrestTimer > 1.4) { this.arrestTimer = 0; onArrested && onArrested(); }
      }
    }
    if (this.wanted === 0) {
      for (const car of this.chasers) this.vehicles.removeCar(car);
      this.chasers = [];
      for (const o of this.officers) this.scene.remove(o.group);
      this.officers = [];
    }
  }
  clearAll() {
    for (const car of this.chasers) this.vehicles.removeCar(car);
    this.chasers = [];
    for (const o of this.officers) this.scene.remove(o.group);
    this.officers = [];
    this.wanted = 0; this.arrestTimer = 0;
  }
}
