@echo off
chcp 65001 >nul
title ASSOMOBEC - Atualizar GitHub

:: Navega automaticamente para a pasta onde este arquivo .bat está salvo
cd /d "%~dp0"

echo ========================================================
echo        ASSOMOBEC - ATUALIZAÇÃO DO REPOSITÓRIO GITHUB
echo ========================================================
echo.
echo  Diretório atual: %CD%
echo  Repositório: https://github.com/reservajaa/ASSOMOBEC-Encomendas
echo.

:: Verifica se o Git está instalado e acessível
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERRO] Git não encontrado no sistema!
    echo  Por favor, verifique se o Git está instalado.
    echo.
    pause
    exit /b 1
)

:: Verifica se há alterações pendentes
set HAS_CHANGES=0
for /f "tokens=*" %%i in ('git status --porcelain 2^>nul') do (
    set HAS_CHANGES=1
)

if "%HAS_CHANGES%"=="0" (
    echo  [INFO] Nenhuma alteração pendente encontrada.
    echo  O seu repositório GitHub já está 100%% atualizado!
    echo.
    echo  Deseja forçar o envio (git push)? (S/N)
    set /p FORCAR="  Opção: "
    if /i not "%FORCAR%"=="S" (
        echo.
        echo  Operação finalizada sem alterações.
        echo.
        pause
        exit /b 0
    )
    echo.
    echo  Enviando alterações pendentes para o GitHub...
    git push origin main
    goto FINALIZAR
)

echo  Alterações encontradas:
echo --------------------------------------------------------
git status -s
echo --------------------------------------------------------
echo.
echo  Digite uma descrição para a atualização:
echo  (Ou pressione ENTER para usar: "Atualização ASSOMOBEC")
echo.
set /p MSG="  Descrição: "

if "%MSG%"=="" (
    set MSG=Atualização ASSOMOBEC - %date% %time:~0,5%
)

echo.
echo  [1/3] Adicionando arquivos modificados...
git add -A

echo  [2/3] Criando commit: "%MSG%"...
git commit -m "%MSG%"

echo  [3/3] Enviando para o GitHub (branch main)...
git push origin main

:FINALIZAR
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo       GITHUB ATUALIZADO COM SUCESSO!
    echo ========================================================
    echo  Acesse em: https://github.com/reservajaa/ASSOMOBEC-Encomendas
) else (
    echo.
    echo ========================================================
    echo       [ERRO] OCORREU UM PROBLEMA AO ENVIAR PARA O GITHUB
    echo ========================================================
    echo  Verifique sua conexão com a internet e permissões no GitHub.
)

echo.
pause
