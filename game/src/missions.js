// Story missions for Solara Bay: the five-job arc for Mara Voss, the step
// machine that moves the gold marker, the timers, and the payouts.

const THREE = window.THREE;
import { MISSIONS } from './config.js';
import { distance2D } from './utils.js';

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.completedMissions = [];
    this.freeRoam = false;
    this.timer = 0;
    this.timerActive = false;
    this.marker = this._buildMarker();
    this.scene.add(this.marker);
    this.onMissionComplete = null;
    this.onStoryComplete = null;
    this.onToast = null;
    this.onStepChange = null;
    this._combatSpawned = false;
    this._wantedSetForStep = false;
  }

  _buildMarker() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd23f, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 30;
    group.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    diamond.position.y = 9;
    diamond.name = 'diamond';
    group.add(diamond);
    return group;
  }

  currentMission() {
    if (this.freeRoam) return null;
    return MISSIONS[this.missionIndex] || null;
  }

  currentStep() {
    const mission = this.currentMission();
    if (!mission) return null;
    return mission.steps[this.stepIndex] || null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.freeRoam = false;
    this._combatSpawned = false;
    this._wantedSetForStep = false;
    this._armStep();
    if (this.onStepChange) this.onStepChange(this.currentMission(), this.currentStep());
  }

  _armStep() {
    const step = this.currentStep();
    if (!step) return;
    this.timerActive = Boolean(step.timer);
    this.timer = step.timer || 0;
    if (step.kind === 'reach' || step.kind === 'combat') {
      this.marker.position.set(step.x, 0, step.z);
      this.marker.visible = true;
    } else {
      this.marker.visible = step.kind === 'stealCar' ? false : true;
      if (step.kind === 'loseWanted') this.marker.visible = false;
    }
    this._combatSpawned = false;
    this._wantedSetForStep = false;
  }

  // Called every frame with the live world; returns events the main loop
  // turns into toasts, sounds and police orders.
  updateMission(dt, world) {
    const mission = this.currentMission();
    const step = this.currentStep();
    if (!mission || !step) return null;
    const diamond = this.marker.getObjectByName('diamond');
    if (diamond) {
      diamond.rotation.y += dt * 2;
      diamond.position.y = 9 + Math.sin(Date.now() * 0.002) * 1.2;
    }
    if (this.timerActive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timerActive = false;
        return { type: 'timerFailed', mission };
      }
    }
    if (step.kind === 'stealCar') {
      if (world.player.inCar) return this._advanceStep(world);
      return null;
    }
    if (step.kind === 'reach') {
      const d = distance2D(world.player.x, world.player.z, step.x, step.z);
      if (d < (step.radius || 20)) return this._advanceStep(world);
      return { type: 'distance', distance: d };
    }
    if (step.kind === 'loseWanted') {
      if (mission.id === 'heat' && !this._wantedSetForStep) {
        world.police.setWanted(2);
        this._wantedSetForStep = true;
      }
      if (mission.id === 'big-score' && !this._wantedSetForStep) {
        world.police.setWanted(3);
        this._wantedSetForStep = true;
      }
      if (world.police.wanted === 0) return this._advanceStep(world);
      return null;
    }
    if (step.kind === 'combat') {
      if (!this._combatSpawned) {
        world.combat.spawnEnemies(step.x, step.z, step.enemies || 4, 'Kane crew');
        this._combatSpawned = true;
        if (this.onToast) this.onToast('Kane\'s crew is here — take them down!');
      }
      if (world.combat.aliveEnemies().length === 0) return this._advanceStep(world);
      return null;
    }
    return null;
  }

  _advanceStep(world) {
    const mission = this.currentMission();
    this.stepIndex += 1;
    if (this.stepIndex >= mission.steps.length) {
      const reward = mission.reward;
      this.completedMissions.push(mission.id);
      world.cash += reward;
      if (this.onMissionComplete) this.onMissionComplete(mission, reward);
      if (this.missionIndex + 1 >= MISSIONS.length) {
        this.freeRoam = true;
        this.marker.visible = false;
        if (this.onStoryComplete) this.onStoryComplete(world.cash);
        return { type: 'storyComplete', mission, reward };
      }
      this.missionIndex += 1;
      this.stepIndex = 0;
      this._armStep();
      if (this.onStepChange) this.onStepChange(this.currentMission(), this.currentStep());
      return { type: 'missionComplete', mission, reward };
    }
    this._armStep();
    if (this.onStepChange) this.onStepChange(mission, this.currentStep());
    return { type: 'stepComplete', mission };
  }

  failTimer() {
    // A failed timer restarts the current mission from its first step.
    this.stepIndex = 0;
    this._armStep();
    if (this.onStepChange) this.onStepChange(this.currentMission(), this.currentStep());
  }

  markerPosition() {
    const step = this.currentStep();
    if (!step || step.kind === 'loseWanted') return null;
    if (step.kind === 'stealCar') return null;
    return { x: step.x, z: step.z };
  }

  statusText() {
    const mission = this.currentMission();
    if (!mission) return { title: 'FREE ROAM — SOLARA BAY', text: 'Explore, steal cars, cause chaos. Missions complete!', distance: '' };
    const step = this.currentStep();
    let distance = '';
    if (step && (step.kind === 'reach' || step.kind === 'combat')) {
      distance = 'Follow the gold marker';
    }
    if (this.timerActive) distance = `TIME LEFT: ${Math.ceil(this.timer)}s`;
    return { title: mission.title, text: step ? step.text : '', distance };
  }
}
