@echo off
chcp 65001 >nul
title ASSOMOBEC - Atualizar GitHub

echo.
echo  Enviando projeto para GitHub...
echo.

cd /d "C:\Projetos\Projeto-ASSOMOBEC-Encomendas"

git status --porcelain > "%TEMP%\gitstatus.txt"
set /p STATUS=<"%TEMP%\gitstatus.txt"
del "%TEMP%\gitstatus.txt"

if "%STATUS%"=="" (
    echo  Nenhuma alteracao encontrada. O GitHub ja esta atualizado!
    echo.
    pause
    exit /b 0
)

echo  Digite uma descricao das alteracoes:
echo  (Pressione ENTER para usar mensagem automatica)
echo.
set /p MSG="  Descricao: "

if "%MSG%"=="" (
    set MSG=Atualizacao automatica
)

echo.
echo  Adicionando arquivos...
git add .

echo  Criando commit: %MSG%
git commit -m "%MSG%"

echo  Enviando para GitHub...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  GITHUB ATUALIZADO COM SUCESSO!
    echo  https://github.com/reservajaa/ASSOMOBEC-Encomendas
) else (
    echo.
    echo  ERRO ao enviar para GitHub!
    echo  Verifique sua conexao e autenticacao.
)

echo.
pause
