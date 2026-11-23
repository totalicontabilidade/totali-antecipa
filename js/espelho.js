/* =====================================================================
   Totali Antecipa — leitor do "Espelho Demonstrativo ICMS Antecipado"
   (Extrato_Espelho_DIA_*.xls exportado pelo DIA da SEFAZ/SE)
   Usa SheetJS (XLSX global). Também aceita colar chaves de acesso.
   ===================================================================== */

const ESPELHO = (() => {

  function num(v) {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s); return isNaN(n) ? 0 : n;
  }
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const COLS = {
    mesRef: ['mes ref'], etiqueta: ['etiqueta'], nNF: ['nr. da nota', 'nr da nota', 'numero da nota', 'nota'],
    dtEmissao: ['dt. emissao', 'dt emissao', 'emissao'], dtRegistro: ['dt. registro', 'registro'], pago: ['pago'],
    vlTotal: ['vl. total nf', 'vl total', 'valor total'], vlIcmsCalc: ['vl. icms calc', 'icms calc'], vlRecolher: ['vl. recolher', 'recolher'],
    emitente: ['emitente'], chave: ['chave de acesso', 'chave'], forma: ['forma recolhimento', 'forma'],
    obs: ['observacao'], alterada: ['nota alterada'], adiada: ['nota adiada'],
  };

  function lerPlanilha(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, raw: true });
    const out = { contribuinte: '', ie: '', nDia: '', ref: '', linhas: [], avisos: [] };
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      let hdr = -1, map = {};
      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const cells = rows[i].map(norm);
        const idx = cells.findIndex(c => c.includes('chave de acesso'));
        if (idx >= 0) {
          hdr = i;
          cells.forEach((c, j) => { for (const [k, alts] of Object.entries(COLS)) if (!map[k] && alts.some(a => c.startsWith(a) || c === a || c.includes(a))) map[k] = j; });
          break;
        }
        const linha = rows[i].map(String).join(' ');
        const m = linha.match(/Contribuinte:\s*(\d+)\s+(.+?)\s+Ref:\s*(\S*)\s*N[ºo°]DIA:\s*(\d+)/i);
        if (m) { out.ie = m[1]; out.contribuinte = m[2].trim(); out.ref = m[3]; out.nDia = m[4]; }
        else if (/contribuinte:/i.test(linha)) { const m2 = linha.match(/Contribuinte:\s*(\d+)\s+([^\t]+)/i); if (m2) { out.ie = m2[1]; out.contribuinte = m2[2].trim(); } }
      }
      if (hdr < 0) continue;
      for (let i = hdr + 1; i < rows.length; i++) {
        const r = rows[i];
        const chave = String(r[map.chave] ?? '').replace(/\D/g, '');
        if (chave.length !== 44) continue;
        const g = k => map[k] != null ? r[map[k]] : '';
        const linha = {
          mesRef: String(g('mesRef')), etiqueta: String(g('etiqueta')), nNF: String(g('nNF')).replace(/\.0+$/, ''),
          dtEmissao: String(g('dtEmissao')), dtRegistro: String(g('dtRegistro')), pago: String(g('pago')),
          vlTotal: num(g('vlTotal')), vlIcmsCalc: num(g('vlIcmsCalc')), vlRecolher: num(g('vlRecolher')),
          emitente: String(g('emitente')).replace(/\D/g, ''), chave, forma: String(g('forma')).trim(),
          obs: String(g('obs')), alterada: String(g('alterada')), adiada: String(g('adiada')), partes: [],
        };
        // A SEFAZ repete a mesma chave quando a nota tem parte "com" e parte "sem" encerramento:
        // junta numa linha só (formas separadas por " + ", valor a recolher somado).
        const ja = out.linhas.find(x => x.chave === chave);
        if (ja) {
          ja.partes.push({ forma: linha.forma, vlRecolher: linha.vlRecolher });
          if (linha.forma && !ja.forma.includes(linha.forma)) ja.forma += ' + ' + linha.forma;
          ja.vlRecolher = Math.round((ja.vlRecolher + linha.vlRecolher) * 100) / 100;
          if (linha.vlIcmsCalc > ja.vlIcmsCalc) ja.vlIcmsCalc = linha.vlIcmsCalc;
        } else { linha.partes.push({ forma: linha.forma, vlRecolher: linha.vlRecolher }); out.linhas.push(linha); }
      }
      // Notas adiadas: coluna "Nota Adiada" = SIM ou rodapé "12345 - Adiada"
      for (const r of rows) for (const c of r) { const m = String(c ?? '').match(/^\s*(\d{1,9})\s*-\s*adiad/i); if (m) { const l = out.linhas.find(x => x.nNF === m[1]); if (l) l.adiadaFlag = true; } }
      for (const l of out.linhas) if (/^s/i.test(l.adiada)) l.adiadaFlag = true;
      if (out.linhas.length) break;
    }
    if (!out.linhas.length) out.avisos.push('Nenhuma linha com chave de acesso (44 dígitos) foi encontrada no arquivo.');
    return out;
  }

  // Texto colado: extrai chaves de 44 dígitos (uma por linha ou separadas por espaço)
  function lerTexto(txt) {
    const chaves = [...new Set((String(txt || '').match(/\d{44}/g) || []))];
    return { contribuinte: '', ie: '', nDia: '', linhas: chaves.map(c => ({ chave: c, nNF: c.substring(25, 34).replace(/^0+/, ''), emitente: c.substring(6, 20), forma: '', vlTotal: 0, vlIcmsCalc: 0, vlRecolher: 0 })), avisos: [] };
  }

  // ---------------------------------------------------------------------------------------------
  // BAHIA: não existe espelho do DIA. O escritório parte do relatório de NF-e destinadas ao CNPJ (rpt_cons_dest.csv),
  // que traz: Numero NF-e;CNPJ/CPF Emitente;Razao Social Emitente;Data de Emissao;Data de Autorizacao;Valor;
  // Chave de Acesso;UF Emit.;Situacao;Tipo Operacao. Separador ";", chave com apóstrofo na frente, valor "2.472,30".
  // Faz o papel do espelho: dá a lista de chaves para baixar os XMLs. Não traz valor calculado pela SEFAZ (vlIcmsCalc = null).
  // ---------------------------------------------------------------------------------------------
  function ehCsvDestinatario(txt) {
    const cab = norm(String(txt || '').replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '');
    return cab.includes('chave de acesso') && cab.includes('uf emit');
  }
  function lerCsvDestinatario(txt) {
    const out = { contribuinte: '', ie: '', nDia: '', ref: '', origem: 'relatorio-destinatario', linhas: [], avisos: [] };
    const rows = String(txt || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!rows.length) { out.avisos.push('Arquivo vazio.'); return out; }
    const sep = (rows[0].match(/;/g) || []).length >= (rows[0].match(/,/g) || []).length ? ';' : ',';
    const cab = rows[0].split(sep).map(norm);
    const col = nome => cab.findIndex(c => c.includes(nome));
    const i = { num: col('numero'), cnpj: col('cnpj'), razao: col('razao'), emi: col('data de emissao'), val: col('valor'), chave: col('chave'), uf: col('uf emit'), sit: col('situacao'), tipo: col('tipo') };
    if (i.chave < 0) { out.avisos.push('Não encontrei a coluna "Chave de Acesso".'); return out; }
    const vistas = new Set();
    for (const l of rows.slice(1)) {
      const c = l.split(sep);
      const chave = String(c[i.chave] || '').replace(/\D/g, '');
      if (chave.length !== 44 || vistas.has(chave)) continue;
      vistas.add(chave);
      const d = String(c[i.emi] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const sit = String(c[i.sit] || '').trim();
      out.linhas.push({
        mesRef: d ? d[2] + '/' + d[3] : '', etiqueta: '', nNF: String(parseInt(String(c[i.num] || '').replace(/\D/g, ''), 10) || ''),
        dtEmissao: d ? d[3] + '-' + d[2] + '-' + d[1] : '', dtRegistro: '', pago: '', vlTotal: num(c[i.val]), vlIcmsCalc: null, vlRecolher: 0,
        emitente: String(c[i.cnpj] || '').replace(/\D/g, ''), chave, forma: '', obs: '', alterada: '', adiada: '', partes: [],
        emitenteNome: String(c[i.razao] || '').trim(), ufEmit: String(c[i.uf] || '').trim(), situacaoNfe: sit, tipoOperacao: String(c[i.tipo] || '').trim(),
        cancelada: /cancelad|denegad/i.test(sit),
      });
    }
    if (!out.linhas.length) out.avisos.push('Nenhuma linha com chave de acesso (44 dígitos) foi encontrada no arquivo.');
    // competência = mês com mais notas emitidas
    const cont = {}; for (const l of out.linhas) if (l.mesRef) cont[l.mesRef] = (cont[l.mesRef] || 0) + 1;
    out.ref = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0] || '';
    return out;
  }

  // Mapeia a "Forma Recolhimento" do espelho para a receita do mapa
  function formaParaReceita(forma) {
    const f = norm(forma);
    if (!f) return null;
    if (f.includes('nao antecipada')) return 'nao_antecipa';
    if (f.includes('com encerramento')) return 'antecip_encer';
    if (f.includes('complementacao de aliquota')) return 'simples';
    if (f.includes('sem encerramento') || f.includes('interestadual')) return 'antecip_interest';
    if (f.includes('diferen')) return 'difal';
    if (f.includes('cesta')) return 'cesta_nao_opt';
    return null;
  }

  // Dados que dá pra tirar da própria chave (sem XML)
  function infoChave(chave) {
    const c = String(chave).replace(/\D/g, '');
    if (c.length !== 44) return null;
    const cUF = c.substring(0, 2), aamm = c.substring(2, 6), cnpj = c.substring(6, 20), mod = c.substring(20, 22), serie = c.substring(22, 25), nNF = c.substring(25, 34);
    const UF = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' }[cUF] || cUF;
    return { uf: UF, ano: '20' + aamm.substring(0, 2), mes: aamm.substring(2, 4), cnpj, mod, serie: String(parseInt(serie, 10)), nNF: String(parseInt(nNF, 10)) };
  }

  return { lerPlanilha, lerTexto, lerCsvDestinatario, ehCsvDestinatario, formaParaReceita, infoChave };
})();
