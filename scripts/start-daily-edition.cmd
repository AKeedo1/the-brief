@echo off
cd /d "C:\Users\Gaming-Pc\OneDrive\Desktop\beit-al-himma\beit-al-himma\outputs\daily-edition-hosted"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\ensure-server.ps1 >> daily-edition-server.log 2>&1
