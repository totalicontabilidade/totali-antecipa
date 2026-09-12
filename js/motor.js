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
    creditoIsentoOrigem: false,     // CST 40/41/50/51: DESLIGADO segue o art. 788 (deduz só o ICMS destacado — sem destaque, alíquota interna cheia).
                                    // LIGADO reproduz a prática do mapa (crédito presumido pela alíquota interestadual). Ver art. 785, § 2º, I.
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
      // descExcluir: a DESCRIÇÃO do produto manda mais que o CEST/NCM da nota, que o emitente às vezes carimba errado
      if (rg.descExcluir && new RegExp(rg.descExcluir).test(desc)) return false;
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
    if (ov && ov.ignorar) return { id: 'nao_antecipa', motivo: 'Item EXCLUÍDO manualmente desta apuração pelo usuário — a versão deixa de ser a calculada automaticamente.' };
    if (ov && ov.receita) return { id: ov.receita, motivo: 'Receita definida manualmente pelo usuário.' };
    if (!tri.interestadual) return { id: 'nao_antecipa', motivo: 'Não é entrada interestadual para contribuinte de SE (emitente ' + nota.emit.uf + ' → destinatário ' + nota.dest.uf + ').' };
    if (['industrializacao', 'devolucao', 'remessaRetorno'].includes(tri.cfopTipo)) return { id: 'nao_antecipa', motivo: T.descCfop[tri.cfopTipo] + ' (CFOP ' + item.cfop + ').' };
    // ST retida PARA SERGIPE nesta operação: nada a antecipar em qualquer regime (a SEFAZ marca "operação não antecipada" — J C de Lira mar/2026)
    if (tri.stRetida) return { id: "nao_antecipa", motivo: "ICMS-ST retido pelo remetente nesta operação (CST/CSOSN " + (item.icms.cst || item.icms.csosn) + (tri.cfopTipo === "stRetida" ? ", CFOP " + item.cfop : "") + ") — não cabe nova antecipação" + (empresa.regime === "simples" ? " nem complementação de alíquota (a SEFAZ marca como operação não antecipada)" : "") + "." };
    // CST 60 / CSOSN 500 numa entrada interestadual: o imposto "cobrado anteriormente" foi do estado de ORIGEM, não de Sergipe.
    if (tri.stAnteriorOutraUF && ctx.alertas) ctx.alertas.push({ nivel: 'medio', msg: 'CST/CSOSN ' + (item.icms.cst || item.icms.csosn) + ' (imposto cobrado anteriormente por ST) numa entrada INTERESTADUAL: essa retenção foi para ' + nota.emit.uf + ', não para Sergipe. Como o substituto não reteve para SE, cabe a antecipação com encerramento (RICMS/SE art. 784, II, "a"). Se o remetente tiver retido para SE, informe a receita do item manualmente.' });
    // ---- Agropecuária / pet shop (conferido com o mapa da J C de Lira, mar/2026) ----
    const ncmI = String(item.ncm || ''), cstO = String(item.icms.cst || ''), descI = String(item.xProd || '').toUpperCase();
    const agropet = empresaAgropet(empresa);
    const origemReduzidaOuIsenta = ['20', '30', '40', '41', '51', '70'].includes(cstO);
    const ncmInsumo = /^(230[1-9]|310[1-5]|3808)/.test(ncmI);
    const ncmFertDefens = /^(310[1-5]|3808)/.test(ncmI);
    // nome inequívoco de criação (pecuária). "Frango", "peixe" e "cordeiro" são SABORES de ração pet e não entram aqui.
    const descCriacao = /SUIN|BOVIN|GADO|EQUIN|POTRO|CAVAL|OVIN|CAPRIN|POEDEIR|\bVACA|BEZERR|NOVILH|LEITA[OÕ]|BUBALIN|MUAR|RUMINANT|\bAVES\b|DE CORTE|ENGORDA|POSTURA|TILAPIA|PISCICULT|CAMAR[AÃ]O/.test(descI);
    // ração pet: CEST 22.001.00 ou palavra de pet no nome — vale inclusive em amostra/bonificação (CST 40), como no mapa da J C de Lira abr/2026
    const petInd = !descCriacao && (String(item.cest || '') === '2200100' || /\b(PET|DOG|CAT|CAO|CAES|GATO|GATOS|CANINE|FELINE|PUPPY|KITTEN|FILHOTE|FILHOTES|PASSARO)\b/.test(descI));
    // CEST de ração na nota mas descrição de suplemento: a descrição manda (o emitente às vezes carimba o CEST errado)
    if (String(item.cest || '') === '2200100' && regra && regra.id !== 'rac-pet' && ctx.alertas)
      ctx.alertas.push({ nivel: 'baixo', msg: 'A nota traz o CEST 22.001.00 (ração tipo pet), mas a descrição é de suplemento/vitamina: a ST de ração NÃO foi aplicada, porque a substituição alcança ração e não suplemento. Se for ração mesmo, troque a receita do item.' });
    // Adubo/defensivo de JARDINAGEM ORNAMENTAL em embalagem de varejo: o Conv. ICMS 100/97 exige "uso na agricultura e na pecuária,
    // vedada a aplicação quando dada ao produto destinação diversa" — jardim doméstico é destinação diversa (J C de Lira abr/2026, linha Forth)
    const jardinagem = ncmFertDefens && (/JARDIM|FLOR|ORQUID|ORQ\.|SAMAMBAIA|ROSA DO DESERTO|ROSA DESERTO|ROSEIRA|BONSAI|SUCULENT|CACTO|GRAMAD|ORNAMENT|VIOLETA|ANTURIO|\bVASO/.test(descI) || /\d+\s*X\s*\d+([.,]\d+)?\s*(G|ML|KG|L)\b/.test(descI));
    // O benefício do Conv. 100/97 só se presume quando o REMETENTE o aplicou (CST com redução/isenção). Se ele tributou cheio
    // (CST 00), não houve benefício na origem e o produto entra na antecipação — ex.: coleira antipulgas 3808 (J C de Lira mai/2026).
    if (ncmInsumo && !petInd && !jardinagem && origemReduzidaOuIsenta && (ncmFertDefens || descCriacao || agropet)) return { id: 'nao_antecipa', motivo: 'Insumo agropecuário (ração/suplemento para criação, fertilizante, substrato, defensivo — NCM ' + ncmI + ', CST ' + cstO + ' com base reduzida/isenta na origem): Convênio ICMS 100/97, tratamento favorecido nas operações internas de SE — não entra na antecipação (prática do escritório; a SEFAZ marca como não antecipada).' };
    if (jardinagem && ctx.alertas) ctx.alertas.push({ nivel: 'medio', msg: 'Adubo/defensivo de jardinagem ornamental em embalagem de varejo (NCM ' + ncmI + '): o Convênio ICMS 100/97 vale só para uso na agricultura e na pecuária, então este item NÃO foi tratado como insumo isento. Se for insumo agrícola, mude a receita do item.' });
    // Medicamento/vacina de uso veterinário em empresa do ramo agropet: 3002 (soros e vacinas), 3003/3004 (medicamentos) e 3006 (preparações
    // farmacêuticas, ex.: Tyladen 3006.93). NÃO entram 3001 e 3005 (gaze, atadura, banda elástica) — material de curativo é mercadoria comum.
    if (agropet && /^(3002|3003|3004|3006)/.test(ncmI)) return { id: 'nao_antecipa', motivo: 'Medicamento/vacina de uso veterinário (NCM ' + ncmI + ') em empresa do ramo agropet: Convênio ICMS 100/97 (vacinas, soros e medicamentos de uso na pecuária) — sem antecipação (prática do escritório, J C de Lira mar a mai/2026; confirmar se a SEFAZ cobrar).' };
    if (regra && regra.regime === 'nao_antecipa') return { id: 'nao_antecipa', motivo: regra.descricao + '.' };
    if (regra && regra.regime === "cesta") { const pct = regra.cestaPct != null ? regra.cestaPct : 2.1; return empresa.cestaOptante
      ? { id: pct >= 3.6 ? "cesta_opt36" : "cesta_opt21", motivo: "Produto da cesta básica (art. 40, § 3º) e adquirente optante do Regime Simplificado: " + String(pct).replace(".", ",") + "% direto sobre o valor, sem crédito (art. 787, I)." }
      : { id: "cesta_nao_opt", motivo: "Produto da cesta básica — adquirente não optante do Regime Simplificado: alíquota interna sobre a base com MVA 30%, menos o crédito (art. 786, I, b; art. 787, II)." }; }
    if (empresa.regime === "simples" && regra && regra.regime === "antecip_encer" && regra.simplesTambem) return { id: "antecip_encer", motivo: regra.descricao + " — produto de ST: antecipação COM encerramento mesmo no Simples (art. 784, II)." };
    // Entrada para uso/consumo ou ativo dita pelo CFOP (6551 a 6553, 6556, 6557 e 6949) ou marcada à mão: não há operação
    // seguinte a antecipar, e o devido é o diferencial de alíquota, apurado fora do DIA. Vale também no Simples, pela
    // LC 123/2006, art. 13, § 1º, XIII, "h" (diferencial) contra a alínea "g" (antecipação). Confirmado nos espelhos do
    // DIA, que marcam essas entradas como "OPERAÇÃO NÃO ANTECIPADA", e nos mapas de Mais Barato, J C de Lira e Faro Tem,
    // onde nenhuma nota de CFOP 6949 foi lançada.
    if (tri.finalidadeExplicita && (tri.finalidade === 'ativo' || tri.finalidade === 'usoConsumo')) {
      if (ctx.alertas && empresa.regime !== 'simples') ctx.alertas.push({ nivel: 'baixo', msg: 'Entrada para ' + (tri.finalidade === 'ativo' ? 'ativo imobilizado' : 'uso e consumo') + ' pelo CFOP ' + item.cfop + ': essa nota não seria no DIFAL? Para apurar o diferencial aqui, marque "Calcular como DIFAL (Port. 367/2016)" na coluna Receita da nota.' });
      return { id: 'nao_antecipa', motivo: 'Entrada para ' + (tri.finalidade === 'ativo' ? 'ativo imobilizado' : 'uso/consumo') + ' (CFOP ' + item.cfop + '): não entra no DIA — o diferencial de alíquota é apurado à parte (a SEFAZ marca como operação não antecipada; LC 123/2006, art. 13, § 1º, XIII, "h", para o optante do Simples). Para calcular o DIFAL, marque a nota como "Calcular como DIFAL" na coluna Receita.' };
    }
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
    // ST retida: só vale se a retenção foi PARA SERGIPE (o remetente destacou o ICMS-ST nesta operação — CST 10/30/70, CFOP 64xx de
    // substituto). CST 60 / CSOSN 500 dizem "imposto cobrado anteriormente", mas numa entrada interestadual esse imposto foi do estado
    // de ORIGEM: o substituto não reteve para SE, e o RICMS/SE art. 784, II, "a" manda antecipar aqui (J C de Lira, Vetminas mai/jun/2026).
    const cstItem = String(item.icms.cst || ''), csosnItem = String(item.icms.csosn || '');
    const cstRet = T.cstStRetida.includes(cstItem) || T.csosnStRetida.includes(csosnItem) || cfopTipo === 'stRetida';
    const stAnterior = ['60'].includes(cstItem) || ['500'].includes(csosnItem);          // "imposto cobrado anteriormente" (substituído)
    // O CFOP diz quem é quem: 6404 é o SUBSTITUÍDO revendendo (ST anterior, de outra UF); 6401, 6403, 6408 e 6409 são do
    // SUBSTITUTO, que recolhe para o destino — caso do moinho de trigo, que recolhe para SE pelo Protocolo ICMS 46/2000
    // sem destacar ICMS-ST na nota (Mais Barato mai/2026, Grande Moinho Cearense).
    const cfopSubstituto = ['6401', '6403', '6408', '6409'].includes(String(item.cfop));
    const reteveAgora = (item.icms.vICMSST > 0) || ['10', '30', '70'].includes(cstItem) || ['201', '202', '203'].includes(csosnItem) || cfopSubstituto;
    const stRetida = cstRet && !(stAnterior && !reteveAgora);   // ST anterior sem retenção nesta operação não vale para SE
    let finalidade = ov.finalidade || (cfopTipo === 'ativo' ? 'ativo' : cfopTipo === 'usoConsumo' ? 'usoConsumo' : 'revenda');
    // Finalidade suposta pelos CNAEs da empresa (só quando o CFOP não diz explicitamente)
    let sugFin = null;
    if (P.finalidadeCnae !== 'nao' && !ov.finalidade && ['revenda', 'bonificacao', 'outro'].includes(cfopTipo) && E.cnaes && E.cnaes.length) {
      sugFin = sugerirFinalidade(E, item);
      if (sugFin && sugFin.finalidade !== 'revenda') {
        // Aplica quando o parâmetro manda ("aplicar") OU quando a própria nota confirma (indFinal=1: o remetente vendeu como consumidor final,
        // sinal independente de que não é revenda) — validado na Mais Barato fev/2026 (Fast Ariam, móveis de checkout)
        const notaConsumidorFinal = nota.indFinal === '1';
        if ((P.finalidadeCnae === 'aplicar' || notaConsumidorFinal) && sugFin.confianca === 'alta') { finalidade = sugFin.finalidade; sugFin.aplicada = true; alertas.push({ nivel: 'medio', msg: 'Finalidade ' + (finalidade === 'ativo' ? 'ATIVO IMOBILIZADO' : 'USO/CONSUMO') + ' aplicada' + (notaConsumidorFinal && P.finalidadeCnae !== 'aplicar' ? ' (nota de consumidor final + CNAE: ' : ' pelo CNAE (') + sugFin.motivo + ') — fora do DIA. Essa nota não seria no DIFAL? No regime normal, dá para marcar "Calcular como DIFAL (Port. 367/2016)" na coluna Receita da nota. Ajuste a finalidade no item se não for o caso.' }); }
        else alertas.push({ nivel: sugFin.confianca === 'alta' ? 'medio' : 'baixo', msg: 'Pelo CNAE da empresa este item parece ' + (sugFin.finalidade === 'ativo' ? 'ATIVO IMOBILIZADO' : 'USO/CONSUMO') + ' (' + sugFin.motivo + '). Se for isso, ajuste a finalidade no item — e, no regime normal, essa nota não seria no DIFAL? Dá para marcar "Calcular como DIFAL (Port. 367/2016)" na coluna Receita.' });
      }
    }
    const tri = {
      interestadual: nota.emit.uf !== 'SE' && nota.dest.uf === 'SE',
      cfopTipo, stRetida, stAnteriorOutraUF: stAnterior && !reteveAgora, finalidade,
      // finalidade dita pelo CFOP da nota ou marcada à mão — sinal firme, diferente da suposta pelo CNAE
      finalidadeExplicita: !!ov.finalidade || cfopTipo === 'ativo' || cfopTipo === 'usoConsumo',
      emitenteSimples: nota.emit.crt === '1',
      destContribuinte: !!nota.dest.ie && !/^(ISENTO|0+)$/i.test(nota.dest.ie),
    };
    if (!tri.destContribuinte) alertas.push({ nivel: 'alto', msg: 'Destinatário sem IE — se não for contribuinte, o caso é DIFAL do remetente (EC 87/2015), não antecipação.' });
    if (cfopTipo === 'outro') alertas.push({ nivel: 'medio', msg: 'CFOP ' + item.cfop + ' não mapeado — confira a natureza da operação.' });
    if (cfopTipo === 'bonificacao') alertas.push({ nivel: 'medio', msg: 'Bonificação (CFOP ' + item.cfop + ') — confirme se entra na antecipação.' });
    if (nota.indFinal === '1' && finalidade === 'revenda') alertas.push({ nivel: 'baixo', msg: 'Nota marcada como consumidor final (indFinal=1). Se a entrada for uso/consumo ou ativo, é DIFAL.' });
    // Manual de Preenchimento do Mapa (Anexo II da Portaria 103/2006, observação da coluna C): a planilha do DIA não
    // serve para recolhimento de massas alimentícias, biscoitos e bolachas — esses produtos têm guia própria.
    if (/^(1902|1905)/.test(String(item.ncm || ''))) alertas.push({ nivel: 'medio', msg: 'Massa alimentícia, biscoito ou bolacha (NCM ' + item.ncm + '): o Manual de Preenchimento do Mapa (Portaria 103/2006, Anexo II) diz que a planilha do DIA NÃO deve ser usada para recolher esses produtos. Confira se o imposto sai por guia própria e, se for o caso, tire a nota da apuração.' });

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
    const rec = decidirReceita({ nota, item, empresa: E, tri, regra, ov, alertas });
    const R = receita(rec.id);

    // ---- Formação do preço (colunas F..K) ----
    // Quantidade ajustada (ov.qtd): devolução parcial, quebra ou item recusado — tudo é reduzido na mesma proporção,
    // como o escritório faz no mapa (Central Net mai/2026: 1 das 10 fontes devolvida, base de 10 para 9 unidades).
    const qNota = item.qCom > 0 ? item.qCom : 1;
    const qUsada = (ov.qtd != null && ov.qtd >= 0) ? ov.qtd : qNota;
    const fatorQtd = qUsada === qNota ? 1 : (qUsada / qNota);
    const px = v => r2((v || 0) * fatorQtd);
    const F = px(item.vProd - item.vDesc);
    const G = px(item.vIPI), H = px(item.vFrete), I = px(item.vSeg), J = px(item.vOutro);
    const usaAcr = !!R.acrescimos;
    const K = usaAcr ? r2(F + G + H + I + J) : F;
    if (fatorQtd !== 1) alertas.push({ nivel: 'medio', msg: 'Quantidade ajustada de ' + qNota + ' para ' + qUsada + ' ' + (item.uCom || 'un') + ': todos os valores do item entram na proporção de ' + (fatorQtd * 100).toFixed(2).replace('.', ',') + '%. Use para devolução parcial, quebra ou recusa.' });

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
        // Prática do escritório (mapas da Mais Barato jan e mai/2026 e da J C de Lira abr e jun/2026): mesmo sem ICMS destacado
        // na origem, o mapa abate o crédito pela alíquota interestadual da UF do remetente.
        const aliqInter = NFE.aliquotaInterestadual(nota.emit.uf, item.icms.orig, T);
        // CST 60 entra aqui também: quando a ST foi de OUTRO estado, a entrada é antecipada em SE e a nota não destaca ICMS —
        // é o mesmo caso dos demais CST sem destaque, e quem decide é o parâmetro (Vetminas, J C de Lira jun/2026).
        if (P.creditoIsentoOrigem && rec.id !== 'nao_antecipa') {
          L = aliqInter; credito = (F + H) * L / 100;
          origemCredito = 'CST ' + cst + (cst === '60' ? ' (ST cobrada em outro estado)' : ' (isenta/não tributada na origem)') + ': crédito presumido pela alíquota interestadual de ' + L + '% sobre (F+H) — como no mapa do escritório';
          alertas.push({ nivel: 'medio', msg: 'CST ' + cst + ' sem ICMS destacado: aplicado crédito presumido de ' + L + '% por opção em Parâmetros (prática do escritório). ATENÇÃO: o art. 788 do RICMS/SE manda deduzir "o valor do ICMS destacado na Nota Fiscal de aquisição", e a CF/88 (art. 155, § 2º, II, "a") diz que a isenção não gera crédito — sem imposto na origem, o crédito não tem amparo literal. Para calcular sem crédito, desligue em Parâmetros.' });
        } else {
          L = 0; credito = 0; origemCredito = 'CST ' + cst + (cst === '60' ? ' — ST cobrada em outro estado' : ' — isenta/não tributada na origem') + ': sem ICMS destacado, nada a deduzir (art. 788 do RICMS/SE)';
          if (rec.id !== 'nao_antecipa') {
            const credPresumido = r2((F + H) * aliqInter / 100);
            alertas.push({ nivel: 'medio', isento: true, cst, aliqInter, credPresumido,
              msg: 'Entrada com CST ' + cst + ' (isenta/não tributada na origem, sem ICMS destacado). Calculado pela ALÍQUOTA INTERNA CHEIA: o art. 788 do RICMS/SE manda deduzir "o valor do ICMS destacado na Nota Fiscal de aquisição", e não há destaque. Se quiser seguir a prática do mapa (só a DIFERENÇA, com crédito presumido de ' + aliqInter + '% = ' + credPresumido.toFixed(2) + '), ligue em Parâmetros. Fora da antecipação (art. 785, § 2º, I) só quando o produto for isento AQUI em SE (Anexo I do RICMS/SE) — isenção de outro estado não vale em Sergipe.' });
          }
        }
      } else { credito = 0; origemCredito = 'Sem ICMS destacado (vICMS = 0)'; }
    } else {
      // Modo do crédito: fórmula do mapa (F+H)×L ou ICMS destacado
      // A coluna F do Mapa da SEFAZ é "Valor da Nota Fiscal / Base de cálculo": quando a receita soma os acréscimos no débito,
      // seguro e outras despesas (que integram a base do ICMS na origem) também entram no crédito. O IPI fica de fora, porque
      // não compõe a base do ICMS na venda para revenda. Conferido na Central Net mar/2026 (NF 276045, com 5,00 de despesas).
      // Fórmula OFICIAL da coluna R, lida nas células ocultas da planilha da SEFAZ (todas as receitas
      // usam a mesma): crédito = (E × F + E × H) × L, ou seja, valor das mercadorias mais frete, pela
      // alíquota de origem. IPI (G), seguro (I) e outras despesas (J) entram no débito mas NÃO no
      // crédito. O Manual (Anexo II, item 11) confirma que K, P, Q, R, S e T são calculados pelo
      // próprio programa, e não informados pelo contribuinte.
      const credMapa = (F + H) * L / 100;
      if (P.creditoModo !== 'destacado') {
        if (Math.abs(credMapa - credito) > 0.05) alertas.push({ nivel: 'baixo', msg: 'Crédito pela fórmula do mapa (F+H)×L = ' + credMapa.toFixed(2) + ' difere do ICMS destacado ' + credito.toFixed(2) + ' (base de origem inclui IPI/seguro/outras ou é reduzida). Usado o valor do mapa, como faz o DIA.' });
        const baseCred = F + H;
        credito = credMapa; origemCredito = '(F+H) × L = (' + F.toFixed(2) + ' + ' + H.toFixed(2) + ') × ' + L + '% = ' + baseCred.toFixed(2) + ' × ' + L + '%' +
          ((I + J) > 0 ? ' — seguro e outras despesas entram no débito mas ficam fora do crédito' : '') + ' — fórmula da coluna R na planilha da SEFAZ';
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

    // Manual de Preenchimento do Mapa (Anexo II da Portaria 103/2006, item 12.2, na redação da Portaria 705/2014):
    // quando a carga de destino (M) é MENOR que a praticada na operação interestadual, a coluna L usa a carga interna.
    // Ou seja, o crédito nunca supera o imposto que seria devido aqui — evita saldo credor na antecipação.
    if (ov.aliqOrigem == null && L > M && M > 0 && rec.id !== 'nao_antecipa') {
      const Lantes = L;
      L = M; credito = (F + H) * L / 100;
      origemCredito = 'alíquota de origem limitada à carga interna: ' + Lantes + '% → ' + M + '% (Manual do Mapa, item 12.2, Portaria 705/2014)';
      alertas.push({ nivel: 'baixo', msg: 'Carga de destino (' + M + '%) menor que a alíquota da operação interestadual (' + Lantes + '%): pelo item 12.2 do Manual de Preenchimento do Mapa, a coluna L passa a ser a carga interna, limitando o crédito.' });
    }

    // ---- MVA (O) ----
    let O = 0, origemO = 'sem MVA nesta receita';
    if (ov.mva != null) { O = ov.mva; origemO = 'MVA informada manualmente'; }
    else if (R.mva === 'geral') { O = E.perfil === 'inapto' ? P.mvaInapto : P.mvaApto; origemO = "MVA geral — contribuinte " + (E.perfil === "inapto" ? "suspenso/inapto: 30% (art. 786, II, b)" : "apto: 10% (art. 786, II, a)"); }
    else if (R.mva === 'produto') {
      // A MVA-ST varia com a ALÍQUOTA INTERESTADUAL da operação, não com o imposto efetivamente destacado:
      // em item isento/reduzido na origem (CST 40, amostra, bonificação) L pode ser 0 — usa-se a alíquota da UF de origem.
      const Lmva = L > 0 ? L : NFE.aliquotaInterestadual(nota.emit.uf, item.icms.orig, T);
      const m = mvaDaRegra(regra, Lmva);
      if (m != null) { O = m; origemO = 'MVA do produto — ' + regra.descricao + ' (origem ' + Lmva + '%' + (L !== Lmva ? ', alíquota interestadual da UF — a nota não destaca ICMS' : '') + ')'; }
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
    let Q, S, pDifal = 0;
    if (R.difal) {
      // Portaria SEFAZ 367/2016, Anexo II: o percentual do DIFAL é a diferença entre a alíquota
      // interna e a interestadual, e a base é o valor da operação dividido por (1 − esse percentual),
      // porque o imposto integra a própria base (LC 87/96, art. 13, § 6º). Sem crédito a deduzir:
      // a dedução da alíquota de origem já está dentro do percentual.
      pDifal = r2(Math.max(0, M - L));
      Pb = pDifal < 100 ? K / (1 - pDifal / 100) : K;
      Q = Pb * pDifal / 100; credito = 0; S = Q;
      origemCredito = 'sem crédito destacado: no DIFAL a alíquota de origem já entra no percentual (' + M + '% − ' + L + '% = ' + pDifal + '%)';
    }
    else if (R.direto) { Q = K * R.direto / 100; S = Q; }
    else { Q = Pb * M / 100; S = Q - credito; }
    if (rec.id === 'nao_antecipa') { Q = 0; S = 0; Pb = 0; }

    // ---- FECOEP ----
    let fecoepPts = 0, origemFecoep = 'desligado';
    // Entrada de USO OU CONSUMO que ficou fora do DIA, em empresa do SIMPLES: o adicional continua
    // devido, porque o art. 616-B, VII manda incidir "nas operações de aquisição, por contribuinte
    // do imposto, de bens destinados ao uso ou consumo do estabelecimento", sem depender da
    // antecipação, e o optante não tem conta gráfica onde lançá-lo depois. Confirmado na planilha de
    // FCP da Faro Tem fev/2026, que cobra 1% da nota 4791 (CFOP 6949) mesmo fora do mapa.
    // No regime NORMAL o escritório não lança no DIA (Mais Barato jul/2026, nota 18201, também CFOP
    // 6949): ali o diferencial e o seu adicional entram na apuração mensal do ICMS. Para calcular os
    // dois aqui, marque a nota como "Calcular como DIFAL". Bem do ATIVO fica fora (art. 616-C-B, II).
    const usoConsumoForaDoDia = rec.id === 'nao_antecipa' && tri.finalidadeExplicita
      && tri.finalidade === 'usoConsumo' && E.regime === 'simples';
    if (P.fecoepAtivo && (rec.id !== 'nao_antecipa' || usoConsumoForaDoDia)) {
      if (ov.fecoep != null) { fecoepPts = ov.fecoep; origemFecoep = 'informado manualmente'; }
      else if (regra && regra.fecoep != null) { fecoepPts = regra.fecoep; origemFecoep = 'regra do NCM (' + regra.descricao + ')'; }
      else if (['cesta_opt36', 'cesta_opt21', 'cesta_nao_opt'].includes(rec.id)) { fecoepPts = 0; origemFecoep = 'cesta básica — excluída do FECOEP'; }
      // DIFAL: o adicional incide na aquisição de bem de USO OU CONSUMO (art. 616-B, VII), com
      // 1 ponto pela regra geral do art. 40-D, e NÃO incide na aquisição para o ATIVO IMOBILIZADO
      // (art. 616-C-B, II). Confirmado na planilha de FCP do DIFAL da Mais Barato de ago/2026,
      // que aplica 1% sobre a base do DIFAL das três notas de uso e consumo.
      else if (R.difal) {
        const ativo = tri.finalidade === 'ativo';
        fecoepPts = ativo ? 0 : P.fecoepPadrao;
        origemFecoep = ativo ? 'DIFAL de bem do ativo imobilizado: sem adicional (RICMS/SE, art. 616-C-B, II)'
          : 'DIFAL de uso e consumo: ' + P.fecoepPadrao + ' ponto sobre a base do diferencial (art. 616-B, VII, c/c art. 40-D)';
      }
      else if (usoConsumoForaDoDia) { fecoepPts = P.fecoepPadrao; origemFecoep = 'entrada para uso e consumo (CFOP ' + item.cfop + '): fora do DIA, mas o adicional é devido sobre o valor da operação (art. 616-B, VII, c/c art. 40-D)'; }
      else if (P.fecoepBase === 'auto' && E.regime !== 'simples' && !['antecip_encer', 'st_interna', 'importacoes'].includes(rec.id)) { fecoepPts = 0; origemFecoep = 'regime normal: FECOEP na entrada só nas receitas com encerramento — na antecipação parcial a saída própria já recolhe o adicional (prática do escritório)'; }
      else { fecoepPts = P.fecoepPadrao; origemFecoep = 'padrão (' + P.fecoepPadrao + ' ponto) — art. 40-B; Dec. 289/2023' + (P.fecoepBase === 'auto' ? (E.regime === 'simples' ? '; Simples: sobre o valor da nota' : '; com encerramento: sobre a base com MVA') : ''); }
    }
    // No DIFAL o adicional do fundo de pobreza é a coluna J da Portaria 367/2016: 2 pontos sobre a
    // base do DIFAL (coluna G), qualquer que seja o regime.
    const fecoepBase = R.difal ? Pb : usoConsumoForaDoDia ? K
      : (P.fecoepBase === "P" || (P.fecoepBase === "auto" && (E.regime !== "simples" || ["antecip_encer", "st_interna", "importacoes"].includes(rec.id)))) ? Pb : K;
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
      if (fatorQtd !== 1) mem.push({ passo: '3b. Quantidade ajustada', txt: qNota + ' ' + (item.uCom || 'un') + ' na nota → ' + qUsada + ' considerada(s) (devolução parcial/quebra): valores na proporção de ' + (fatorQtd * 100).toFixed(2).replace('.', ',') + '%' });
      mem.push({ passo: '4. Formação do preço', txt: 'F valor = ' + f(F) + (usaAcr ? ' · G IPI = ' + f(G) + ' · H frete = ' + f(H) + ' · I seguro = ' + f(I) + ' · J outras = ' + f(J) + ' → K = ' + f(K) : ' → K = F = ' + f(K) + ' (sem encerramento: IPI/frete/seguro não entram na base — manual da SEFAZ, itens 7 a 10)') });
      mem.push({ passo: '5. Alíquota de origem (L)', txt: L + '% — ' + origemCredito });
      mem.push({ passo: '6. Carga de destino (M)', txt: M + '% — ' + origemM });
      if (R.difal) {
        mem.push({ passo: '7. Percentual do DIFAL (coluna H)', txt: 'alíquota interna − alíquota de origem = ' + M + '% − ' + L + '% = ' + pDifal + '%' });
        mem.push({ passo: '8. Base do DIFAL (coluna G)', txt: 'valor da operação ÷ (1 − ' + pDifal + '%) = ' + f(K) + ' ÷ ' + (1 - pDifal / 100).toFixed(4) + ' = ' + f(Pb) + ' — o imposto integra a própria base (LC 87/96, art. 13, § 6º; Portaria 367/2016, Anexo II). A coluna B soma mercadorias ' + f(F) + (G > 0 ? ' + IPI ' + f(G) : '') + (H > 0 ? ' + frete ' + f(H) : '') + (I > 0 ? ' + seguro ' + f(I) : '') + (J > 0 ? ' + outras ' + f(J) : '') + ': na entrada para uso, consumo ou ativo não há operação seguinte, então o IPI entra na base do ICMS (CF, art. 155, § 2º, XI, a contrario sensu)' });
        mem.push({ passo: '9. Valor do DIFAL (coluna I)', txt: 'base × ' + pDifal + '% = ' + f(Pb) + ' × ' + pDifal + '% = ' + f(Q) });
        mem.push({ passo: '10. A recolher (coluna K)', txt: f(S) + ' de DIFAL' + (fecoep > 0 ? ' + ' + f(fecoep) + ' do Fundo de Pobreza (coluna J) = ' + f(S + fecoep) : '') + ' — DAE próprio, fora do mapa do DIA' });
      }
      else if (R.direto) mem.push({ passo: '7. Imposto direto', txt: 'K × ' + R.direto + '% = ' + f(K) + ' × ' + R.direto + '% = ' + f(Q) + ' (sem crédito)' });
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
      qtdNota: qNota, qtdUsada: qUsada, fatorQtd,
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
    // Item fora do DIA pode ter FECOEP mesmo assim (entrada de uso e consumo, art. 616-B, VII):
    // ele não gera linha no mapa, mas o adicional entra no total da nota.
    for (const r of itens) if (r.receita === 'nao_antecipa' && r.fecoep > 0) tot.fecoep = r2(tot.fecoep + r.fecoep);
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
    // Valor a recolher por receita não fica negativo (saldo credor maior que devedor → zero).
    // O DIFAL fica fora do total do DIA: tem mapa próprio (Portaria 367/2016) e DAE próprio.
    const difal = { valor: 0, base: 0, fecoep: 0, notas: 0, linhas: [] };
    for (const [id, p] of Object.entries(porReceita)) {
      p.recolher = p.devido > 0 ? p.devido : 0;
      if (receita(id).difal) { difal.valor = r2(difal.valor + p.recolher); difal.base = r2(difal.base + p.base); difal.notas = p.notas; p.difal = true; }
      else devido = r2(devido + p.recolher);
    }
    if (difal.valor > 0) {
      for (const r of resultados) {
        if (r.ignorada) continue;
        const itens = r.itens.filter(i => receita(i.receita).difal);
        if (!itens.length) continue;
        const soma = c => r2(itens.reduce((s, i) => s + (i[c] || 0), 0));
        difal.fecoep = r2(difal.fecoep + soma('fecoep'));
        difal.linhas.push({ nNF: r.nota.nNF, chave: r.nota.chave, emitente: r.nota.emit.nome, uf: r.nota.emit.uf,
          B: soma('K'), C: itens[0].L, E: itens[0].M, F: itens[0].fecoepPts, G: soma('P'), H: r2(itens[0].M - itens[0].L),
          I: soma('Q'), J: soma('fecoep'), K: r2(soma('Q') + soma('fecoep')) });
      }
      fecoep = r2(fecoep - difal.fecoep);                 // o Fundo do DIFAL sai no DAE do DIFAL
    }
    return { porReceita, base, debito, credito, devido, fecoep, difal, totalDae: r2(devido + fecoep) };
  }

  return { PARAMS_PADRAO, EMPRESA_PADRAO, receita, classificarCfop, buscarRegra, mvaDaRegra, sugerirFinalidade, calcularItem, calcularNota, consolidar, r2 };
})();
