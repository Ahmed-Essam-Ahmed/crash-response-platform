import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../app.dart';
import 'splash_cubit.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => SplashCubit(ctx.read<AppServices>())..init(),
      child: BlocConsumer<SplashCubit, SplashState>(
        listener: (context, state) {
          final route = switch (state) {
            SplashState.goHome => Routes.home,
            SplashState.goOnboarding => Routes.onboarding,
            _ => null,
          };
          if (route != null) {
            Navigator.of(context).pushReplacementNamed(route);
          }
        },
        builder: (context, state) {
          final scheme = Theme.of(context).colorScheme;
          final text = Theme.of(context).textTheme;
          return Scaffold(
            backgroundColor: scheme.primary,
            body: SafeArea(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shield_outlined, size: 84, color: scheme.onPrimary),
                    const SizedBox(height: 20),
                    Text(
                      'SafeDrive',
                      style: text.displaySmall?.copyWith(
                        color: scheme.onPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Intelligent Vehicle Safety System',
                      style: text.titleMedium?.copyWith(
                        color: scheme.onPrimary.withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: 40),
                    if (state == SplashState.failed)
                      FilledButton.tonal(
                        onPressed: () => context.read<SplashCubit>().init(),
                        child: const Text('Could not start — retry'),
                      )
                    else
                      SizedBox(
                        width: 26,
                        height: 26,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: scheme.onPrimary,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
