import math
import random


def sample_gps(base_lat: float, base_lon: float, noise_m: float = 2.0):
    noise_lat = random.gauss(0, noise_m / 111320.0)
    noise_lon = random.gauss(0, noise_m / (111320.0 * max(math.cos(math.radians(base_lat)), 0.2)))
    return round(base_lat + noise_lat, 6), round(base_lon + noise_lon, 6)


def sample_accel_g(forward_mps2: float, lateral_mps2: float, vertical_mps2: float,
                   noise_g: float = 0.02):
    gx = forward_mps2 / 9.81 + random.gauss(0, noise_g)
    gy = lateral_mps2 / 9.81 + random.gauss(0, noise_g)
    gz = 1.0 + vertical_mps2 / 9.81 + random.gauss(0, noise_g)
    mag = math.sqrt(gx * gx + gy * gy + gz * gz)
    return {"x": round(gx, 3), "y": round(gy, 3), "z": round(gz, 3), "g": round(mag, 3)}


def sample_gyro_rps(yaw_rad_s: float = 0.0, noise: float = 0.005):
    return {
        "x": round(random.gauss(0, noise), 4),
        "y": round(random.gauss(0, noise), 4),
        "z": round(yaw_rad_s + random.gauss(0, noise), 4),
    }