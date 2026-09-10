# =====================================================================
#  Totali Antecipa - carimba a versao nos scripts do index.html
#  ---------------------------------------------------------------------
#  Por que existe: o GitHub Pages manda os arquivos com cache de 10 min.
#  Sem o "?v=" o navegador carrega o index.html novo com os .js velhos:
#  a tela muda mas o calculo nao, e o rodape mostra a versao antiga.
#  Rode SEMPRE depois de mexer em js/versao.js e antes do commit:
#      powershell -ExecutionPolicy Bypass -File versionar.ps1
#
#  Le e grava em UTF-8 SEM BOM (o index.html tem acentos; Get-Content /
#  Set-Content do PowerShell 5.1 corrompem os acentos, por isso usamos
#  System.IO.File com um encoder explicito).
# =====================================================================
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$verFile = Join-Path $raiz 'js\versao.js'
$idx = Join-Path $raiz 'index.html'
$utf8 = New-Object System.Text.UTF8Encoding($false)

$m = [regex]::Match([System.IO.File]::ReadAllText($verFile, $utf8), "numero:\s*'([0-9.]+)'")
if (-not $m.Success) { Write-Host "Nao achei o numero da versao em js/versao.js" -ForegroundColor Red; exit 1 }
$v = $m.Groups[1].Value

$padrao = '(<script src="js/[a-z\-]+\.js)(\?v=[0-9.]+)?(")'
$html = [System.IO.File]::ReadAllText($idx, $utf8)
$novo = [regex]::Replace($html, $padrao, ('${1}?v=' + $v + '${3}'))

if ($novo -eq $html) {
  Write-Host "  Nada a mudar - index.html ja esta na versao $v."
} else {
  [System.IO.File]::WriteAllText($idx, $novo, $utf8)
  Write-Host "  index.html carimbado com a versao $v." -ForegroundColor Green
}

$conta = ([regex]::Matches($novo, '<script src="js/[a-z\-]+\.js\?v=')).Count
Write-Host "  $conta script(s) com carimbo de versao."
