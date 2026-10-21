import 'package:flutter/material.dart';

import 'application/app_services.dart';
import 'presentation/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(SafeDriveApp(services: AppServices.production()));
}
