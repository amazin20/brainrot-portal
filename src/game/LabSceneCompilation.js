/** Submit the shader work before polling parallel-compilation readiness.
 * A stopped loading loop otherwise leaves some native WebGL drivers waiting
 * for queued links. Both public compile calls use identical scene arguments;
 * the second reuses those programs. Actual portal/shadow warm draws still run
 * afterward and establish variants not covered by compileAsync. */
export async function compileLabScene(renderer,scene,camera,targetScene=scene){
 if(!renderer?.compileAsync)return;
 if(renderer.compile){
  renderer.compile(scene,camera,targetScene);
  renderer.getContext?.()?.flush?.();
 }
 await renderer.compileAsync(scene,camera,targetScene);
}
