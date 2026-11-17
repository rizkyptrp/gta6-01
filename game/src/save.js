// Save and load for Solara Bay: one localStorage slot holding cash, the
// story progress, the hero position and the garage of owned cars.

import { SAVE_KEY } from './config.js';

export function defaultSaveData() {
  return {
    cash: 0,
    missionIndex: 0,
    missionStep: 0,
    playerX: 10,
    playerZ: 40,
    playerHeading: 0,
    completedMissions: [],
    carsOwned: 0,
    playTimeSeconds: 0,
  };
}

export function loadSaveData() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { ...defaultSaveData(), ...parsed };
  } catch (error) {
    return null;
  }
}

export function hasSaveData() {
  return loadSaveData() !== null;
}

export function writeSaveData(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearSaveData() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    // Storage may be unavailable; the game still plays unsaved.
  }
}
