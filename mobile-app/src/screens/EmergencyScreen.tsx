import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { severity: number };

export default function EmergencyScreen({ severity }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>EMERGENCY</Text>
      <Text style={styles.sev}>Severity {severity}/10</Text>
      <Text style={styles.body}>
        Emergency services have been notified with your location and medical profile.
      </Text>
      <Text style={styles.body}>A message and call were placed to your emergency contacts.</Text>
      <Text style={styles.muted}>Awaiting dispatch confirmation… (see operations dashboard)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#c62828' },
  badge: { color: '#ffffff', fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  sev: { color: '#ffd5d5', fontSize: 20, fontWeight: '600', marginTop: 8 },
  body: { color: '#ffffff', fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 22 },
  muted: { color: '#ffd5d5', fontSize: 13, marginTop: 18, textAlign: 'center' },
});