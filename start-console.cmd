@echo off
setlocal
pushd "%~dp0" || exit /b 1
if not defined CW_PORT set "CW_PORT=17323"
node tools/mitm-ca.mjs status
if errorlevel 1 echo Warning: capture CA check failed; capture may need certificate setup.
if /i "%~1"=="start" goto launch
echo.
echo Local console was not started automatically.
echo Start it with: npm start
echo Or:            .\start-console.cmd start
echo Default URL:   http://127.0.0.1:%CW_PORT%/
if not defined CW_NO_PAUSE pause
popd
exit /b 0
:launch
echo Local console: http://127.0.0.1:%CW_PORT%/
node src/app.mjs console
if errorlevel 1 goto failed
popd
exit /b 0
:failed
echo See the diagnostic above.
pause
popd
exit /b 1
