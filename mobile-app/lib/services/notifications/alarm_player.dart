// Loud looping alarm + vibration for the countdown (FR-09).

import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

class AlarmPlayer {
  AudioPlayer? _player;
  Timer? _haptics;

  Future<void> start() async {
    _haptics?.cancel();
    _haptics = Timer.periodic(const Duration(milliseconds: 800), (_) {
      HapticFeedback.heavyImpact();
    });
    try {
      final p = _player ??= AudioPlayer();
      await p.setReleaseMode(ReleaseMode.loop);
      await p.setVolume(1.0);
      await p.play(AssetSource('sounds/alarm.wav'));
    } catch (_) {
      // Browsers block audio before a user tap; vibration still runs.
    }
  }

  Future<void> stop() async {
    _haptics?.cancel();
    _haptics = null;
    try {
      await _player?.stop();
    } catch (_) {}
  }

  Future<void> dispose() async {
    await stop();
    await _player?.dispose();
    _player = null;
  }
}
