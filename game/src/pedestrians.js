// pedestrians.js — people on the sidewalks: they stroll, cross at corners,
// and run away from gunfire. A few carry cash you can pick up after a scare.
import * as THREE from 'three';
import { ROAD_SPACING, CITY_EXTENT, makePerson } from './city.js';
import { dist2D, pick } from './utils.js';

const SHIRTS = [0xe05a5a, 0x5a8ae0, 0x5ae08a, 0xe0d25a, 0xb05ae0, 0xe08a5a, 0x5ad8e0, 0xf0f0f0];
const PANTS = [0x2a2f38, 0x3a4a6a, 0x5a3a2a, 0x444444];

export class Pedestrians {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.people = [];
    for (let i = 0; i < 16; i++) this.spawn();
  }
  spawn() {
    const road = (Math.floor(this.rng() * 7) - 3) * ROAD_SPACING;
    const along = (this.rng() * 2 - 1) * CITY_EXTENT;
    const vertical = this.rng() < 0.5;
    const off = (this.rng() < 0.5 ? -1 : 1) * (7 + 2 + this.rng() * 1.5);
    const x = vertical ? road + off : along;
    const z = vertical ? along : road + off;
    const built = makePerson(pick(this.rng, SHIRTS), pick(this.rng, PANTS));
    built.group.position.set(x, 0, z);
    this.scene.add(built.group);
    const yaw = this.rng() * Math.PI * 2;
    this.people.push({ ...built, pos: built.group.position, yaw, speed: 1.2 + this.rng() * 1.1, phase: this.rng() * 6, flee: 0, dirT: 0 });
  }
  scare(x, z, radius) {
    for (const p of this.people) {
      if (dist2D(p.pos.x, p.pos.z, x, z) < radius) {
        p.flee = 3 + this.rng() * 2;
        p.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
      }
    }
  }
  update(dt) {
    for (const p of this.people) {
      p.dirT -= dt;
      if (p.flee > 0) {
        p.flee -= dt;
      } else if (p.dirT <= 0) {
        // wander: mostly keep going, sometimes turn at a corner
        p.dirT = 2 + this.rng() * 4;
        if (this.rng() < 0.35) p.yaw += (this.rng() < 0.5 ? -1 : 1) * Math.PI / 2;
      }
      const sp = p.flee > 0 ? p.speed * 3.2 : p.speed;
      p.pos.x += Math.sin(p.yaw) * sp * dt;
      p.pos.z += Math.cos(p.yaw) * sp * dt;
      if (Math.abs(p.pos.x) > CITY_EXTENT + 6) p.yaw = Math.atan2(-p.pos.x, -p.pos.z);
      if (Math.abs(p.pos.z) > CITY_EXTENT + 6) p.yaw = Math.atan2(-p.pos.x, -p.pos.z);
      p.phase += dt * sp * 3;
      const swing = Math.sin(p.phase) * 0.5;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
      p.armL.rotation.x = -swing * 0.6; p.armR.rotation.x = swing * 0.6;
      p.group.position.set(p.pos.x, 0, p.pos.z);
      p.group.rotation.y = p.yaw;
    }
  }
}
