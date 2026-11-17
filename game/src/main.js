// Solara Bay — the entry point. Boots three.js, builds the city, wires the
// player, traffic, pedestrians, police, missions, combat, sound, HUD and
// save together, and runs the frame loop. Nothing here fetches anything.

const THREE = window.THREE;
import { CityBuilder } from './city.js';
import { PlayerController } from './player.js';
import { TrafficManager, drivePlayerCar } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { CombatManager } from './combat.js';
import { MissionManager } from './missions.js';
import { EffectsManager } from './effects.js';
import { SoundEngine } from './audio.js';
import { HudManager } from './hud.js';
import { InputManager } from './input.js';
import { loadSaveData, writeSaveData, clearSaveData, defaultSaveData } from './save.js';
import { distance2D, formatDuration } from './utils.js';
import { MISSIONS } from './config.js';
import { setupShotScenes } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(10, 6, 52);

const city = new CityBuilder(scene).buildCity();
const player = new PlayerController(scene, city);
const traffic = new TrafficManager(scene, city);
const pedestrians = new PedestrianManager(scene, city);
const police = new PoliceManager(scene, city);
const combat = new CombatManager(scene, city);
const missions = new MissionManager(scene);
const effects = new EffectsManager(scene);
const sound = new SoundEngine();
const hud = new HudManager();
const input = new InputManager(canvas);

traffic.spawnTraffic(18);
pedestrians.spawnPedestrians(26);

const world = { city, player, traffic, pedestrians, police, combat, missions, cash: 0 };

let gameState = 'loading';
let paused = false;
let muted = false;
let playTime = 0;
let lastSaveAt = 0;
let lastFrameAt = performance.now();
let shotMode = null;
let bustedReason = '';

missions.onToast = (text) => hud.showToast(text, 4);
missions.onStepChange = (mission, step) => {
  if (mission && step) hud.showToast(`${mission.title}: ${step.text}`, 4);
};
missions.onMissionComplete = (mission, reward) => {
  hud.showToast(`MISSION COMPLETE — ${mission.title}  +$${reward}`, 5);
  sound.playMissionComplete();
  effects.spawnPickupSparkle(player.x, 2, player.z);
};
missions.onStoryComplete = (cash) => {
  document.getElementById('winText').textContent =
    `You pulled off the Big Score and slipped away by boat with $${cash.toLocaleString('en-US')} in the bag. ` +
    'Solara Bay is yours now — keep playing in free roam.';
  gameState = 'won';
  hud.showScreen('win');
  input.exitPointerLock();
};

police.onSiren = () => sound.playSirenBlip();
police.onBusted = (reason) => {
  if (gameState !== 'playing') return;
  bustedReason = reason;
  gameState = 'busted';
  world.cash = Math.max(0, world.cash - 200);
  if (player.currentCar) {
    traffic.removeCar(player.currentCar);
    player.exitCar();
  }
  police.clearWanted();
  sound.playBusted();
  hud.showScreen('busted');
  input.exitPointerLock();
  saveGame();
};

combat.onEnemyDown = (enemy) => {
  world.cash += 50;
  hud.showToast('Rival down — +$50', 2);
  sound.playPickup();
  effects.spawnBurst(enemy.x, 1.2, enemy.z, 0xff5a4e, 12, 5, 0.5, 0.16, 6);
};
combat.onPlayerHit = (damage) => {
  if (gameState !== 'playing') return;
  const died = player.takeDamage(damage);
  hud.showDamageFlash();
  sound.playHit();
  if (died) wasted();
};

function wasted() {
  if (gameState !== 'playing') return;
  gameState = 'wasted';
  world.cash = Math.max(0, world.cash - 150);
  police.clearWanted();
  sound.playBusted();
  hud.showScreen('wasted');
  input.exitPointerLock();
  saveGame();
}

function saveGame() {
  writeSaveData({
    cash: world.cash,
    missionIndex: missions.missionIndex,
    missionStep: missions.stepIndex,
    playerX: player.x,
    playerZ: player.z,
    playerHeading: player.heading,
    completedMissions: missions.completedMissions,
    carsOwned: 0,
    playTimeSeconds: Math.round(playTime),
  });
}

function loadIntoGame(save) {
  world.cash = save.cash || 0;
  missions.missionIndex = save.missionIndex || 0;
  missions.stepIndex = save.missionStep || 0;
  missions.completedMissions = save.completedMissions || [];
  missions.freeRoam = missions.missionIndex >= MISSIONS.length;
  playTime = save.playTimeSeconds || 0;
  player.setPosition(save.playerX || 10, save.playerZ || 40, save.playerHeading || 0);
  missions.startMission(missions.missionIndex);
  missions.stepIndex = save.missionStep || 0;
  missions._armStep();
}

function startGame(fromSave) {
  sound.ensureStarted();
  sound.playUiClick();
  if (fromSave) {
    const save = loadSaveData();
    if (save) loadIntoGame(save);
  } else {
    world.cash = 0;
    playTime = 0;
    player.health = 100;
    player.setPosition(10, 40, 0);
    missions.completedMissions = [];
    missions.startMission(0);
    clearSaveData();
  }
  gameState = 'playing';
  paused = false;
  hud.hideAllScreens();
  hud.showToast('Welcome to Solara Bay — follow the gold marker', 5);
  hud.setStatus('Solara Bay: playing, follow the gold mission marker');
  input.requestPointerLock();
}

function enterNearestCar() {
  if (player.inCar) {
    const car = player.exitCar();
    if (car) traffic.cars.push(car);
    hud.showToast('You got out', 2);
    return;
  }
  const car = traffic.nearestCar(player.x, player.z, 4.5);
  if (!car) {
    hud.showToast('No car close enough — walk up to one', 2);
    return;
  }
  traffic.removeCar(car);
  const playerCar = traffic.spawnPlayerCar(car.x, car.z, car.heading, car.color);
  playerCar.name = car.name;
  playerCar.health = 100;
  player.enterCar(playerCar);
  sound.playUiClick();
  hud.showToast(`You stole a ${car.name}!`, 2.5);
  const seen = Math.random() < 0.6;
  if (seen) {
    police.addHeat(14);
    hud.showToast('Someone saw you steal that car — the cops are coming!', 3.5);
  }
}

function fireWeapon() {
  if (!player.canShoot(performance.now())) return;
  player.markShot(performance.now());
  const origin = new THREE.Vector3(player.x, 1.5, player.z);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = clampAim(direction.y);
  const hit = combat.playerShoot(origin, direction, police.copPeds);
  sound.playGunshot();
  if (hit && hit.kind === 'enemy') {
    sound.playHit();
    hud.showToast('Hit!', 1);
  }
  if (hit && hit.kind === 'cop') {
    police.addHeat(22);
    hud.showToast('You shot a cop! Wanted level up!', 3);
  }
  if (!hit) {
    pedestrians.updatePedestrians(0, { x: player.x, z: player.z, radius: 14 });
  }
  if (police.wanted === 0 && (hit && hit.kind === 'enemy')) {
    // Shooting rivals in a mission is the job; no heat from it.
  } else if (hit || true) {
    const nearPed = pedestrians.peds.some((p) => distance2D(p.x, p.z, player.x, player.z) < 25);
    if (nearPed && police.wanted < 2) police.addHeat(8);
  }
}

function clampAim(y) {
  return Math.max(-0.6, Math.min(0.4, y));
}

function respawnAfterDeath() {
  player.health = 100;
  player.setPosition(10, 40, 0);
  police.clearWanted();
  gameState = 'playing';
  hud.hideAllScreens();
  hud.showToast('Patched up. Back on the streets.', 3);
  input.requestPointerLock();
  saveGame();
}

function togglePause() {
  if (gameState !== 'playing' && gameState !== 'paused') return;
  paused = !paused;
  gameState = paused ? 'paused' : 'playing';
  if (paused) {
    document.getElementById('pauseStats').textContent =
      `Cash $${world.cash.toLocaleString('en-US')} · Missions complete ${missions.completedMissions.length} of ${MISSIONS.length} · ` +
      `Wanted ${'★'.repeat(police.wanted) || 'clean'} · Play time ${formatDuration(playTime)}`;
    hud.showScreen('pause');
    input.exitPointerLock();
    saveGame();
  } else {
    hud.hideAllScreens();
    input.requestPointerLock();
  }
}

function updatePlaying(dt) {
  playTime += dt;
  const now = performance.now();
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    togglePause();
    return;
  }
  if (input.wasPressed('KeyM')) {
    muted = !muted;
    sound.setMuted(muted);
    hud.showToast(muted ? 'Sound muted' : 'Sound on', 1.5);
  }
  if (input.wasPressed('KeyE')) enterNearestCar();
  if (player.inCar && player.currentCar) {
    const speed = drivePlayerCar(player.currentCar, input, dt, city, (impact) => {
      sound.playCrash();
      effects.spawnCrashSparks(player.x, 0.8, player.z);
      player.currentCar.health -= impact * 0.8;
      if (player.currentCar.health <= 0) {
        effects.spawnExplosion(player.x, 1, player.z);
        sound.playCrash();
        hud.showToast('Your car is wrecked!', 3);
        const wreck = player.currentCar;
        player.exitCar();
        traffic.removeCar(wreck);
        player.health = Math.max(10, player.health - 20);
      }
    });
    sound.setEngineSpeed(Math.abs(player.currentCar.speed) / 34, true);
    player.updateInCar(camera, dt);
    if (Math.abs(player.currentCar.speed) > 12 && Math.random() < dt * 6) {
      const backX = player.currentCar.x - Math.sin(player.currentCar.heading) * 2.4;
      const backZ = player.currentCar.z - Math.cos(player.currentCar.heading) * 2.4;
      effects.spawnExhaust(backX, 0.4, backZ);
    }
    // Hitting pedestrians while driving draws heat.
    for (const ped of pedestrians.peds) {
      if (distance2D(ped.x, ped.z, player.x, player.z) < 2.2 && Math.abs(player.currentCar.speed) > 4) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        police.addHeat(18);
        sound.playCrash();
      }
    }
  } else {
    player.updateOnFoot(input, dt, camera);
    sound.setEngineSpeed(0, false);
    if (input.mouseDown || input.consumeClick()) fireWeapon();
  }
  traffic.updateTraffic(dt, { x: player.x, z: player.z });
  // Pedestrians dive out of the way of a speeding car — or get clipped.
  const carDanger = player.inCar && player.currentCar && Math.abs(player.currentCar.speed) > 8
    ? { x: player.x, z: player.z, radius: 11 }
    : null;
  pedestrians.updatePedestrians(dt, carDanger);
  police.updatePolice(dt, player, player.currentCar, (cop, dist) => {
    const from = new THREE.Vector3(cop.x, 1.4, cop.z);
    const to = new THREE.Vector3(player.x, 1.2, player.z);
    const dir = to.clone().sub(from).normalize();
    combat._spawnTracer(from, dir);
    combat._spawnFlash(from);
    sound.playGunshot();
    if (Math.random() < 0.3) {
      const died = player.takeDamage(6 + Math.random() * 5);
      hud.showDamageFlash();
      if (died) wasted();
    }
  });
  combat.updateEnemies(dt, { x: player.x, z: player.z }, player.inCar);
  effects.updateEffects(dt, camera);
  const event = missions.updateMission(dt, world);
  if (event && event.type === 'timerFailed') {
    hud.showToast('Too slow! The buyers walked — mission restarted', 4);
    missions.failTimer();
  }
  if (playTime - lastSaveAt > 20) {
    lastSaveAt = playTime;
    saveGame();
  }
  const status = missions.statusText();
  const district = city.districtAt(player.x, player.z);
  hud.updateHud({
    wanted: police.wanted,
    cash: world.cash,
    health: player.health,
    carHealth: player.currentCar ? player.currentCar.health : 100,
    inCar: player.inCar,
    speedMph: player.currentCar ? Math.abs(player.currentCar.speed) * 2.1 : 0,
    playing: true,
    district: district ? district.name : 'Solara Bay',
    missionTitle: status.title,
    missionText: status.text,
    missionDistance: status.distance,
  });
  hud.drawMinimap(world);
}

function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  const dt = Math.min(0.05, (now - lastFrameAt) / 1000 || 0.016);
  lastFrameAt = now;
  if (gameState === 'playing' && !paused) updatePlaying(dt);
  if (gameState === 'loading' || gameState === 'title') {
    // The title screen orbits the city so the menu itself shows the world.
    const t = now * 0.00004;
    camera.position.set(Math.sin(t) * 260, 120, Math.cos(t) * 260);
    camera.lookAt(0, 10, 0);
    traffic.updateTraffic(dt, null);
    pedestrians.updatePedestrians(dt, null);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('playBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('howBtn').addEventListener('click', () => {
  const how = document.getElementById('howText');
  how.style.display = how.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('restartBtn').addEventListener('click', () => {
  clearSaveData();
  startGame(false);
});
document.getElementById('menuBtn').addEventListener('click', () => {
  gameState = 'title';
  hud.showScreen('start');
});
document.getElementById('bustedBtn').addEventListener('click', respawnAfterDeath);
document.getElementById('wastedBtn').addEventListener('click', respawnAfterDeath);
document.getElementById('winBtn').addEventListener('click', () => {
  gameState = 'playing';
  hud.hideAllScreens();
  input.requestPointerLock();
});

input.onFirstGesture = () => sound.ensureStarted();

// Boot: title screen, or straight into a scripted shot scene.
const params = new URLSearchParams(window.location.search);
shotMode = params.get('shot');
const saved = loadSaveData();
if (saved) {
  document.getElementById('continueBtn').style.display = 'inline-block';
}
hud.showScreen('start');
hud.setStatus('Solara Bay title screen: press Start Engine to play');
gameState = 'title';
if (shotMode) {
  setupShotScenes({ shotMode, world, player, traffic, pedestrians, police, combat, missions, hud, sound, camera, startGame });
}
requestAnimationFrame(frameLoop);
window.__shotReady = false;
