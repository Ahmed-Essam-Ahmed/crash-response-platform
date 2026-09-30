# Crash Detection AI Model

AI component of the Crash Response Platform graduation project.

## Goal

Detect vehicle crashes from smartphone sensor data using machine learning.

Initial task:

- Binary classification: crash vs non-crash
- Input data: accelerometer, gyroscope, and GPS speed
- Dataset: VZCrash
- Baseline: rule-based crash detector
- ML baseline: Random Forest

## Structure

- data/ - Local datasets (not committed to Git)
- notebooks/ - Dataset exploration and experiments
- src/ - Reusable preprocessing, training, evaluation, and prediction code
- models/ - Trained model files (not committed to Git)
- tests/ - Automated tests
