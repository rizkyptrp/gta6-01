// The Bay Police: the wanted system and the cops who answer it. Stars rise
// on crimes the police can see, fall when the player breaks line of sight,
// and cop cars ram and box the player in while cop officers shoot on foot.

const THREE = window.THREE;
import { buildCarMesh } from './vehicles.js';
import { buildPersonMesh } from './player.js';
import { makeRng, clampNumber, distance2D, turnTowardAngle } from './utils.js';

export class PoliceManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(9090);
    this.wanted = 0;
    this.heat = 0;
    this.coolTimer = 0;
    this.copCars = [];
    this.copPeds = [];
    this.spawnTimer = 0;
    this.sirenTimer = 0;
    this.onSiren = null;
    this.onBusted = null;
  }

  addHeat(amount) {
    this.heat = clampNumber(this.heat + amount, 0, 100);
    const next = this.heat < 12 ? 0 : this.heat < 32 ? 1 : this.heat < 52 ? 2 : this.heat < 72 ? 3 : this.heat < 88 ? 4 : 5;
    const rose = next > this.wanted;
    this.wanted = next;
    this.coolTimer = 0;
    return rose;
  }

  setWanted(level) {
    this.wanted = clampNumber(level, 0, 5);
    this.heat = [0, 20, 40, 60, 78, 92][this.wanted];
    this.coolTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.coolTimer = 0;
    for (const cop of this.copCars) this.scene.remove(cop.mesh);
    for (const cop of this.copPeds) this.scene.remove(cop.mesh);
    this.copCars = [];
    this.copPeds = [];
  }

  _spawnCopCarNear(x, z) {
    const angle = this.rng() * Math.PI * 2;
    const sx = clampNumber(x + Math.sin(angle) * 55, -400, 400);
    const sz = clampNumber(z + Math.cos(angle) * 55, -400, 350);
    const mesh = buildCarMesh(0x1a1a2e, 'sedan');
    // Police livery: white doors and a light bar.
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.4, 1.6), doorMat);
    door.position.set(0, 0.75, 0);
    mesh.add(door);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.3), barMat);
    bar.position.set(0, 1.52, -0.2);
    bar.name = 'lightbar';
    mesh.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0.6, 1.52, -0.2);
    mesh.add(bar2);
    mesh.position.set(sx, 0, sz);
    this.scene.add(mesh);
    const cop = { mesh, x: sx, z: sz, heading: Math.atan2(x - sx, z - sz), speed: 0, stuckTimer: 0, bar, touchTimer: 0 };
    this.copCars.push(cop);
    return cop;
  }

  _spawnCopPedNear(x, z) {
    const angle = this.rng() * Math.PI * 2;
    const px = clampNumber(x + Math.sin(angle) * 18, -400, 400);
    const pz = clampNumber(z + Math.cos(angle) * 18, -400, 350);
    const mesh = buildPersonMesh(0x1a2a4a, 0x1a2a4a, 0xd9a066, 1);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0x0f1c33 }),
    );
    cap.position.y = 1.92;
    mesh.add(cap);
    mesh.position.set(px, 0, pz);
    this.scene.add(mesh);
    const cop = { mesh, x: px, z: pz, heading: 0, shootTimer: 1 + this.rng() };
    this.copPeds.push(cop);
    return cop;
  }

  // Cops chase, ram, and — when the player is on foot and close — get out
  // and shoot. Getting busted happens when a cop car touches the player
  // while on foot at low speed, or a cop ped gets within arm's reach.
  updatePolice(dt, player, playerCar, onPlayerShot) {
    const px = player.x;
    const pz = player.z;
    const wanted = this.wanted;
    if (wanted > 0) {
      this.coolTimer += dt;
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 3.2;
        if (this.onSiren) this.onSiren();
      }
      this.spawnTimer -= dt;
      const wantCars = Math.min(wanted + 1, 5);
      if (this.copCars.length < wantCars && this.spawnTimer <= 0) {
        this._spawnCopCarNear(px, pz);
        this.spawnTimer = 2.5;
      }
      const wantPeds = wanted >= 3 ? 2 : 0;
      if (this.copPeds.length < wantPeds && this.spawnTimer <= 0) {
        this._spawnCopPedNear(px, pz);
        this.spawnTimer = 2.5;
      }
      // Heat cools only when the player is far from every cop.
      let nearestCop = Infinity;
      for (const cop of this.copCars) nearestCop = Math.min(nearestCop, distance2D(px, pz, cop.x, cop.z));
      for (const cop of this.copPeds) nearestCop = Math.min(nearestCop, distance2D(px, pz, cop.x, cop.z));
      if (nearestCop > 70) {
        this.heat -= dt * (wanted >= 3 ? 2.2 : 4.5);
        if (this.heat <= 0) this.clearWanted();
        else this.wanted = this.heat < 12 ? 0 : this.heat < 32 ? 1 : this.heat < 52 ? 2 : this.heat < 72 ? 3 : this.heat < 88 ? 4 : 5;
      }
    }
    const playerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
    for (const cop of this.copCars) {
      const dist = distance2D(cop.x, cop.z, px, pz);
      const targetHeading = Math.atan2(px - cop.x, pz - cop.z);
      cop.heading = turnTowardAngle(cop.heading, targetHeading, 2.6 * dt);
      const topSpeed = 15 + wanted * 4.5;
      cop.speed = clampNumber(cop.speed + (topSpeed - cop.speed) * dt * 0.8, 0, topSpeed);
      const nextX = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      const nextZ = cop.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!this.city.collidesWithBuilding(nextX, nextZ, 2.2)) {
        cop.x = nextX;
        cop.z = nextZ;
      } else {
        cop.heading += Math.PI * 0.5;
        cop.speed *= 0.5;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      if (cop.bar) cop.bar.material.color.setHex(Math.floor(Date.now() / 300) % 2 === 0 ? 0xff2222 : 0x2244ff);
      // Ram the player's car, or bust the player on foot — but only after
      // a full second of contact, so a brush in traffic is not an instant bust.
      if (dist < 3.4) {
        cop.touchTimer += dt;
        if (cop.touchTimer > 1.1) {
          if (playerCar && playerSpeed < 4) {
            if (this.onBusted) this.onBusted('rammed');
          } else if (!playerCar && dist < 2.6) {
            if (this.onBusted) this.onBusted('caught');
          }
        }
        if (playerCar) {
          playerCar.speed *= 0.86;
          playerCar.health -= 6 * dt * 10;
        }
      } else {
        cop.touchTimer = 0;
      }
    }
    for (const cop of this.copPeds) {
      const dist = distance2D(cop.x, cop.z, px, pz);
      const targetHeading = Math.atan2(px - cop.x, pz - cop.z);
      cop.heading = turnTowardAngle(cop.heading, targetHeading, 3 * dt);
      if (dist > 14) {
        cop.x += Math.sin(cop.heading) * 5.5 * dt;
        cop.z += Math.cos(cop.heading) * 5.5 * dt;
      } else if (dist < 2.2 && !playerCar) {
        if (this.onBusted) this.onBusted('caught');
      }
      cop.shootTimer -= dt;
      if (dist < 26 && cop.shootTimer <= 0) {
        cop.shootTimer = 1.1 + this.rng() * 0.8;
        if (onPlayerShot) onPlayerShot(cop, dist);
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
  }
}
