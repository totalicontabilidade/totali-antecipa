# =====================================================================
#  Totali Antecipa — importa a planilha do Portal Nacional da ST (SE)
#  Entrada : materiais\portal-st-se-vNNNN.xlsx (baixada do Portal da ST)
#  Saída   : materiais\st-se-portal.csv  (uma linha por NCM/CEST, com
#            MVA-ST por alíquota de origem, PFC, alíquota interna e FECOEP)
#  Uso     : powershell -ExecutionPolicy Bypass -File importar-portal-st.ps1 [-Arquivo caminho.xlsx]
# =====================================================================
param([string]$Arquivo = "")
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Arquivo) { $Arquivo = (Get-ChildItem (Join-Path $root 'materiais') -Filter 'portal-st-se-*.xlsx' | Sort-Object Name -Descending | Select-Object -First 1).FullName }
$out = Join-Path $root 'materiais\st-se-portal.csv'
Write-Host "Lendo $Arquivo"

function Norm($s) { $t = ("{0}" -f $s) -replace "`r|`n", " "; $t = $t -replace '\s+', ' '; return $t.Trim() }
function Q($s) { $t = Norm $s; return ($t -replace ';', ' ,' -replace '"', "'") }
function Pct($v) {
  if ($null -eq $v -or "$v" -eq "") { return "" }
  $s = (Norm $v); if ($s -eq "-") { return "" }
  if ($s -match '^-?[\d.,]+\s*%$') { return ([double]($s.TrimEnd('%',' ').Replace(',', '.'))).ToString([Globalization.CultureInfo]::InvariantCulture) }
  if ($s -match '^-?[\d.,]+$') { $d = [double]($s.Replace(',', '.')); if ($d -le 5) { $d = $d * 100 }; return ([math]::Round($d, 2)).ToString([Globalization.CultureInfo]::InvariantCulture) }
  return ""
}

$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open($Arquivo, 0, $true)
$rows = New-Object System.Collections.Generic.List[string]
$rows.Add("segmento;anexo;item;cest;ncm;descricao;op_interna;protocolo;legislacao;mva4;mva7;mva12;mva_int;mva2_4;mva2_7;mva2_12;mva2_int;mva_ns4;mva_ns7;mva_ns12;mva_imp;pfc;aliq_interna;fecoep;aliq_txt;vigencia;versao")
$versao = ""
foreach ($ws in $wb.Worksheets) {
  if ($ws.Name -eq 'Leiaute') { continue }
  $ur = $ws.UsedRange; $v = $ur.Value2; $nr = $ur.Rows.Count; $nc = $ur.Columns.Count
  $anexo = ""; $seg = $ws.Name; $vig = ""; $obsNaoIncide = $false
  for ($i = 1; $i -le [Math]::Min($nr, 8); $i++) { for ($j = 1; $j -le $nc; $j++) { $t = Norm $v[$i, $j]
      if ($t -match 'ANEXO\s+([IVXL]+)\s*[–-]\s*SEGMENTO:\s*(.+)$') { $anexo = $Matches[1]; $seg = $Matches[2].Trim() }
      if ($t -match 'efeitos a partir de\s*(\S+)') { $vig = $Matches[1] }
      if ($t -match 'Vers[ãa]o:\s*(\d+)') { $versao = $Matches[1] }
      if ($t -match 'N[ãa]o incide o adicional') { $obsNaoIncide = $true } } }
  $h = 0; for ($i = 1; $i -le [Math]::Min($nr, 10); $i++) { for ($j = 1; $j -le $nc; $j++) { if ((Norm $v[$i, $j]) -eq 'CEST') { $h = $i } }; if ($h) { break } }
  if (-not $h) { continue }
  $h1 = $h + 1
  # cabeçalho: junta a linha do cabeçalho com a linha seguinte quando esta for "0,04" etc. (Medicamentos)
  $hdr = @{}; $sub = $false
  for ($j = 1; $j -le $nc; $j++) { $t = Norm $v[$h, $j]; $t2 = ""; if ($h1 -le $nr) { $t2 = Norm $v[$h1, $j] }
    if ($t2 -match '^0,\d\d$' -and (Norm $v[$h1, 1]) -eq '' -and (Norm $v[$h1, 2]) -eq '' -and (Norm $v[$h1, 3]) -eq '') { $t = $t + ' ' + $t2; $sub = $true }
    $hdr[$j] = $t }
  $dataStart = $h1; if ($sub) { $dataStart = $h1 + 1 }
  $c = @{ cest = 0; ncm = 0; desc = 0; op = 0; leg = 0; item = 0; aliq = 0; pfc = 0; vig = 0; m4 = 0; m7 = 0; m12 = 0; mi = 0; d4 = 0; d7 = 0; d12 = 0; di = 0; n4 = 0; n7 = 0; n12 = 0; imp = 0 }
  foreach ($k in ($hdr.Keys | Sort-Object)) { $t = $hdr[$k]
    if ($t -eq 'CEST') { $c.cest = $k; continue }
    if ($t -match '^NCM') { $c.ncm = $k; continue }
    if ($t -match '^Descri' -and -not $c.desc) { $c.desc = $k; continue }
    if ($t -match '^Op\. Interna') { $c.op = $k; continue }
    if ($t -match 'Legisla') { $c.leg = $k; continue }
    if ($t -match '^ITEM$|^Item$') { $c.item = $k; continue }
    if ($t -match '^PFC') { $c.pfc = $k; continue }
    if ($t -match 'validade|Vig[êe]ncia') { $c.vig = $k; continue }
    if ($t -match 'n[ãa]o signat') { if ($t -match '4\s*%') { $c.n4 = $k } elseif ($t -match '7\s*%') { $c.n7 = $k } elseif ($t -match '12\s*%') { $c.n12 = $k }; continue }
    if ($t -match 'Importa') { $c.imp = $k; continue }
    if ($t -match 'MVA-ST 2') { if ($t -match '4\s*%') { $c.d4 = $k } elseif ($t -match '7\s*%') { $c.d7 = $k } elseif ($t -match '12\s*%') { $c.d12 = $k } else { $c.di = $k }; continue }
    if ($t -match '^Al[ií]q(uota|\.)?\s*[Ii]nterna' -or $t -match '^Especifica') { if (-not $c.aliq -and $t -match '[Ii]nterna') { $c.aliq = $k }; continue }
    if ($t -match '(^|\D)4\s*%|0,04') { if (-not $c.m4) { $c.m4 = $k }; continue }
    if ($t -match '(^|\D)7\s*%|0,07') { if (-not $c.m7) { $c.m7 = $k }; continue }
    if ($t -match '12\s*%|0,12') { if (-not $c.m12) { $c.m12 = $k }; continue }
    if ($t -match '(18|19)\s*(%|a|\+)|0,19|^MVA-ST$') { if (-not $c.mi) { $c.mi = $k }; continue }
  }
  if (-not $c.ncm -and $c.cest) { $t = Norm $v[$dataStart, ($c.cest + 1)]; if ($t -match '^\d{4}' -and $hdr[$c.cest + 1] -notmatch '^Descri') { $c.ncm = $c.cest + 1 } }
  $cProt = 0; if ($c.op -and $c.leg) { for ($j = $c.op + 1; $j -lt $c.leg; $j++) { if ($hdr[$j] -match '[A-Z]{2},' -or $hdr[$j] -match 'Todas') { $cProt = $j; break } } }
  $g = { param($col, $i) if ($col) { return (Pct $v[$i, $col]) } else { return "" } }
  $cnt = 0
  for ($i = $dataStart; $i -le $nr; $i++) {
    $cestD = ((Q $v[$i, $c.cest]) -replace '\D', ''); if ($cestD.Length -lt 5) { continue }
    $ncms = @(); if ($c.ncm) { $ncms = @(((Q $v[$i, $c.ncm]) -split ' ') | ForEach-Object { ($_ -replace '\D', '') } | Where-Object { $_.Length -ge 4 }) }
    if (-not $ncms.Count) { $ncms = @("") }
    $aliqTxt = ""; if ($c.aliq) { $aliqTxt = Q $v[$i, $c.aliq] }
    $al = ""; $fe = ""
    if ($aliqTxt -match '(\d+)\s*%') { $al = $Matches[1] }
    if ($aliqTxt -match '\+\s*(\d)\s*%?\s*\(?\s*FECOEP') { $fe = $Matches[1] } elseif ($aliqTxt -match 'FECOEP') { $fe = "1" }
    if ($obsNaoIncide) { $fe = "0" }
    $prot = ""; if ($cProt) { $prot = Q $v[$i, $cProt] }
    $vigR = $vig; if ($c.vig) { $t = Q $v[$i, $c.vig]; if ($t -and $t -notmatch '^\d{5}$') { $vigR = $t } }
    $vals = @((& $g $c.m4 $i), (& $g $c.m7 $i), (& $g $c.m12 $i), (& $g $c.mi $i), (& $g $c.d4 $i), (& $g $c.d7 $i), (& $g $c.d12 $i), (& $g $c.di $i), (& $g $c.n4 $i), (& $g $c.n7 $i), (& $g $c.n12 $i), (& $g $c.imp $i))
    $pfc = ""; if ($c.pfc) { $pfc = Q $v[$i, $c.pfc] }
    $desc = ""; if ($c.desc) { $desc = Q $v[$i, $c.desc] }
    $item = ""; if ($c.item) { $item = Q $v[$i, $c.item] }
    $op = ""; if ($c.op) { $op = Q $v[$i, $c.op] }
    $leg = ""; if ($c.leg) { $leg = Q $v[$i, $c.leg] }
    foreach ($n in $ncms) {
      $rows.Add((@($seg, $anexo, $item, $cestD, $n, $desc, $op, $prot, $leg) + $vals + @($pfc, $al, $fe, $aliqTxt, $vigR, $versao)) -join ';'); $cnt++
    }
  }
  Write-Host ("{0,-16} anexo {1,-5} ncm={2} 4={3} 7={4} 12={5} int={6} ns4={7} imp={8} aliq={9} pfc={10} linhas={11}" -f $ws.Name, $anexo, $c.ncm, $c.m4, $c.m7, $c.m12, $c.mi, $c.n4, $c.imp, $c.aliq, $c.pfc, $cnt)
}
$wb.Close($false); $xl.Quit()
[IO.File]::WriteAllLines($out, $rows, (New-Object Text.UTF8Encoding($true)))
Write-Host "Gerado $out ($($rows.Count - 1) linhas, versão $versao)"
