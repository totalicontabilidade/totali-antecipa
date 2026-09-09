/* =====================================================================
   Totali Antecipa — exportação para Excel (xlsx-js-style / SheetJS)
   Abas:
     1. Mapa SEFAZ      — réplica do Mapa de Apuração do ICMS (Portaria 103/2006)
     2. Itens           — planilha item a item no padrão do sistema de referência
     3. FECOEP          — cálculo do FCP por nota (padrão do escritório)
     4. Resumo DAE      — valor por receita/código
     5. Espelho x Cálculo — conferência com o DIA da SEFAZ
   ===================================================================== */

const EXPORTAR = (() => {
  const NAVY = '182C43', GOLD = 'C89D57', GELO = 'F9F9F9';
  const bold = { font: { bold: true } };
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: NAVY } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: brd() };
  const goldStyle = { font: { bold: true, color: { rgb: NAVY } }, fill: { patternType: 'solid', fgColor: { rgb: 'F3E7CF' } }, border: brd() };
  const notaHdr = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFC7CE' } } };
  const colHdr = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } }, alignment: { horizontal: 'center', wrapText: true }, border: brd() };
  const amarelo = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFF99' } }, border: brd() };
  const money = '#,##0.00'; const pct = '0.00%';
  function brd() { const s = { style: 'thin', color: { rgb: 'BFBFBF' } }; return { top: s, bottom: s, left: s, right: s }; }

  function cell(ws, addr, v, opt = {}) {
    if (v === undefined || v === null || v === '') { if (opt.s) ws[addr] = { t: 's', v: '', s: opt.s }; return; }
    const c = { v };
    if (opt.f) { c.f = opt.f; c.t = 'n'; }
    else if (typeof v === 'number') c.t = 'n'; else c.t = 's';
    if (opt.z) c.z = opt.z;
    if (opt.s) c.s = opt.s;
    ws[addr] = c;
  }
  const A = (c, r) => XLSX.utils.encode_cell({ c, r });
  function range(ws, r1, c1, r2, c2) { ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: c2, r: r2 } }); }
  function merge(ws, r1, c1, r2, c2) { (ws['!merges'] = ws['!merges'] || []).push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }); }
  const fmtComp = comp => comp ? comp.replace(/^(\d{4})-(\d{2})$/, '$2/$1') : '';

  // ------------------------------------------------------------------
  // 1. MAPA SEFAZ
  // ------------------------------------------------------------------
  function abaMapa(ctx) {
    const { empresa, competencia, resultados, consolidado } = ctx;
    const ws = {};
    const title = { font: { bold: true, sz: 12 } };
    cell(ws, 'A5', 'GOVERNO DE SERGIPE', title); cell(ws, 'A6', 'SECRETARIA DE ESTADO DA FAZENDA', title);
    cell(ws, 'B7', 'VERSÃO 5'); cell(ws, 'A8', 'PORTARIA N.º 103/2006-SEFAZ'); cell(ws, 'A9', 'DE 26 DE JANEIRO DE 2006');
    cell(ws, 'A11', 'ANEXO I', bold); cell(ws, 'A12', 'MAPA DE APURAÇÃO DO ICMS', title);
    cell(ws, 'A14', 'MÊS DE REFERÊNCIA', bold); cell(ws, 'D14', fmtComp(competencia));
    cell(ws, 'A15', 'CONTRIBUINTE:', bold); cell(ws, 'D15', empresa.nome);
    cell(ws, 'A16', 'INSCRIÇÃO ESTADUAL N.º:', bold); cell(ws, 'D16', empresa.ie);
    cell(ws, 'A17', 'CNPJ:', bold); cell(ws, 'B17', empresa.cnpj);
    cell(ws, 'H13', 'Valor devido por Receita', bold); cell(ws, 'M13', 'Valor da devolução', bold); cell(ws, 'O13', 'Valor a recolher por Receita', bold);
    const ordem = ['cesta_opt36', 'cesta_opt21', 'difal', 'antecip_encer', 'importacoes', 'antecip_interest', 'simfaz', 'cesta_nao_opt', 'st_interna', 'antecip_interna', 'simples'];
    let r = 14;
    for (const id of ordem) {
      const R = MOTOR.receita(id); const v = consolidado.porReceita[id];
      cell(ws, A(7, r), R.cod); cell(ws, A(8, r), R.nome);
      cell(ws, A(11, r), v ? v.devido : 0, { z: money }); cell(ws, A(13, r), 0, { z: money }); cell(ws, A(15, r), v ? v.recolher : 0, { z: money, s: v && v.recolher > 0 ? goldStyle : undefined });
      r++;
    }
    cell(ws, 'A20', 'Somatório das Bases de Cálculo', bold); cell(ws, 'E20', consolidado.base, { z: money });
    cell(ws, 'A21', 'Débito do Imposto', bold); cell(ws, 'E21', consolidado.debito, { z: money });
    cell(ws, 'A22', 'Crédito do Imposto referente as entradas', bold); cell(ws, 'E22', consolidado.credito, { z: money });
    cell(ws, 'A23', 'Imposto devido', bold); cell(ws, 'E23', MOTOR.r2(consolidado.debito - consolidado.credito), { z: money });
    cell(ws, 'A24', 'Devolução de mercadoria / desfazimento', bold); cell(ws, 'E24', 0, { z: money });
    cell(ws, 'A25', 'valor a recolher', bold); cell(ws, 'E25', consolidado.devido, { z: money, s: goldStyle });
    cell(ws, 'A26', 'FECOEP (DAE à parte)', bold); cell(ws, 'E26', consolidado.fecoep, { z: money });
    cell(ws, 'A28', 'Gerado por Totali Antecipa — memória de cálculo item a item na aba "Itens". Confira os itens marcados antes de recolher.', { font: { italic: true, color: { rgb: '666666' } } });

    // Cabeçalho da tabela (linhas 33-38 no original; aqui letras na 33 e nomes na 34)
    const letras = 'ABCDEFGHIJKLMNOPQRST'.split('');
    letras.forEach((l, i) => cell(ws, A(i, 32), l, { s: { ...hdrStyle } }));
    const nomes = ['NOTA FISCAL DE ENTRADA (NF/CTRC Nº)', 'Devolução / desfazimento (marque)', 'Receita a ser antecipada', 'IDENTIFICAÇÃO DO FORNECEDOR OU DO DESTINATÁRIO', 'Quantidade do produto',
      'Valor da Nota Fiscal / Base de cálculo', 'IPI', 'Frete', 'Seguro', 'OUTRAS DESPESAS', 'Preço Composto', 'Alíquota de origem', 'Carga tributária de destino', 'Valor da pauta fiscal para o produto',
      'Margem de Agreg. MVA', 'Base de Cálculo', 'Débito do Imposto', 'Crédito da nota fiscal de origem', 'ICMS a ser recolhido na operação', 'Valor do ICMS a ser devolvido'];
    nomes.forEach((n, i) => cell(ws, A(i, 33), n, { s: colHdr }));
    // Totais na linha 39 (índice 38)
    const rowsData = []; let rr = 39;
    for (const res of resultados) {
      if (res.ignorada) continue;
      for (const g of res.linhasMapa) {
        const usaAcr = MOTOR.receita(g.receita).acrescimos;
        const direto = MOTOR.receita(g.receita).direto;
        cell(ws, A(0, rr), g.nNF); cell(ws, A(2, rr), g.receitaNome); cell(ws, A(3, rr), g.fornecedor); cell(ws, A(4, rr), 1);
        cell(ws, A(5, rr), g.F, { z: money });
        if (usaAcr) { cell(ws, A(6, rr), g.G || 0, { z: money }); cell(ws, A(7, rr), g.H || 0, { z: money }); cell(ws, A(8, rr), g.I || 0, { z: money }); cell(ws, A(9, rr), g.J || 0, { z: money }); }
        const x = rr + 1;
        cell(ws, A(10, rr), g.K, { z: money, f: usaAcr ? `F${x}+G${x}+H${x}+I${x}+J${x}` : `F${x}` });
        cell(ws, A(11, rr), g.L / 100, { z: pct }); cell(ws, A(12, rr), g.M / 100, { z: pct });
        if (g.N) cell(ws, A(13, rr), g.N, { z: money });
        if (g.O) cell(ws, A(14, rr), g.O / 100, { z: pct });
        if (direto) { cell(ws, A(15, rr), g.P, { z: money }); cell(ws, A(16, rr), g.Q, { z: money }); cell(ws, A(17, rr), 0, { z: money }); cell(ws, A(18, rr), g.S, { z: money }); }
        else {
          cell(ws, A(15, rr), g.P, { z: money, f: `IF(N${x}>K${x},N${x}*E${x},K${x}*(1+O${x}))` });
          cell(ws, A(16, rr), g.Q, { z: money, f: `P${x}*M${x}` });
          cell(ws, A(17, rr), g.R, { z: money });
          cell(ws, A(18, rr), g.S, { z: money, f: `Q${x}-R${x}` });
        }
        cell(ws, A(19, rr), 0, { z: money });
        rowsData.push(rr); rr++;
      }
    }
    const last = rr; // linha seguinte à última
    if (rowsData.length) {
      cell(ws, A(15, 38), consolidado.base, { z: money, f: `SUM(P40:P${last})`, s: bold }); cell(ws, A(16, 38), consolidado.debito, { z: money, f: `SUM(Q40:Q${last})`, s: bold });
      cell(ws, A(17, 38), consolidado.credito, { z: money, f: `SUM(R40:R${last})`, s: bold }); cell(ws, A(18, 38), MOTOR.r2(consolidado.debito - consolidado.credito), { z: money, f: `SUM(S40:S${last})`, s: bold });
      cell(ws, A(19, 38), 0, { z: money, f: `SUM(T40:T${last})`, s: bold });
    }
    cell(ws, A(11, 38), 'TOTAIS', bold);
    range(ws, 0, 0, Math.max(rr, 40), 19);
    ws['!cols'] = [10, 8, 22, 40, 6, 14, 10, 10, 10, 10, 14, 9, 9, 12, 9, 14, 14, 14, 14, 12].map(w => ({ wch: w }));
    ws['!rows'] = []; ws['!rows'][33] = { hpt: 48 };
    return ws;
  }

  // ------------------------------------------------------------------
  // 2. ITENS (padrão do sistema de referência)
  // ------------------------------------------------------------------
  function abaItens(ctx) {
    const { empresa, competencia, resultados } = ctx;
    const ws = {};
    // Emitente, destinatário, nº da NF e chave ficam só na linha de cabeçalho da nota; as linhas começam no nº do item
    const cols = ['nItem', 'COD_ITEM', 'DESC_ITEM', 'NCM', 'CEST', 'CFOP', 'CST_ICMS',
      'VL_PROD', 'VL_DESC', 'VL_BC_ICMS', 'ALIQ_ICMS', 'VL_ICMS', 'VL_FCP', 'VL_FRETE', 'VL_SEG', 'VL_OUTROS', 'VL_IPI_NF', 'MVA_NF', 'VL_BC_ST_NF', 'ALIQ_ST_NF', 'VL_ICMS_ST_NF',
      'RECEITA', 'COD_RECEITA', 'BC_ANTECIPACAO (K)', 'ALIQ_ORIGEM (L)', 'ALIQ_INTERNA (M)', 'MVA_DB (O)', 'BC_ICMS_ST (P)', 'DEBITO (Q)', 'ICMS_ORIGEM (R)', 'ICMS_ANTECIPADO (S)', 'ALIQ_FECOEP', 'FECOEP', 'CUSTO_TOTAL', 'ALERTAS'];
    cell(ws, 'A1', 'Antecipação ICMS — SERGIPE — ' + empresa.nome + ' — competência ' + fmtComp(competencia), { s: { font: { bold: true, sz: 13, color: { rgb: NAVY } } } });
    cell(ws, 'A2', 'MVA em amarelo = não encontrada na base (informar manualmente) · Alíquota interna em amarelo = valor padrão aplicado (verificar) · Gerado por Totali Antecipa', { s: { font: { italic: true, color: { rgb: '666666' } } } });
    let r = 3;
    for (const res of resultados) {
      if (res.ignorada) continue;
      const n = res.nota;
      cell(ws, A(0, r), `NOTA FISCAL: ${n.nNF} - CHAVE: ${n.chave} - EMITENTE: ${n.emit.nome} (${n.emit.cnpj}) - DESTINATÁRIO: ${n.dest.nome}` + (res.naoAntecipada ? ' — OPERAÇÃO NÃO ANTECIPADA' : ''), { s: notaHdr });
      merge(ws, r, 0, r, cols.length - 1); r++;
      cols.forEach((c, i) => cell(ws, A(i, r), c, { s: colHdr })); r++;
      const r0 = r;
      for (const it of res.itens) {
        const i = it.item;
        const semMva = it.alertas.some(a => /MVA do produto não encontrada/.test(a.msg));
        const aliqPadrao = !it.override.aliq && !(it.regra && it.regra.aliq != null) && MOTOR.receita(it.receita).aliq == null && it.receita !== 'nao_antecipa';
        const vals = [i.nItem, i.cProd, i.xProd, i.ncm, i.cest, i.cfop, i.icms.cst || i.icms.csosn,
          i.vProd, i.vDesc, i.icms.vBC, i.icms.pICMS, i.icms.vICMS, i.icms.vFCP, i.vFrete, i.vSeg, i.vOutro, i.vIPI, i.icms.pMVAST, i.icms.vBCST, i.icms.pICMSST, i.icms.vICMSST,
          it.receitaNome, it.cod, it.K, it.L, it.M, it.O, it.P, it.Q, it.R, it.S, it.fecoepPts, it.fecoep, MOTOR.r2(it.K + it.S + it.fecoep), it.alertas.map(a => a.msg).join(' | ')];
        vals.forEach((v, c) => {
          const isNum = typeof v === 'number';
          const s = (c === 26 && semMva) || (c === 25 && aliqPadrao) ? amarelo : { border: brd() };
          cell(ws, A(c, r), v === '' ? undefined : v, { z: isNum && c >= 7 ? money : undefined, s });
        });
        r++;
      }
      cell(ws, A(2, r), 'TOTAIS DA NOTA:', bold);
      [7, 11, 16, 23, 27, 28, 29, 30, 32, 33].forEach(c => { const L = XLSX.utils.encode_col(c); cell(ws, A(c, r), res.itens.reduce((s, it) => s + (c === 7 ? it.item.vProd : c === 11 ? it.item.icms.vICMS : c === 16 ? it.item.vIPI : c === 23 ? it.K : c === 27 ? it.P : c === 28 ? it.Q : c === 29 ? it.R : c === 30 ? it.S : c === 32 ? it.fecoep : it.K + it.S + it.fecoep), 0), { z: money, f: `SUM(${L}${r0 + 1}:${L}${r})`, s: bold }); });
      r += 2;
    }
    range(ws, 0, 0, r, cols.length - 1);
    ws['!cols'] = cols.map(c => ({ wch: c === 'DESC_ITEM' ? 40 : c === 'EMIT_NOME' || c === 'DEST_NOME' ? 30 : c === 'C_CHAVE' ? 46 : c === 'ALERTAS' ? 60 : 13 }));
    return ws;
  }

  // ------------------------------------------------------------------
  // 3. FECOEP (padrão do escritório)
  // ------------------------------------------------------------------
  function abaFecoep(ctx) {
    const { empresa, resultados, params } = ctx;
    const ws = {};
    cell(ws, 'A1', 'IE', bold); cell(ws, 'A2', empresa.ie); cell(ws, 'E2', 'FCP', bold);
    cell(ws, 'A3', 'FORMA DE RECOLHIMENTO', { s: hdrStyle }); cell(ws, 'B3', 'NOTA', { s: hdrStyle }); cell(ws, 'C3', 'VALOR', { s: hdrStyle }); cell(ws, 'D3', 'BASE DE CÁLCULO', { s: hdrStyle }); cell(ws, 'E3', (params.fecoepPadrao || 1) / 100, { z: '0.00%', s: hdrStyle });
    let r = 3;
    for (const res of resultados) {
      if (res.ignorada || res.naoAntecipada) continue;
      for (const g of res.linhasMapa) {
        if (!(g.fecoep > 0)) continue;
        const base = params.fecoepBase === 'P' ? g.P : g.K;
        cell(ws, A(0, r), g.receitaNome); cell(ws, A(1, r), g.nNF); cell(ws, A(2, r), g.F, { z: money }); cell(ws, A(3, r), base, { z: money });
        cell(ws, A(4, r), g.fecoep, { z: money }); r++;
      }
    }
    cell(ws, A(3, r + 1), 'TOTAL', bold); cell(ws, A(4, r + 1), ctx.consolidado.fecoep, { z: money, f: `SUM(E4:E${r})`, s: goldStyle });
    range(ws, 0, 0, r + 1, 4); ws['!cols'] = [28, 10, 14, 16, 14].map(w => ({ wch: w }));
    return ws;
  }

  // ------------------------------------------------------------------
  // 4. RESUMO DAE
  // ------------------------------------------------------------------
  function abaResumo(ctx) {
    const { empresa, competencia, consolidado } = ctx;
    const ws = {};
    cell(ws, 'A1', 'RESUMO DO ICMS ANTECIPADO — ' + empresa.nome, { s: { font: { bold: true, sz: 13, color: { rgb: NAVY } } } });
    cell(ws, 'A2', 'IE ' + empresa.ie + ' · CNPJ ' + empresa.cnpj + ' · competência ' + fmtComp(competencia) + ' · regime ' + (empresa.regime === 'simples' ? 'Simples Nacional' : 'Normal (' + empresa.perfil + ')'));
    ['Receita', 'Código DAE', 'Notas', 'Base de cálculo', 'Débito', 'Crédito', 'Devido', 'A recolher'].forEach((h, i) => cell(ws, A(i, 3), h, { s: hdrStyle }));
    let r = 4;
    for (const [id, v] of Object.entries(consolidado.porReceita)) {
      cell(ws, A(0, r), MOTOR.receita(id).titulo); cell(ws, A(1, r), v.cod); cell(ws, A(2, r), v.notas);
      cell(ws, A(3, r), v.base, { z: money }); cell(ws, A(4, r), v.debito, { z: money }); cell(ws, A(5, r), v.credito, { z: money }); cell(ws, A(6, r), v.devido, { z: money }); cell(ws, A(7, r), v.recolher, { z: money, s: bold }); r++;
    }
    cell(ws, A(0, r), 'FECOEP / FUNPOBREZA (DAE à parte)'); cell(ws, A(1, r), 'FECOEP'); cell(ws, A(7, r), consolidado.fecoep, { z: money, s: bold }); r++;
    cell(ws, A(0, r + 1), 'TOTAL A RECOLHER (ICMS + FECOEP)', bold); cell(ws, A(7, r + 1), consolidado.totalDae, { z: money, s: goldStyle });
    cell(ws, A(0, r + 4), 'Gerado por ' + (typeof APP_VERSAO !== 'undefined' ? APP_VERSAO.nome + ' v' + APP_VERSAO.numero + ' (' + APP_VERSAO.data + ')' : 'Totali Antecipa') + ' — tabelas ' + TABELAS_SE.versao, { s: { font: { italic: true, color: { rgb: '666666' } } } });
    cell(ws, A(0, r + 3), 'Fundamento: Lei 3.796/96, arts. 42 e 42-A; RICMS/SE (Dec. 21.400/2002) arts. 785 a 790 e Anexo X; FECOEP Lei 4.731/2002. Confirme prazo e código do DAE vigentes na SEFAZ/SE.', { s: { font: { italic: true, color: { rgb: '666666' } } } });
    range(ws, 0, 0, r + 4, 7); ws['!cols'] = [52, 12, 8, 16, 14, 14, 14, 14].map(w => ({ wch: w }));
    return ws;
  }

  // ------------------------------------------------------------------
  // 5. ESPELHO x CÁLCULO
  // ------------------------------------------------------------------
  function abaEspelho(ctx) {
    const { linhasConferencia } = ctx;
    const ws = {};
    ['Nº NF', 'Emitente', 'UF', 'Chave de acesso', 'Forma (SEFAZ)', 'ICMS calc. SEFAZ', 'Receita (sistema)', 'ICMS calculado', 'FECOEP', 'Diferença', 'Status'].forEach((h, i) => cell(ws, A(i, 0), h, { s: hdrStyle }));
    let r = 1;
    for (const l of linhasConferencia) {
      const vals = [l.nNF, l.emitente, l.uf, l.chave, l.forma, l.vSefaz, l.receita, l.vCalc, l.fecoep, l.dif, l.status];
      vals.forEach((v, c) => cell(ws, A(c, r), v, { z: typeof v === 'number' ? money : undefined, s: c === 9 && Math.abs(v) > 0.05 ? amarelo : { border: brd() } })); r++;
    }
    range(ws, 0, 0, r, 10); ws['!cols'] = [8, 36, 4, 46, 40, 14, 30, 14, 12, 12, 22].map(w => ({ wch: w }));
    return ws;
  }

  function gerar(ctx) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, abaMapa(ctx), 'Mapa SEFAZ');
    XLSX.utils.book_append_sheet(wb, abaItens(ctx), 'Itens');
    XLSX.utils.book_append_sheet(wb, abaFecoep(ctx), 'FECOEP');
    XLSX.utils.book_append_sheet(wb, abaResumo(ctx), 'Resumo DAE');
    if (ctx.linhasConferencia && ctx.linhasConferencia.length) XLSX.utils.book_append_sheet(wb, abaEspelho(ctx), 'Espelho x Cálculo');
    const nome = `Antecipa_SE_${(ctx.empresa.ie || ctx.empresa.cnpj || 'empresa').replace(/\D/g, '')}_${(ctx.competencia || '').replace('-', '')}.xlsx`;
    XLSX.writeFile(wb, nome);
    return nome;
  }

  return { gerar };
})();
