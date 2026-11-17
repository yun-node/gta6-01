// player.js — Rico Vane on foot: WASD movement relative to camera yaw,
// sprint, walk animation, health, and the third-person camera rig.
import * as THREE from 'three';
import { clamp, collideCircle, inCityBounds } from './utils.js';
import { makePerson } from './city.js';

export class Player {
  constructor(scene) {
    const { group, legL, legR, armL, armR } = makePerson(0x2f6fd4, 0x2a2f38, 0xd9a077);
    // Rico's look: teal jacket, dark jeans, cap.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    cap.position.y = 1.9; group.add(cap);
    this.mesh = group; this.legL = legL; this.legR = legR; this.armL = armL; this.armR = armR;
    this.pos = new THREE.Vector3(0, 0, 96);   // start on Palm Boulevard
    this.yaw = Math.PI;                        // facing north into the city
    this.camYaw = Math.PI; this.camPitch = 0.32;
    this.speed = 0; this.health = 100;
    this.walkPhase = 0;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }
  update(dt, input, colliders, inCar) {
    const m = input.consumeMouse();
    this.camYaw -= m.dx * 0.0032;
    this.camPitch = clamp(this.camPitch + m.dy * 0.0022, -0.15, 0.9);
    if (inCar) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.4;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.4;
    let fx = 0, fz = 0;
    if (input.down('KeyW')) fz -= 1; if (input.down('KeyS')) fz += 1;
    if (input.down('KeyA')) fx -= 1; if (input.down('KeyD')) fx += 1;
    const moving = fx !== 0 || fz !== 0;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = moving ? (sprint ? 11 : 6.5) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    if (moving) {
      const len = Math.hypot(fx, fz); fx /= len; fz /= len;
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      // forward is (sin, cos) of camYaw; right is (-cos, sin)
      const wx = -fx * cos - fz * sin;
      const wz = fx * sin - fz * cos;
      this.pos.x += wx * this.speed * dt;
      this.pos.z += wz * this.speed * dt;
      this.yaw = Math.atan2(wx, wz);
      this.walkPhase += dt * this.speed * 1.4;
    }
    const p = collideCircle(colliders, this.pos.x, this.pos.z, 0.6);
    const b = inCityBounds(p.x, p.z);
    this.pos.x = b.x; this.pos.z = b.z;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7; this.armR.rotation.x = swing * 0.7;
  }
  // Third-person camera: behind and above the player (or the car).
  updateCamera(camera, dt, anchorPos, anchorYaw) {
    const dist = 9.5, height = 4.2 + this.camPitch * 6;
    const tx = anchorPos.x - Math.sin(this.camYaw) * dist;
    const tz = anchorPos.z - Math.cos(this.camYaw) * dist;
    const desired = new THREE.Vector3(tx, height, tz);
    camera.position.lerp(desired, Math.min(1, dt * 7));
    camera.lookAt(anchorPos.x, 1.6, anchorPos.z);
  }
  damage(amount) { this.health = clamp(this.health - amount, 0, 100); return this.health <= 0; }
  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }
}
