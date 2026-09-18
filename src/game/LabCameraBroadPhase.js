import * as THREE from 'three';

/** Conservative per-update culling of ordinary rigid leaf meshes. The narrow
 * phase is STILL Three's original recursive raycast and original hit filter.
 * Unknown/custom/deformed/hierarchical objects always take that full path.
 * No collider or visibility state is copied here; bounds live for ONE update.
 */
export class LabCameraBroadPhase {
  constructor() {
    this.entries = [];
    this.candidates = [];
    this.query = new THREE.Box3();
    this.localBounds = new WeakMap();
    this.active = false;
  }

  begin(objects) {
    this.entries.length = objects.length;
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i], geometry = object.geometry;
      let entry = this.entries[i];
      if (!entry) entry = this.entries[i] = { object: null, box: new THREE.Box3(), bounded: false };
      entry.object = object;
      entry.bounded = false;
      // Do not assume bounds for custom raycast (sprites/lines/points/LOD),
      // descendants, skinning, instances or morph targets. Invisible collision
      // proxies are ordinary meshes and MUST remain eligible for collisions.
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh
        || object.children.length || object.raycast !== THREE.Mesh.prototype.raycast
        || !geometry?.attributes.position || Object.keys(geometry.morphAttributes || {}).length) continue;
      const position = geometry.attributes.position;
      if (position.isGLBufferAttribute) continue;
      let local = this.localBounds.get(geometry);
      const version = position.isInterleavedBufferAttribute ? position.data.version : position.version;
      if (!local || local.position !== position || local.version !== version || local.count !== position.count) {
        local = { position, version, count: position.count, box: new THREE.Box3().setFromBufferAttribute(position) };
        this.localBounds.set(geometry, local);
      }
      entry.box.copy(local.box).applyMatrix4(object.matrixWorld);
      const { min, max } = entry.box;
      entry.bounded = Number.isFinite(min.x + min.y + min.z + max.x + max.y + max.z) && !entry.box.isEmpty();
    }
    this.active = true;
  }

  select(objects, origin, direction, distance, radius) {
    if (!this.active) return objects; // Independent calls retain the full original query.
    // Enclose all nine parallel rays, INCLUDING the original far extension.
    // The epsilon makes grazing a boundary conservative under float rounding.
    const far = distance + radius, pad = radius + 1e-7;
    const ex = origin.x + direction.x * far, ey = origin.y + direction.y * far, ez = origin.z + direction.z * far;
    this.query.min.set(Math.min(origin.x, ex) - pad, Math.min(origin.y, ey) - pad, Math.min(origin.z, ez) - pad);
    this.query.max.set(Math.max(origin.x, ex) + pad, Math.max(origin.y, ey) + pad, Math.max(origin.z, ez) + pad);
    this.candidates.length = 0;
    // Preserve source order, duplicates, descendants, materials and layer policy.
    for (const entry of this.entries) if (!entry.bounded || this.query.intersectsBox(entry.box)) this.candidates.push(entry.object);
    return this.candidates;
  }

  end() { this.active = false; this.candidates.length = 0; }
  clear() { this.end(); this.entries.length = 0; this.localBounds = new WeakMap(); }
}
