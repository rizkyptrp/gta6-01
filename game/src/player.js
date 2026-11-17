// Mara Voss on foot: the third-person character, her walk / sprint, the
// follow camera, and the pistol she fires with the mouse.

const THREE = window.THREE;
import { clampNumber, turnTowardAngle } from './utils.js';

export function buildPersonMesh(shirtColor, pantsColor, skinColor, scale) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor || 0x2c3e50 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.62;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshLambertMaterial({ color: 0x1a1210 }),
  );
  hair.position.y = 1.72;
  hair.scale.y = 0.7;
  group.add(hair);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.4), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const legGeo = new THREE.BoxGeometry(0.28, 0.72, 0.3);
  const leftLeg = new THREE.Mesh(legGeo, pants);
  leftLeg.position.set(-0.19, 0.36, 0);
  leftLeg.name = 'legL';
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, pants);
  rightLeg.position.set(0.19, 0.36, 0);
  rightLeg.name = 'legR';
  group.add(rightLeg);
  const armGeo = new THREE.BoxGeometry(0.2, 0.68, 0.22);
  const leftArm = new THREE.Mesh(armGeo, shirt);
  leftArm.position.set(-0.48, 1.08, 0);
  leftArm.name = 'armL';
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, shirt);
  rightArm.position.set(0.48, 1.08, 0);
  rightArm.name = 'armR';
  group.add(rightArm);
  group.scale.setScalar(scale || 1);
  return group;
}

export class PlayerController {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = buildPersonMesh(0xffd23f, 0x2c3e50, 0xd9a066, 1);
    this.mesh.position.set(10, 0, 40);
    scene.add(this.mesh);
    this.x = 10;
    this.z = 40;
    this.heading = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.42;
    this.health = 100;
    this.speed = 0;
    this.walkPhase = 0;
    this.inCar = false;
    this.currentCar = null;
    this.ammo = Infinity;
    this.lastShotAt = 0;
  }

  setPosition(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading || 0;
    this.cameraYaw = this.heading;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
  }

  updateOnFoot(input, dt, camera) {
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const forward = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0)
      - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const strafe = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const delta = input.consumeMouseDelta();
    this.cameraYaw -= delta.dx * 0.0032;
    this.cameraPitch = clampNumber(this.cameraPitch + delta.dy * 0.0022, 0.08, 1.1);
    const targetSpeed = sprint ? 9.5 : 5.2;
    const moving = forward !== 0 || strafe !== 0;
    const moveSpeed = moving ? targetSpeed : 0;
    this.speed = moveSpeed;
    if (moving) {
      const sin = Math.sin(this.cameraYaw);
      const cos = Math.cos(this.cameraYaw);
      let mx = -sin * forward + cos * strafe;
      let mz = -cos * forward - sin * strafe;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      const nextX = this.x + mx * moveSpeed * dt;
      const nextZ = this.z + mz * moveSpeed * dt;
      const hit = this.city.collidesWithBuilding(nextX, nextZ, 0.7);
      if (!hit && !this.city.isInSea(nextX, nextZ)) {
        const clamped = this.city.clampToCity(nextX, nextZ);
        this.x = clamped.x;
        this.z = clamped.z;
      }
      const targetHeading = Math.atan2(mx, mz);
      this.heading = turnTowardAngle(this.heading, targetHeading, 10 * dt);
      this.walkPhase += dt * (sprint ? 13 : 9);
    } else {
      this.walkPhase *= 0.9;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const legL = this.mesh.getObjectByName('legL');
    const legR = this.mesh.getObjectByName('legR');
    const armL = this.mesh.getObjectByName('armL');
    const armR = this.mesh.getObjectByName('armR');
    const swing = moving ? Math.sin(this.walkPhase) * 0.65 : 0;
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.8;
    if (armR) armR.rotation.x = swing * 0.8;
    this._updateCamera(camera, dt, 0);
  }

  // Third-person camera: behind the hero, above the shoulder, smoothing in.
  // On foot the camera sits behind the camera yaw; in a car it sits behind
  // the car's nose, which points the opposite way from the on-foot yaw.
  _updateCamera(camera, dt, carSpeed) {
    const dist = this.inCar ? 11.5 : 8.5;
    const height = this.inCar ? 4.2 : 3.4;
    const yaw = this.inCar ? this.heading : this.cameraYaw;
    const sign = this.inCar ? -1 : 1;
    const lookX = this.x;
    const lookZ = this.z;
    const camX = lookX + sign * Math.sin(yaw) * dist;
    const camZ = lookZ + sign * Math.cos(yaw) * dist;
    const camY = height + Math.sin(this.cameraPitch) * 2.2;
    const k = 1 - Math.exp(-8 * dt);
    camera.position.x += (camX - camera.position.x) * k;
    camera.position.y += (camY - camera.position.y) * k;
    camera.position.z += (camZ - camera.position.z) * k;
    camera.lookAt(lookX, 1.4, lookZ);
  }

  updateInCar(camera, dt) {
    if (!this.currentCar) return;
    this.x = this.currentCar.x;
    this.z = this.currentCar.z;
    this.heading = this.currentCar.heading;
    this.mesh.visible = false;
    this._updateCamera(camera, dt, this.currentCar.speed);
  }

  enterCar(car) {
    this.inCar = true;
    this.currentCar = car;
    this.mesh.visible = false;
    this.x = car.x;
    this.z = car.z;
  }

  exitCar() {
    if (!this.currentCar) return null;
    const car = this.currentCar;
    const sideX = car.x + Math.cos(car.heading) * 2.4;
    const sideZ = car.z - Math.sin(car.heading) * 2.4;
    this.inCar = false;
    this.currentCar = null;
    this.mesh.visible = true;
    const spot = this.city.collidesWithBuilding(sideX, sideZ, 0.7) ? { x: car.x, z: car.z + 3 } : { x: sideX, z: sideZ };
    this.setPosition(spot.x, spot.z, car.heading);
    return car;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }

  canShoot(now) {
    return now - this.lastShotAt > 0.28;
  }

  markShot(now) {
    this.lastShotAt = now;
  }
}
