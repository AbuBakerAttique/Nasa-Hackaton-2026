/** Request a fresh fix, retrying provider failures with a cached/coarse fix. */
export async function currentLocation(geolocation: Pick<Geolocation, "getCurrentPosition">): Promise<GeolocationPosition> {
  const request = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => {
    // Some browsers leave the permission prompt pending beyond their own timeout.
    const timer = setTimeout(() => reject({code: 3}), 13000);
    geolocation.getCurrentPosition(position => { clearTimeout(timer); resolve(position); }, error => { clearTimeout(timer); reject(error); }, options);
  });
  try {
    return await request({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  } catch (error) {
    if ((error as GeolocationPositionError).code === 1) throw error;
    return request({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }
}

export function locationErrorMessage(error: {code?: number}) {
  if (error.code === 1) return "Location access is blocked. Allow Location in your browser’s site settings, and enable Location Services for your browser in your device settings. Then try again. You can also search for your town.";
  if (error.code === 3) return "Your device took too long to find a location. Check that Location Services are enabled and try again, or search for your town.";
  return "Your browser could not get a location from your device. Enable Location Services and try again, or search for your town.";
}

/**
 * Read "lat, lon" typed into the place search, e.g. "52.52, 13.40" or "52.52 13.40".
 * Returns null for anything that is not two numbers in range, so it is searched as a name.
 */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
