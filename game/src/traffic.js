// traffic.js — ambient traffic cars cruising the road grid on lanes,
// wrapping around the city edges. They slow when the player is ahead.
import { ROAD_SPACING, CITY_EXTENT, makeCar, randomCarColor } from './city.js';
import { dist2D } from './utils.js';

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.cars = [];
    for (let i = 0; i < 12; i++) this.spawn();
  }
  spawn() {
    const vertical = this.rng() < 0.5;
    const road = (Math.floor(this.rng() * 7) - 3) * ROAD_SPACING;
    const lane = this.rng() < 0.5 ? -3.5 : 3.5;
    const along = (this.rng() * 2 - 1) * CITY_EXTENT;
    const dir = this.rng() < 0.5 ? 1 : -1;
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    const yaw = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const built = makeCar(randomCarColor(this.rng), false);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = yaw;
    this.scene.add(built.group);
    this.cars.push({ mesh: built.group, wheels: built.wheels, pos: built.group.position, yaw, speed: 9 + this.rng() * 5, vertical });
  }
  update(dt, playerPos, drivenCar) {
    for (const c of this.cars) {
      let speed = c.speed;
      const aheadX = c.pos.x + Math.sin(c.yaw) * 7;
      const aheadZ = c.pos.z + Math.cos(c.yaw) * 7;
      if (dist2D(aheadX, aheadZ, playerPos.x, playerPos.z) < 5) speed = Math.min(speed, 2);
      if (drivenCar && dist2D(aheadX, aheadZ, drivenCar.pos.x, drivenCar.pos.z) < 6) speed = Math.min(speed, 1.5);
      c.pos.x += Math.sin(c.yaw) * speed * dt;
      c.pos.z += Math.cos(c.yaw) * speed * dt;
      if (c.vertical) {
        if (c.pos.z > CITY_EXTENT + 10) c.pos.z = -CITY_EXTENT - 10;
        if (c.pos.z < -CITY_EXTENT - 10) c.pos.z = CITY_EXTENT + 10;
      } else {
        if (c.pos.x > CITY_EXTENT + 10) c.pos.x = -CITY_EXTENT - 10;
        if (c.pos.x < -CITY_EXTENT - 10) c.pos.x = CITY_EXTENT + 10;
      }
      c.mesh.position.set(c.pos.x, 0, c.pos.z);
      c.mesh.rotation.y = c.yaw;
      for (const w of c.wheels) w.rotation.x += speed * dt * 2.4;
    }
  }
}
