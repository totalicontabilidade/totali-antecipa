# =====================================================================
#  Totali Antecipa — servidor local (páginas + integração SEFAZ)
#  ---------------------------------------------------------------------
#  Não precisa instalar nada: roda no Windows PowerShell 5.1.
#  Uso:  clique duas vezes em INICIAR.bat   ou
#        powershell -ExecutionPolicy Bypass -File servir.ps1 [-Porta 8788]
#
#  Rotas da API (JSON):
#    GET  /api/status                         certificados cadastrados
#    POST /api/certificado  {cnpj,pfxBase64,senha,lembrar}
#    POST /api/senha        {cnpj,senha}      destrava a senha só nesta sessão
#    DELETE /api/certificado/<cnpj>
#    GET  /api/nfe/<chave>?cnpj=<cnpj>        XML completo (Distribuição DF-e + ciência)
#    GET  /api/distribuicao?cnpj=<cnpj>       todas as NF-e novas do CNPJ (por NSU)
# =====================================================================
param([int]$Porta = 8788, [switch]$SemNavegador)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'server\sefaz-dfe.ps1')

$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.png'='image/png'; '.svg'='image/svg+xml'; '.json'='application/json; charset=utf-8'; '.xml'='application/xml; charset=utf-8'; '.xls'='application/vnd.ms-excel'; '.xlsx'='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; '.ico'='image/x-icon'; '.md'='text/plain; charset=utf-8'; '.pdf'='application/pdf'; '.txt'='text/plain; charset=utf-8' }

function Send-Json($res, $obj, [int]$status = 200) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $res.StatusCode = $status; $res.ContentType = 'application/json; charset=utf-8'
  $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close()
}
function Read-Body($req) { $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8); $t = $sr.ReadToEnd(); $sr.Close(); if ($t) { return ($t | ConvertFrom-Json) } else { return $null } }

$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Porta/")
$l.Prefixes.Add("http://127.0.0.1:$Porta/")
try { $l.Start() } catch { Write-Host "Não consegui abrir a porta $Porta ($_). Feche outra instância ou use -Porta 8790."; exit 1 }
Write-Host ""
Write-Host "  Totali Antecipa  ->  http://localhost:$Porta/"
Write-Host "  Certificados em: $script:CERT_DIR"
Write-Host "  (deixe esta janela aberta; Ctrl+C para parar)"
Write-Host ""
if (-not $SemNavegador) { try { Start-Process "http://localhost:$Porta/" } catch {} }

while ($l.IsListening) {
  try {
    $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.AddHeader('Access-Control-Allow-Headers', 'Content-Type'); $res.AddHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    $qs = $req.QueryString

    # ------------------------------------------------ API
    if ($path -like '/api/*') {
      try {
        if ($path -eq '/api/status') { Send-Json $res @{ ok = $true; versao = '1.0'; certificados = (Get-CertificadosCadastrados) }; continue }
        if ($path -eq '/api/certificado' -and $req.HttpMethod -eq 'POST') {
          $b = Read-Body $req
          $info = Save-Certificado -cnpj ([string]$b.cnpj) -pfxBytes ([Convert]::FromBase64String($b.pfxBase64)) -senha ([string]$b.senha) -lembrar ([bool]$b.lembrar)
          Send-Json $res @{ ok = $true; certificado = $info }; continue
        }
        if ($path -eq '/api/senha' -and $req.HttpMethod -eq 'POST') {
          $b = Read-Body $req; $cnpj = ([string]$b.cnpj) -replace '\D', ''
          $script:SENHAS[$cnpj] = [string]$b.senha
          $c = Get-Certificado $cnpj   # valida
          Send-Json $res @{ ok = $true; titular = $c.Subject; validade = $c.NotAfter.ToString('yyyy-MM-dd') }; continue
        }
        if ($path -like '/api/certificado/*' -and $req.HttpMethod -eq 'DELETE') {
          $cnpj = ($path -split '/')[-1] -replace '\D', ''
          Get-ChildItem $script:CERT_DIR -Filter "$cnpj.*" | Remove-Item -Force; $script:SENHAS.Remove($cnpj)
          Send-Json $res @{ ok = $true }; continue
        }
        if ($path -like '/api/nfe/*') {
          $chave = ($path -split '/')[-1]; $cnpj = [string]$qs['cnpj']
          $r = Get-NFeCompleta -cnpj $cnpj -chave $chave
          Send-Json $res $r; continue
        }
        if ($path -eq '/api/distribuicao') {
          $cnpj = [string]$qs['cnpj']; $lotes = 10; if ($qs['lotes']) { $lotes = [int]$qs['lotes'] }
          $r = Get-NFeDistribuicao -cnpj $cnpj -maxLotes $lotes
          Send-Json $res $r; continue
        }
        Send-Json $res @{ ok = $false; erro = 'rota não encontrada' } 404; continue
      } catch {
        $msg = $_.Exception.Message
        if ($_.Exception.InnerException) { $msg += ' | ' + $_.Exception.InnerException.Message }
        Write-Host "API $path : $msg"
        $code = 'ERRO'; if ($msg -like '*SENHA_NECESSARIA*') { $code = 'SENHA_NECESSARIA' } elseif ($msg -like '*não cadastrado*') { $code = 'SEM_CERTIFICADO' }
        Send-Json $res @{ ok = $false; erro = $msg; codigo = $code } 200; continue
      }
    }

    # ------------------------------------------------ arquivos
    $p = $path.TrimStart('/'); if ($p -eq '') { $p = 'index.html' }
    if ($p -eq '__lista') { $sub = 'exemplos'; if ($qs['dir']) { $sub = 'exemplos\' + ($qs['dir'] -replace '[^\w\-]', '') }; $arr = @(Get-ChildItem (Join-Path $root $sub) -File | Select-Object -ExpandProperty Name); Send-Json $res $arr; continue }
    $file = Join-Path $root $p
    if ($p -like 'server/certs*' -or -not $file.StartsWith($root)) { $res.StatusCode = 403; $res.Close(); continue }
    if ((Test-Path $file) -and -not (Get-Item $file).PSIsContainer) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct; $res.AddHeader('Cache-Control', 'no-cache')
      $bytes = [IO.File]::ReadAllBytes($file); $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes('404 - ' + $p); $res.OutputStream.Write($b, 0, $b.Length) }
    $res.Close()
  } catch { Write-Host "erro: $_" }
}
