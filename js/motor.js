/* =====================================================================
   Totali Antecipa — MOTOR DE CÁLCULO do ICMS Antecipado / SE
   ---------------------------------------------------------------------
   Reproduz, item a item, as colunas do Mapa de Apuração do ICMS da
   SEFAZ/SE (Portaria 103/2006):
     F  valor da nota / base            G IPI   H frete   I seguro   J outras
     K  preço composto  = F (+G+H+I+J quando a receita usa acréscimos)
     L  alíquota de origem               M carga tributária de destino
     N  pauta fiscal                     O margem de agregação (MVA)
     P  base de cálculo = maior(K×(1+O), N)
     Q  débito = P × M                   R crédito = (F+H) × L  (ou vICMS destacado)
     S  ICMS a recolher = Q − R          FECOEP = base × pontos
   Regras de decisão em decidirReceita(). Tudo gera memória de cálculo.
   ===================================================================== */

const MOTOR = (() => {
  const T = TABELAS_SE;
  const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

  const PARAMS_PADRAO = {
    aliqModal: T.aliquotaInternaModal,
    mvaApto: T.mvaGeral.apto,
    mvaInapto: T.mvaGeral.inapto,
    fecoepAtivo: true,
    fecoepPadrao: T.fecoep.geral,
    creditoModo: 'mapa',            // 'mapa' = (F+H) × L como no Mapa da SEFAZ (é como o DIA calcula) | 'destacado' = vICMS da nota
    creditoEmitenteSimples: true,   // emitente do Simples não destaca ICMS: presume crédito pela alíquota interestadual (prática do escritório)
    fecoepBase: 'auto',             // 'auto' = Simples: K em todas | normal: P só com encerramento (prática do escritório); 'K' | 'P'
    finalidadeCnae: 'sugerir',      // 'sugerir' | 'aplicar' | 'nao' — finalidade da compra suposta pelos CNAEs da empresa
    tabelaSt: 'alertar',            // 'alertar' = planilha ST/SE só avisa (prática do escritório: regra geral 10%) | 'aplicar' = decide a receita quando o NCM é exato
    ajustarMva: true,               // MVA da planilha ST/SE ajustada pela alíquota interestadual (Conv. 142/2018, cl. 11)
  };

  const EMPRESA_PADRAO = {
    cnpj: '', ie: '', nome: '', regime: 'normal', perfil: 'apto', cestaOptante: false,
  };

  function receita(id) { return T.receitas.find(r => r.id === id) || T.receitas.find(r => r.id === 'nao_antecipa'); }

  function classificarCfop(cfop) {
    const c = String(cfop || '');
    const g = T.cfop;
    if (g.revenda.includes(c)) return 'revenda';
    if (g.ativo.includes(c)) return 'ativo';
    if (g.usoConsumo.includes(c)) return 'usoConsumo';
    if (g.industrializacao.includes(c)) return 'industrializacao';
    if (g.bonificacao.includes(c)) return 'bonificacao';
    if (g.stRetida.includes(c)) return 'stRetida';
    if (g.devolucao.test(c)) return 'devolucao';
    if (g.remessaRetorno.test(c)) return 'remessaRetorno';
    return 'outro';
  }

  // Procura a regra de NCM: primeiro as do usuário, depois as embutidas. Menor prioridade vence.
  function buscarRegra(ncm, xProd, regrasUsuario) {
    const n = String(ncm || '').replace(/\D/g, '');
    const desc = String(xProd || '').toUpperCase();
    const casa = (rg) => {
      const rn = String(rg.ncm || '').replace(/\D/g, '');
      if (!rn) return false;
      const okNcm = (rg.match === 'igual') ? n === rn : n.startsWith(rn);
      if (!okNcm) return false;
      if (rg.descPadrao) {
        // várias alternativas separadas por "|" (ex.: "MILHO|FUBA"): basta uma casar
        const pats = String(rg.descPadrao).toUpperCase().split('|').map(s => s.trim()).filter(Boolean);
        if (rg.descMatch === 'inicia') return pats.some(p => desc.startsWith(p));
        return pats.some(p => desc.includes(p));
      }
      return true;
    };
    const cand = [];
    (regrasUsuario || []).forEach((rg, i) => { if (rg.ativa !== false && casa(rg)) cand.push({ rg, ord: [rg.prioridade ?? 100, 0, i] }); });
    T.regrasNcm.forEach((rg, i) => { if (casa(rg)) cand.push({ rg: { ...rg, embutida: true }, ord: [rg.prioridade ?? 100, 1, i] }); });
    if (!cand.length) return null;
    cand.sort((a, b) => a.ord[0] - b.ord[0] || a.ord[1] - b.ord[1] || String(b.rg.ncm).length - String(a.rg.ncm).length || a.ord[2] - b.ord[2]);
    return cand[0].rg;
  }

  function mvaDaRegra(regra, aliqOrigem) {
    if (!regra || regra.mva == null) return null;
    if (typeof regra.mva === 'number') return regra.mva;
    const keys = [4, 7, 12];
    const k = keys.reduce((best, x) => Math.abs(x - aliqOrigem) < Math.abs(best - aliqOrigem) ? x : best, 12);
    return regra.mva[k] ?? regra.mva.interna ?? null;
  }

  // Supõe a finalidade da compra (revenda / usoConsumo / ativo) pelos CNAEs da empresa e pelo NCM do item
  function sugerirFinalidade(E, item) {
    if (typeof CNAE_FAMILIAS === 'undefined') return null;
    const ncm = String(item.ncm || '').replace(/\D/g, ''); if (ncm.length < 4) return null;
    const cap = ncm.slice(0, 2), pos = ncm.slice(0, 4);
    const fams = (E.cnaes || []).map(c => cnaeFamilia(c.codigo || c));
    const vende = new Set(); fams.forEach(f => f.capitulos.forEach(c => vende.add(c)));
    const ramo = fams.map(f => f.nome).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ');
    const doRamo = vende.has(cap);
    const desc = String(item.xProd || '').toUpperCase();
    const pistaUso = /ETIQUETA|BOBINA|SACOLA|EMBALAGEM|CUPOM|FITA|DETERGENTE|DESINFETANTE|PAPEL HIG|TONER|CARTUCHO|UNIFORME|EPI|LUVA|MASCARA|COPO DESCART|GUARDANAPO/.test(desc);
    const pistaAtivo = /BALAN[CÇ]A|FREEZER|GELADEIRA|REFRIGERADOR|EXPOSITOR|GONDOLA|GÔNDOLA|PRATELEIRA|COMPUTADOR|NOTEBOOK|IMPRESSORA|MONITOR|AR COND|SPLIT|CAMERA|CÂMERA|DVR|NOBREAK|ROTEADOR|SWITCH|VEICULO|VEÍCULO|MOTO |EMPILHADEIRA|CHECKOUT|PDV|TERMINAL/.test(desc);
    const emAtivo = NCM_IMOBILIZADO.some(p => ncm.startsWith(p)), emUso = NCM_USO_CONSUMO.some(p => ncm.startsWith(p));
    if (pistaUso && !doRamo) return { finalidade: "usoConsumo", confianca: "alta", motivo: "descrição de material de uso/embalagem e NCM " + pos + " fora do ramo (" + ramo + ")" };
    if (pistaAtivo && !doRamo) return { finalidade: "ativo", confianca: "alta", motivo: "descrição de bem durável e NCM " + pos + " fora do ramo (" + ramo + ")" };
    if (emAtivo && !doRamo) return { finalidade: 'ativo', confianca: 'alta', motivo: 'NCM ' + pos + ' é típico de imobilizado e não é do ramo (' + ramo + ')' };
    if (emUso && !doRamo) return { finalidade: 'usoConsumo', confianca: 'alta', motivo: 'NCM ' + pos + ' é típico de uso/consumo e não é do ramo (' + ramo + ')' };
    if (pistaUso && doRamo) return { finalidade: "usoConsumo", confianca: "baixa", motivo: "descrição de material de uso, mas o capítulo " + cap + " é do ramo (" + ramo + ")" };
    if (pistaAtivo && doRamo) return { finalidade: "ativo", confianca: "baixa", motivo: "descrição de bem durável, mas o capítulo " + cap + " é do ramo (" + ramo + ") — pode ser revenda" };
    if (vende.size && !doRamo) return { finalidade: 'usoConsumo', confianca: 'baixa', motivo: 'capítulo NCM ' + cap + ' não está entre os produtos que o CNAE indica (' + ramo + ')' };
    return { finalidade: 'revenda', confianca: doRamo ? 'alta' : 'baixa', motivo: doRamo ? 'NCM do ramo da empresa (' + ramo + ')' : 'sem indício contrário' };
  }

  // Empresa do ramo agropecuário / pet (pet shop, veterinária, atacado de alimentos para animais, agropecuária): pelos CNAEs do cadastro
  function empresaAgropet(E) {
    return !!(E && E.cnaes && E.cnaes.some(c => /^(4789004|7500100|4623109|4771704|4692300|0161|0162|4683400)/.test(String((c && c.codigo) || c || '').replace(/\D/g, ''))));
  }
  function decidirReceita(ctx) {
    const { nota, item, empresa, tri, regra, ov } = ctx;
    if (ov && ov.receita) return { id: ov.receita, motivo: 'Receita definida manualmente pelo usuário.' };
    if (!tri.interestadual) return { id: 'nao_antecipa', motivo: 'Não é entrada interestadual para contribuinte de SE (emitente ' + nota.emit.uf + ' → destinatário ' + nota.dest.uf + ').' };
    if (['industrializacao', 'devolucao', 'remessaRetorno'].includes(tri.cfopTipo)) return { id: 'nao_antecipa', motivo: T.descCfop[tri.cfopTipo] + ' (CFOP ' + item.cfop + ').' };
    // ST já retida pelo remetente: nada a antecipar em QUALQUER regime (no Simples a SEFAZ marca "operação não antecipada" — J C de Lira mar/2026)
    if (tri.stRetida) return { id: "nao_antecipa", motivo: "ICMS-ST já retido na origem (CST/CSOSN " + (item.icms.cst || item.icms.csosn) + (tri.cfopTipo === "stRetida" ? ", CFOP " + item.cfop : "") + ") — não cabe nova antecipação" + (empresa.regime === "simples" ? " nem complementação de alíquota (a SEFAZ marca como operação não antecipada)" : "") + "." };
    // ---- Agropecuária / pet shop (conferido com o mapa da J C de Lira, mar/2026) ----
    const ncmI = String(item.ncm || ''), cstO = String(item.icms.cst || ''), descI = String(item.xProd || '').toUpperCase();
    const agropet = empresaAgropet(empresa);
    const origemReduzidaOuIsenta = ['20', '30', '40', '41', '51', '70'].includes(cstO);
    const ncmInsumo = /^(230[1-9]|310[1-5]|3808)/.test(ncmI);
    // ração pet: CEST 22.001.00 ou palavras de pet no nome — sabores ("frango e arroz", "peixe", "cordeiro") não a tornam ração de criação
    const petInd = String(item.cest || '') === '2200100' || /\b(PET|DOG|CAT|CAO|CAES|GATO|GATOS|CANINE|FELINE|PUPPY|KITTEN|FILHOTE|FILHOTES)\b/.test(descI);
    const descCriacao = !petInd && /SUIN|BOVIN|\bAVES?\b|FRANGO|GADO|EQUIN|POTRO|CAVAL|OVIN|CAPRIN|PEIXE|CAMAR|POEDEIRA|VACA|BEZERR|CORDEIR|PORC|GALINH|NOVILH/.test(descI);
    if (ncmInsumo && (origemReduzidaOuIsenta || (agropet && (/^(310[1-5]|3808)/.test(ncmI) || descCriacao)))) return { id: 'nao_antecipa', motivo: 'Insumo agropecuário (ração/suplemento para criação, fertilizante, substrato, defensivo — NCM ' + ncmI + (origemReduzidaOuIsenta ? ', CST ' + cstO + ' com base reduzida/isenta na origem' : '') + '): Convênio ICMS 100/97, isento nas operações internas de SE (RICMS/SE Anexo I) — não entra na antecipação (prática do escritório; a SEFAZ marca como não antecipada).' };
    if (agropet && /^(3002|3003|3004)/.test(ncmI)) return { id: 'nao_antecipa', motivo: 'Medicamento/vacina de uso veterinário (NCM ' + ncmI + ') em empresa do ramo agropet: Convênio ICMS 100/97 (vacinas, soros e medicamentos de uso na pecuária) — sem antecipação (prática do escritório, J C de Lira mar/2026; confirmar se a SEFAZ cobrar).' };
    if (regra && regra.regime === 'nao_antecipa') return { id: 'nao_antecipa', motivo: regra.descricao + '.' };
    if (regra && regra.regime === "cesta") { const pct = regra.cestaPct != null ? regra.cestaPct : 2.1; return empresa.cestaOptante
      ? { id: pct >= 3.6 ? "cesta_opt36" : "cesta_opt21", motivo: "Produto da cesta básica (art. 40, § 3º) e adquirente optante do Regime Simplificado: " + String(pct).replace(".", ",") + "% direto sobre o valor, sem crédito (art. 787, I)." }
      : { id: "cesta_nao_opt", motivo: "Produto da cesta básica — adquirente não optante do Regime Simplificado: alíquota interna sobre a base com MVA 30%, menos o crédito (art. 786, I, b; art. 787, II)." }; }
    if (empresa.regime === "simples" && regra && regra.regime === "antecip_encer" && regra.simplesTambem) return { id: "antecip_encer", motivo: regra.descricao + " — produto de ST: antecipação COM encerramento mesmo no Simples (art. 784, II)." };
    if (empresa.regime === "simples") return { id: "simples", motivo: 'Adquirente optante do Simples Nacional: complementação de alíquota interestadual sem MVA (Lei 3.796/96, art. 42-A).' };
    if (tri.finalidade === 'ativo' || tri.finalidade === 'usoConsumo') return { id: 'nao_antecipa', motivo: 'Entrada para ' + (tri.finalidade === 'ativo' ? 'ativo imobilizado' : 'uso/consumo') + ' (CFOP ' + item.cfop + '): não entra no DIA — o DIFAL é apurado à parte (a SEFAZ marca como operação não antecipada). Se quiser lançar no mapa, escolha a receita "Difer. de Alíquota".' };
    if (regra && regra.regime === 'antecip_encer') return { id: 'antecip_encer', motivo: regra.descricao + ' — antecipação COM encerramento, MVA própria.' };
    if (regra && regra.regime === 'st_interna') return { id: 'st_interna', motivo: regra.descricao + '.' };
    return { id: 'antecip_interest', motivo: 'Entrada interestadual para revenda, regime normal: antecipação SEM encerramento com MVA geral (arts. 785/786 RICMS/SE).' };
  }

  function calcularItem(nota, item, empresa, params, cad, ovItem, ovNota) {
    const P = { ...PARAMS_PADRAO, ...(params || {}) };
    const E = { ...EMPRESA_PADRAO, ...(empresa || {}) };
    const ov = { ...(ovItem || {}) };
    if (ovNota && ovNota.receita && !ov.receita) ov.receita = ovNota.receita;
    const alertas = [];
    const mem = [];

    // ---- Triagem ----
    const cfopTipo = classificarCfop(item.cfop);
    const stRetida = T.cstStRetida.includes(item.icms.cst) || T.csosnStRetida.includes(item.icms.csosn) || cfopTipo === 'stRetida';
    let finalidade = ov.finalidade || (cfopTipo === 'ativo' ? 'ativo' : cfopTipo === 'usoConsumo' ? 'usoConsumo' : 'revenda');
    // Finalidade suposta pelos CNAEs da empresa (só quando o CFOP não diz explicitamente)
    let sugFin = null;
    if (P.finalidadeCnae !== 'nao' && !ov.finalidade && ['revenda', 'bonificacao', 'outro'].includes(cfopTipo) && E.cnaes && E.cnaes.length) {
      sugFin = sugerirFinalidade(E, item);
      if (sugFin && sugFin.finalidade !== 'revenda') {
        // Aplica quando o parâmetro manda ("aplicar") OU quando a própria nota confirma (indFinal=1: o remetente vendeu como consumidor final,
        // sinal independente de que não é revenda) — validado na Mais Barato fev/2026 (Fast Ariam, móveis de checkout)
        const notaConsumidorFinal = nota.indFinal === '1';
        if ((P.finalidadeCnae === 'aplicar' || notaConsumidorFinal) && sugFin.confianca === 'alta') { finalidade = sugFin.finalidade; sugFin.aplicada = true; alertas.push({ nivel: 'medio', msg: 'Finalidade ' + (finalidade === 'ativo' ? 'ATIVO IMOBILIZADO' : 'USO/CONSUMO') + ' aplicada' + (notaConsumidorFinal && P.finalidadeCnae !== 'aplicar' ? ' (nota de consumidor final + CNAE: ' : ' pelo CNAE (') + sugFin.motivo + ') — fora do DIA; DIFAL à parte. Ajuste a finalidade no item se não for o caso.' }); }
        else alertas.push({ nivel: sugFin.confianca === 'alta' ? 'medio' : 'baixo', msg: 'Pelo CNAE da empresa este item parece ' + (sugFin.finalidade === 'ativo' ? 'ATIVO IMOBILIZADO' : 'USO/CONSUMO') + ' (' + sugFin.motivo + '). Se for isso, ajuste a finalidade no item.' });
      }
    }
    const tri = {
      interestadual: nota.emit.uf !== 'SE' && nota.dest.uf === 'SE',
      cfopTipo, stRetida, finalidade,
      emitenteSimples: nota.emit.crt === '1',
      destContribuinte: !!nota.dest.ie && !/^(ISENTO|0+)$/i.test(nota.dest.ie),
    };
    if (!tri.destContribuinte) alertas.push({ nivel: 'alto', msg: 'Destinatário sem IE — se não for contribuinte, o caso é DIFAL do remetente (EC 87/2015), não antecipação.' });
    if (cfopTipo === 'outro') alertas.push({ nivel: 'medio', msg: 'CFOP ' + item.cfop + ' não mapeado — confira a natureza da operação.' });
    if (cfopTipo === 'bonificacao') alertas.push({ nivel: 'medio', msg: 'Bonificação (CFOP ' + item.cfop + ') — confirme se entra na antecipação.' });
    if (nota.indFinal === '1' && finalidade === 'revenda') alertas.push({ nivel: 'baixo', msg: 'Nota marcada como consumidor final (indFinal=1). Se a entrada for uso/consumo ou ativo, é DIFAL.' });

    // ---- Regra de NCM (usuário > embutidas > tabela oficial de ST de SE) ----
    let regra = buscarRegra(item.ncm, item.xProd, cad && cad.regras);
    let stTab = null;
    // Portal Nacional da ST (SE): MVA por alíquota de origem já ajustada, FECOEP e alíquota interna por CEST/NCM
    let portal = null;
    if (typeof MATERIAIS !== 'undefined' && MATERIAIS.carregada('st_portal')) {
      const pr = MATERIAIS.stPortal(item.ncm, item.cest);
      if (pr && pr.linhas.length) {
        const l = pr.linhas[0];
        const aliqInter = item.icms.pICMS > 0 ? item.icms.pICMS : NFE.aliquotaInterestadual(nota.emit.uf, item.icms.orig, T);
        const k = Math.abs(aliqInter - 4) < 1 ? 'mva4' : Math.abs(aliqInter - 7) < 1 ? 'mva7' : 'mva12';
        const mvaOrig = l[k] != null ? l[k] : (l.mva_int != null ? l.mva_int : null);
        portal = { linha: l, exato: pr.exato, cestOk: pr.cestOk, mva: mvaOrig, chave: k, pfc: l.pfcNum || null, fecoep: l.fecoep, aliq: l.aliq_interna };
        stTab = { linhas: [{ ...l, mva: mvaOrig, norma: l.protocolo, dispositivo: l.legislacao, trecho: l.descricao }], exato: pr.exato, prefixo: pr.prefixo };
        const confiavel = pr.exato && pr.cestOk;
        const aplicar = P.tabelaSt === 'aplicar' && confiavel && mvaOrig != null;
        if (!aplicar && (!regra || regra.regime == null)) {
          alertas.push({ nivel: confiavel ? 'medio' : 'baixo', msg: 'NCM ' + item.ncm + (item.cest ? ' / CEST ' + item.cest : '') + (pr.exato ? '' : ' (pelo prefixo ' + pr.prefixo + ')') + (pr.cestOk ? '' : ' — CEST da nota diferente do da planilha') + ' consta do Portal Nacional da ST (SE): segmento ' + (l.segmento || '?') + (mvaOrig != null ? ', MVA-ST ' + mvaOrig + '% (origem ' + aliqInter + '%)' : (l.pfc ? ', pauta PFC R$ ' + l.pfc : ', sem MVA')) + (l.fecoep != null ? ', FECOEP ' + l.fecoep + ' pt' : '') + '. Aplicada a regra geral; se for ST sem retenção (art. 784, II), altere a receita do item para "Antecip. com encer." ou ligue "aplicar" em Parâmetros.' });
        }
        if (aplicar && (!regra || regra.regime == null)) {
          regra = { id: 'st_portal:' + l.cest, prioridade: 25, ncm: item.ncm, match: 'igual', fonte: 'st_portal', tabela: true,
            descricao: 'Portal da ST/SE — ' + (l.segmento || '') + ' CEST ' + l.cest + ': ' + String(l.descricao || '').slice(0, 70),
            regime: 'antecip_encer', encerra: true, mva: { 4: l.mva4, 7: l.mva7, 12: l.mva12, interna: l.mva_int }, aliq: l.aliq_interna != null ? l.aliq_interna : null,
            fecoep: l.fecoep != null ? l.fecoep : null, fundamento: [l.protocolo, l.legislacao].filter(Boolean).join(' — ') + ' (Portal Nacional da ST, SE v' + (l.versao || '') + ')', cest: l.cest, confirmar: false };
        }
      }
    }
    if (!portal && typeof MATERIAIS !== 'undefined' && MATERIAIS.carregada('st_se')) {
      stTab = MATERIAIS.st(item.ncm, item.cest);
      // A planilha do Fiscal Certo só decide a receita no modo "aplicar", com NCM exato (e CEST igual, quando ambos têm),
      // porque um NCM de 4 dígitos na lista puxa produtos de outro segmento (ex.: 1806 em "Sorvetes" não é chocolate).
      const linhaTab = stTab && stTab.linhas.length ? stTab.linhas[0] : null;
      const exato = !!(stTab && stTab.exato && linhaTab && (!item.cest || !linhaTab.cest || String(linhaTab.cest).replace(/\D/g, '') === item.cest));
      const aplicar = P.tabelaSt === 'aplicar' && exato && linhaTab && linhaTab.mva != null;
      if (linhaTab && !aplicar && (!regra || regra.regime == null)) {
        alertas.push({ nivel: exato ? 'medio' : 'baixo', msg: 'NCM ' + item.ncm + (exato ? '' : ' (pelo prefixo ' + stTab.prefixo + ')') + ' consta da planilha de ST/SE do Fiscal Certo — segmento ' + (linhaTab.segmento || '?') + (linhaTab.mva != null ? ', MVA ' + linhaTab.mva + '%' : ', sem MVA (pauta/PMPF)') + '. Aplicada a regra geral; se for produto com ST/encerramento, altere a receita do item ou cadastre a regra em NCM/MVA.' });
      }
      if (aplicar && (!regra || regra.regime == null)) {
        const l = stTab.linhas[0];
        regra = { id: 'st_se:' + l.ncm, prioridade: 25, ncm: l.ncm, match: 'inicia', fonte: 'st_se', tabela: true,
          descricao: 'ST em SE — segmento ' + (l.segmento || '?') + (l.trecho ? ': ' + l.trecho.slice(0, 80) : ''),
          regime: 'antecip_encer', encerra: true, mvaOriginal: l.mva, aliq: (regra && regra.aliq != null) ? regra.aliq : (l.aliq_interna != null ? l.aliq_interna : null),
          fecoep: regra ? regra.fecoep : null, fundamento: [l.norma, l.dispositivo].filter(Boolean).join(' — ') + ' (planilha oficial de ST/SE)', cest: l.cest, confirmar: false };
      } else if (stTab && stTab.linhas.length && regra && regra.mva == null && regra.regime !== 'nao_antecipa') {
        // regra do usuário/embutida sem MVA própria: completa com a MVA da tabela
        regra = { ...regra, mvaOriginal: stTab.linhas[0].mva, fundamento: (regra.fundamento || '') + ' + planilha ST/SE (' + stTab.linhas[0].dispositivo + ')' };
      }
    }
    const rec = decidirReceita({ nota, item, empresa: E, tri, regra, ov });
    const R = receita(rec.id);

    // ---- Formação do preço (colunas F..K) ----
    const F = r2(item.vProd - item.vDesc);
    const G = r2(item.vIPI), H = r2(item.vFrete), I = r2(item.vSeg), J = r2(item.vOutro);
    const usaAcr = !!R.acrescimos;
    const K = usaAcr ? r2(F + G + H + I + J) : F;

    // ---- Alíquota de origem (L) e crédito (R) ----
    let L = item.icms.pICMS, credito = item.icms.vICMS, origemCredito = 'ICMS destacado na nota (vICMS)';
    const cst = item.icms.cst, csosn = item.icms.csosn;
    if (!(credito > 0)) {
      if (tri.emitenteSimples || csosn) {
        const aliqInter = NFE.aliquotaInterestadual(nota.emit.uf, item.icms.orig, T);
        if (P.creditoEmitenteSimples) {
          L = aliqInter; credito = (F + H) * L / 100;
          origemCredito = 'Emitente do Simples (CSOSN ' + csosn + ') não destaca ICMS: crédito presumido pela alíquota interestadual de ' + L + '% sobre (F+H) — prática do escritório; LC 123/2006 art. 23';
          alertas.push({ nivel: 'baixo', msg: 'Emitente do Simples: crédito presumido de ' + L + '% aplicado. Se preferir sem crédito, desligue em Parâmetros.' });
        } else { L = 0; credito = 0; origemCredito = 'Emitente do Simples sem destaque de ICMS — sem crédito (parâmetro)'; }
      } else if (['40', '41', '50', '51', '60'].includes(cst)) {
        L = 0; credito = 0; origemCredito = 'CST ' + cst + ' — operação isenta/não tributada/diferida na origem, sem crédito';
        if (rec.id !== 'nao_antecipa') alertas.push({ nivel: 'medio', msg: 'CST ' + cst + ' sem ICMS na origem: o antecipado sai pela alíquota interna cheia. Confira se cabe.' });
      } else { credito = 0; origemCredito = 'Sem ICMS destacado (vICMS = 0)'; }
    } else {
      // Modo do crédito: fórmula do mapa (F+H)×L ou ICMS destacado
      const credMapa = (F + H) * L / 100;
      if (P.creditoModo !== 'destacado') {
        if (Math.abs(credMapa - credito) > 0.05) alertas.push({ nivel: 'baixo', msg: 'Crédito pela fórmula do mapa (F+H)×L = ' + credMapa.toFixed(2) + ' difere do ICMS destacado ' + credito.toFixed(2) + ' (base de origem inclui IPI/seguro/outras ou é reduzida). Usado o valor do mapa, como faz o DIA.' });
        credito = credMapa; origemCredito = '(F+H) × L = (' + F.toFixed(2) + ' + ' + H.toFixed(2) + ') × ' + L + '% — fórmula do Mapa da SEFAZ (coluna R)';
      }
      // Base reduzida na origem?
      if (item.icms.pRedBC > 0 || (item.icms.vBC > 0 && item.icms.vBC < F - 0.01)) {
        const cargaEfetiva = F > 0 ? r2(item.icms.vICMS / F * 100) : L;
        alertas.push({ nivel: 'medio', msg: 'Base reduzida na origem (vBC ' + item.icms.vBC.toFixed(2) + ' < ' + F.toFixed(2) + '). Carga efetiva de origem ' + cargaEfetiva + '%. Se houver redução também em SE (Anexo II), use a carga efetiva em M.' });
      }
    }
    if (ov.aliqOrigem != null) { L = ov.aliqOrigem; credito = (F + H) * L / 100; origemCredito = 'Alíquota de origem informada manualmente'; }
    if (rec.id === 'cesta_opt36' || rec.id === 'cesta_opt21' || rec.id === 'nao_antecipa') { credito = 0; }

    // ---- Carga de destino (M) ----
    let M = ov.aliq ?? R.aliq ?? (regra && regra.aliq != null ? regra.aliq : P.aliqModal);
    let origemM = ov.aliq != null ? 'informada manualmente' : R.aliq != null ? 'fixa da receita' : (regra && regra.aliq != null) ? 'regra do NCM (' + regra.descricao + ')' : 'alíquota modal de SE';

    // ---- MVA (O) ----
    let O = 0, origemO = 'sem MVA nesta receita';
    if (ov.mva != null) { O = ov.mva; origemO = 'MVA informada manualmente'; }
    else if (R.mva === 'geral') { O = E.perfil === 'inapto' ? P.mvaInapto : P.mvaApto; origemO = "MVA geral — contribuinte " + (E.perfil === "inapto" ? "suspenso/inapto: 30% (art. 786, II, b)" : "apto: 10% (art. 786, II, a)"); }
    else if (R.mva === 'produto') {
      const m = mvaDaRegra(regra, L);
      if (m != null) { O = m; origemO = 'MVA do produto — ' + regra.descricao + ' (origem ' + L + '%)'; }
      else if (regra && regra.mvaOriginal != null) {
        const mo = regra.mvaOriginal;
        if (P.ajustarMva && L > 0 && M < 100 && L < M) {
          O = r2(((1 + mo / 100) * (1 - L / 100) / (1 - M / 100) - 1) * 100);
          origemO = 'MVA ajustada = [(1 + ' + mo + '%) × (1 − ' + L + '%) ÷ (1 − ' + M + '%)] − 1 = ' + O + '% (Convênio ICMS 142/2018, cláusula 11; MVA original ' + mo + '% da planilha ST/SE)';
        } else { O = mo; origemO = 'MVA original ' + mo + '% da planilha oficial de ST/SE (sem ajuste)'; }
      }
      else if (regra && regra.fonte === 'st_se') { O = 0; origemO = 'produto de ST em SE sem MVA na planilha oficial (segmento ' + (stTab && stTab.linhas[0] ? stTab.linhas[0].segmento : '?') + ') — usa PAUTA FISCAL / PMPF'; alertas.push({ nivel: 'alto', msg: 'NCM ' + item.ncm + ' está na ST de SE por PAUTA (PMPF), sem MVA. Informe o valor de pauta (N) no item ou a MVA manualmente.' }); }
      else { O = 0; origemO = 'MVA do produto NÃO cadastrada'; alertas.push({ nivel: 'alto', msg: 'MVA do produto não encontrada para o NCM ' + item.ncm + '. Cadastre em Cadastros › NCM/MVA ou informe manualmente.' }); }
    }
    else if (typeof R.mva === 'number') { O = R.mva; origemO = 'MVA fixa da receita (' + R.mva + '%)'; }
    // ---- Benefícios em SE (isenção / base reduzida) — só alerta, não aplica ----
    let benef = [];
    if (typeof MATERIAIS !== 'undefined' && MATERIAIS.carregada('beneficios_se') && rec.id !== 'nao_antecipa') {
      benef = MATERIAIS.beneficios(item.ncm).filter(b => b.tipo !== 'st');
      const red = benef.find(b => b.tipo === 'reducao'), ise = benef.find(b => b.tipo === 'isencao');
      if (ise) alertas.push({ nivel: 'baixo', msg: 'NCM ' + item.ncm + ' consta do Anexo I do RICMS/SE (isenção): ' + (ise.dispositivo || '') + '. Se a saída interna for isenta, confira se cabe antecipação.' });
      if (red) alertas.push({ nivel: 'baixo', msg: 'NCM ' + item.ncm + ' consta do Anexo II do RICMS/SE (base reduzida): ' + (red.dispositivo || '') + '. Se aplicável, a antecipação é pela carga efetiva — ajuste a alíquota interna (M) do item.' });
    }

    // ---- Pauta (N), base (P), débito (Q), a recolher (S) ----
    const N = ov.pauta != null ? r2(ov.pauta) : 0;
    let baseMva = K * (1 + O / 100);
    let usouPauta = false;
    let Pb = baseMva;
    if (N > Pb) { Pb = N; usouPauta = true; }
    if (R.grossup && M < 100) Pb = Pb / (1 - M / 100);
    let Q, S;
    if (R.direto) { Q = K * R.direto / 100; S = Q; }
    else { Q = Pb * M / 100; S = Q - credito; }
    if (rec.id === 'nao_antecipa') { Q = 0; S = 0; Pb = 0; }

    // ---- FECOEP ----
    let fecoepPts = 0, origemFecoep = 'desligado';
    if (P.fecoepAtivo && rec.id !== 'nao_antecipa') {
      if (ov.fecoep != null) { fecoepPts = ov.fecoep; origemFecoep = 'informado manualmente'; }
      else if (regra && regra.fecoep != null) { fecoepPts = regra.fecoep; origemFecoep = 'regra do NCM (' + regra.descricao + ')'; }
      else if (['cesta_opt36', 'cesta_opt21', 'cesta_nao_opt'].includes(rec.id)) { fecoepPts = 0; origemFecoep = 'cesta básica — excluída do FECOEP'; }
      else if (P.fecoepBase === 'auto' && E.regime !== 'simples' && !['antecip_encer', 'st_interna', 'importacoes'].includes(rec.id)) { fecoepPts = 0; origemFecoep = 'regime normal: FECOEP na entrada só nas receitas com encerramento — na antecipação parcial a saída própria já recolhe o adicional (prática do escritório)'; }
      else { fecoepPts = P.fecoepPadrao; origemFecoep = 'padrão (' + P.fecoepPadrao + ' ponto) — art. 40-B; Dec. 289/2023' + (P.fecoepBase === 'auto' ? (E.regime === 'simples' ? '; Simples: sobre o valor da nota' : '; com encerramento: sobre a base com MVA') : ''); }
    }
    const fecoepBase = (P.fecoepBase === "P" || (P.fecoepBase === "auto" && (E.regime !== "simples" || ["antecip_encer", "st_interna", "importacoes"].includes(rec.id)))) ? Pb : K;
    const fecoep = fecoepBase * fecoepPts / 100;

    // ---- Alertas de regra ----
    if (regra && regra.confirmar && rec.id !== 'nao_antecipa') alertas.push({ nivel: 'baixo', msg: 'Regra "' + regra.descricao + '" marcada para CONFIRMAÇÃO no RICMS/SE (' + regra.fundamento + ').' });
    if (stRetida && rec.id === "simples") alertas.push({ nivel: "baixo", msg: "ICMS-ST já retido na origem (CST/CSOSN " + (cst || csosn) + "), mas no Simples a complementação de alíquota alcança todas as entradas (art. 674-A, § 3º) — a SEFAZ cobra; confira." });
    if (regra && regra.regime === 'antecip_encer' && rec.id === 'simples') alertas.push({ nivel: 'medio', msg: 'Produto com MVA própria/encerramento (' + regra.descricao + '). A SEFAZ pode cobrar como "Antecip. com encer." — confira o espelho e, se for o caso, altere a receita do item.' });
    if (!regra && ['antecip_interest', 'antecip_encer'].includes(rec.id)) alertas.push({ nivel: 'baixo', msg: 'NCM ' + item.ncm + ' sem regra específica: aplicada a regra geral (MVA ' + O + '%, alíquota ' + M + '%).' });
    if (S < 0 && rec.id !== 'nao_antecipa') alertas.push({ nivel: 'medio', msg: 'Crédito da origem maior que o débito interno — saldo negativo neste item (compensa no total da receita).' });

    // ---- Memória de cálculo ----
    const f = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    mem.push({ passo: '1. Triagem', txt: (tri.interestadual ? 'Entrada interestadual ' + nota.emit.uf + ' → SE' : 'Operação NÃO interestadual') + ' · CFOP ' + item.cfop + ' (' + T.descCfop[cfopTipo] + ') · CST/CSOSN ' + (cst || csosn || '-') + ' · NCM ' + item.ncm + (item.cest ? ' · CEST ' + item.cest : '') });
    const ncmInfo = (typeof MATERIAIS !== 'undefined' && MATERIAIS.carregada('ncm')) ? MATERIAIS.ncmInfo(item.ncm) : null;
    if (ncmInfo && !ncmInfo.existe && rec.id !== 'nao_antecipa') alertas.push({ nivel: 'medio', msg: 'NCM ' + item.ncm + ' não consta da tabela NCM vigente (Siscomex)' + (ncmInfo.descricao ? ' — posição: ' + ncmInfo.descricao : '') + '. Confira a classificação.' });
    mem.push({ passo: '2. Regra do produto', txt: (ncmInfo && ncmInfo.descricao ? 'NCM ' + item.ncm + ' = ' + ncmInfo.descricao + ' · ' : '') + (regra ? regra.descricao + ' [' + regra.fundamento + ']' : 'Nenhuma regra específica para o NCM — regra geral.') + (stTab && stTab.linhas.length && regra && regra.fonte !== 'st_se' ? ' · consta da planilha ST/SE (' + stTab.linhas[0].segmento + ', MVA ' + stTab.linhas[0].mva + '%)' : '') });
    mem.push({ passo: '3. Receita (coluna C do mapa)', txt: R.titulo + (R.cod ? ' · código ' + R.cod : '') + ' — ' + rec.motivo });
    if (rec.id !== 'nao_antecipa') {
      mem.push({ passo: '4. Formação do preço', txt: 'F valor = ' + f(F) + (usaAcr ? ' · G IPI = ' + f(G) + ' · H frete = ' + f(H) + ' · I seguro = ' + f(I) + ' · J outras = ' + f(J) + ' → K = ' + f(K) : ' → K = F = ' + f(K) + ' (sem encerramento: IPI/frete/seguro não entram na base — manual da SEFAZ, itens 7 a 10)') });
      mem.push({ passo: '5. Alíquota de origem (L)', txt: L + '% — ' + origemCredito });
      mem.push({ passo: '6. Carga de destino (M)', txt: M + '% — ' + origemM });
      if (R.direto) mem.push({ passo: '7. Imposto direto', txt: 'K × ' + R.direto + '% = ' + f(K) + ' × ' + R.direto + '% = ' + f(Q) + ' (sem crédito)' });
      else {
        mem.push({ passo: '7. Margem de agregação (O)', txt: O + '% — ' + origemO });
        mem.push({ passo: '8. Base de cálculo (P)', txt: (usouPauta ? 'Pauta N = ' + f(N) + ' maior que ' : '') + 'K × (1 + ' + O + '%) = ' + f(K) + ' × ' + (1 + O / 100).toFixed(4) + ' = ' + f(baseMva) + (R.grossup ? ' ÷ (1 − ' + M + '%) = ' + f(Pb) : '') });
        mem.push({ passo: '9. Débito (Q)', txt: 'P × M = ' + f(Pb) + ' × ' + M + '% = ' + f(Q) });
        mem.push({ passo: '10. Crédito (R)', txt: f(credito) + ' — ' + origemCredito });
        mem.push({ passo: '11. ICMS a recolher (S)', txt: 'Q − R = ' + f(Q) + ' − ' + f(credito) + ' = ' + f(S) });
      }
      mem.push({ passo: '12. FECOEP', txt: fecoepPts > 0 ? fecoepPts + ' ponto(s) × ' + (P.fecoepBase === 'P' ? 'base P ' : 'valor K ') + f(fecoepBase) + ' = ' + f(fecoep) + ' (' + origemFecoep + ') — DAE à parte' : 'não aplicado (' + origemFecoep + ')' });
    }

    return {
      chave: nota.chave, nItem: item.nItem, item, tri, regra, receita: rec.id, cod: R.cod, receitaNome: R.nome, motivo: rec.motivo,
      F, G, H, I, J, K, L, M, N, O, P: Pb, Q, R: credito, S, fecoep, fecoepPts, fecoepBase, usaAcrescimos: usaAcr, usouPauta,
      memoria: mem, alertas, override: ov, ncmInfo, stTab: stTab && stTab.linhas.length ? stTab.linhas[0] : null, beneficios: benef, sugestaoFinalidade: sugFin,
    };
  }

  function calcularNota(nota, empresa, params, cad, overrides) {
    const ovs = overrides || {};
    const ovNota = ovs[nota.chave] || {};
    const itens = nota.itens.map(it => calcularItem(nota, it, empresa, params, cad, ovs[nota.chave + '#' + it.nItem], ovNota));
    // Linhas do mapa: agrupa por receita + L + M + O
    const grupos = {};
    for (const r of itens) {
      if (r.receita === 'nao_antecipa') continue;
      const k = [r.receita, r.L, r.M, r.O].join('|');
      if (!grupos[k]) grupos[k] = { receita: r.receita, cod: r.cod, receitaNome: r.receitaNome, nNF: nota.nNF, fornecedor: nota.emit.nome, E: 1, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0, L: r.L, M: r.M, N: 0, O: r.O, P: 0, Q: 0, R: 0, S: 0, T: 0, fecoep: 0, itens: [] };
      const g = grupos[k];
      ["F", "G", "H", "I", "J", "K", "N", "P", "Q", "R", "S", "fecoep"].forEach(c => g[c] = g[c] + r[c]);
      g.itens.push(r.nItem);
    }
    const linhasMapa = Object.values(grupos);
    for (const g of linhasMapa) ["F", "G", "H", "I", "J", "K", "N", "P", "Q", "R", "S", "fecoep"].forEach(c => g[c] = r2(g[c]));
    const tot = { base: 0, debito: 0, credito: 0, devido: 0, fecoep: 0, porReceita: {} };
    for (const g of linhasMapa) {
      tot.base = r2(tot.base + g.P); tot.debito = r2(tot.debito + g.Q); tot.credito = r2(tot.credito + g.R); tot.devido = r2(tot.devido + g.S); tot.fecoep = r2(tot.fecoep + g.fecoep);
      const pr = tot.porReceita[g.receita] || (tot.porReceita[g.receita] = { cod: g.cod, nome: g.receitaNome, base: 0, debito: 0, credito: 0, devido: 0 });
      pr.base = r2(pr.base + g.P); pr.debito = r2(pr.debito + g.Q); pr.credito = r2(pr.credito + g.R); pr.devido = r2(pr.devido + g.S);
    }
    const alertas = []; itens.forEach(i => i.alertas.forEach(a => alertas.push({ ...a, nItem: i.nItem })));
    const naoAntecipada = itens.length > 0 && itens.every(i => i.receita === 'nao_antecipa');
    return { nota, itens, linhasMapa, totais: tot, alertas, naoAntecipada, ignorada: !!ovNota.ignorar || !!ovNota.situacao, situacao: ovNota.situacao || "" };
  }

  // Consolida várias notas (uma competência)
  function consolidar(resultados) {
    const porReceita = {};
    let devido = 0, fecoep = 0, base = 0, debito = 0, credito = 0;
    for (const r of resultados) {
      if (r.ignorada) continue;
      base = r2(base + r.totais.base); debito = r2(debito + r.totais.debito); credito = r2(credito + r.totais.credito); fecoep = r2(fecoep + r.totais.fecoep);
      for (const [id, v] of Object.entries(r.totais.porReceita)) {
        const p = porReceita[id] || (porReceita[id] = { cod: v.cod, nome: v.nome, base: 0, debito: 0, credito: 0, devido: 0, notas: 0 });
        p.base = r2(p.base + v.base); p.debito = r2(p.debito + v.debito); p.credito = r2(p.credito + v.credito); p.devido = r2(p.devido + v.devido); p.notas++;
      }
    }
    // Valor a recolher por receita não fica negativo (saldo credor maior que devedor → zero)
    for (const p of Object.values(porReceita)) { p.recolher = p.devido > 0 ? p.devido : 0; devido = r2(devido + p.recolher); }
    return { porReceita, base, debito, credito, devido, fecoep, totalDae: r2(devido + fecoep) };
  }

  return { PARAMS_PADRAO, EMPRESA_PADRAO, receita, classificarCfop, buscarRegra, mvaDaRegra, sugerirFinalidade, calcularItem, calcularNota, consolidar, r2 };
})();
