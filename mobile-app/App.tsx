import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import DriveScreen from './src/screens/DriveScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';

export default function App() {
  const [emergency, setEmergency] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      {emergency === null ? (
        <DriveScreen onEmergency={(sev) => setEmergency(sev)} />
      ) : (
        <EmergencyScreen severity={emergency} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1a24' },
});