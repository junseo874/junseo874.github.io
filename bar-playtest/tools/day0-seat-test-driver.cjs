module.exports=async function finishSeatLessons(p){
 await p.waitForFunction(()=>barGame.tutorial?.kind==='seatExplore');await p.keyboard.up('Control');await p.locator('[data-guide="seatExplore"]').waitFor();
 for(let i=0;i<8;i++){await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);const direction=await p.evaluate(()=>{if(barGame.tutorial?.kind!=='seatExplore')return null;return ['L','M','R'].indexOf(barGame.focus)<['L','M','R'].indexOf(barGame.tutorialSeatTarget())?'KeyD':'KeyA';});if(!direction)break;await p.keyboard.press(direction);await p.waitForTimeout(650);}
 await p.keyboard.down('Control');await p.waitForFunction(()=>barGame.tutorial?.kind==='seatIndicator');await p.keyboard.up('Control');await p.locator('[data-act="tutorialBarContinue"]').click();await p.locator('.day0-seat-legend').waitFor();await p.keyboard.press('Space');await p.keyboard.down('Control');
};
