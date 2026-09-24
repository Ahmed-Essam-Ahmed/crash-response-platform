import math
from dataclasses import dataclass, field


@dataclass
class Node:
    idx: int
    lat: float
    lon: float


@dataclass
class Edge:
    a: int
    b: int


def haversine_m(a_lat, a_lon, b_lat, b_lon):
    r = 6371000.0
    dlat = math.radians(b_lat - a_lat)
    dlon = math.radians(b_lon - a_lon)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a_lat)) * \
        math.cos(math.radians(b_lat)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


@dataclass
class CityGrid:
    rows: int = 6
    cols: int = 6
    origin_lat: float = 30.0500
    origin_lon: float = 31.2300
    spacing: float = 0.0040

    nodes: list = field(default_factory=list)
    edges: list = field(default_factory=list)
    neighbors: dict = field(default_factory=dict)
    edge_len: dict = field(default_factory=dict)

    def __post_init__(self):
        for r in range(self.rows):
            for c in range(self.cols):
                idx = r * self.cols + c
                self.nodes.append(Node(idx, self.origin_lat - r * self.spacing,
                                       self.origin_lon + c * self.spacing))
                self.neighbors[idx] = []
        for r in range(self.rows):
            for c in range(self.cols):
                idx = r * self.cols + c
                if c + 1 < self.cols:
                    i2 = r * self.cols + (c + 1)
                    self._link(idx, i2)
                if r + 1 < self.rows:
                    i2 = (r + 1) * self.cols + c
                    self._link(idx, i2)

    def _link(self, i, j):
        self.edges.append(Edge(i, j))
        self.neighbors[i].append(j)
        self.neighbors[j].append(i)
        n1, n2 = self.nodes[i], self.nodes[j]
        self.edge_len[(i, j)] = self.edge_len[(j, i)] = haversine_m(
            n1.lat, n1.lon, n2.lat, n2.lon)

    def position(self, a, b, progress):
        n1, n2 = self.nodes[a], self.nodes[b]
        lat = n1.lat + (n2.lat - n1.lat) * progress
        lon = n1.lon + (n2.lon - n1.lon) * progress
        return lat, lon

    def pick_next(self, a, b):
        options = [n for n in self.neighbors[a] if n != b]
        return options[0] if options else b

    def random_intersection(self, rng):
        return rng.randrange(len(self.nodes))

    def bounds(self):
        lats = [n.lat for n in self.nodes]
        lons = [n.lon for n in self.nodes]
        return min(lats), max(lats), min(lons), max(lons)