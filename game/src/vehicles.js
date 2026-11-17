// vehicles.js — drivable cars: arcade physics, parked cars to steal,
// entering/exiting, and simple car-vs-building collision.
import * as THREE from 'three';
import { clamp, collideCircle, inCityBounds, angleLerp, dist2D } from './utils.js';
import { makeCar, randomCarColor, ROAD_SPACING, CITY_EXTENT } from './city.js';

export class Car {
  constructor(scene, x, z, yaw, color, opts = {}) {
    const built = makeCar(color, !!opts.police);
    this.mesh = built.group; this.wheels = built.wheels;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = yaw; this.speed = 0; this.steer = 0;
    this.police = !!opts.police; this.traffic = !!opts.traffic;
    this.stolen = false; this.id = Car._next++;
    this.mesh.position.copy(this.pos); this.mesh.rotation.y = yaw;
    scene.add(this.mesh);
  }
  update(dt, input, colliders, driven) {
    if (driven) {
      const fwd = input.down('KeyW') || input.down('ArrowUp');
      const back = input.down('KeyS') || input.down('ArrowDown');
      const left = input.down('KeyA') || input.down('ArrowLeft');
      const right = input.down('KeyD') || input.down('ArrowRight');
      const brake = input.down('Space');
      const accel = fwd ? 26 : back ? -16 : 0;
      this.speed += accel * dt;
      if (!fwd && !back) this.speed *= Math.max(0, 1 - dt * 0.9);
      if (brake) this.speed *= Math.max(0, 1 - dt * 4.5);
      this.speed = clamp(this.speed, -14, 34);
      const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 6);
      const dir = this.speed >= 0 ? 1 : -1;
      this.yaw += this.steer * 1.9 * dt * clamp(Math.abs(this.speed) / 10, 0, 1) * dir;
    } else {
      this.speed *= Math.max(0, 1 - dt * 2);
    }
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    const before = { x: this.pos.x, z: this.pos.z };
    const p = collideCircle(colliders, nx, nz, 1.6);
    const b = inCityBounds(p.x, p.z);
    this.pos.x = b.x; this.pos.z = b.z;
    if (Math.abs(this.pos.x - nx) > 0.01 || Math.abs(this.pos.z - nz) > 0.01) {
      // bumped a building: kill most speed, small bounce
      if (Math.abs(this.speed) > 6) this._bumped = true;
      this.speed *= 0.35;
    }
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    const spin = this.speed * dt * 2.4;
    for (const w of this.wheels) w.rotation.x += spin;
    return this._bumped ? (this._bumped = false, true) : false;
  }
}
Car._next = 1;

export class VehicleManager {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.cars = [];
    // Parked cars along the roads (stealable).
    const spots = [];
    for (let i = -3; i <= 3; i++) {
      for (let d = -140; d <= 140; d += 46) {
        spots.push([i * ROAD_SPACING + 9.5, d + 8, Math.PI / 2]);
        spots.push([d + 20, i * ROAD_SPACING + 9.5, 0]);
      }
    }
    for (let i = 0; i < 14; i++) {
      const s = spots[Math.floor(rng() * spots.length)];
      this.cars.push(new Car(scene, s[0], s[1], s[2], randomCarColor(rng)));
    }
    // Rico's starter car near the spawn.
    this.cars.push(new Car(scene, 9.5, 84, Math.PI / 2, 0xf2c230));
    this.driven = null;
  }
  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.police) continue;
      const d = dist2D(x, z, c.pos.x, c.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  enter(car) { this.driven = car; car.stolen = true; return car; }
  exit() { const c = this.driven; this.driven = null; return c; }
  addPoliceCar(x, z) {
    const c = new Car(this.scene, x, z, 0, 0x1a2a3a, { police: true });
    this.cars.push(c); return c;
  }
  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
    if (this.driven === car) this.driven = null;
  }
  update(dt, input, colliders, wanted) {
    for (const c of this.cars) {
      if (c.police) continue; // police cars are driven by police.js
      const bumped = c.update(dt, input, colliders, c === this.driven);
      if (bumped && c === this.driven) return 'crash';
    }
    return null;
  }
}
