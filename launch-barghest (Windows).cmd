@echo off
chcp 65001 >nul
rem Launch BARGHEST: double-click this file and the project runs. Stamped by assembly sync-claude; do not
rem hand-edit, regenerate. The file is UTF-8 and the line above makes the console read it so.
title Launch BARGHEST
rem pushd, not cd: a folder on a network share gets a drive letter, where cd would silently stay in Windows\.
pushd "%~dp0" || (echo Cannot open this file's own folder. & pause & exit /b 1)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is not installed. Install Node 22 and pnpm, then double-click this file again.
  pause
  exit /b 1
)
rem A project that arrived after the last install (assembly new, a git pull) has no node_modules of its own yet.
set "NEED_INSTALL="
if not exist "..\..\..\node_modules" set "NEED_INSTALL=1"
if not exist "node_modules" set "NEED_INSTALL=1"
if defined NEED_INSTALL (
  echo First run: installing ^(one time^)...
  pushd "..\..\.."
  call pnpm install
  if errorlevel 1 (popd & pause & exit /b 1)
  popd
)
echo Launching BARGHEST. Close this window to stop it.
call pnpm exec vite --open
pause
