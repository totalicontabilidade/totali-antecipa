/* =====================================================================
   Totali Antecipa — CONFERIR MAPA
   ---------------------------------------------------------------------
   Lê o "Mapa de Apuração do ICMS" (Anexo I da Portaria 103/2006) em .xls,
   compara linha a linha com o cálculo do sistema e, onde não bate, diz
   POR QUE difere, com a base legal.

   O .xls do mapa tem a aba "Mapa de Apuração do ICMS" com as colunas do
   Anexo I nas letras A..U (linha 33 traz as letras, os dados começam na
   linha 40):
     A NF · C receita · D fornecedor · E quantidade
     F valor/base · G IPI · H frete · I seguro · J outras · K composto
     L alíquota de origem · M carga de destino · N pauta · O MVA
     P base de cálculo · Q débito · R crédito · S ICMS a recolher
   Uma nota pode ocupar VÁRIAS linhas (uma por tipo de receita).
   ===================================================================== */

const AUDITORIA = (() => {

  const num = v => {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').replace(/R\$|\s|%/g, '').trim();
    if (!s || s === '-') return 0;
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s); return isNaN(n) ? 0 : n;
  };
  const pct = v => {                                   // "4,00%" e 0.04 chegam como 4
    const n = num(v);
    return Math.round(((typeof v === 'number' && n > 0 && n <= 1) ? n * 100 : n) * 100) / 100;
  };
  // A célula do mês vem como data serial do Excel quando a planilha foi preenchida com data
  const mesRef = v => {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
    }
    return String(v ?? '').trim();
  };
  const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  // O .xls do mapa é do Excel antigo: acento às vezes chega trocado, então os rótulos
  // são comparados em maiúscula com qualquer não-ASCII virando ponto (casa com /M.S/).
  const norm = v => String(v ?? '').toUpperCase().replace(/[^\x20-\x7E]/g, '.');

  // ---------------------------------------------------------------- leitura do .xls
  function lerMapa(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', raw: true });
    const nome = wb.SheetNames.find(n => /mapa/i.test(n)) || wb.SheetNames[wb.SheetNames.length - 1];
    const ws = wb.Sheets[nome];
    if (!ws) return { erro: 'Não achei a aba do mapa neste arquivo.' };
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    const out = { contribuinte: '', ie: '', cnpj: '', comp: '', totais: {}, linhas: [], aba: nome };
    // cabeçalho: procura os rótulos na coluna A
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const r = rows[i] || [];
      const a = norm(r[0]);
      if (/M.S DE REFER/.test(a)) out.comp = mesRef(r[3] !== '' && r[3] != null ? r[3] : r[2]);
      if (a.includes('CONTRIBUINTE')) out.contribuinte = String(r[2] ?? r[1] ?? '').trim();
      if (/INSCRI..O ESTADUAL/.test(a)) out.ie = String(r[3] ?? r[2] ?? '').replace(/\D/g, '');
      if (a.includes('CNPJ')) out.cnpj = String(r[1] ?? r[2] ?? '').replace(/\D/g, '');
      if (/SOMAT.RIO DAS BASES/.test(a)) out.totais.base = num(r[4]);
      if (/D.BITO DO IMPOSTO/.test(a)) out.totais.debito = num(r[4]);
      if (/CR.DITO DO IMPOSTO/.test(a)) out.totais.credito = num(r[4]);
      if (a.includes('IMPOSTO DEVIDO')) out.totais.devido = num(r[4]);
      if (a.includes('VALOR A RECOLHER')) out.totais.recolher = num(r[4]);
    }
    // linhas de nota: coluna A com número e coluna S (18) com valor, a partir do cabeçalho "NF/CTRC"
    let inicio = rows.findIndex(r => norm((r || [])[0]).includes('NF/CTRC'));
    if (inicio < 0) inicio = 38;
    for (let i = inicio + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nf = String(r[0] ?? '').trim().replace(/\D/g, '');
      const receita = String(r[2] ?? '').trim();
      const S = num(r[18]);
      if (!nf && !S) continue;
      if (!nf && !receita) continue;
      if (!nf) continue;                                 // linha de continuação sem NF: ignora
      out.linhas.push({
        nNF: String(parseInt(nf, 10)), receita, fornecedor: String(r[3] ?? '').trim(),
        qtd: num(r[4]), F: num(r[5]), G: num(r[6]), H: num(r[7]), I: num(r[8]), J: num(r[9]),
        K: num(r[10]), L: pct(r[11]), M: pct(r[12]), N: num(r[13]), O: pct(r[14]),
        P: num(r[15]), Q: num(r[16]), R: num(r[17]), S, linhaXls: i + 1,
      });
    }
    if (!out.linhas.length) out.erro = 'Não achei linhas de nota na aba "' + nome + '". Confira se é o .xls do Mapa de Apuração.';
    return out;
  }

  // ---------------------------------------------------------------- hipóteses de divergência
  // Cada hipótese recalcula a nota de um jeito e vê se bate com o total do mapa.
  const HIPOTESES = [
    { id: 'ipi-fora', nome: 'IPI não somado na base',
      base: 'Lei 3.796/96, art. 42-A (a base é "acrescida do IPI, frete, carreto e demais despesas") e Manual do Mapa, coluna G. Na antecipação SEM encerramento o IPI realmente fica de fora; nas demais receitas, entra.',
      quem: 'mapa', aplica: (it) => ({ ...it, vIPI: 0 }) },
    { id: 'desconto-nao-abatido', nome: 'desconto da nota não abatido',
      base: 'Lei 3.796/96, art. 17-A: a base é "o valor que serviu de base de cálculo para cobrança do ICMS da operação de entrada interestadual" — ou seja, já líquida do desconto.',
      quem: 'mapa', aplica: (it) => ({ ...it, vDesc: 0 }) },
    { id: 'frete-fora', nome: 'frete e demais despesas fora da base',
      base: 'Manual do Mapa, colunas H a J: frete, seguro e outras despesas entram, exceto na antecipação sem encerramento.',
      quem: 'mapa', aplica: (it) => ({ ...it, vFrete: 0, vSeg: 0, vOutro: 0 }) },
  ];

  // Hipóteses que mexem em alíquota/MVA e são testadas por override
  const OVERRIDES = [
    { id: 'origem-7', nome: 'alíquota de origem 7%', ov: { aliqOrigem: 7 },
      base: 'Resolução do Senado 22/1989: 7% nas saídas do Sul e Sudeste (exceto ES) para o Nordeste; 12% nas demais. Mercadoria importada é 4% (Resolução 13/2012), identificada pelo código de origem 1, 2, 3 ou 8 do item.' },
    { id: 'origem-12', nome: 'alíquota de origem 12%', ov: { aliqOrigem: 12 },
      base: 'Resolução do Senado 22/1989. Confira a UF do emitente e o código de origem do produto.' },
    { id: 'origem-4', nome: 'alíquota de origem 4%', ov: { aliqOrigem: 4 },
      base: 'Resolução do Senado 13/2012: 4% só para mercadoria importada ou com conteúdo de importação acima de 40% (código de origem 1, 2, 3 ou 8).' },
    { id: 'interna-19', nome: 'alíquota interna 19%', ov: { aliq: 19 },
      base: 'RICMS/SE art. 40: alíquota modal de 19%. Produto de informática do Anexo III tem 12% (art. 40, IX).' },
    { id: 'interna-12', nome: 'alíquota interna 12%', ov: { aliq: 12 },
      base: 'RICMS/SE art. 40, IX (Lei 8.499/2018) c/c Anexo III: produto ou material de informática tem alíquota interna de 12%.' },
    { id: 'interna-25', nome: 'alíquota interna 25%', ov: { aliq: 25 },
      base: 'Lei 3.796/96, art. 18: 25% em bebidas alcoólicas, cigarros, armas, joias, perfumes e demais supérfluos.' },
    { id: 'mva-10', nome: 'MVA de 10%', ov: { mva: 10 }, base: 'RICMS/SE art. 786, II, "a": 10% para contribuinte apto.' },
    { id: 'mva-30', nome: 'MVA de 30%', ov: { mva: 30 }, base: 'RICMS/SE art. 786, II, "b": 30% para contribuinte suspenso perante o Fisco.' },
    { id: 'mva-20', nome: 'MVA de 20%', ov: { mva: 20 }, base: 'O Manual de 2006 citava 20% para o inapto, mas o art. 786, II, "b" do RICMS vigente fixa 30%.' },
  ];

  // Recalcula uma nota com um ajuste e devolve o total
  function recalcularNota(nota, empresa, params, cad, ovNota, mudaItem, ovItemExtra, ovPorItem) {
    const n = mudaItem ? { ...nota, itens: nota.itens.map(mudaItem) } : nota;
    const ovs = {};
    if (ovItemExtra) for (const it of n.itens) ovs[n.chave + '#' + it.nItem] = { ...ovItemExtra };
    if (ovPorItem) for (const k of Object.keys(ovPorItem)) ovs[n.chave + '#' + k] = { ...(ovs[n.chave + '#' + k] || {}), ...ovPorItem[k] };
    const r = MOTOR.calcularNota(n, empresa, params, cad, { ...ovs, [n.chave]: ovNota || {} });
    return r.ignorada ? 0 : r2(r.totais.devido);
  }

  // ---------------------------------------------------------------- composição: coluna a coluna e faixa a faixa
  const fn = v => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fp = v => String(Math.round((v || 0) * 100) / 100).replace('.', ',') + '%';
  const ACESSORIOS = [
    ['G', 'IPI', 'Lei 3.796/96, art. 42-A: a base da antecipação é o valor da operação "acrescido do IPI, do frete, do carreto, do seguro e das demais despesas". O IPI só fica de fora na antecipação PARCIAL sem encerramento, porque ali se cobra apenas a diferença de alíquota sobre a base da operação interestadual (art. 17-A), e o IPI não integra aquela base quando a mercadoria é destinada à revenda (CF, art. 155, § 2º, XI).'],
    ['H', 'frete', 'Lei 3.796/96, art. 42-A e Manual do Mapa, coluna H: o frete cobrado do destinatário integra a base. Frete pago a transportadora por conta do destinatário (CIF/FOB) entra do mesmo jeito.'],
    ['I', 'seguro', 'Lei 3.796/96, art. 42-A e Manual do Mapa, coluna I.'],
    ['J', 'outras despesas', 'Lei 3.796/96, art. 42-A e Manual do Mapa, coluna J: demais despesas debitadas ao destinatário.'],
  ];
  function analisarComposicao(ctx) {
    const { res, nota, empresa, params, cad, linhasMapa, doSistema } = ctx;
    const ach = [];
    if (!res || !linhasMapa.length) return ach;
    const itens = res.itens.filter(i => (i.P || 0) > 0 || (i.S || 0) > 0);
    if (!itens.length) return ach;
    const somaM = c => r2(linhasMapa.reduce((a, l) => a + (l[c] || 0), 0));
    const somaS = c => r2(itens.reduce((a, i) => a + (i[c] || 0), 0));
    // efeito de adotar o critério do mapa, medido isoladamente (mantendo o resto como está)
    const imp = (mudaItem, ovPorItem) => r2(recalcularNota(nota, empresa, params, cad, null, mudaItem, null, ovPorItem) - doSistema);
    const sentido = e => (e >= 0 ? 'aumenta ' : 'reduz ') + fn(Math.abs(e)) + ' no ICMS da nota';
    const mods = [], ovAll = {}, extras = [];           // guardados para o teste combinado no fim

    // 1) colunas acessórias: IPI, frete, seguro, outras
    for (const [c, nome, base] of ACESSORIOS) {
      const dm = somaM(c), ds = somaS(c);
      if (Math.abs(dm - ds) <= 0.05) continue;
      const zera = { G: it => ({ ...it, vIPI: 0 }), H: it => ({ ...it, vFrete: 0 }), I: it => ({ ...it, vSeg: 0 }), J: it => ({ ...it, vOutro: 0 }) }[c];
      let efeito = null;
      if (ds > dm && dm <= 0.05) { efeito = imp(zera, null); mods.push(zera); }   // o mapa simplesmente não lançou
      ach.push({
        tipo: 'coluna-' + c, quem: ds > dm ? 'mapa' : 'sistema',
        texto: `Coluna ${c} (${nome}): o mapa lançou ${fn(dm)} e o sistema ${fn(ds)}.` + (efeito != null ? ` Deixar de somar, como o mapa fez, ${sentido(efeito)}.` : ''),
        base,
      });
    }

    // 2) faixas de alíquota (origem L × destino M): mostra para onde o mapa levou a base
    const kf = (L, M) => fp(L) + ' / ' + fp(M);
    const fx = {};
    const põe = (k, lado, o, it) => {
      fx[k] = fx[k] || { sis: { F: 0, P: 0, Q: 0, R: 0 }, map: { F: 0, P: 0, Q: 0, R: 0 }, itens: [] };
      ['F', 'P', 'Q', 'R'].forEach(c => fx[k][lado][c] += (o[c] || 0));
      if (it) fx[k].itens.push(it);
    };
    itens.forEach(i => põe(kf(i.L, i.M), 'sis', i, i));
    linhasMapa.forEach(l => põe(kf(l.L, l.M), 'map', l));
    const difs = Object.keys(fx).map(k => ({ k, d: r2(fx[k].map.F - fx[k].sis.F), ...fx[k] })).filter(x => Math.abs(x.d) > 0.05);
    const usados = new Set();
    for (const a of difs) {
      if (usados.has(a.k) || a.d >= 0) continue;                 // parte do doador: base que saiu desta faixa no mapa
      const par = difs.find(b => b.k !== a.k && !usados.has(b.k) && Math.abs(b.d + a.d) <= 0.05 && b.d > 0);
      if (!par) continue;
      usados.add(a.k); usados.add(par.k);
      const [Ls, Ms] = a.k.split(' / '), [Lm, Mm] = par.k.split(' / ');
      const mudouL = Ls !== Lm, mudouM = Ms !== Mm;
      const quais = a.itens.map(i => `${i.nItem} (${(i.item.xProd || '').slice(0, 26)}, origem ${i.item.icms.orig})`).slice(0, 6).join('; ');
      const ovPorItem = {}; a.itens.forEach(i => ovPorItem[i.nItem] = { ...(mudouL ? { aliqOrigem: parseFloat(Lm) } : {}), ...(mudouM ? { aliq: parseFloat(Mm) } : {}) });
      const efeito = imp(null, ovPorItem);
      Object.keys(ovPorItem).forEach(k => ovAll[k] = { ...(ovAll[k] || {}), ...ovPorItem[k] });
      ach.push({
        tipo: 'faixa', quem: 'mapa',
        texto: `O mapa levou ${fn(Math.abs(a.d))} de base da faixa ${a.k} para a faixa ${par.k}` +
          (mudouL ? `, ou seja, usou alíquota de origem de ${Lm} em vez de ${Ls}` : '') +
          (mudouM ? `, ou seja, usou alíquota interna de ${Mm} em vez de ${Ms}` : '') +
          `. É o item ${quais}. Esse critério ${sentido(efeito)}.`,
        base: mudouL
          ? 'Resolução do Senado 22/1989 (7% do Sul e Sudeste, exceto ES, para o Nordeste; 12% nas demais) e Resolução do Senado 13/2012 (4% para mercadoria importada ou com conteúdo de importação acima de 40%, códigos de origem 1, 2, 3 e 8 da tabela do CONFAZ). Quem manda é o código de origem do ITEM e a UF do emitente, não a média da nota.'
          : 'RICMS/SE, art. 40: alíquota interna modal de 19%; inciso IX (Lei 8.499/2018) c/c Anexo III: 12% para os produtos e materiais de informática ali listados. Confira o NCM do item na lista do Anexo III.',
      });
    }
    // faixa sem par: costuma ser desconto não abatido
    for (const a of difs) {
      if (usados.has(a.k)) continue;
      const desc = r2(a.itens.reduce((s, i) => s + (i.item.vDesc || 0) * (i.fatorQtd || 1), 0));
      if (a.d > 0.05 && Math.abs(a.d - desc) <= 0.05 && desc > 0) {
        const semDesc = it => ({ ...it, vDesc: 0 });
        const efeito = imp(semDesc, null); mods.push(semDesc);
        ach.push({ tipo: 'desconto', quem: 'mapa',
          texto: `Na faixa ${a.k} o mapa usou base de ${fn(a.map.F)} e o sistema ${fn(a.sis.F)}: a diferença de ${fn(a.d)} é exatamente o desconto da nota, que o mapa não abateu. Esse critério ${sentido(efeito)}.`,
          base: 'Lei 3.796/96, art. 17-A: a base é "o valor que serviu de base de cálculo para cobrança do ICMS da operação de entrada interestadual", e o desconto incondicional já está fora daquela base (art. 13, § 1º, II, "a" da LC 87/96, a contrario sensu). O próprio XML traz o desconto no campo vDesc e a base do ICMS de origem já vem líquida.' });
      } else {
        ach.push({ tipo: 'faixa-solta', quem: 'verificar',
          texto: `Na faixa ${a.k} o mapa usou base de ${fn(a.map.F)} e o sistema ${fn(a.sis.F)} (diferença de ${fn(a.d)}).`,
          base: 'Compare as colunas F a K desta faixa no mapa com a memória de cálculo da nota. Pode ser item a mais ou a menos, quantidade diferente ou valor digitado à mão.' });
      }
      usados.add(a.k);
    }

    // 3) mesma base, contas diferentes: débito (Q) e crédito (R) da mesma faixa
    for (const k of Object.keys(fx)) {
      const f = fx[k];
      if (usados.has(k) || !f.itens.length || f.map.F <= 0) continue;
      if (Math.abs(f.map.F - f.sis.F) > 0.05) continue;                 // base diferente já foi explicada acima
      const L = parseFloat(k.split(' / ')[0].replace(',', '.'));
      const destaque = r2(f.itens.reduce((s, i) => s + (i.item.icms.vICMS || 0) * (i.fatorQtd || 1), 0));
      const dP = r2(f.map.P - f.sis.P), dQ = r2(f.map.Q - f.sis.Q);

      // base de cálculo diferente com o mesmo valor de produtos: MVA, pauta ou despesa acessória.
      // Se algo já foi apontado acima, essa diferença é consequência dele e não vira achado novo.
      if (Math.abs(dP) > 0.01) {
        if (ach.length) continue;
        ach.push({ tipo: 'base-faixa', quem: 'verificar',
          texto: `Na faixa ${k} o valor dos produtos bate, mas a base de cálculo não: mapa ${fn(f.map.P)} e sistema ${fn(f.sis.P)}, o que dá débito de ${fn(f.map.Q)} contra ${fn(f.sis.Q)}. Isso ${sentido(dQ)}.`,
          base: 'Colunas N a Q do Manual do Mapa: a base de cálculo (P) é o valor composto (K) acrescido da MVA (O) ou substituído pela pauta (N), e o débito (Q) é essa base pela carga interna (M). Confira MVA e pauta no RICMS/SE, art. 786, II, e art. 787.' });
        extras.push(dQ);
        usados.add(k);
        continue;
      }
      if (Math.abs(dQ) > 0.01) {
        ach.push({ tipo: 'debito-faixa', quem: 'verificar',
          texto: `Na faixa ${k} a base de cálculo bate (${fn(f.sis.P)}), mas o débito não: mapa ${fn(f.map.Q)} e sistema ${fn(f.sis.Q)}. Isso ${sentido(dQ)}.`,
          base: 'Coluna Q do Manual do Mapa: o débito é a base de cálculo (P) multiplicada pela carga tributária de destino (M). Sobre a mesma base, débito diferente é erro de digitação ou arredondamento.' });
        extras.push(dQ);
      }

      const dR = r2(f.sis.R - f.map.R);                                  // crédito a menos no mapa vira imposto a mais
      if (Math.abs(dR) > 0.01) {
        const soProdutos = r2(f.sis.F * L / 100);
        const semDespesas = Math.abs(f.map.R - soProdutos) <= 0.02 && Math.abs(f.sis.R - soProdutos) > 0.02;
        const quem = !destaque ? 'verificar' : Math.abs(destaque - f.sis.R) <= 0.05 ? 'mapa' : Math.abs(destaque - f.map.R) <= 0.05 ? 'sistema' : 'verificar';
        ach.push({ tipo: 'credito-faixa', quem,
          texto: `Na faixa ${k} o valor dos produtos bate, mas o crédito não: o mapa deduziu ${fn(f.map.R)} e o sistema ${fn(f.sis.R)}` +
            (destaque ? `, e o ICMS destacado na nota nesses itens é ${fn(destaque)}` : '') +
            (semDespesas ? `. O mapa aplicou ${fp(L)} só sobre o valor dos produtos (${fn(f.sis.F)}) e deixou de fora as demais despesas` : '') +
            `. Isso ${sentido(dR)}` + (Math.abs(dR) < 0.05 && !semDespesas ? ', ou seja, é arredondamento de centavos.' : '.'),
          base: destaque
            ? 'Lei 3.796/96, art. 42-A, § 1º, e RICMS/SE, art. 788: deduz-se o ICMS DESTACADO na nota de origem. Como as despesas acessórias integram a base do imposto na saída interestadual (LC 87/96, art. 13, § 1º, II, "b"), o destaque do emitente já as inclui, e o crédito tem de ser o valor destacado, não a alíquota aplicada apenas sobre as mercadorias.'
            : 'Lei 3.796/96, art. 42-A, § 1º: na falta de destaque, deduz-se "o correspondente à aplicação da alíquota legalmente prevista para operação interestadual" sobre a base da operação, que inclui frete, seguro e demais despesas debitadas ao destinatário.' });
        extras.push(dR);
      }
      usados.add(k);
    }

    // fechamento: aplicando tudo o que foi apontado, o sistema chega ao valor do mapa?
    if (ach.length && (mods.length || Object.keys(ovAll).length || extras.length)) {
      const recalc = (mods.length || Object.keys(ovAll).length)
        ? recalcularNota(nota, empresa, params, cad, null, mods.length ? (it => mods.reduce((x, f) => f(x), it)) : null, null, Object.keys(ovAll).length ? ovAll : null)
        : doSistema;
      const junto = r2(recalc + extras.reduce((s, e) => s + e, 0));      // extras: diferenças de débito e crédito, que não passam pelo motor
      const sobra = r2(junto - ctx.doMapa);
      ach.push({ tipo: 'fechamento', quem: Math.abs(sobra) <= 0.05 ? 'ok' : 'verificar',
        texto: Math.abs(sobra) <= 0.005
          ? `Somando os pontos acima, o cálculo chega a ${fn(junto)}, exatamente o valor do mapa: a diferença está toda explicada.`
          : Math.abs(sobra) <= 0.05
            ? `Somando os pontos acima, o cálculo chega a ${fn(junto)} e o mapa traz ${fn(ctx.doMapa)}: a diferença está explicada, sobrando só ${fn(Math.abs(sobra))} de arredondamento.`
            : `Somando os pontos acima o cálculo chega a ${fn(junto)} e o mapa traz ${fn(ctx.doMapa)}: ainda sobram ${fn(Math.abs(sobra))} sem explicação.`,
        base: Math.abs(sobra) <= 0.05
          ? 'Cada valor acima é medido isoladamente, por isso a soma dos efeitos pode não bater com a diferença total: o que fecha é este cálculo combinado.'
          : 'Abra a nota e compare coluna a coluna com o mapa: base (F a K), alíquotas (L e M), MVA (O), débito (Q) e crédito (R).' });
    }
    return ach;
  }

  // ---------------------------------------------------------------- diagnóstico de uma nota
  function diagnosticar(ctx) {
    const { nota, empresa, params, cad, doSistema, doMapa, linhasMapa } = ctx;   // ctx traz também res
    const dif = r2(doMapa - doSistema);
    const achados = [];
    const bate = v => Math.abs(v - doMapa) <= 0.05;

    // 1) quantidade: devolução parcial deixa a base proporcional
    const qtdMapa = linhasMapa.reduce((s, l) => s + (l.qtd || 0), 0);
    for (const it of nota.itens) {
      if (!(it.qCom > 1)) continue;
      for (let q = Math.floor(it.qCom) - 1; q >= 1 && q >= it.qCom - 5; q--) {
        const v = recalcularNota(nota, empresa, params, cad, null, null, null);
        const ovs = {}; ovs[nota.chave + '#' + it.nItem] = { qtd: q };
        const rr = MOTOR.calcularNota(nota, empresa, params, cad, ovs);
        if (bate(r2(rr.totais.devido))) {
          achados.push({ tipo: 'quantidade', quem: 'sistema', item: it.nItem,
            texto: `O item ${it.nItem} (${(it.xProd || '').slice(0, 30)}) tem ${it.qCom} na nota, e o mapa usou ${q}. Costuma ser devolução parcial, quebra ou recusa.`,
            base: 'Não é erro do mapa: informe a quantidade no item (tela Itens) que o sistema ajusta a base na mesma proporção.',
            acao: { item: it.nItem, campo: 'qtd', valor: q } });
          break;
        }
      }
      if (achados.length) break;
    }

    // 2) composição: coluna a coluna e faixa a faixa (explica várias causas na mesma nota)
    if (!achados.length) achados.push(...analisarComposicao(ctx));

    // 3) hipóteses de base (IPI, desconto, frete) — só quando a composição não explicou
    if (!achados.length) for (const h of HIPOTESES) {
      const v = recalcularNota(nota, empresa, params, cad, null, h.aplica, null);
      if (bate(v)) { achados.push({ tipo: h.id, quem: h.quem, texto: 'O mapa calculou como se o ' + h.nome + '.', base: h.base }); break; }
    }

    // 4) hipóteses de alíquota e MVA na nota inteira
    if (!achados.length) for (const o of OVERRIDES) {
      const v = recalcularNota(nota, empresa, params, cad, null, null, o.ov);
      if (bate(v)) { achados.push({ tipo: o.id, quem: 'mapa', texto: 'O mapa usou ' + o.nome + '.', base: o.base }); break; }
    }

    // 5) crédito presumido ligado/desligado
    if (!achados.length) {
      const p2 = { ...params, creditoIsentoOrigem: !params.creditoIsentoOrigem };
      if (bate(recalcularNota(nota, empresa, p2, cad, null, null, null))) {
        achados.push({ tipo: 'credito-presumido', quem: 'parametro',
          texto: 'A diferença é o crédito presumido em item sem ICMS destacado: o mapa ' + (params.creditoIsentoOrigem ? 'NÃO aplicou' : 'aplicou') + ' e o sistema está ' + (params.creditoIsentoOrigem ? 'aplicando' : 'sem aplicar') + '.',
          base: 'Adquirente do Simples: a Lei 3.796/96, art. 42-A, § 1º manda deduzir o ICMS destacado "ou, na falta deste, o correspondente à aplicação da alíquota legalmente prevista para operação interestadual". Adquirente do regime normal: o art. 42 e o art. 788 do RICMS/SE falam só em ICMS destacado. A caixa fica em Parâmetros.' });
      }
    }

    // 6) nota que o mapa não tem. O espelho do DIA costuma dizer por quê: a própria SEFAZ
    // classifica a operação, e o escritório monta o mapa seguindo essa classificação.
    if (!linhasMapa.length && doSistema > 0) {
      const forma = String(ctx.forma || '').toUpperCase();
      const naoAntecipada = /N[ÃA]O ANTECIPADA/.test(forma);
      achados.push({ tipo: 'fora-do-mapa', quem: naoAntecipada ? 'sistema' : 'verificar',
        texto: 'Esta nota não consta do mapa e o sistema calculou ' + fn(doSistema) + '.' +
          (forma ? ' No espelho do DIA a SEFAZ classificou a operação como "' + ctx.forma + '"' + (ctx.vSefaz != null ? ', com ' + fn(ctx.vSefaz) + ' a recolher' : '') + '.' : '') +
          (naoAntecipada ? ' O mapa seguiu o espelho e não lançou a nota; quem está cobrando a mais é o sistema.' : ''),
        base: naoAntecipada
          ? 'A SEFAZ marca "operação não antecipada" quando a entrada não é de mercadoria destinada a comercialização: uso e consumo ou ativo imobilizado (aí o devido é o diferencial de alíquota, à parte do DIA — LC 123/2006, art. 13, § 1º, XIII, "h" para o optante do Simples), ST já retida para Sergipe, devolução, remessa ou industrialização. Confira o CFOP e a finalidade do item na memória de cálculo e, confirmando, tire a nota da apuração pela coluna Receita.'
          : 'Confira se foi paga por GNRE, se é DIFAL de bem do ativo ou de uso e consumo, ou se ficou de fora por engano. Saindo da apuração, marque na coluna Receita.' });
    }
    if (linhasMapa.length && doSistema === 0 && doMapa > 0) {
      achados.push({ tipo: 'zerada-no-sistema', quem: 'verificar',
        texto: 'O mapa cobra ' + doMapa.toFixed(2) + ' e o sistema deixou a nota fora da apuração.',
        base: 'Veja o motivo na memória de cálculo da nota: costuma ser ST já retida, insumo do Convênio 100/97, medicamento veterinário ou item marcado manualmente.' });
    }

    if (!achados.length && Math.abs(dif) > 0.05) {
      achados.push({ tipo: 'nao-identificado', quem: 'verificar',
        texto: 'Não consegui reproduzir o valor do mapa com uma hipótese simples. Provavelmente há mais de uma diferença na mesma nota.',
        base: 'Abra a nota e compare coluna a coluna com o mapa: base (F a K), alíquotas (L e M), MVA (O), débito (Q) e crédito (R).' });
    }
    return { dif, achados };
  }

  // ---------------------------------------------------------------- confronto completo
  function confrontar(mapa, ctx) {
    const { CONF, RES, empresa, params, cad } = ctx;
    const porNF = {};
    for (const l of mapa.linhas) (porNF[l.nNF] = porNF[l.nNF] || []).push(l);

    const linhas = [];
    const vistas = new Set();
    for (const c of CONF) {
      const nf = String(parseInt(String(c.nNF).replace(/\D/g, ''), 10) || c.nNF);
      const lm = porNF[nf] || []; vistas.add(nf);
      const doMapa = r2(lm.reduce((s, x) => s + x.S, 0));
      const doSistema = r2(c.vCalc || 0);
      const dif = r2(doSistema - doMapa);
      const item = { nNF: c.nNF, emitente: c.emitente, uf: c.uf, chave: c.chave, doMapa, doSistema, dif, temNoMapa: lm.length > 0, linhasMapa: lm, achados: [] };
      if (Math.abs(dif) > 0.05) {
        const res = RES.find(r => r.nota && r.nota.chave === c.chave);
        if (res && res.nota) {
          const d = diagnosticar({ nota: res.nota, res, empresa, params, cad, doSistema, doMapa, linhasMapa: lm, forma: c.forma, vSefaz: c.vSefaz });
          item.achados = d.achados;
        } else if (!res) {
          item.achados = [{ tipo: 'sem-xml', quem: 'verificar', texto: 'O XML desta nota não está na apuração, então não dá para diagnosticar.', base: 'Traga o XML no Passo 2 ou pelo Portal Nacional.' }];
        }
      }
      linhas.push(item);
    }
    // notas que só existem no mapa
    for (const nf of Object.keys(porNF)) {
      if (vistas.has(nf)) continue;
      const lm = porNF[nf];
      linhas.push({ nNF: nf, emitente: (lm[0] || {}).fornecedor || '', uf: '', chave: '', doMapa: r2(lm.reduce((s, x) => s + x.S, 0)), doSistema: 0, dif: r2(-lm.reduce((s, x) => s + x.S, 0)), temNoMapa: true, soNoMapa: true, linhasMapa: lm,
        achados: [{ tipo: 'so-no-mapa', quem: 'verificar', texto: 'Esta nota está no mapa mas não na apuração do sistema.', base: 'Provavelmente falta trazer o XML ou a nota não está no espelho do DIA desta competência.' }] });
    }
    // Nota que só existe no mapa e cujo valor completa outra nota: número digitado errado no mapa.
    // Acontece quando a nota ocupa várias linhas e uma delas sai com um dígito a mais ou a menos.
    const parecidos = (a, b) => {
      a = String(a); b = String(b);
      if (a === b) return true;
      if (Math.abs(a.length - b.length) === 1) { const [g, p] = a.length > b.length ? [a, b] : [b, a]; for (let i = 0; i < g.length; i++) if (g.slice(0, i) + g.slice(i + 1) === p) return true; }
      if (a.length === b.length) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d === 1; }
      return false;
    };
    for (const orfa of linhas.filter(l => l.soNoMapa)) {
      const alvo = linhas.find(l => !l.soNoMapa && l.doSistema > 0 && Math.abs(r2(l.doSistema - l.doMapa) - orfa.doMapa) <= 0.05 && parecidos(l.nNF, orfa.nNF));
      if (!alvo) continue;
      const texto = `O número não existe na apuração, mas o valor de ${r2(orfa.doMapa).toFixed(2).replace('.', ',')} é exatamente o que falta na NF ${alvo.nNF}: no mapa ela foi lançada em mais de uma linha e uma delas saiu com o número digitado errado (${orfa.nNF} em vez de ${alvo.nNF}). Somando as duas linhas, o mapa fecha com o sistema.`;
      const base = 'Confira as linhas da NF no mapa: o erro é só de digitação na coluna A, e o imposto do mês não muda. Vale corrigir para a nota ser localizável numa fiscalização.';
      orfa.achados = [{ tipo: 'nf-digitada-errada', quem: 'mapa', texto, base }];
      alvo.achados = [{ tipo: 'nf-digitada-errada', quem: 'mapa', texto: `A NF ${alvo.nNF} confere: o mapa a lançou em linhas separadas e uma delas ficou com o número ${orfa.nNF}. Somadas, dão ${r2(alvo.doMapa + orfa.doMapa).toFixed(2).replace('.', ',')}, igual ao sistema.`, base }];
    }
    linhas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif) || String(a.nNF).localeCompare(String(b.nNF), undefined, { numeric: true }));

    const totalMapa = r2(linhas.reduce((s, l) => s + l.doMapa, 0));
    const totalSistema = r2(linhas.reduce((s, l) => s + l.doSistema, 0));
    return { linhas, totalMapa, totalSistema, difTotal: r2(totalSistema - totalMapa),
      totaisDeclarados: mapa.totais, conferem: linhas.filter(l => Math.abs(l.dif) <= 0.05).length, divergem: linhas.filter(l => Math.abs(l.dif) > 0.05).length };
  }

  return { lerMapa, confrontar, diagnosticar };
})();
