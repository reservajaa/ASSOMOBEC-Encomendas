# Script de Atualização Automática do Repositório GitHub - ASSOMOBEC
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "ASSOMOBEC - Atualizar GitHub"

# Garantir que executa na pasta do projeto
Set-Location -LiteralPath $PSScriptRoot

Clear-Host
Write-Host "========================================================" -ForegroundColor Green
Write-Host "       ASSOMOBEC - ATUALIZAÇÃO DO REPOSITÓRIO GITHUB    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Diretório: " -NoNewline; Write-Host $PSScriptRoot -ForegroundColor Yellow
Write-Host "  Repositório: " -NoNewline; Write-Host "https://github.com/reservajaa/ASSOMOBEC-Encomendas" -ForegroundColor Cyan
Write-Host ""

# Verificar Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERRO] O comando 'git' não foi encontrado neste computador." -ForegroundColor Red
    Write-Host "  Instale o Git para Windows ou adicione-o ao PATH." -ForegroundColor Yellow
    Read-Host "Pressione ENTER para sair..."
    exit 1
}

# Verificar se há alterações
$status = git status --porcelain
if (-not $status) {
    Write-Host "  [INFO] Nenhuma alteração pendente encontrada." -ForegroundColor Green
    Write-Host "  Seu GitHub já está completamente atualizado!" -ForegroundColor Green
    Write-Host ""
    $resp = Read-Host "  Deseja forçar o envio (git push)? (S/N)"
    if ($resp -ne "S" -and $resp -ne "s") {
        Write-Host "`n  Operação concluída." -ForegroundColor Gray
        Read-Host "Pressione ENTER para fechar..."
        exit 0
    }
    Write-Host "`n  Enviando para o GitHub..." -ForegroundColor Cyan
    git push origin main
} else {
    Write-Host "  Arquivos com alterações:" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
    git status -s
    Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    
    $msg = Read-Host "  Digite a descrição da atualização (ou dê ENTER para automática)"
    if ([string]::IsNullOrWhiteSpace($msg)) {
        $timestamp = (Get-Date).ToString("dd/MM/yyyy HH:mm")
        $msg = "Atualização ASSOMOBEC - $timestamp"
    }

    Write-Host "`n  [1/3] Adicionando arquivos..." -ForegroundColor Cyan
    git add -A

    Write-Host "  [2/3] Criando commit: '$msg'..." -ForegroundColor Cyan
    git commit -m "$msg"

    Write-Host "  [3/3] Enviando para o GitHub (branch main)..." -ForegroundColor Cyan
    git push origin main
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "       GITHUB ATUALIZADO COM SUCESSO!                   " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "  Acesse seu projeto em: https://github.com/reservajaa/ASSOMOBEC-Encomendas" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "       [ERRO] FALHA AO ENVIAR PARA O GITHUB             " -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "  Verifique sua conexão com a internet e permissões de acesso." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione ENTER para fechar..."
