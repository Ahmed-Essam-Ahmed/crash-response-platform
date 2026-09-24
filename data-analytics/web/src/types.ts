export interface Hotspot {
  lat: number;
  lon: number;
  count: number;
  max_severity: number;
}

export interface HourBucket {
  hour: number;
  count: number;
}

export interface SeverityBucket {
  bucket: string;
  count: number;
}

export interface AnalyticsSummary {
  totals: {
    incidents: number;
    hot_cells: number;
    severe: number;
    avg_severity: number;
  };
  hotspots: Hotspot[];
  by_hour: HourBucket[];
  severity_distribution: SeverityBucket[];
}
