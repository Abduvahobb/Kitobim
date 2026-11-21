#!/bin/bash
# Emulyator ichida: o'rnatish, ishga tushirish, DevTools'ga ulanish, sinov
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n uz.kitobim.app/.MainActivity
S=""
for i in $(seq 1 40); do
  sleep 5
  S=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
  [ -n "$S" ] && break
  [ $((i % 8)) = 0 ] && adb shell am start -n uz.kitobim.app/.MainActivity
done
sleep 8
echo "socket: $S"
adb forward tcp:9222 localabstract:$S
curl -s http://127.0.0.1:9222/json/list | head -c 600; echo
node tools/emu-test.cjs $KITOBLAR 2>&1 | tee emu.log
adb logcat -d > logcat-full.txt
grep -iE ' F |libc|DEBUG|crash|fatal|died|lowmemory|chromium|cr_|AndroidRuntime|Renderer|SIG' logcat-full.txt | grep -v 'Capacitor/Plugin\|Notifying listeners\|methodName' | tail -300 > logcat.txt || true
