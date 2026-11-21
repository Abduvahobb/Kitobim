#!/bin/bash
# Emulyator ichida: o'rnatish, ishga tushirish, DevTools'ga ulanish, sinov
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n uz.kitobim.app/.MainActivity
sleep 30
S=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
echo "socket: $S"
adb forward tcp:9222 localabstract:$S
curl -s http://127.0.0.1:9222/json/list | head -c 600; echo
node tools/emu-test.cjs $KITOBLAR 2>&1 | tee emu.log
adb logcat -d | grep -iE 'Capacitor|Filesystem|chromium|WebViewLocal|AndroidRuntime' | tail -150 > logcat.txt || true
