// Solara Bay itself: the procedural city. A seeded grid of blocks, roads,
// towers, houses, palms, street props, a beach and the sea. It also owns the
// collision queries (is this point inside a building? on a road?) and the
// data the minimap draws.

const THREE = window.THREE;
import { CITY, PALETTE, DISTRICTS } from './config.js';
import { makeRng, pickFrom, randomInRange, randomInt, clampNumber } from './utils.js';

export class CityBuilder {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(CITY.seed);
    this.buildings = [];
    this.roads = [];
    this.palms = [];
    this.props = [];
    this.streetCenters = [];
    this.groundMeshes = [];
    this.buildingMeshes = [];
    this.minimapBuildings = [];
  }

  buildCity() {
    this._buildSkyAndLights();
    this._buildGround();
    this._buildRoadGrid();
    this._buildBlocks();
    this._buildBeachAndSea();
    this._buildPalmsAndProps();
    this._buildLandmarks();
    return this;
  }

  _buildSkyAndLights() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x7ec3ee);
    scene.fog = new THREE.Fog(0xbfe0f2, 260, 900);
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x9a8a6a, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(PALETTE.sun, 1.35);
    sun.position.set(180, 260, 120);
    scene.add(sun);
    // A soft fill light from the opposite side so north faces never go black.
    const fill = new THREE.DirectionalLight(0xbcd8ff, 0.45);
    fill.position.set(-160, 140, -200);
    scene.add(fill);
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(18, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
    );
    sunBall.position.set(320, 300, -420);
    scene.add(sunBall);
    // A few soft clouds made of flattened white spheres.
    for (let i = 0; i < 9; i += 1) {
      const cloud = new THREE.Group();
      const puffCount = 3 + Math.floor(this.rng() * 3);
      for (let p = 0; p < puffCount; p += 1) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(randomInRange(this.rng, 8, 16), 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }),
        );
        puff.position.set(p * 12 - puffCount * 6, this.rng() * 3, this.rng() * 6 - 3);
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(randomInRange(this.rng, -380, 380), randomInRange(this.rng, 130, 180), randomInRange(this.rng, -380, 200));
      scene.add(cloud);
    }
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.halfSize * 2 + 400, CITY.halfSize * 2 + 400),
      new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 40);
    this.scene.add(ground);
    this.groundMeshes.push(ground);
  }

  _buildRoadGrid() {
    const half = CITY.halfSize;
    const step = CITY.blockSize + CITY.roadWidth;
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
    const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const count = CITY.streetCount;
    for (let i = 0; i < count; i += 1) {
      const coord = -half + i * step + CITY.blockSize / 2;
      this.streetCenters.push(coord);
      // North-south road.
      const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, half * 2), roadMat);
      roadNS.rotation.x = -Math.PI / 2;
      roadNS.position.set(coord, 0, 0);
      this.scene.add(roadNS);
      // East-west road.
      const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat);
      roadEW.rotation.x = -Math.PI / 2;
      roadEW.position.set(0, 0, coord);
      this.scene.add(roadEW);
      this.roads.push({ x: coord, z: 0, vertical: true });
      this.roads.push({ x: 0, z: coord, vertical: false });
      // Centre dashes on both roads.
      for (let d = -half + 10; d < half; d += 24) {
        const dashNS = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 7), lineMat);
        dashNS.rotation.x = -Math.PI / 2;
        dashNS.position.set(coord, 0.02, d);
        this.scene.add(dashNS);
        const dashEW = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.7), lineMat);
        dashEW.rotation.x = -Math.PI / 2;
        dashEW.position.set(d, 0.02, coord);
        this.scene.add(dashEW);
      }
      // Sidewalk strips along each road.
      const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(3, half * 2), walkMat);
      walkNS.rotation.x = -Math.PI / 2;
      walkNS.position.set(coord + CITY.roadWidth / 2 + 1.5, 0.01, 0);
      this.scene.add(walkNS);
      const walkNS2 = walkNS.clone();
      walkNS2.position.x = coord - CITY.roadWidth / 2 - 1.5;
      this.scene.add(walkNS2);
    }
  }

  _buildBlocks() {
    const step = CITY.blockSize + CITY.roadWidth;
    const half = CITY.halfSize;
    for (let bx = 0; bx < CITY.streetCount - 1; bx += 1) {
      for (let bz = 0; bz < CITY.streetCount - 1; bz += 1) {
        const cx = -half + bx * step + CITY.blockSize + CITY.roadWidth / 2;
        const cz = -half + bz * step + CITY.blockSize + CITY.roadWidth / 2;
        if (cz > 330) continue; // Boardwalk / beach strip stays open.
        const downtown = Math.abs(cx) < 160 && Math.abs(cz + 40) < 160;
        this._buildOneBlock(cx, cz, downtown);
      }
    }
  }

  _buildOneBlock(cx, cz, downtown) {
    const rng = this.rng;
    const kind = rng();
    if (kind < 0.12) {
      // A small park: grass, trees, a bench or two.
      this._buildPark(cx, cz);
      return;
    }
    if (kind < 0.2) {
      // A car park: flat asphalt with painted bays.
      const lot = new THREE.Mesh(
        new THREE.PlaneGeometry(CITY.blockSize - 6, CITY.blockSize - 6),
        new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
      );
      lot.rotation.x = -Math.PI / 2;
      lot.position.set(cx, 0.02, cz);
      this.scene.add(lot);
      return;
    }
    const towerCount = downtown ? randomInt(rng, 3, 4) : randomInt(rng, 2, 3);
    // A paved block slab so the block reads as city, not bare grass.
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.blockSize - 2, CITY.blockSize - 2),
      new THREE.MeshLambertMaterial({ color: 0xb9b3a4 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(cx, 0.01, cz);
    this.scene.add(slab);
    for (let i = 0; i < towerCount; i += 1) {
      const w = randomInRange(rng, 16, 26);
      const d = randomInRange(rng, 16, 26);
      const h = downtown ? randomInRange(rng, 28, 78) : randomInRange(rng, 8, 24);
      const ox = randomInRange(rng, -14, 14);
      const oz = randomInRange(rng, -14, 14);
      const x = cx + ox;
      const z = cz + oz;
      this._addBuilding(x, z, w, h, d, downtown);
    }
  }

  _addBuilding(x, z, w, h, d, downtown) {
    const color = pickFrom(this.rng, PALETTE.buildingColors);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.set(x, h / 2, z);
    this.scene.add(body);
    this.buildingMeshes.push(body);
    // Glass window band near the top, and a darker roof slab.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, Math.max(2, h * 0.12), d + 0.3),
      new THREE.MeshLambertMaterial({ color: PALETTE.glass, emissive: 0x1a3a4a }),
    );
    band.position.set(x, h * 0.82, z);
    this.scene.add(band);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 1.2, d * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x5a5f66 }),
    );
    roof.position.set(x, h + 0.6, z);
    this.scene.add(roof);
    if (downtown && h > 40) {
      // Rooftop beacon so the skyline reads at a glance.
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4444 }),
      );
      beacon.position.set(x, h + 2.4, z);
      beacon.name = 'beacon';
      this.scene.add(beacon);
      this.props.push(beacon);
    }
    const record = { x, z, w, d, h, downtown };
    this.buildings.push(record);
    this.minimapBuildings.push({ x, z, w, d });
  }

  _buildPark(cx, cz) {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.blockSize - 8, CITY.blockSize - 8),
      new THREE.MeshLambertMaterial({ color: 0x5da85a }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.02, cz);
    this.scene.add(lawn);
    for (let i = 0; i < 4; i += 1) {
      const tx = cx + randomInRange(this.rng, -20, 20);
      const tz = cz + randomInRange(this.rng, -20, 20);
      this._addPalm(tx, tz, randomInRange(this.rng, 0.8, 1.3));
    }
  }

  _buildBeachAndSea() {
    // Sand strip along the south edge, then the sea beyond it.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.halfSize * 2 + 400, 60),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, 405);
    this.scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.halfSize * 2 + 600, 400),
      new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.4, 640);
    this.scene.add(sea);
    // Boardwalk planks.
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.halfSize * 2, 10),
      new THREE.MeshLambertMaterial({ color: 0xb98a5a }),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.04, 372);
    this.scene.add(walk);
    for (let x = -380; x < 390; x += 42) {
      this._addPalm(x + randomInRange(this.rng, -6, 6), 388, 1.15);
    }
  }

  _addPalm(x, z, scale) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    trunk.position.y = 3.5;
    trunk.rotation.z = 0.08;
    group.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 5.5, 4),
        new THREE.MeshLambertMaterial({ color: 0x2f8f3a }),
      );
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 1.6, 7.2, Math.sin(angle) * 1.6);
      leaf.rotation.z = Math.cos(angle) * 1.1;
      leaf.rotation.x = -Math.sin(angle) * 1.1;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    this.scene.add(group);
    this.palms.push(group);
  }

  _buildPalmsAndProps() {
    // Street lamps and hydrants along a few avenues.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const coord of this.streetCenters) {
      for (let d = -380; d < 380; d += 78) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), lampMat);
        pole.position.set(coord + CITY.roadWidth / 2 + 3.4, 3, d);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), bulbMat);
        bulb.position.set(coord + CITY.roadWidth / 2 + 3.4, 6.2, d);
        this.scene.add(bulb);
        this.props.push(pole, bulb);
      }
    }
  }

  _buildLandmarks() {
    // The Downtown bank tower (mission 5), the Marina lighthouse, the
    // Docks warehouse and Delia's garage — big readable silhouettes.
    this._addLandmarkTower(0, -40, 34, 96, 34, 0xcfd8e6, 'BANK');
    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4.5, 26, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    light.position.set(-300, 13, 330);
    this.scene.add(light);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    cap.position.set(-300, 29, 330);
    this.scene.add(cap);
    this.props.push(light, cap);
    const warehouse = new THREE.Mesh(
      new THREE.BoxGeometry(46, 14, 30),
      new THREE.MeshLambertMaterial({ color: 0x7a6a55 }),
    );
    warehouse.position.set(-280, 7, -260);
    this.scene.add(warehouse);
    this.buildings.push({ x: -280, z: -260, w: 46, d: 30, h: 14, downtown: false });
    this.minimapBuildings.push({ x: -280, z: -260, w: 46, d: 30 });
    const garage = new THREE.Mesh(
      new THREE.BoxGeometry(30, 9, 20),
      new THREE.MeshLambertMaterial({ color: 0x3d6e9e }),
    );
    garage.position.set(250, 4.5, 220);
    this.scene.add(garage);
    this.buildings.push({ x: 250, z: 220, w: 30, d: 20, h: 9, downtown: false });
    this.minimapBuildings.push({ x: 250, z: 220, w: 30, d: 20 });
  }

  _addLandmarkTower(x, z, w, h, d, color, label) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    tower.position.set(x, h / 2, z);
    this.scene.add(tower);
    this.buildings.push({ x, z, w, d, h, downtown: true });
    this.minimapBuildings.push({ x, z, w, d });
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.5, 6, d * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2f7fc9 }),
    );
    crown.position.set(x, h + 3, z);
    this.scene.add(crown);
    this.props.push(tower, crown);
  }

  // Collision: is a circle of the given radius at (x, z) inside a building?
  collidesWithBuilding(x, z, radius) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius) {
        return b;
      }
    }
    return null;
  }

  isOnRoad(x, z) {
    for (const coord of this.streetCenters) {
      if (Math.abs(x - coord) < CITY.roadWidth / 2 + 1) return true;
      if (Math.abs(z - coord) < CITY.roadWidth / 2 + 1) return true;
    }
    return false;
  }

  isInSea(x, z) {
    return z > 432;
  }

  clampToCity(x, z) {
    return {
      x: clampNumber(x, -CITY.halfSize - 20, CITY.halfSize + 20),
      z: clampNumber(z, -CITY.halfSize - 20, 432),
    };
  }

  randomRoadPoint(rng) {
    const coord = this.streetCenters[Math.floor(rng() * this.streetCenters.length)];
    const along = randomInRange(rng, -380, 380);
    if (rng() < 0.5) return { x: coord, z: along, heading: along > 0 ? 0 : Math.PI };
    return { x: along, z: coord, heading: Math.PI / 2 };
  }

  districtAt(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const d of DISTRICTS) {
      const dist = Math.hypot(x - d.x, z - d.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }
}
