import * as THREE from 'three';

function rigidMaterial(material) {
  return !!material && !material.isShaderMaterial && !material.displacementMap
    && material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
}

/** Conservative CPU culling to the SAME pixel rectangle already scissored by
 * the portal renderer. The optical camera/projection/viewport and texture UVs
 * are untouched. This only avoids submitting rigid meshes whose renderer
 * bounds lie entirely outside that rectangle. No occlusion guesses or cadence
 * reduction. Deformed/custom-displacement and hierarchical meshes fall back.
 * All visibility changes are scoped to one synchronous render, then restored. */
export class LabPortalRenderCulling {
  constructor() {
    this.enabled = true;
    this.crop = new THREE.Matrix4();
    this.viewProjection = new THREE.Matrix4();
    this.frustum = new THREE.Frustum();
    this.hidden = [];
    this.active = false;
    this.tested = 0;
  }

  begin(scene, camera, rect, width, height, reversedDepth = false) {
    if (this.active) throw new Error('Portal culling is already active');
    this.tested = 0;
    if (!this.enabled) return;
    const { x, y, width: w, height: h } = rect;
    if (![x, y, w, h, width, height].every(Number.isFinite)
      || w <= 0 || h <= 0 || width <= 0 || height <= 0) return;
    // Pad the true scissor by two pixels, so floating point edge decisions
    // cannot discard a sample the rasterizer might cover at the boundary.
    const left = Math.max(0, x - 2), bottom = Math.max(0, y - 2);
    const right = Math.min(width, x + w + 2), top = Math.min(height, y + h + 2);
    const cw = right - left, ch = top - bottom;
    if (cw <= 0 || ch <= 0 || (cw === width && ch === height)) return;
    this.crop.set(width / cw, 0, 0, (width - right - left) / cw,
      0, height / ch, 0, (height - top - bottom) / ch,
      0, 0, 1, 0, 0, 0, 0, 1);
    this.viewProjection.copy(this.crop).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection, camera.coordinateSystem, reversedDepth);
    this.active = true;
    // World matrices are refreshed by the caller with the same policy as
    // WebGLRenderer, before traversal. InstancedMesh bounds follow Three's
    // own aggregate bounds; never test an individual instance independently.
    scene.traverseVisible(object => {
      if (!object.isMesh || !object.frustumCulled || object.isSkinnedMesh
        || object.children.length) return;
      for (const key in object.geometry?.morphAttributes) if (object.geometry.morphAttributes[key]?.length) return;
      if (Array.isArray(object.material)) {
        if (!object.material.length || !object.material.every(rigidMaterial)) return;
      } else if (!rigidMaterial(object.material)) return;
      // Render callbacks can generate or move geometry just before drawing.
      if (object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
      this.tested++;
      if (!this.frustum.intersectsObject(object)) {
        this.hidden.push(object);
        object.visible = false;
      }
    });
  }

  end() {
    for (const object of this.hidden) object.visible = true;
    this.hidden.length = 0;
    this.active = false;
  }
}
