@echo off
setlocal
chcp 65001 >nul
title Deploy - ASSOMOBEC Encomendas

color 0A
cls
echo.
echo  ======================================================
echo         ASSOMOBEC - DEPLOY PARA GITHUB E NETLIFY
echo  ======================================================
echo.

cd /d "%~dp0"

:: Verificar se o git existe
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERRO] Git nao encontrado no computador!
    echo.
    pause
    exit /b 1
)

echo  [1/3] Adicionando arquivos alterados...
git add .
echo.

echo  [2/3] Registrando alteracoes (commit)...
git commit -m "Atualizacao do sistema ASSOMOBEC"
echo.

echo  [3/3] Enviando para o GitHub (origin main)...
git push origin main
echo.

if %ERRORLEVEL% EQU 0 (
    color 0A
    echo  ======================================================
    echo   [SUCESSO] ARQUIVOS ENVIADOS AO GITHUB COM SUCESSO!
    echo   Acesse: https://assomobecencomendas.netlify.app/
    echo.
    echo   Dica: Se a alteracao nao aparecer de imediato,
    echo   aperte CTRL + F5 para recarregar sem cache.
    echo  ======================================================
) else (
    color 0C
    echo  ======================================================
    echo   [AVISO] Verifique sua conexao ou autenticacao GitHub.
    echo  ======================================================
)

echo.
color 07
pause
