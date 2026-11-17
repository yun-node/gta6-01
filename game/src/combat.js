// combat.js — pistol combat: hitscan shooting from the camera centre,
// enemy gang members with health bars, muzzle flash and damage numbers.
import * as THREE from 'three';
import { makePerson } from './city.js';
import { dist2D, clamp } from './utils.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.enemies = [];
    this.ammo = 12; this.magSize = 12;
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    this.flash.visible = false; scene.add(this.flash);
    this._flashT = 0;
    // tracer line from gun to hit point
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    this.tracer.visible = false; scene.add(this.tracer);
    this._tracerT = 0;
    this._shotLog = [];
  }
  spawnEnemy(x, z, hp) {
    const built = makePerson(0x8a2a2a, 0x222222, 0xb98a6a);
    // red bandana
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.68),
      new THREE.MeshLambertMaterial({ color: 0xd42a2a }));
    band.position.y = 1.82; built.group.add(band);
    built.group.position.set(x, 0, z);
    this.scene.add(built.group);
    const hpBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    hpBar.position.set(x, 2.25, z); this.scene.add(hpBar);
    const e = { ...built, pos: built.group.position, yaw: 0, hp: hp || 60, maxHp: hp || 60, hpBar, phase: Math.random() * 6, shootT: 1 + Math.random() };
    this.enemies.push(e);
    return e;
  }
  clearEnemies() {
    for (const e of this.enemies) { this.scene.remove(e.group); this.scene.remove(e.hpBar); }
    this.enemies = [];
  }
  // Shoot a hitscan ray at torso height along the camera's horizontal aim
  // direction. (A ray straight from the high chase camera dives into the
  // ground before it reaches anyone, so the shot is taken from the player's
  // chest instead — what the crosshair points at is what gets hit.)
  shoot(camera, playerPos, onEnemyDown) {
    if (this.ammo <= 0) return { empty: true };
    this.ammo -= 1;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(playerPos.x, 1.35, playerPos.z);
    const aim = origin.clone().add(dir.clone().multiplyScalar(40));
    aim.y = 1.35;
    const flat = aim.sub(origin).normalize();
    this.raycaster.set(origin, flat);
    this.raycaster.far = 70;
    const meshes = [];
    for (const e of this.enemies) e.group.traverse((o) => { if (o.isMesh) { o.userData.enemy = e; meshes.push(o); } });
    const hits = this.raycaster.intersectObjects(meshes, false);
    let point = origin.clone().add(flat.clone().multiplyScalar(60));
    let hitEnemy = null;
    if (hits.length > 0) {
      const h = hits[0];
      point = h.point;
      if (h.object.userData.enemy) {
        hitEnemy = h.object.userData.enemy;
      }
    }
    // Arcade aim assist: the ray is a line, but a target just off it still
    // counts — take the nearest enemy within 1.3 units of the shot line.
    if (!hitEnemy) {
      let best = null, bestD = 1.3;
      for (const e of this.enemies) {
        const toE = new THREE.Vector3(e.pos.x - origin.x, 0, e.pos.z - origin.z);
        const along = toE.dot(flat);
        if (along < 1 || along > 45) continue;
        const perp = toE.clone().addScaledVector(flat, -along).length();
        if (perp < bestD) { bestD = perp; best = e; }
      }
      if (best) { hitEnemy = best; point = new THREE.Vector3(best.pos.x, 1.35, best.pos.z); }
    }
    if (hitEnemy) {
      hitEnemy.hp -= 34;
      if (hitEnemy.hp <= 0) {
        this.scene.remove(hitEnemy.group); this.scene.remove(hitEnemy.hpBar);
        this.enemies = this.enemies.filter((e) => e !== hitEnemy);
        onEnemyDown && onEnemyDown(hitEnemy);
      }
    }
    this._shotLog.push({ hit: !!hitEnemy, ammo: this.ammo, enemies: this.enemies.length,
      rayHits: hits.length, rayFirst: hits.length ? (hits[0].object.userData.enemy ? 'enemy' : hits[0].object.type) : null,
      origin: [+origin.x.toFixed(1), +origin.y.toFixed(2), +origin.z.toFixed(1)],
      flat: [+flat.x.toFixed(2), +flat.y.toFixed(2), +flat.z.toFixed(2)],
      nearest: this.enemies.map((e) => {
        const toE = new THREE.Vector3(e.pos.x - origin.x, 0, e.pos.z - origin.z);
        const along = toE.dot(flat);
        const perp = toE.clone().addScaledVector(flat, -along).length();
        return { along: +along.toFixed(1), perp: +perp.toFixed(2), hp: e.hp };
      }),
    });
    // muzzle flash + tracer
    this.flash.position.copy(origin).add(flat.clone().multiplyScalar(1.2));
    this.flash.visible = true; this._flashT = 0.06;
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, point.x, point.y, point.z);
    pos.needsUpdate = true;
    this.tracer.visible = true; this._tracerT = 0.08;
    return { hit: !!hitEnemy, enemy: hitEnemy, point, empty: false };
  }
  reload() { this.ammo = this.magSize; }
  // Enemies strafe toward the player and fire back on a timer.
  update(dt, playerPos, playerAlive, onEnemyShot) {
    if (this._flashT > 0) { this._flashT -= dt; if (this._flashT <= 0) this.flash.visible = false; }
    if (this._tracerT > 0) { this._tracerT -= dt; if (this._tracerT <= 0) this.tracer.visible = false; }
    for (const e of this.enemies) {
      const d = dist2D(e.pos.x, e.pos.z, playerPos.x, playerPos.z);
      e.yaw = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      if (d > 9) {
        e.pos.x += Math.sin(e.yaw) * 4.2 * dt;
        e.pos.z += Math.cos(e.yaw) * 4.2 * dt;
      }
      e.phase += dt * 6;
      const swing = Math.sin(e.phase) * 0.5;
      e.legL.rotation.x = swing; e.legR.rotation.x = -swing;
      e.group.position.set(e.pos.x, 0, e.pos.z);
      e.group.rotation.y = e.yaw;
      const hpFrac = clamp(e.hp / e.maxHp, 0, 1);
      e.hpBar.scale.x = hpFrac;
      e.hpBar.position.set(e.pos.x - Math.sin(e.yaw) * 0, 2.25, e.pos.z);
      e.hpBar.lookAt(playerPos.x, 2.25, playerPos.z);
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 45 && playerAlive) {
        e.shootT = 1.6 + Math.random() * 1.2;
        onEnemyShot && onEnemyShot(e, d);
      }
    }
  }
}
