/** Declared 10 m component fixture, not the normal authored Play spawn. */
export const ROOM23_DOCKED_INITIAL_STATE={displacement:10,spawn:[3.1,10,3],cargoSpawn:[1.1,10.61,3]};

/** All cargo transfer actions are production movement/E inputs. The clutch
 * bootstrap is explicitly a component command omitted by the initial fixture;
 * it actuates the real finite fork and never assigns a cabin/actor pose. */
export async function runRoom23DockedHandoff(d){
 const {game,level}=d,m=level.balance;
 d.wait(3);m.requestClutch(true);d.wait(6);
 d.mark('declared middle docking holds real east cargo and passenger');
 d.pickup();d.walk(5.5,3);d.wait(6);d.mark('finite hand joint extracts original from east freight pan');
 d.walk(5.5,1);d.walk(-4.2,1);d.walk(-4.2,3);d.walk(-2.8,3);
 // A bounded ordinary approach presses the traveller against the physical
 // passenger hood while the finite hand reaches into the cargo-only mouth.
 d.worldMove(1,0);for(let n=0;n<360;n++)d.frame();d.stop();d.wait(1);
 game.interact();d.wait(2);
 d.mark('same original free load enters west freight pan and reverses source');
 return{scope:'declared middle-height contact component fixture',normalAuthoredSpawn:false,clutchBootstrap:'component requestClutch(true), physical finite fork',
  cargoTransferActions:'ordinary movement, E pickup/release and real free-cargo pushing',fullOrdinaryRouteAccepted:false,
  terminal:{west:m.diagnostics().west,east:m.diagnostics().east,original:game.cargo.position.toArray(),passenger:game.playerPosition.toArray()}};
}
