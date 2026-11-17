// The HUD: cash, health, wanted stars, the circular minimap with the city,
// the mission tracker, toasts, and every menu screen the game shows.

import { CITY, CONTROLS_TEXT } from './config.js';
import { clampNumber } from './utils.js';

export class HudManager {
  constructor() {
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.wantedEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('healthfill');
    this.carBar = document.getElementById('carbar');
    this.carFill = document.getElementById('carfill');
    this.missionTitle = document.getElementById('missionTitle');
    this.missionText = document.getElementById('missionText');
    this.missionDist = document.getElementById('missionDist');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.districtEl = document.getElementById('district');
    this.speedo = document.getElementById('speedo');
    this.speedNum = document.getElementById('speedNum');
    this.crosshair = document.getElementById('crosshair');
    this.statusEl = document.getElementById('status');
    this.damageEl = document.getElementById('damage');
    this.toastTimer = null;
    this.screens = {
      start: document.getElementById('startScreen'),
      pause: document.getElementById('pauseScreen'),
      busted: document.getElementById('bustedScreen'),
      wasted: document.getElementById('wastedScreen'),
      win: document.getElementById('winScreen'),
      loading: document.getElementById('loading'),
    };
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      if (el) el.style.display = key === name ? 'flex' : 'none';
    }
    if (!name && this.screens.loading) this.screens.loading.style.display = 'none';
  }

  hideAllScreens() {
    for (const el of Object.values(this.screens)) {
      if (el) el.style.display = 'none';
    }
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  showToast(text, seconds) {
    this.toastEl.textContent = text;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.textContent = '';
    }, (seconds || 3.5) * 1000);
  }

  showDamageFlash() {
    this.damageEl.style.display = 'block';
    setTimeout(() => {
      this.damageEl.style.display = 'none';
    }, 180);
  }

  updateHud(state) {
    this.wantedEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.wantedEl.style.color = state.wanted >= 3 ? '#ff5a4e' : '#ffd23f';
    this.cashEl.textContent = `$${state.cash.toLocaleString('en-US')}`;
    this.healthFill.style.width = `${clampNumber(state.health, 0, 100)}%`;
    if (state.inCar) {
      this.carBar.style.display = 'block';
      this.carFill.style.width = `${clampNumber(state.carHealth, 0, 100)}%`;
      this.speedo.style.display = 'block';
      this.speedNum.textContent = String(Math.round(state.speedMph));
      this.crosshair.style.display = 'none';
      this.hintEl.textContent = CONTROLS_TEXT.car;
    } else {
      this.carBar.style.display = 'none';
      this.speedo.style.display = 'none';
      this.crosshair.style.display = state.playing ? 'block' : 'none';
      this.hintEl.textContent = CONTROLS_TEXT.foot;
    }
    this.missionTitle.textContent = state.missionTitle;
    this.missionText.textContent = state.missionText;
    this.missionDist.textContent = state.missionDistance;
    if (state.district) this.districtEl.textContent = state.district.toUpperCase();
  }

  // The circular minimap: roads, buildings, the sea, the player arrow, cop
  // dots, traffic dots and the pulsing gold mission marker.
  drawMinimap(world) {
    const ctx = this.mapCtx;
    const size = 220;
    const center = size / 2;
    const scale = size / (CITY.halfSize * 2 + 120);
    const toMap = (x, z) => [center + x * scale, center + z * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#12303f';
    ctx.fillRect(0, 0, size, size);
    // Sea along the south edge.
    ctx.fillStyle = '#1f7fa8';
    const [, seaY] = toMap(0, 432);
    ctx.fillRect(0, seaY, size, size - seaY);
    // Sand.
    ctx.fillStyle = '#e8d29a';
    const [, sandY] = toMap(0, 375);
    ctx.fillRect(0, sandY, size, seaY - sandY);
    // Roads.
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 7;
    for (const coord of world.city.streetCenters) {
      const [rx] = toMap(coord, 0);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, size);
      ctx.stroke();
      const [, rz] = toMap(0, coord);
      ctx.beginPath();
      ctx.moveTo(0, rz);
      ctx.lineTo(size, rz);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8fa3b5';
    for (const b of world.city.minimapBuildings) {
      const [bx, bz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(bx, bz, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
    }
    // Traffic dots.
    ctx.fillStyle = '#ffd23f';
    for (const car of world.traffic.cars) {
      const [cx, cz] = toMap(car.x, car.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    // Mission marker, pulsing.
    const marker = world.missions.markerPosition();
    if (marker) {
      const [mx, mz] = toMap(marker.x, marker.z);
      const pulse = 5 + Math.sin(Date.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx, mz, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Cop dots.
    ctx.fillStyle = '#ff4d4d';
    for (const cop of world.police.copCars) {
      const [cx, cz] = toMap(cop.x, cop.z);
      ctx.beginPath();
      ctx.arc(cx, cz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of world.police.copPeds) {
      const [cx, cz] = toMap(cop.x, cop.z);
      ctx.fillRect(cx - 2, cz - 2, 4, 4);
    }
    // Player arrow, rotated to the heading.
    const [px, pz] = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-world.player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', center, 16);
  }
}
