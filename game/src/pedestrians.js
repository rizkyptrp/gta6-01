// Pedestrians: the people of Solara Bay. They stroll the sidewalks, cross
// streets, flee from gunfire and from cars, and scream when the player
// steals a car in front of them.

const THREE = window.THREE;
import { makeRng, pickFrom, randomInRange, clampNumber, distance2D } from './utils.js';
import { buildPersonMesh } from './player.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];
const SKINS = [0xd9a066, 0x8d5524, 0xffdbac, 0xf1c27d, 0xc68642];

export class PedestrianManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(4242);
    this.peds = [];
  }

  spawnPedestrians(count) {
    for (let i = 0; i < count; i += 1) {
      const spot = this.city.randomRoadPoint(this.rng);
      const mesh = buildPersonMesh(
        pickFrom(this.rng, SHIRTS),
        pickFrom(this.rng, [0x2c3e50, 0x5d4037, 0x37474f, 0x6d4c41]),
        pickFrom(this.rng, SKINS),
        randomInRange(this.rng, 0.92, 1.08),
      );
      const x = spot.x + randomInRange(this.rng, -8, 8);
      const z = spot.z + randomInRange(this.rng, -8, 8);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x, z,
        heading: randomInRange(this.rng, 0, Math.PI * 2),
        speed: randomInRange(this.rng, 1.2, 2.2),
        state: 'walk',
        fleeTimer: 0,
        panicTimer: 0,
        walkPhase: randomInRange(this.rng, 0, 6),
        retargetTimer: randomInRange(this.rng, 2, 8),
        targetX: x,
        targetZ: z,
      });
    }
  }

  // A pedestrian walks toward a wandering target, re-picking it often.
  // Gunfire or a speeding car nearby flips them to fleeing.
  updatePedestrians(dt, danger) {
    for (const ped of this.peds) {
      let speed = ped.speed;
      if (danger) {
        const d = distance2D(ped.x, ped.z, danger.x, danger.z);
        if (d < danger.radius) {
          ped.state = 'flee';
          ped.fleeTimer = 2.5;
          const away = Math.atan2(ped.x - danger.x, ped.z - danger.z);
          ped.targetX = ped.x + Math.sin(away) * 30;
          ped.targetZ = ped.z + Math.cos(away) * 30;
        }
      }
      if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        speed = 6.5;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      }
      ped.retargetTimer -= dt;
      if (ped.retargetTimer <= 0 && ped.state === 'walk') {
        ped.retargetTimer = randomInRange(this.rng, 3, 9);
        const angle = randomInRange(this.rng, 0, Math.PI * 2);
        const dist = randomInRange(this.rng, 10, 45);
        ped.targetX = clampNumber(ped.x + Math.sin(angle) * dist, -410, 410);
        ped.targetZ = clampNumber(ped.z + Math.cos(angle) * dist, -410, 350);
      }
      const dx = ped.targetX - ped.x;
      const dz = ped.targetZ - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1) {
        const want = Math.atan2(dx, dz);
        let diff = want - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += clampNumber(diff, -2.4 * dt, 2.4 * dt);
        const nextX = ped.x + Math.sin(ped.heading) * speed * dt;
        const nextZ = ped.z + Math.cos(ped.heading) * speed * dt;
        if (!this.city.collidesWithBuilding(nextX, nextZ, 0.7)) {
          ped.x = nextX;
          ped.z = nextZ;
        } else {
          ped.retargetTimer = 0;
        }
        ped.walkPhase += dt * speed * 4.2;
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      const legL = ped.mesh.getObjectByName('legL');
      const legR = ped.mesh.getObjectByName('legR');
      const armL = ped.mesh.getObjectByName('armL');
      const armR = ped.mesh.getObjectByName('armR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing * 0.8;
      if (armR) armR.rotation.x = swing * 0.8;
    }
  }

  countFleeing() {
    return this.peds.filter((p) => p.state === 'flee').length;
  }
}
