/** Only the enclosed upper reunion chamber needs the bounded twelve-view
 * mechanism lens. Keep the optical cages, light duct and lower mirror on
 * their ordinary camera, including their existing narrow-screen shoulder. */
export function room13ReunionCameraArea(level, index, target, companion) {
  return index === 12 && level?.id === 'optical-paradox'
    && target.x >= 7 && target.x <= 15
    && target.z >= .3 && target.z <= 7
    && target.y >= 11.7 && target.y <= 15
    // The last floor-address shot needs the original optical shoulder.
    // Begin reunion framing only once the same physical companion has
    // actually arrived upstairs; no solved flag or route timer is involved.
    && companion?.y >= 11.7 && companion.y <= 16
    && companion.x >= 7 && companion.x <= 15
    && companion.z >= .3 && companion.z <= 7;
}
