@echo off
chcp 65001 >nul
title Deploy - ASSOMOBEC Encomendas

color 0A
cls
echo.
echo  ==========================================
echo   ASSOMOBEC - Deploy para GitHub
echo  ==========================================
echo.

:: Entrar na pasta onde o script deploy.bat esta localizado
cd /d "%~dp0"

:: Verificar se git existe
git --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERRO] Git nao encontrado! Instale o Git e tente novamente.
    pause
    exit /b 1
)

:: Mostrar arquivos alterados
echo  Verificando alteracoes...
echo.
git status --short
echo.

:: Verificar se ha alteracoes
git status --porcelain > "%TEMP%\gitstatus.txt"
set /p STATUS=<"%TEMP%\gitstatus.txt"
del "%TEMP%\gitstatus.txt" >nul 2>&1

if "%STATUS%"=="" (
    color 0B
    echo  ==========================================
    echo   Nenhuma alteracao. GitHub ja atualizado!
    echo  ==========================================
    echo.
    pause
    exit /b 0
)

:: Pedir mensagem do commit
echo  Digite a descricao das alteracoes:
echo  (Pressione ENTER para usar data/hora automatica)
echo.
set /p MSG="  >> "
echo.

:: Usar mensagem automatica se nao digitar nada
if "%MSG%"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DATETIME=%%I
    if defined DATETIME (
        set MSG=Atualizacao %DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2% %DATETIME:~8,2%:%DATETIME:~10,2%
    ) else (
        set MSG=Atualizacao automatica
    )
)

echo  [1/3] Adicionando arquivos alterados...
git add .
echo.

echo  [2/3] Criando commit: %MSG%
git commit -m "%MSG%"
echo.

echo  [3/3] Enviando para GitHub...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo  ==========================================
    echo   DEPLOY CONCLUIDO COM SUCESSO!
    echo   github.com/reservajaa/ASSOMOBEC-Encomendas
    echo  ==========================================
) else (
    color 0C
    echo  ==========================================
    echo   ERRO no deploy! Verifique sua conexao
    echo   ou autenticacao do GitHub.
    echo  ==========================================
)

echo.
color 07
pause
