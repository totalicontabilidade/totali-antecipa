# =====================================================================
#  Publica o sistema no GitHub da Totali (conta totalicontabilidade) e liga o GitHub Pages
#  Uso (PowerShell, na pasta do sistema):
#     $env:GITHUB_TOKEN = "cole_aqui_o_token"       # token com escopo "repo" (Settings > Developer settings > Tokens)
#     powershell -ExecutionPolicy Bypass -File server\publicar-github.ps1 -Repo dia-certo
#  O token não é gravado em lugar nenhum: vale só nesta janela do PowerShell.
# =====================================================================
param([string]$Conta = "totalicontabilidade", [string]$Repo = "dia-certo", [string]$Descricao = "DIA Certo — ICMS antecipado de Sergipe (Totali Contabilidade)", [switch]$Privado)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tok = $env:GITHUB_TOKEN
if (-not $tok) { Write-Host "Defina o token antes:  `$env:GITHUB_TOKEN = 'ghp_...'" -ForegroundColor Yellow; exit 1 }
$hdr = @{ Authorization = "Bearer $tok"; Accept = "application/vnd.github+json"; "User-Agent" = "totali-antecipa" }

# 1) quem é o dono do token?
$me = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $hdr
Write-Host "Token de: $($me.login)"

# 2) cria o repositório (na conta do token ou na organização informada)
$body = @{ name = $Repo; description = $Descricao; private = [bool]$Privado; has_issues = $true; auto_init = $false } | ConvertTo-Json
$url = if ($me.login -ieq $Conta) { "https://api.github.com/user/repos" } else { "https://api.github.com/orgs/$Conta/repos" }
try { $r = Invoke-RestMethod -Uri $url -Method Post -Headers $hdr -Body $body -ContentType "application/json"; Write-Host "Repositório criado: $($r.html_url)" }
catch { if ("$_" -match "already exists|422") { Write-Host "Repositório já existe — seguindo para o push." } else { throw } }

# 3) push (usa o token só nesta chamada)
Set-Location $root
git remote remove origin 2>$null
git remote add origin "https://github.com/$Conta/$Repo.git"
$askpass = Join-Path $env:TEMP "gh-askpass-$PID.cmd"
"@echo off`r`necho $tok" | Set-Content -Path $askpass -Encoding ascii
$env:GIT_ASKPASS = $askpass; $env:GIT_TERMINAL_PROMPT = "0"
try {
  git -c credential.helper= -c "http.extraheader=Authorization: Bearer $tok" push -u origin main
} finally { Remove-Item $askpass -Force -ErrorAction SilentlyContinue; $env:GIT_ASKPASS = $null }

# 4) liga o GitHub Pages (branch main, raiz)
try {
  Invoke-RestMethod -Uri "https://api.github.com/repos/$Conta/$Repo/pages" -Method Post -Headers $hdr -Body (@{ source = @{ branch = "main"; path = "/" } } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  Write-Host "GitHub Pages ativado."
} catch { Write-Host "Pages: $_ (ative em Settings > Pages se ainda não estiver)" }
Write-Host ""
Write-Host "Site: https://$Conta.github.io/$Repo/   (leva 1 a 2 minutos para publicar)" -ForegroundColor Green
