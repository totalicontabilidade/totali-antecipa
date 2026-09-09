/* =====================================================================
   Totali Antecipa — MATERIAIS DE APOIO (mesmos do sistema Fiscal Certo)
   ---------------------------------------------------------------------
   Tabelas oficiais em materiais/ (CSV ; ou JSON). Carregadas por fetch
   quando o sistema roda pelo servir.ps1 / hospedagem; também podem ser
   importadas manualmente (arquivo) na tela "Materiais de apoio".

   Regra de uso (herdada do Fiscal Certo): enquanto a tabela não estiver
   carregada, a checagem que depende dela fica como "não conferido" —
   nunca como "ok".
   ===================================================================== */

const MATERIAIS = (() => {
  const DEF = {
    st_portal: { arquivo: 'materiais/st-se-portal.csv', rotulo: 'Portal Nacional da ST — Sergipe (v0019, efeitos 01/07/2023)', origem: 'Planilha oficial do Portal Nacional da ST, UF SE (portal-st-se-v0019.xlsx) convertida por server/importar-portal-st.ps1', uso: 'MVA-ST por alíquota de origem (4/7/12%) e interna, PFC/PMPF, alíquota interna e FECOEP por CEST/NCM', chave: 'ncm' },
    st_se: { arquivo: 'materiais/st-sergipe.csv', rotulo: 'ST / MVA de Sergipe (Fiscal Certo)', origem: 'Planilha de ST de Sergipe do Fiscal Certo (derivada do Portal da ST) + RICMS/SE Anexo IX', uso: 'complemento por NCM quando o Portal não tem a linha', chave: 'ncm' },
    cest: { arquivo: 'materiais/cest.csv', rotulo: 'CEST × NCM (Convênio ICMS 142/2018)', origem: 'Convênio ICMS 142/2018, Anexos II a XXVI', uso: 'produto sujeito a ST / CEST correto', chave: 'ncm' },
    beneficios_se: { arquivo: 'materiais/beneficios-se.csv', rotulo: 'Benefícios do RICMS/SE (isenção, base reduzida, ST)', origem: 'RICMS/SE — Anexos I, II e IX (PDF oficial da SEFAZ/SE)', uso: 'alerta de isenção/base reduzida em SE (carga efetiva)', chave: 'ncm' },
    ncm: { arquivo: 'materiais/ncm-siscomex.json', rotulo: 'Tabela NCM vigente', origem: 'Portal Único Siscomex — Nomenclatura (JSON)', uso: 'descrição oficial e existência do NCM', chave: 'Codigo', json: true },
    tipi: { arquivo: 'materiais/tipi.csv', rotulo: 'TIPI (alíquotas de IPI por NCM)', origem: 'Decreto 11.158/2022 e alterações — RFB', uso: 'conferência do IPI destacado', chave: 'ncm' },
    piscofins: { arquivo: 'materiais/piscofins.csv', rotulo: 'PIS/COFINS por NCM (monofásico, alíquota zero, ST)', origem: 'IN RFB 2.121/2022 + tabelas 4.3.x da EFD-Contribuições', uso: 'informativo (regime de PIS/COFINS do produto)', chave: 'ncm' },
    ibscbs: { arquivo: 'materiais/ibscbs.csv', rotulo: 'IBS/CBS por NCM (LC 214/2025)', origem: 'LC 214/2025 — Anexos e Imposto Seletivo', uso: 'informativo (reforma tributária)', chave: 'ncm' },
    in2121: { arquivo: 'materiais/in2121-indice.csv', rotulo: 'IN RFB 2.121/2022 — índice por NCM', origem: 'IN RFB 2.121/2022 (DOU)', uso: 'citar o artigo da IN por NCM', chave: 'ncm' },
    termos: { arquivo: 'materiais/termos-ncm.csv', rotulo: 'Termos do produto × NCM esperado', origem: 'Conhecimento do escritório (editável)', uso: 'NCM incompatível com o nome do produto', chave: 'termo' },
  };
  const cache = {};   // nome -> { linhas, porNcm (Map prefixo -> [linhas]), meta }
  const status = {};  // nome -> { ok, linhas, erro, origem: 'fetch'|'arquivo' }

  // ---------------- CSV ----------------
  function detectarSep(l) { const c = (l.match(/;/g) || []).length, v = (l.match(/,/g) || []).length, t = (l.match(/\t/g) || []).length; if (t > c && t > v) return '\t'; return c >= v ? ';' : ','; }
  function parseCSV(texto) {
    texto = String(texto).replace(/^﻿/, '');
    const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!linhas.length) return [];
    const sep = detectarSep(linhas[0]);
    const campos = (linha) => { const out = []; let a = '', q = false; for (let i = 0; i < linha.length; i++) { const ch = linha[i]; if (q) { if (ch === '"' && linha[i + 1] === '"') { a += '"'; i++; } else if (ch === '"') q = false; else a += ch; } else if (ch === '"') q = true; else if (ch === sep) { out.push(a); a = ''; } else a += ch; } out.push(a); return out.map(s => s.trim()); };
    const hdr = campos(linhas[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows = [];
    for (let i = 1; i < linhas.length; i++) { const c = campos(linhas[i]); if (!c.length) continue; const o = {}; hdr.forEach((h, j) => o[h] = c[j] ?? ''); rows.push(o); }
    return rows;
  }
  const soDig = s => String(s || '').replace(/\D/g, '');
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; };

  function indexar(nome, linhas) {
    const def = DEF[nome]; const porNcm = new Map();
    const add = (k, l) => { if (!k) return; if (!porNcm.has(k)) porNcm.set(k, []); porNcm.get(k).push(l); };
    if (nome === 'ncm') {
      const arr = Array.isArray(linhas) ? linhas : (linhas.Nomenclaturas || []);
      const out = [];
      for (const n of arr) { const cod = soDig(n.Codigo); const l = { ncm: cod, codigo: n.Codigo, descricao: String(n.Descricao || '').replace(/^-+\s*/, ''), inicio: n.Data_Inicio, fim: n.Data_Fim, ato: (n.Tipo_Ato_Ini || '') + ' ' + (n.Numero_Ato_Ini || '') + '/' + (n.Ano_Ato_Ini || '') }; out.push(l); add(cod, l); }
      linhas = out;
    } else if (nome === 'termos') { for (const l of linhas) add(String(l.termo || '').toLowerCase(), l); }
    else if (nome === 'st_portal') {
      const porCest = new Map();
      for (const l of linhas) {
        l.ncm = soDig(l.ncm); l.cest = soDig(l.cest);
        ['mva4', 'mva7', 'mva12', 'mva_int', 'mva2_4', 'mva2_7', 'mva2_12', 'mva2_int', 'mva_ns4', 'mva_ns7', 'mva_ns12', 'mva_imp', 'aliq_interna', 'fecoep'].forEach(k => l[k] = num(l[k]));
        if (l.pfc != null) l.pfcNum = num(String(l.pfc).replace(/\./g, '').replace(',', '.'));
        if (l.ncm) add(l.ncm, l);
        if (l.cest) { if (!porCest.has(l.cest)) porCest.set(l.cest, []); porCest.get(l.cest).push(l); }
      }
      cache[nome] = { linhas, porNcm, porCest, def }; status[nome] = { ok: true, linhas: linhas.length }; return;
    }
    else { for (const l of linhas) { l.ncm = soDig(l.ncm); if (l.mva != null) l.mva = num(l.mva); if (l.aliq_interna != null) l.aliq_interna = num(l.aliq_interna); if (l.aliquota != null) l.aliquota = num(l.aliquota); add(l.ncm, l); } }
    cache[nome] = { linhas, porNcm, def };
    status[nome] = { ok: true, linhas: linhas.length };
  }

  async function carregarTodos(base) {
    base = base || '';
    const podeFetch = /^https?:/.test(location.protocol);
    await Promise.all(Object.keys(DEF).map(async nome => {
      if (cache[nome]) return;
      if (!podeFetch) { status[nome] = { ok: false, erro: 'abra pelo servir.ps1 (http) ou importe o arquivo' }; return; }
      try {
        const r = await fetch(base + DEF[nome].arquivo, { cache: 'force-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const txt = await r.text();
        indexar(nome, DEF[nome].json ? JSON.parse(txt) : parseCSV(txt));
        status[nome].origem = 'fetch';
      } catch (e) { status[nome] = { ok: false, erro: e.message }; }
    }));
    return status;
  }
  function importarArquivo(nome, texto) { indexar(nome, DEF[nome].json ? JSON.parse(texto) : parseCSV(texto)); status[nome].origem = 'arquivo'; }

  // Casamento por prefixo: tenta do NCM completo (8) até 2 dígitos; devolve as linhas do maior prefixo
  function porPrefixo(nome, ncm) {
    const c = cache[nome]; if (!c) return null;
    ncm = soDig(ncm);
    for (let len = ncm.length; len >= 2; len--) { const k = ncm.substring(0, len); if (c.porNcm.has(k)) return { prefixo: k, exato: len === ncm.length, linhas: c.porNcm.get(k) }; }
    return { prefixo: '', exato: false, linhas: [] };
  }
  const carregada = nome => !!cache[nome];

  // ---- consultas ----
  function st(ncm, cest) {
    const r = porPrefixo('st_se', ncm); if (!r) return null;
    let linhas = r.linhas;
    if (cest && linhas.length > 1) { const c = soDig(cest); const f = linhas.filter(l => soDig(l.cest) === c); if (f.length) linhas = f; }
    return { ...r, linhas };
  }
  // Portal Nacional da ST (SE): casa por NCM exato (8 dígitos) ou prefixo da tabela; se o item tem CEST, prefere a linha do mesmo CEST
  function stPortal(ncm, cest) {
    const c = cache.st_portal; if (!c) return null;
    ncm = soDig(ncm); cest = soDig(cest);
    let linhas = [], prefixo = '', exato = false;
    for (let len = ncm.length; len >= 4; len--) { const k = ncm.substring(0, len); if (c.porNcm.has(k)) { linhas = c.porNcm.get(k); prefixo = k; exato = len === ncm.length; break; } }
    let porCest = cest && c.porCest.has(cest) ? c.porCest.get(cest) : [];
    if (cest && linhas.length) { const f = linhas.filter(l => l.cest === cest); if (f.length) { linhas = f; } }
    // item com CEST que só existe por CEST (água, bebidas frias — sem NCM na planilha)
    if (!linhas.length && porCest.length) { linhas = porCest; prefixo = 'CEST ' + cest; }
    const cestOk = !cest || !linhas.length || linhas.some(l => l.cest === cest);
    return { linhas, prefixo, exato, cestOk, porCest };
  }
  function cestDe(ncm) { const r = porPrefixo('cest', ncm); return r ? r.linhas : []; }
  function beneficios(ncm) { const r = porPrefixo('beneficios_se', ncm); return r ? r.linhas : []; }
  function ncmInfo(ncm) {
    const c = cache.ncm; if (!c) return null; ncm = soDig(ncm);
    const ex = c.porNcm.get(ncm);
    if (ex && ex.length) { const l = ex[ex.length - 1]; return { existe: true, descricao: l.descricao, vigente: !l.fim || l.fim === '31/12/9999', fim: l.fim }; }
    // descrição hierárquica (posição/subposição) quando o código de 8 dígitos não está na tabela
    for (let len = ncm.length - 1; len >= 4; len--) { const p = c.porNcm.get(ncm.substring(0, len)); if (p && p.length) return { existe: false, descricao: p[p.length - 1].descricao, vigente: false, nivel: len }; }
    return { existe: false, descricao: '', vigente: false };
  }
  function tipi(ncm) { const r = porPrefixo('tipi', ncm); return r ? r.linhas : []; }
  function piscofins(ncm) { const r = porPrefixo('piscofins', ncm); return r ? r.linhas : []; }
  function ibscbs(ncm) { const r = porPrefixo('ibscbs', ncm); return r ? r.linhas : []; }
  function in2121(ncm) { const r = porPrefixo('in2121', ncm); return r ? r.linhas : []; }
  function termos(xProd) {
    const c = cache.termos; if (!c) return [];
    const p = String(xProd || '').toLowerCase(); const out = [];
    for (const [termo, ls] of c.porNcm) if (termo && p.includes(termo)) out.push(...ls);
    return out;
  }

  // Ficha completa de um NCM (para a tela de consulta e o detalhe do item)
  function ficha(ncm, cest, xProd) {
    return { ncm: soDig(ncm), info: ncmInfo(ncm), portal: stPortal(ncm, cest), st: st(ncm, cest), cest: cestDe(ncm), beneficios: beneficios(ncm), tipi: tipi(ncm), piscofins: piscofins(ncm), ibscbs: ibscbs(ncm), in2121: in2121(ncm), termos: termos(xProd) };
  }

  function segmentos() { const c = cache.st_se; if (!c) return null; const m = {}; for (const l of c.linhas) { const s = l.segmento || "(sem segmento)"; m[s] = (m[s] || 0) + 1; } return m; }

  return { DEF, status, carregarTodos, importarArquivo, carregada, st, stPortal, segmentos, cestDe, beneficios, ncmInfo, tipi, piscofins, ibscbs, in2121, termos, ficha, parseCSV };
})();
