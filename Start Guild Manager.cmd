@echo off
setlocal
set "SENARI_GUILD_SOURCE_ROOT=%~dp0"
pushd "%~dp0"
node scripts\start-local.mjs
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
