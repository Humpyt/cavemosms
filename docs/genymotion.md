# Genymotion Setup

This project can target Genymotion directly without requiring `adb` on your global `PATH`.

## Commands

- `npm run genymotion:open`
  Opens the Genymotion desktop app.

- `npm run genymotion:list`
  Lists configured Genymotion virtual devices and currently connected ADB devices.

- `npm run android:genymotion`
  Deploys the Android app to the first running ADB device, which can be a Genymotion emulator.

## Current machine state

On this PC, Genymotion is installed at:

- `C:\Program Files\Genymobile\Genymotion\genymotion.exe`

ADB is available at:

- `C:\Users\Cavemo\AppData\Local\Android\Sdk\platform-tools\adb.exe`

## Important limitation

This app's native SMS feature requires Android telephony messaging support. Most emulators, including Genymotion, do not provide a real SIM-backed SMS stack, so UI flows can be tested there, but actual SMS sending still needs a real Android phone.
