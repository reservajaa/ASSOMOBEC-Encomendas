@echo off
chcp 65001 >nul
title Deploy - ASSOMOBEC Encomendas

color 0A
cls
echo.
echo  ======================================================
echo         ASSOMOBEC - DEPLOY PARA GITHUB E NETLIFY
echo  ======================================================
echo.

:: Entrar na pasta onde o script deploy.bat esta localizado
cd /d "%~dp0"

:: Verificar se git existe
git --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERRO] Git nao encontrado no computador!
    echo  Por favor instale o Git e tente novamente.
    echo.
    pause
    exit /b 1
)

:: Garantir que o repositorio local esta configurado
if not exist ".git" (
    echo  Inicializando repositorio local...
    git init
    git branch -M main
    git remote add origin https://github.com/reservajaa/ASSOMOBEC-Encomendas.git
)

echo  [1/3] Verificando e adicionando arquivos alterados...
git add .
echo.

:: Verificar se ha algo para commitar
git status --porcelain > "%TEMP%\gitstatus.txt"
set /p STATUS=<"%TEMP%\gitstatus.txt"
del "%TEMP%\gitstatus.txt" >nul 2>&1

if not "%STATUS%"=="" (
    echo  Arquivos alterados detectados:
    git status --short
    echo.
    echo  Digite a descricao das alteracoes (ou pressione ENTER para data/hora):
    set /p MSG="  >> "
    echo.

    if "!MSG!"=="" set MSG=Atualizacao automatica do sistema

    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DATETIME=%%I
    if defined DATETIME (
        if "%MSG%"=="" set MSG=Atualizacao %DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2% %DATETIME:~8,2%:%DATETIME:~10,2%
    )

    echo  [2/3] Gravando versao (Commit)...
    git commit -m "%MSG%"
    echo.
) else (
    echo  [2/3] Todos os arquivos locais ja estao commitados.
    echo.
)

echo  [3/3] Enviando para o GitHub (origin main)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo  ======================================================
    echo   [SUCESSO] ARQUIVOS ENVIADOS AO GITHUB COM SUCESSO!
    echo   O Netlify iniciara a atualizacao automatica do site.
    echo.
    echo   Acesse: https://assomobecencomendas.netlify.app/
    echo   Dica: Se nao ver na hora, aperte CTRL + F5 para limpar
    echo         o cache do navegador/PWA.
    echo  ======================================================
) else (
    color 0C
    echo  ======================================================
    echo   [ERRO] Falha ao enviar para o GitHub.
    echo   Verifique sua conexao com a internet ou credenciais.
    echo  ======================================================
)

echo.
color 07
pause
