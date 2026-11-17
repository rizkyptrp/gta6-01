// Effects: the juice — exhaust puffs, crash sparks, explosion fireballs,
// floating score text and the screen shake that sells a hard hit.

const THREE = window.THREE;
import { makeRng, randomInRange } from './utils.js';

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(606);
    this.particles = [];
    this.shakeAmount = 0;
    this.shakeTime = 0;
  }

  addShake(amount, duration) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  spawnBurst(x, y, z, color, count, speed, life, size, gravity) {
    for (let i = 0; i < count; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size || 0.18, 6, 6), mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const angle = this.rng() * Math.PI * 2;
      const up = randomInRange(this.rng, 0.3, 1);
      this.particles.push({
        mesh,
        vx: Math.sin(angle) * speed * this.rng(),
        vy: up * speed,
        vz: Math.cos(angle) * speed * this.rng(),
        life: life * randomInRange(this.rng, 0.6, 1.2),
        maxLife: life,
        gravity: gravity === undefined ? 6 : gravity,
        fade: true,
      });
    }
  }

  spawnExplosion(x, y, z) {
    this.spawnBurst(x, y + 0.6, z, 0xff7a1a, 26, 9, 0.9, 0.3, 4);
    this.spawnBurst(x, y + 0.6, z, 0xffd23f, 18, 6, 0.7, 0.24, 2);
    this.spawnBurst(x, y + 0.6, z, 0x555555, 12, 3, 1.6, 0.4, -1.5);
    this.addShake(0.7, 0.5);
  }

  spawnCrashSparks(x, y, z) {
    this.spawnBurst(x, y + 0.5, z, 0xffe14d, 10, 6, 0.4, 0.12, 8);
    this.addShake(0.25, 0.25);
  }

  spawnExhaust(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.32 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.particles.push({
      mesh, vx: 0, vy: 0.9, vz: 0, life: 0.5, maxLife: 0.5, gravity: -0.5, fade: true,
    });
  }

  spawnPickupSparkle(x, y, z) {
    this.spawnBurst(x, y + 1, z, 0x7dff9a, 12, 3, 0.6, 0.14, 1);
  }

  updateEffects(dt, camera) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.fade) p.mesh.material.opacity = Math.max(0, p.life / p.maxLife) * 0.95;
      const s = 1 + (1 - Math.max(0, p.life / p.maxLife)) * 1.6;
      p.mesh.scale.setScalar(s);
    }
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        return false;
      }
      return true;
    });
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const amount = this.shakeAmount * (this.shakeTime / 0.5);
      camera.position.x += (this.rng() - 0.5) * amount;
      camera.position.y += (this.rng() - 0.5) * amount * 0.6;
      if (this.shakeTime <= 0) this.shakeAmount = 0;
    }
  }
}
