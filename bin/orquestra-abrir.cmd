@echo off
rem Roda o orquestra-abrir.js com o proprio executavel do Orquestra (nao precisa de Node instalado).
setlocal
set ELECTRON_RUN_AS_NODE=1
"%ORQUESTRA_NODE%" "%~dp0orquestra-abrir.js" %*
