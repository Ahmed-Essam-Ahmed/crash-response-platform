import React, { useEffect, useRef, useState } from 'react';
import {
  Button, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import scenario from '../assets/scenario.json';
import { submitAlert } from '../services/api';
import type { EmergencyAlert, Trip } from '../types';

type Props = {
  onEmergency: (severity: number) => void;
};

const TRIP: Trip = (scenario as { trips: Trip[] }).trips[0];

function speedKmH(mps: number) {
  return Math.round(mps * 3.6);
}

export default function DriveScreen({ onEmergency }: Props) {
  const [index, setIndex] = useState(0);
  const [alert, setAlert] = useState<EmergencyAlert | null>(null);
  const raf = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (index < TRIP.samples.length) {
      raf.current = setTimeout(() => setIndex((i) => i + 1), TRIP.dt * 1000);
    } else if (TRIP.label === 'crash') {
      onEmergency(TRIP.crash?.severity ?? 5);
    }
    return () => clearTimeout(raf.current);
  }, [index, onEmergency]);

  const sample = TRIP.samples[Math.min(index, TRIP.samples.length - 1)];
  const g = sample.accel.g;

  const crashNow =
    TRIP.crash !== null &&
    index >= Math.floor(TRIP.crash.time_s / TRIP.dt) &&
    index < Math.floor(TRIP.crash.time_s / TRIP.dt) + 20;

  useEffect(() => {
    if (crashNow && !alert) {
      submitAlert(TRIP.samples.slice(0, index + 1), TRIP.crash?.severity ?? 5)
        .then(setAlert)
        .catch(() => setAlert(null));
    }
  }, [crashNow, alert, index]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simulated Drive — {TRIP.trip_id}</Text>
      <Text style={styles.meta}>Label: {TRIP.label} · {speedKmH(sample.gps.speed_mps)} km/h</Text>

      <View style={gate(g).container}>
        <Text style={gate(g).value}>{g.toFixed(2)} g</Text>
      </View>

      <Text style={styles.msg}>
        {crashNow
          ? 'Impact detected — preparing emergency alert…'
          : alert
            ? `Dispatch confirmed · Ambulance ETA ${alert.eta_seconds}s`
            : `Cruising… (${Math.round((index / TRIP.samples.length) * 100)}%)`}
      </Text>

      <ScrollView style={styles.log}>
        {TRIP.samples.slice(0, index + 1).reverse().slice(0, 8).map((s, i) => (
          <Text key={i} style={styles.logLine}>
            t={s.t.toFixed(1)}s · g={s.accel.g.toFixed(2)} · {speedKmH(s.gps.speed_mps)} km/h
          </Text>
        ))}
      </ScrollView>

      <Button title="Reset" onPress={() => setIndex(0)} disabled={index === TRIP.samples.length - 1} />
    </View>
  );
}

function gate(g: number) {
  const active = g >= 4;
  return {
    container: { ...styles.gaugeBg, backgroundColor: active ? '#c62828' : '#263238' },
    value: { ...styles.gauge, color: active ? '#ffffff' : '#8fd3ff' },
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#0f1a24' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  meta: { color: '#9aa7b5', fontSize: 13, marginTop: 4 },
  gaugeBg: {
    marginTop: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 28,
  },
  gauge: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  msg: { color: '#e8eef4', fontSize: 15, marginTop: 14, minHeight: 40 },
  log: { flex: 1, marginTop: 8 },
  logLine: { color: '#7f8f9f', fontSize: 12, fontVariant: ['tabular-nums'] },
});