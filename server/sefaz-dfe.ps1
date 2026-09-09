# =====================================================================
#  Totali Antecipa — integração com a SEFAZ (Ambiente Nacional)
#  ---------------------------------------------------------------------
#  Busca o XML completo da NF-e pelo web service NFeDistribuicaoDFe,
#  usando o certificado digital A1 (.pfx) do CNPJ destinatário.
#  Quando a SEFAZ ainda só libera o resumo (resNFe), envia o evento
#  "Ciência da Operação" (210210) e consulta de novo.
#
#  Funciona em Windows PowerShell 5.1 (sem instalar nada):
#    - TLS mútuo:  System.Net.HttpWebRequest + X509Certificate2
#    - Assinatura: System.Security.Cryptography.Xml.SignedXml (RSA-SHA1)
#    - Gzip:       System.IO.Compression.GZipStream
#
#  Regras da SEFAZ que este código respeita:
#    - Só o CNPJ do certificado (ou sua matriz) pode consultar.
#    - consChNFe: 1 chave por requisição.
#    - distNSU: lotes de até 50 docs; ao chegar em maxNSU, esperar 1h
#      (cStat 137/656). O último NSU fica salvo em certs/<cnpj>.nsu.
# =====================================================================

Add-Type -AssemblyName System.Security
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$script:URL_DIST   = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
$script:URL_EVENTO = 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
$script:NS_NFE     = 'http://www.portalfiscal.inf.br/nfe'
$script:CERT_DIR   = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'certs'
if (-not (Test-Path $script:CERT_DIR)) { New-Item -ItemType Directory -Path $script:CERT_DIR | Out-Null }
$script:SENHAS = @{}   # senhas em memória (cnpj -> senha) enquanto o servidor estiver aberto

function Get-CertPath([string]$cnpj) { Join-Path $script:CERT_DIR ("$cnpj.pfx") }

# ---------------------------------------------------------------- certificados
function Save-Certificado {
  param([string]$cnpj, [byte[]]$pfxBytes, [string]$senha, [bool]$lembrar)
  $cnpj = $cnpj -replace '\D', ''
  # valida abrindo o PFX
  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxBytes, $senha, 'Exportable,UserKeySet')
  $cnpjCert = ''
  if ($cert.Subject -match '(\d{14})') { $cnpjCert = $Matches[1] }
  if (-not $cnpjCert) { # e-CNPJ ICP-Brasil traz o CNPJ na extensão OtherName 2.16.76.1.3.3
    foreach ($ext in $cert.Extensions) { if ($ext.Oid.Value -eq '2.5.29.17') { $s = $ext.Format($false); if ($s -match '(\d{14})') { $cnpjCert = $Matches[1] } } }
  }
  if (-not $cnpj) { $cnpj = $cnpjCert }
  if (-not $cnpj) { throw 'Não foi possível identificar o CNPJ do certificado. Informe o CNPJ.' }
  [IO.File]::WriteAllBytes((Get-CertPath $cnpj), $pfxBytes)
  $script:SENHAS[$cnpj] = $senha
  $senhaFile = Join-Path $script:CERT_DIR "$cnpj.senha"
  if ($lembrar) { # protegida pelo DPAPI do usuário do Windows (só esta conta consegue ler)
    (ConvertTo-SecureString $senha -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content -Path $senhaFile -Encoding ascii
  } elseif (Test-Path $senhaFile) { Remove-Item $senhaFile -Force }
  return @{ cnpj = $cnpj; cnpjCertificado = $cnpjCert; titular = $cert.Subject; validade = $cert.NotAfter.ToString('yyyy-MM-dd'); vencido = ($cert.NotAfter -lt (Get-Date)) }
}

function Get-Senha([string]$cnpj) {
  if ($script:SENHAS.ContainsKey($cnpj)) { return $script:SENHAS[$cnpj] }
  $f = Join-Path $script:CERT_DIR "$cnpj.senha"
  if (Test-Path $f) {
    try {
      $sec = Get-Content $f | ConvertTo-SecureString
      $senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
      $script:SENHAS[$cnpj] = $senha; return $senha
    } catch { }
  }
  return $null
}

function Get-Certificado([string]$cnpj) {
  $cnpj = $cnpj -replace '\D', ''
  $p = Get-CertPath $cnpj
  if (-not (Test-Path $p)) { throw "Certificado do CNPJ $cnpj não cadastrado. Envie o .pfx pela tela." }
  $senha = Get-Senha $cnpj
  if ($null -eq $senha) { throw "SENHA_NECESSARIA" }
  return New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($p, $senha, 'Exportable,UserKeySet')
}

function Get-CertificadosCadastrados {
  $lista = @()
  Get-ChildItem $script:CERT_DIR -Filter '*.pfx' -ErrorAction SilentlyContinue | ForEach-Object {
    $cnpj = $_.BaseName; $info = @{ cnpj = $cnpj; senhaSalva = (Test-Path (Join-Path $script:CERT_DIR "$cnpj.senha")); senhaEmMemoria = $script:SENHAS.ContainsKey($cnpj) }
    try { $c = Get-Certificado $cnpj; $info.titular = $c.Subject; $info.validade = $c.NotAfter.ToString('yyyy-MM-dd'); $info.vencido = ($c.NotAfter -lt (Get-Date)) } catch { $info.erro = $_.Exception.Message }
    $nsu = Join-Path $script:CERT_DIR "$cnpj.nsu"; if (Test-Path $nsu) { $info.ultNSU = (Get-Content $nsu -Raw).Trim() }
    $lista += $info
  }
  return ,$lista
}

# ---------------------------------------------------------------- SOAP
function Invoke-Soap {
  param([string]$url, [string]$bodyXml, [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert)
  $env = @"
<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>$bodyXml</soap12:Body></soap12:Envelope>
"@
  $bytes = [Text.Encoding]::UTF8.GetBytes($env)
  $req = [Net.HttpWebRequest]::Create($url)
  $req.Method = 'POST'; $req.ContentType = 'application/soap+xml; charset=utf-8'; $req.Timeout = 60000
  $req.ClientCertificates.Add($cert) | Out-Null
  $req.UserAgent = 'TotaliAntecipa/1.0'
  $s = $req.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
  try { $resp = $req.GetResponse() } catch [Net.WebException] { if ($_.Exception.Response) { $resp = $_.Exception.Response } else { throw } }
  $sr = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
  $txt = $sr.ReadToEnd(); $sr.Close(); $resp.Close()
  if ($txt -match "403 - Forbidden") { throw "Portal Nacional recusou o certificado (HTTP 403). Confira se é um e-CNPJ A1 ICP-Brasil válido e do CNPJ destinatário das notas." }
  if ($txt -match '^\s*<!DOCTYPE html') { throw "Portal Nacional respondeu uma página HTML em vez do SOAP (serviço indisponível ou bloqueio). Tente de novo mais tarde." }
  return $txt
}

function Expand-Gzip([string]$b64) {
  $data = [Convert]::FromBase64String($b64)
  $ms = New-Object IO.MemoryStream(,$data)
  $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Decompress)
  $out = New-Object IO.MemoryStream; $gz.CopyTo($out); $gz.Close()
  return [Text.Encoding]::UTF8.GetString($out.ToArray())
}

function Parse-RetDist([string]$soapResp) {
  $x = New-Object Xml.XmlDocument; $x.LoadXml($soapResp)
  $ns = New-Object Xml.XmlNamespaceManager($x.NameTable); $ns.AddNamespace('n', $script:NS_NFE)
  $ret = $x.SelectSingleNode('//n:retDistDFeInt', $ns)
  if ($null -eq $ret) { throw "Resposta inesperada da SEFAZ: " + $soapResp.Substring(0, [Math]::Min(400, $soapResp.Length)) }
  $r = @{ cStat = $ret.SelectSingleNode('n:cStat', $ns).InnerText; xMotivo = $ret.SelectSingleNode('n:xMotivo', $ns).InnerText; ultNSU = ''; maxNSU = ''; docs = @() }
  $u = $ret.SelectSingleNode('n:ultNSU', $ns); if ($u) { $r.ultNSU = $u.InnerText }
  $m = $ret.SelectSingleNode('n:maxNSU', $ns); if ($m) { $r.maxNSU = $m.InnerText }
  foreach ($d in $ret.SelectNodes('n:loteDistDFeInt/n:docZip', $ns)) {
    $xml = Expand-Gzip $d.InnerText
    $doc = @{ nsu = $d.GetAttribute('NSU'); schema = $d.GetAttribute('schema'); xml = $xml; chave = '' }
    if ($xml -match 'Id="NFe(\d{44})"') { $doc.chave = $Matches[1] } elseif ($xml -match '<chNFe>(\d{44})</chNFe>') { $doc.chave = $Matches[1] }
    $r.docs += $doc
  }
  return $r
}

function Invoke-DistDFe {
  param([string]$cnpj, [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert, [string]$chave, [string]$ultNSU)
  $cnpj = $cnpj -replace '\D', ''
  if ($chave) { $cons = "<consChNFe><chNFe>$chave</chNFe></consChNFe>" }
  else { $n = if ($ultNSU) { $ultNSU } else { '0' }; $cons = "<distNSU><ultNSU>$($n.PadLeft(15,'0'))</ultNSU></distNSU>" }
  $dist = "<distDFeInt xmlns=`"$($script:NS_NFE)`" versao=`"1.01`"><tpAmb>1</tpAmb><cUFAutor>28</cUFAutor><CNPJ>$cnpj</CNPJ>$cons</distDFeInt>"
  $body = "<nfeDistDFeInteresse xmlns=`"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe`"><nfeDadosMsg>$dist</nfeDadosMsg></nfeDistDFeInteresse>"
  $resp = Invoke-Soap -url $script:URL_DIST -bodyXml $body -cert $cert
  return Parse-RetDist $resp
}

# ---------------------------------------------------------------- assinatura e evento
function Sign-Xml {
  param([string]$xml, [string]$idRef, [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert, [string]$parentTag)
  $doc = New-Object Xml.XmlDocument; $doc.PreserveWhitespace = $false; $doc.LoadXml($xml)
  $signed = New-Object System.Security.Cryptography.Xml.SignedXml($doc)
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  $signed.SigningKey = $rsa
  $signed.SignedInfo.CanonicalizationMethod = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
  $signed.SignedInfo.SignatureMethod = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  $ref = New-Object System.Security.Cryptography.Xml.Reference
  $ref.Uri = '#' + $idRef
  $ref.DigestMethod = 'http://www.w3.org/2000/09/xmldsig#sha1'
  $ref.AddTransform((New-Object System.Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform))
  $ref.AddTransform((New-Object System.Security.Cryptography.Xml.XmlDsigC14NTransform))
  $signed.AddReference($ref)
  $ki = New-Object System.Security.Cryptography.Xml.KeyInfo
  $ki.AddClause((New-Object System.Security.Cryptography.Xml.KeyInfoX509Data($cert)))
  $signed.KeyInfo = $ki
  $signed.ComputeSignature()
  $sig = $doc.ImportNode($signed.GetXml(), $true)
  $parent = $doc.GetElementsByTagName($parentTag)[0]
  $parent.AppendChild($sig) | Out-Null
  return $doc.OuterXml
}

function Send-CienciaOperacao {
  param([string]$cnpj, [string]$chave, [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert)
  $cnpj = $cnpj -replace '\D', ''
  $dh = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
  $id = "ID210210$($chave)01"
  $evento = "<evento xmlns=`"$($script:NS_NFE)`" versao=`"1.00`"><infEvento Id=`"$id`"><cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>$cnpj</CNPJ><chNFe>$chave</chNFe><dhEvento>$dh</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao=`"1.00`"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento>"
  $assinado = Sign-Xml -xml $evento -idRef $id -cert $cert -parentTag 'evento'
  $assinado = $assinado -replace '^<\?xml[^>]*\?>', ''
  $env = "<envEvento xmlns=`"$($script:NS_NFE)`" versao=`"1.00`"><idLote>$((Get-Date).ToString('yyyyMMddHHmmss'))</idLote>$assinado</envEvento>"
  $body = "<nfeDadosMsg xmlns=`"http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4`">$env</nfeDadosMsg>"
  $resp = Invoke-Soap -url $script:URL_EVENTO -bodyXml $body -cert $cert
  $x = New-Object Xml.XmlDocument; $x.LoadXml($resp)
  $ns = New-Object Xml.XmlNamespaceManager($x.NameTable); $ns.AddNamespace('n', $script:NS_NFE)
  $inf = $x.SelectSingleNode('//n:retEvento/n:infEvento', $ns)
  if ($null -eq $inf) { $lote = $x.SelectSingleNode('//n:retEnvEvento', $ns); if ($lote) { return @{ cStat = $lote.SelectSingleNode('n:cStat', $ns).InnerText; xMotivo = $lote.SelectSingleNode('n:xMotivo', $ns).InnerText } }; throw 'Resposta inesperada no evento: ' + $resp.Substring(0, [Math]::Min(300, $resp.Length)) }
  return @{ cStat = $inf.SelectSingleNode('n:cStat', $ns).InnerText; xMotivo = $inf.SelectSingleNode('n:xMotivo', $ns).InnerText }
}

# ---------------------------------------------------------------- fluxo por chave
function Get-NFeCompleta {
  param([string]$cnpj, [string]$chave)
  $cnpj = $cnpj -replace '\D', ''; $chave = $chave -replace '\D', ''
  if ($chave.Length -ne 44) { throw 'Chave de acesso inválida.' }
  $cert = Get-Certificado $cnpj
  $r = Invoke-DistDFe -cnpj $cnpj -cert $cert -chave $chave
  $log = @("distDFe consChNFe: $($r.cStat) $($r.xMotivo)")
  $proc = $r.docs | Where-Object { $_.schema -like 'procNFe*' } | Select-Object -First 1
  if ($proc) { return @{ ok = $true; xml = $proc.xml; chave = $chave; log = $log } }
  $res = $r.docs | Where-Object { $_.schema -like 'resNFe*' } | Select-Object -First 1
  if ($res -or $r.cStat -eq '138') {
    # Só o resumo veio: manifesta ciência e consulta de novo
    $ev = Send-CienciaOperacao -cnpj $cnpj -chave $chave -cert $cert
    $log += "ciência 210210: $($ev.cStat) $($ev.xMotivo)"
    if ($ev.cStat -in @('135', '136', '573')) {  # 573 = evento já registrado
      Start-Sleep -Seconds 2
      $r2 = Invoke-DistDFe -cnpj $cnpj -cert $cert -chave $chave
      $log += "distDFe após ciência: $($r2.cStat) $($r2.xMotivo)"
      $proc2 = $r2.docs | Where-Object { $_.schema -like 'procNFe*' } | Select-Object -First 1
      if ($proc2) { return @{ ok = $true; xml = $proc2.xml; chave = $chave; log = $log } }
      return @{ ok = $false; pendente = $true; motivo = 'Ciência registrada; a SEFAZ ainda não liberou o XML completo. Tente de novo em alguns minutos.'; log = $log }
    }
    return @{ ok = $false; motivo = "Evento de ciência rejeitado: $($ev.cStat) $($ev.xMotivo)"; log = $log }
  }
  return @{ ok = $false; motivo = "SEFAZ: $($r.cStat) $($r.xMotivo)"; log = $log }
}

# ---------------------------------------------------------------- fluxo por NSU (todas as notas do CNPJ)
function Get-NFeDistribuicao {
  param([string]$cnpj, [int]$maxLotes = 10)
  $cnpj = $cnpj -replace '\D', ''
  $cert = Get-Certificado $cnpj
  $nsuFile = Join-Path $script:CERT_DIR "$cnpj.nsu"
  $ult = '0'; if (Test-Path $nsuFile) { $ult = (Get-Content $nsuFile -Raw).Trim() }
  $docs = @(); $log = @(); $lotes = 0
  while ($lotes -lt $maxLotes) {
    $r = Invoke-DistDFe -cnpj $cnpj -cert $cert -ultNSU $ult
    $lotes++
    $log += "distNSU ultNSU=$ult -> $($r.cStat) $($r.xMotivo) (docs $($r.docs.Count), ultNSU $($r.ultNSU), maxNSU $($r.maxNSU))"
    foreach ($d in $r.docs) { $docs += @{ nsu = $d.nsu; schema = $d.schema; chave = $d.chave; xml = $d.xml } }
    if ($r.ultNSU) { $ult = $r.ultNSU; Set-Content -Path $nsuFile -Value $ult -Encoding ascii }
    if ($r.cStat -ne '138') { break }
    if ($r.ultNSU -eq $r.maxNSU) { break }
  }
  return @{ ok = $true; docs = $docs; ultNSU = $ult; log = $log }
}
