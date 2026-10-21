import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../app.dart';
import '../settings/settings_cubit.dart';

class _Page {
  const _Page(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;
}

// Simple language on purpose (brief: "Use simple explanations").
const _pages = <_Page>[
  _Page(
    Icons.shield_outlined,
    'What SafeDrive does',
    'SafeDrive watches for car accidents while you drive. If it thinks you '
        'had a serious crash and you don\'t answer, it alerts the people you '
        'chose and sends them your location.',
  ),
  _Page(
    Icons.sensors,
    'How detection works',
    'Your phone\'s motion sensors and GPS are checked together: a strong '
        'impact, a sudden loss of speed and the car stopping afterwards. '
        'One signal alone is never enough, so bumps and hard braking are '
        'not treated as crashes. No extra hardware is needed.',
  ),
  _Page(
    Icons.directions_car_outlined,
    'Motion & location access',
    'Motion access lets SafeDrive feel an impact. Location — set to '
        '"Always" — lets it notice when you start driving and tell your '
        'contacts where you are. Location is only shared after a confirmed '
        'emergency.',
  ),
  _Page(
    Icons.timer_outlined,
    'After a suspected crash',
    'A loud alarm and a countdown (20 seconds by default) appear. Tap '
        '"I\'M OK" to cancel. If you don\'t respond, your emergency contacts '
        'get a message with your location on a map.',
  ),
  _Page(
    Icons.contacts_outlined,
    'Emergency contacts',
    'Add up to 5 people and put them in order. The first one is called '
        'first. They don\'t need the app — they will get an SMS.',
  ),
  _Page(
    Icons.lock_outline,
    'Your privacy',
    'Your driving data stays on your phone. We never record audio. Only '
        'accident events (and the few seconds of sensor data around them) are '
        'saved to your account, and you can delete your history at any time '
        'from Settings.',
  ),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  bool get _isLast => _index == _pages.length - 1;

  Future<void> _finish() async {
    await context.read<SettingsCubit>().completeOnboarding();
    if (!mounted) return;
    // Next: one screen that explains + requests every permission (step 5).
    Navigator.of(context).pushReplacementNamed(Routes.permissionsFirstRun);
  }

  void _next() {
    if (_isLast) {
      _finish();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _isLast ? null : _finish,
                child: const Text('Skip'),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) {
                  final p = _pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircleAvatar(
                          radius: 52,
                          backgroundColor: scheme.primaryContainer,
                          child: Icon(p.icon, size: 52, color: scheme.onPrimaryContainer),
                        ),
                        const SizedBox(height: 32),
                        Text(
                          p.title,
                          textAlign: TextAlign.center,
                          style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          p.body,
                          textAlign: TextAlign.center,
                          style: text.bodyLarge?.copyWith(
                            color: scheme.onSurfaceVariant,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _pages.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _index ? 22 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _index ? scheme.primary : scheme.outlineVariant,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _next,
                  child: Text(_isLast ? 'Get started' : 'Next'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
