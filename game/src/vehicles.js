// Cars: the low-poly car model builder, the traffic that fills the roads,
// and the arcade driving physics for the car the player steals.

const THREE = window.THREE;
import { PALETTE } from './config.js';
import { makeRng, pickFrom, randomInRange, clampNumber, turnTowardAngle, distance2D } from './utils.js';

export function buildCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyColor = color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.62, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.18, kind === 'truck' ? 0.7 : -0.2);
  group.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.5, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    bed.position.set(0, 1.0, -1.2);
    group.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    sign.position.set(0, 1.62, -0.2);
    group.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPositions = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  for (const [wx, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(lx, 0.72, 2.22);
    group.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
  for (const lx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(lx, 0.72, -2.22);
    group.add(tail);
  }
  group.userData.tailMat = tailMat;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  return group;
}

export const CAR_NAMES = ['Comet', 'Sandstorm', 'Vagabond', 'Sunrunner', 'Marlin', 'Prowler'];

export class TrafficManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(777);
    this.cars = [];
    this.playerCar = null;
  }

  spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const spot = this.city.randomRoadPoint(this.rng);
      const kind = pickFrom(this.rng, ['sedan', 'sedan', 'sedan', 'taxi', 'truck']);
      const color = kind === 'taxi' ? 0xf1c40f : pickFrom(this.rng, PALETTE.carColors);
      const mesh = buildCarMesh(color, kind);
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.heading;
      this.scene.add(mesh);
      this.cars.push({
        mesh, kind, color,
        name: pickFrom(this.rng, CAR_NAMES),
        speed: randomInRange(this.rng, 7, 12),
        heading: spot.heading,
        x: spot.x, z: spot.z,
        roadAxis: Math.abs(spot.x - this._nearestStreet(spot.x)) < 2 ? 'z' : 'x',
        street: this._nearestStreet(Math.abs(spot.x - this._nearestStreet(spot.x)) < 2 ? spot.x : spot.z),
        laneOffset: this.rng() < 0.5 ? -3.2 : 3.2,
        waitTimer: 0,
        honkTimer: randomInRange(this.rng, 4, 20),
      });
    }
  }

  _nearestStreet(value) {
    let best = this.city.streetCenters[0];
    let bestDist = Infinity;
    for (const s of this.city.streetCenters) {
      const d = Math.abs(s - value);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  spawnPlayerCar(x, z, heading, color) {
    const mesh = buildCarMesh(color || 0xc0392b, 'sedan');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      mesh, kind: 'sedan', color: color || 0xc0392b, name: 'Comet',
      speed: 0, heading, x, z, health: 100,
      isPlayer: true, roadAxis: 'x', street: 0, laneOffset: 0, waitTimer: 0, honkTimer: 0,
    };
    this.playerCar = car;
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const index = this.cars.indexOf(car);
    if (index >= 0) this.cars.splice(index, 1);
    if (this.playerCar === car) this.playerCar = null;
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  // Traffic cars cruise their street, slow for the car ahead, and turn at
  // the city edge instead of driving into the sea.
  updateTraffic(dt, playerPos) {
    for (const car of this.cars) {
      if (car.waitTimer > 0) {
        car.waitTimer -= dt;
        continue;
      }
      const ahead = this._carAhead(car, 9);
      let targetSpeed = car.speed;
      if (ahead) targetSpeed = Math.min(targetSpeed, ahead.speed * 0.6);
      if (playerPos && distance2D(car.x, car.z, playerPos.x, playerPos.z) < 7 && car.speed > 2) {
        targetSpeed = 2;
      }
      const moving = targetSpeed > 0.5;
      if (moving) {
        const dx = Math.sin(car.heading);
        const dz = Math.cos(car.heading);
        car.x += dx * targetSpeed * dt;
        car.z += dz * targetSpeed * dt;
        if (Math.abs(car.x) > 415 || Math.abs(car.z) > 415 || car.z > 360) {
          car.heading += Math.PI;
          car.x = clampNumber(car.x, -410, 410);
          car.z = clampNumber(car.z, -410, 350);
        }
        // Gentle wander so traffic does not look glued to rails.
        car.heading += Math.sin(Date.now() * 0.0002 + car.x) * 0.0004;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  _carAhead(car, range) {
    let best = null;
    let bestDist = range;
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (forward > 0 && forward < bestDist && side < 2.4) {
        bestDist = forward;
        best = other;
      }
    }
    return best;
  }
}

// Arcade driving for the player's car: accelerate, brake, steer harder at
// low speed, handbrake slides, and buildings stop the car with a thud.
export function drivePlayerCar(car, input, dt, city, onCrash) {
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const brake = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');
  const maxSpeed = 34;
  const maxReverse = 10;
  if (forward) car.speed += 22 * dt;
  if (brake) {
    if (car.speed > 0.5) car.speed -= 34 * dt;
    else car.speed -= 10 * dt;
  }
  if (!forward && !brake) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 26 * dt;
  car.speed = clampNumber(car.speed, -maxReverse, maxSpeed);
  if (Math.abs(car.speed) < 0.15) car.speed = 0;
  const steerAmount = (left ? 1 : 0) - (right ? 1 : 0);
  const steerPower = 1.9 * clampNumber(1 - Math.abs(car.speed) / 46, 0.35, 1);
  if (car.speed !== 0) {
    car.heading += steerAmount * steerPower * dt * Math.sign(car.speed) * (handbrake ? 1.6 : 1);
  }
  const nextX = car.x + Math.sin(car.heading) * car.speed * dt;
  const nextZ = car.z + Math.cos(car.heading) * car.speed * dt;
  // Brake lights flare while the brake key is held.
  if (car.mesh.userData.tailMat) {
    car.mesh.userData.tailMat.color.setHex(brake ? 0xff2a2a : 0x881111);
  }
  const hit = city.collidesWithBuilding(nextX, nextZ, 2.2);
  if (hit) {
    if (Math.abs(car.speed) > 8 && onCrash) onCrash(Math.abs(car.speed));
    car.speed *= -0.25;
  } else if (city.isInSea(nextX, nextZ)) {
    car.speed *= 0.4;
    car.x = clampNumber(nextX, -440, 440);
    car.z = 430;
  } else {
    const clamped = city.clampToCity(nextX, nextZ);
    car.x = clamped.x;
    car.z = clamped.z;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Body roll and pitch sell the speed.
  car.mesh.rotation.z = -steerAmount * clampNumber(Math.abs(car.speed) / 34, 0, 1) * 0.05;
  car.mesh.rotation.x = clampNumber(-car.speed / 34, -1, 1) * 0.02;
  return Math.abs(car.speed);
}
