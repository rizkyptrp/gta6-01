// Screenshot scenes for Solara Bay: scripted setups driven by ?shot= so
// the cover and the other screenshots are real renders of the live game,
// each showing several systems at once.

export function setupShotScenes(ctx) {
  const { shotMode, world, player, traffic, pedestrians, police, combat, missions, hud, sound, camera, startGame } = ctx;
  const readyAfter = (ms, extra) => {
    setTimeout(() => {
      if (extra) extra();
      window.__shotReady = true;
    }, ms);
  };

  if (shotMode === 'start') {
    // Title screen over the orbiting city.
    readyAfter(1200);
    return;
  }

  // Every gameplay shot starts a real game, then stages its scene.
  startGame(false);
  sound.setMuted(true);

  if (shotMode === 'drive') {
    missions.startMission(1);
    const car = traffic.spawnPlayerCar(2, 60, Math.PI, 0x2471a3);
    player.enterCar(car);
    player.setPosition(2, 60, Math.PI);
    camera.position.set(2, 6, 78);
    readyAfter(1600);
    return;
  }

  if (shotMode === 'chase') {
    missions.startMission(4);
    const car = traffic.spawnPlayerCar(-76, -20, Math.PI, 0xc0392b);
    car.speed = 18;
    player.enterCar(car);
    player.setPosition(-76, -20, Math.PI);
    police.setWanted(3);
    police._spawnCopCarNear(-76, -20);
    police._spawnCopCarNear(-76, -20);
    police._spawnCopCarNear(-76, -20);
    hud.showToast('3-STAR MANHUNT — lose the cops!', 5);
    readyAfter(1800, () => {
      // Nudge the chase into frame: cops close behind the player.
      for (const cop of police.copCars) {
        cop.x = player.x - Math.sin(player.heading) * 14 - 6;
        cop.z = player.z - Math.cos(player.heading) * 14 - 6;
      }
    });
    return;
  }

  if (shotMode === 'mission') {
    missions.startMission(3);
    player.setPosition(-238, -218, Math.PI / 4);
    player.cameraYaw = Math.PI / 4;
    combat.spawnEnemies(-270, -250, 4, 'Kane crew');
    police.setWanted(1);
    camera.position.set(-232, 5, -212);
    readyAfter(1600);
    return;
  }

  if (shotMode === 'onfoot') {
    missions.startMission(0);
    player.setPosition(8, 30, Math.PI);
    player.cameraYaw = Math.PI;
    // A busy sidewalk: pull pedestrians and traffic into view.
    for (let i = 0; i < 6; i += 1) {
      const ped = pedestrians.peds[i];
      if (ped) {
        ped.x = 8 + (i % 3) * 4 - 4;
        ped.z = 30 - Math.floor(i / 3) * 8 - 4;
        ped.targetX = ped.x;
        ped.targetZ = ped.z + 30;
      }
    }
    camera.position.set(8, 5, 46);
    readyAfter(1500);
    return;
  }

  readyAfter(800);
}
