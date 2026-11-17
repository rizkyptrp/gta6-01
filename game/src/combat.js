// Combat: the pistol, the rival gang members, tracers, muzzle flashes and
// the floating damage feedback. Enemies take cover positions, strafe, and
// shoot back with visible tracers so a fight reads in a screenshot.

const THREE = window.THREE;
import { makeRng, randomInRange, distance2D, clampNumber } from './utils.js';
import { buildPersonMesh } from './player.js';

export class CombatManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(31337);
    this.enemies = [];
    this.tracers = [];
    this.flashes = [];
    this.onEnemyDown = null;
    this.onPlayerHit = null;
  }

  spawnEnemies(centerX, centerZ, count, label) {
    const spawned = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + this.rng();
      const x = clampNumber(centerX + Math.sin(angle) * randomInRange(this.rng, 8, 20), -400, 400);
      const z = clampNumber(centerZ + Math.cos(angle) * randomInRange(this.rng, 8, 20), -400, 350);
      const mesh = buildPersonMesh(0x8e2f2f, 0x222222, 0xd9a066, 1);
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.14, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xffd23f }),
      );
      band.position.y = 1.25;
      mesh.add(band);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const enemy = {
        mesh, x, z, health: 100, heading: angle,
        shootTimer: 1 + this.rng() * 1.5,
        strafeDir: this.rng() < 0.5 ? 1 : -1,
        strafeTimer: 2,
        hitFlash: 0,
        label: label || 'Rival',
        dead: false,
      };
      this.enemies.push(enemy);
      spawned.push(enemy);
    }
    return spawned;
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.mesh);
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  // A shot from the player: raycast against enemies and cop peds, spawn a
  // tracer and a muzzle flash, return what it hit.
  playerShoot(origin, direction, targets) {
    const ray = new THREE.Raycaster(origin, direction, 0.1, 120);
    const meshes = [];
    for (const enemy of this.aliveEnemies()) meshes.push(enemy.mesh);
    for (const target of targets || []) meshes.push(target.mesh);
    const hits = ray.intersectObjects(meshes, true);
    this._spawnTracer(origin, direction);
    this._spawnFlash(origin);
    if (hits.length === 0) return null;
    let hitObject = hits[0].object;
    while (hitObject.parent && hitObject.parent !== this.scene) hitObject = hitObject.parent;
    const enemy = this.enemies.find((e) => e.mesh === hitObject && !e.dead);
    if (enemy) {
      enemy.health -= 34;
      enemy.hitFlash = 0.25;
      if (enemy.health <= 0) {
        enemy.dead = true;
        enemy.mesh.visible = false;
        if (this.onEnemyDown) this.onEnemyDown(enemy);
      }
      return { kind: 'enemy', enemy };
    }
    const cop = (targets || []).find((t) => t.mesh === hitObject);
    if (cop) return { kind: 'cop', cop };
    return { kind: 'world' };
  }

  enemyShoot(enemy, playerPos) {
    const from = new THREE.Vector3(enemy.x, 1.4, enemy.z);
    const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
    const dir = to.clone().sub(from).normalize();
    this._spawnTracer(from, dir);
    this._spawnFlash(from);
    const dist = distance2D(enemy.x, enemy.z, playerPos.x, playerPos.z);
    const hitChance = clampNumber(0.5 - dist / 90, 0.12, 0.5);
    if (this.rng() < hitChance && this.onPlayerHit) this.onPlayerHit(9 + this.rng() * 8);
  }

  updateEnemies(dt, playerPos, playerInCar) {
    for (const enemy of this.aliveEnemies()) {
      const dist = distance2D(enemy.x, enemy.z, playerPos.x, playerPos.z);
      // A hit makes the enemy flinch and flash bigger for a beat.
      if (enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        enemy.mesh.scale.setScalar(1.12);
      } else {
        enemy.mesh.scale.setScalar(1);
      }
      const want = Math.atan2(playerPos.x - enemy.x, playerPos.z - enemy.z);
      let diff = want - enemy.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      enemy.heading += clampNumber(diff, -3 * dt, 3 * dt);
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeTimer = randomInRange(this.rng, 1.5, 3);
        enemy.strafeDir *= -1;
      }
      if (dist > 16) {
        enemy.x += Math.sin(enemy.heading) * 4.2 * dt;
        enemy.z += Math.cos(enemy.heading) * 4.2 * dt;
      } else if (dist > 7) {
        enemy.x += Math.cos(enemy.heading) * enemy.strafeDir * 2.4 * dt;
        enemy.z -= Math.sin(enemy.heading) * enemy.strafeDir * 2.4 * dt;
      }
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 42 && !playerInCar) {
        enemy.shootTimer = 1.2 + this.rng() * 0.9;
        this.enemyShoot(enemy, playerPos);
      }
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.mesh.rotation.y = enemy.heading;
    }
    this._updateTracers(dt);
  }

  _spawnTracer(origin, direction) {
    const end = origin.clone().add(direction.clone().multiplyScalar(40));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  _spawnFlash(position) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95 }),
    );
    flash.position.copy(position);
    this.scene.add(flash);
    this.flashes.push({ mesh: flash, life: 0.07 });
  }

  _updateTracers(dt) {
    for (const tracer of this.tracers) tracer.life -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        return false;
      }
      return true;
    });
    for (const flash of this.flashes) flash.life -= dt;
    this.flashes = this.flashes.filter((f) => {
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        return false;
      }
      return true;
    });
  }
}
