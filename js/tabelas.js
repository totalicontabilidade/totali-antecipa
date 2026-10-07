/* =====================================================================
   Totali Antecipa — Base de conhecimento do ICMS Antecipado de SERGIPE
   ---------------------------------------------------------------------
   Fonte: skill icms-antecipado-se da Totali (Lei 3.796/96 arts. 42/42-A;
   RICMS/SE Dec. 21.400/2002 arts. 785-790; Anexo X; FECOEP Lei 4.731/02),
   Mapa de Apuração do ICMS da SEFAZ/SE (Portaria 103/2006, Anexo I e II)
   e prática do escritório (mapas da Braz Móvel e do Tiago Pimentel).

   TUDO que muda de número fica aqui. Os itens marcados confirmar:true
   aparecem com ⚠ na tela e devem ser validados no RICMS/SE antes de
   recolher. O usuário pode sobrescrever qualquer regra em Cadastros
   (as regras do usuário têm prioridade sobre estas).
   ===================================================================== */

const TABELAS_SE = {
  versao: '2026-09',
  uf: 'SE',

  // ---------------------------------------------------------------
  // Alíquotas
  // ---------------------------------------------------------------
  aliquotaInternaModal: 19,          // Lei 9.176/2023, desde 01/04/2023
  aliquotaCestaBasica: 12,           // art. 40 — confirmar por NCM
  aliquotaSuperfluo: 25,             // art. 40-A (+2 pts FECOEP)
  ufs7: ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'],   // Sul/Sudeste exceto ES -> 7%
  aliquotaImportado: 4,              // Res. SF 13/2012 (orig 1,2,3,6,7,8 exceto 6/7 s/ similar)

  // MVA geral da antecipação SEM encerramento (art. 786)
  mvaGeral: { apto: 10, inapto: 30 },   // art. 786, II, "a" (apto 10%) e "b" (contribuinte SUSPENSO 30%) — RICMS/SE vigente (PDF oficial, set/2026)

  // FECOEP / FUNPOBREZA (arts. 40-A / 40-B; Lei 4.731/2002)
  fecoep: { geral: 1, superfluo: 2 },

  // Regime simplificado (cesta básica optante)
  cestaOptante: { pct: 2.1, codigo: '2674' },

  // ---------------------------------------------------------------
  // Tipos de receita do Mapa da SEFAZ/SE (coluna C do mapa)
  // Códigos conforme o cabeçalho do mapa (Portaria 103/2006, versão 5)
  // ---------------------------------------------------------------
  receitas: [
    { id: 'simples',          cod: '2607', nome: 'simples nacional',
      titulo: 'Simples Nacional — complementação de alíquota interestadual',
      formula: 'Base K × alíquota interna − crédito da origem (sem MVA)',
      mva: 'nenhum', acrescimos: true, base: 'Lei 3.796/96, art. 42-A; IN SEFAZ 17/2023' },
    { id: 'antecip_interest', cod: '2631', nome: 'antecip. Op. Interest.',
      titulo: 'Antecipação operação interestadual (sem encerramento)',
      formula: 'K × (1 + MVA geral 10% apto / 30% suspenso) × alíq. interna − crédito da origem',
      mva: 'geral', acrescimos: false, base: 'RICMS/SE arts. 785 e 786' },
    { id: 'antecip_encer',    cod: '2674', nome: 'Antecip.com encer.',
      titulo: 'Antecipação com encerramento da fase de tributação',
      formula: '(K + IPI + frete + seguro + outras) × (1 + MVA do produto) × alíq. interna − crédito',
      mva: 'produto', acrescimos: true, base: 'RICMS/SE arts. 785/786 e Anexo X' },
    { id: 'difal',            cod: '2445', nome: 'Difer.de Alíquota',
      titulo: 'Diferença de alíquota (uso, consumo ou ativo imobilizado)',
      formula: 'base = valor da operação ÷ [1 − (alíq. interna − alíq. origem)] · DIFAL = base × (alíq. interna − alíq. origem)',
      mva: 'nenhum', acrescimos: true, difal: true, manual: true,
      base: 'EC 87/2015; LC 87/96, art. 13, § 6º (o imposto integra a própria base); Portaria SEFAZ 367/2016, Anexos I e II' },
    { id: 'antecip_interna',  cod: '2666', nome: 'antecipação trib. Interna',
      titulo: 'Antecipação tributária interna',
      formula: 'K × (1 + MVA 10%/20%) × alíq. interna − crédito',
      mva: 'geral', acrescimos: true, base: 'RICMS/SE art. 785, II — REVOGADO pelo Dec. 1.006/2025 (mantido só para lançamento manual)', confirmar: true },
    { id: 'st_interna',       cod: '2356', nome: 'subst tribut. interna',
      titulo: 'Substituição tributária interna',
      formula: 'K × (1 + MVA do produto) × alíq. interna − crédito',
      mva: 'produto', acrescimos: true, base: 'RICMS/SE Anexo IX' },
    { id: 'cesta_nao_opt',    cod: '2674', nome: 'Cesta básica não optante',
      titulo: 'Cesta básica — atacadista/varejista NÃO optante do regime simplificado',
      formula: 'K × 1,30 × 12% − crédito (art. 787, II)', mva: 30, acrescimos: true,
      base: 'RICMS/SE Anexo X, item 2' },
    { id: 'cesta_opt36',      cod: '2674', nome: 'Cesta Básica opt. (3,6%)',
      titulo: 'Cesta básica — optante do Regime Simplificado: sabão em barra, leite em pó e charque (art. 787, I, a)',
      formula: 'K × 3,6% (sem crédito)', mva: 'nenhum', direto: 3.6, acrescimos: true,
      base: 'RICMS/SE Anexo X, item 1 / art. 786 (leite, charque…)' },
    { id: 'cesta_opt21',      cod: '2674', nome: 'Cesta Básica opt.(2,1%)',
      titulo: 'Cesta básica — optante do Regime Simplificado: demais produtos (art. 787, I, b)',
      formula: 'K × 2,1% (sem crédito)', mva: 'nenhum', direto: 2.1, acrescimos: true,
      base: 'RICMS/SE Anexo X, item 1 / art. 786 (farinha/flocão de milho, café…)' },
    { id: 'importacoes',      cod: '2372', nome: 'Importações',
      titulo: 'Antecipação de produtos importados', formula: 'K ÷ (1 − alíq.) × alíq. interna',
      mva: 'produto', acrescimos: true, grossup: true, base: 'Lei 3.796/96 art. 11, V' },
    { id: 'simfaz',           cod: '2658', nome: 'Simfaz comércio',
      titulo: 'Simfaz comércio', formula: 'K × alíq. interna − crédito',
      mva: 'nenhum', acrescimos: true, base: 'Regime Simfaz' },
    { id: 'nao_antecipa',     cod: '',     nome: 'OPERAÇÃO NÃO ANTECIPADA',
      titulo: 'Operação não antecipada', formula: 'sem imposto', mva: 'nenhum', acrescimos: false, base: '' },
  ],

  // ---------------------------------------------------------------
  // CFOP de entrada interestadual (visão do emitente 6xxx) — como tratar
  // ---------------------------------------------------------------
  cfop: {
    revenda:        ['6101', '6102', '6103', '6104', '6105', '6106', '6107', '6108', '6109', '6110', '6111', '6112', '6113', '6114', '6115', '6116', '6117', '6118', '6119', '6120', '6122', '6123'],
    ativo:          ['6551', '6552', '6553'],
    usoConsumo:     ['6556', '6557', '6949'],
    industrializacao: ['6124', '6125'],
    bonificacao:    ['6910', '6911'],
    devolucao:      /^62\d\d$/,
    remessaRetorno: /^69\d\d$/,
    stRetida:       ['6401', '6403', '6404', '6408', '6409', '6410', '6411'],
  },

  // CST / CSOSN que indicam ICMS-ST já retido na origem (não cabe antecipar de novo)
  cstStRetida:   ['10', '30', '60', '70'],
  csosnStRetida: ['201', '202', '203', '500'],

  // ---------------------------------------------------------------
  // Regras por NCM (prioridade menor = mais importante). O casamento é
  // por prefixo ('inicia') ou igualdade ('igual'). Campos:
  //   regime: id da receita a aplicar quando a empresa é do regime normal
  //   mva: número (fixo) OU objeto {4:x, 7:y, 12:z} por alíquota de origem
  //   aliq: alíquota interna do produto em SE (padrão 19)
  //   fecoep: pontos do adicional (0, 1 ou 2); null = usar padrão
  //   encerra: true se encerra a fase (ST/antecipação com encerramento)
  // ---------------------------------------------------------------
  regrasNcm: [
    // ---------------------------------------------------------------------------------------------
    // ANEXO X — CARNES E AVES (antecipação COM encerramento: art. 784, VI e VIII)
    //
    // ALÍQUOTA: 19%, a modal do art. 40, I. Carne NÃO é cesta básica desde 01/11/2008 (o item 2 da
    // alínea "b" do inciso VIII foi revogado pelo Decreto 25.631/08) e a lista vigente do art. 40,
    // § 3º só traz CHARQUE (inciso XII). Para ave o Regulamento é expresso: art. 40, XIV — "19% aves
    // abatidas e produtos de sua matança, em estado natural, congelados, ou simplesmente temperados,
    // a partir de 01/01/2024" (Lei 9.176/2023). Até 2026-09 estas regras usavam 12%, herdado da
    // redação revogada em 2008 — por isso vão marcadas confirmar:true até baterem num mapa da SEFAZ.
    //
    // FECOEP: 1 ponto (art. 40-D). Carne não está no art. 40-C (os de 2 pontos) e não está entre as
    // exclusões do art. 616-C-A — cujo inciso V afasta o adicional só na antecipação SEM encerramento.
    // Como estas receitas são COM encerramento, o adicional incide. Antes vinha fecoep:0.
    //
    // NCM de cada item do Anexo X (Decretos 717/2024 e 756/2024):
    //   item  5 (bovino/ovino/bufalino salgado/seco)  0210.20.00 · 0210.99.00 · 1502
    //   item  6 (bovino/ovino/bufalino fresco)        0201 · 0202 · 0204 · 0206
    //   item  7 (caprina fresca)                      0204
    //   item  8 (caprinos)                            0210.99.00 · 1502.10.19 · 1502.90.00
    //   item  9 (suínos)                              0203 · 0206 · 0209 · 0210.1 · 0210.99.00 · 1501
    //   item 10 (AVES)                                0207 · 0209 · 0210.99.00 · 1501
    // 0209, 0210.99 e 1501 aparecem nos dois grupos: o desempate é pelo produto, então as regras de
    // ave vêm com NCM mais longo (o motor faz o NCM mais específico vencer) ou com padrão de descrição.
    // ---------------------------------------------------------------------------------------------
    { id: 'ax-carne-bov', prioridade: 10, ncm: '0201', match: 'inicia', descricao: 'Carne bovina fresca/refrigerada — Anexo X item 6',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, item 6 (Dec. 717/2024); art. 784, VI; alíquota 19% do art. 40, I (carne saiu da cesta básica com o Dec. 25.631/08); FECOEP de 1 ponto pelo art. 40-D' },
    { id: 'ax-carne-bov2', prioridade: 10, ncm: '0202', match: 'inicia', descricao: 'Carne bovina congelada — Anexo X item 6',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, item 6; art. 784, VI; alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    { id: "ax-suino", prioridade: 10, ncm: "0203", match: "inicia", descricao: "Carne suína — Anexo X item 9 (Dec. 756/2024)",
      regime: "antecip_encer", encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: "RICMS/SE Anexo X, item 9 (CEST 17.087.01; Decreto 756/2024); art. 784, VI; alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D" },
    { id: 'ax-ovina', prioridade: 10, ncm: '0204', match: 'inicia', descricao: 'Carne ovina/caprina — Anexo X itens 6-8',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, itens 6 a 8; art. 784, VI; alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    { id: 'ax-miudos', prioridade: 10, ncm: '0206', match: 'inicia', descricao: 'Miudezas comestíveis — Anexo X',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, itens 6 a 9; art. 784, VI; alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    { id: 'ax-aves', prioridade: 10, simplesTambem: true, ncm: '0207', match: 'inicia', descricao: 'Carne de aves (frango, galinha, peru) — Anexo X item 10',
      regime: 'antecip_encer', encerra: true, mva: { 4: 43.57, 7: 39.09, 12: 31.61, interna: 21.14 }, aliq: 19, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE art. 784, VIII e art. 786, VIII c/c Anexo X, item 10 (Dec. 717/2024); alíquota 19% do art. 40, XIV (Lei 9.176/2023, desde 01/01/2024); FECOEP de 1 ponto pelo art. 40-D; conferido no texto vigente do RICMS/SE (atualizado até o Dec. 1.536/2026) em 07/10/2026: o art. 784 alcança todo atacadista ou varejista, inclusive optante do Simples' },
    // Gordura DE AVES (0209.90) — item 10, MVA de ave. Vence a regra de 0209 (suíno) por ter NCM mais longo.
    { id: 'ax-aves-gord', prioridade: 10, simplesTambem: true, ncm: '02099', match: 'inicia', descricao: 'Gordura de aves — Anexo X item 10',
      regime: 'antecip_encer', encerra: true, mva: { 4: 43.57, 7: 39.09, 12: 31.61, interna: 21.14 }, aliq: 19, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE art. 784, VIII c/c Anexo X, item 10 (NCM 0209 consta dos itens 9 e 10; a gordura de aves é 0209.90); alíquota 19% do art. 40, XIV; conferido no texto vigente do RICMS/SE (atualizado até o Dec. 1.536/2026) em 07/10/2026: o art. 784 alcança todo atacadista ou varejista, inclusive optante do Simples' },
    { id: "ax-toucinho", prioridade: 10, ncm: "0209", match: "inicia", descricao: "Toucinho/gordura suína — Anexo X item 9 (Dec. 756/2024)",
      regime: "antecip_encer", encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, item 9; art. 784, VI; alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    // 0210.99.00 está nos itens 5, 8, 9 E 10 — o que decide é o animal, então esta regra só pega o
    // que a descrição disser que é ave (frango defumado, peito de peru, galinha salgada...).
    { id: 'ax-aves-021099', prioridade: 10, simplesTambem: true, ncm: '021099', match: 'inicia',
      descricao: 'Carne de ave salgada, seca, defumada ou temperada (0210.99) — Anexo X item 10',
      descPadrao: 'FRANGO|GALINHA|GALO|AVE|AVES|PERU|CHESTER|CODORNA|PATO|GANSO|MARRECO|FILE DE PEITO|PEITO DE PERU|TENDER',
      descMatch: 'contem',
      regime: 'antecip_encer', encerra: true, mva: { 4: 43.57, 7: 39.09, 12: 31.61, interna: 21.14 }, aliq: 19, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE art. 784, VIII c/c Anexo X, item 10 (0210.99.00 consta dos itens 5, 8, 9 e 10 — aqui pela descrição de ave); alíquota 19% do art. 40, XIV; conferido no texto vigente do RICMS/SE (atualizado até o Dec. 1.536/2026) em 07/10/2026: o art. 784 alcança todo atacadista ou varejista, inclusive optante do Simples' },
    { id: 'ax-charque', prioridade: 30, ncm: '0210', match: 'inicia', descricao: 'Carne salgada/seca (charque, bacon, defumados) — Anexo X itens 5 e 9',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X, itens 5 e 9; art. 784, VI. O charque 0210.20 é cesta básica (art. 40, § 3º, XII) e tem regra própria, com prioridade maior. Alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    // Gorduras: 1501 = de porco e DE AVES (itens 9 e 10) · 1502 = bovina/ovina/caprina (itens 5 e 8).
    { id: 'ax-aves-1501', prioridade: 10, simplesTambem: true, ncm: '150190', match: 'inicia', descricao: 'Gordura de aves (1501.90) — Anexo X item 10',
      regime: 'antecip_encer', encerra: true, mva: { 4: 43.57, 7: 39.09, 12: 31.61, interna: 21.14 }, aliq: 19, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE art. 784, VIII c/c Anexo X, item 10 (NCM 1501); alíquota 19% do art. 40, XIV; FECOEP de 1 ponto pelo art. 40-D; conferido no texto vigente do RICMS/SE (atualizado até o Dec. 1.536/2026) em 07/10/2026: o art. 784 alcança todo atacadista ou varejista, inclusive optante do Simples' },
    { id: 'ax-banha', prioridade: 10, ncm: '1501', match: 'inicia', descricao: 'Banha e demais gorduras de porco (1501) — Anexo X item 9',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE art. 784, VI c/c Anexo X, item 9 (NCM 1501); alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    { id: 'ax-sebo', prioridade: 10, ncm: '1502', match: 'inicia', descricao: 'Gorduras bovina, ovina e caprina (sebo, 1502) — Anexo X itens 5 e 8',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE art. 784, VI c/c Anexo X, itens 5 (NCM 1502) e 8 (1502.10.19 e 1502.90.00); alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },
    // ---------------------------------------------------------------------------------------------
    // FRANGO VIVO (NCM 0105) — art. 784, III: "frangos vivos, mesmo que destinados a produtor".
    // É antecipação COM ENCERRAMENTO, e a base NÃO é o valor da nota: o art. 786, III manda usar o
    // VALOR DE PAUTA fixado pelo Secretário da Fazenda, acrescido de 20% de MVA. Como a pauta muda por
    // ato da SEFAZ, ela não fica gravada aqui — o motor avisa e você informa a pauta (coluna N) no item.
    // ---------------------------------------------------------------------------------------------
    { id: 'ax-frango-vivo', prioridade: 10, ncm: '0105', match: 'inicia', simplesTambem: true, exigePauta: true,
      descricao: 'Frango vivo / galinha viva (0105) — antecipação com encerramento sobre a PAUTA + MVA 20%',
      regime: 'antecip_encer', encerra: true, mva: 20, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE art. 784, III (frangos vivos, mesmo que destinados a produtor) e art. 786, III (base = valor de pauta + 20% de MVA); apuração pelo art. 788, com dedução do ICMS destacado. Alíquota 19% do art. 40, I; FECOEP de 1 ponto pelo art. 40-D' },

    // ---- Anexo X — material cerâmico de construção (item 11) ----
    ...['2505', '2507', '2517', '6901', '6904', '6905', '6907', '6908'].map(n => ({
      id: 'ax-ceramico-' + n, prioridade: 10, ncm: n, match: 'inicia',
      descricao: 'Material cerâmico/construção (areia, argila, brita, tijolo, telha, lajota) — Anexo X item 11',
      regime: 'antecip_encer', encerra: true, mva: { 4: 68.30, 7: 63.04, 12: 54.27, interna: 42 }, aliq: 19, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 11' })),

    // ---- Anexo X — calçados ----
    ...['6401', '6402', '6403', '6404', '6405'].map(n => ({
      id: 'ax-calcado-' + n, prioridade: 10, ncm: n, match: 'inicia',
      descricao: 'Calçados — Anexo X (MVA própria)',
      regime: 'antecip_encer', encerra: true, mva: { 4: 56.87, 7: 56.87, 12: 48.43, interna: 40 }, aliq: 19, fecoep: null, confirmar: true,
      fundamento: 'RICMS/SE Anexo X (calçados) — confirmar percentual vigente por região' })),

    // ---- Farinha de trigo / trigo (regime próprio art. 709-A) ----
    { id: 'trigo', prioridade: 10, ncm: '1001', match: 'inicia', descricao: 'Trigo em grão — regime próprio',
      regime: 'antecip_encer', encerra: true, mva: 33, aliq: 19, fecoep: 0, confirmar: true, fundamento: 'RICMS/SE art. 709-A; mapa SEFAZ receitas 7/8/9/13' },
    { id: 'farinha-trigo', prioridade: 10, ncm: '1101', match: 'inicia', descricao: 'Farinha de trigo — regime próprio (signatário/não signatário)',
      regime: 'antecip_encer', encerra: true, mva: 30, aliq: 12, fecoep: 0, confirmar: true, fundamento: 'RICMS/SE art. 709-A; Protocolo 46/2000' },

    // ---- Cesta básica (regime simplificado: optante paga 30% x carga; nao optante MVA 30%) ----
    // Carga de 12% -> optante 3,6% | carga de 7% -> optante 2,1% (validado no mapa da Mais Barato, jul/2026)
    // Lista OFICIAL: RICMS/SE art. 40, § 3º (PDF vigente, set/2026). Optante do Regime Simplificado (art. 787, I):
    //   3,6% para sabão em barra, leite em pó e charque; 2,1% para os demais. Não optante (art. 787, II): alíquota interna × base com MVA 30%.
    ...[
      ["1006", "Arroz branco, parboilizado ou integral", 2.1, "ARROZ"], ["0713", "Feijão", 2.1],
      ["0401", "Leite in natura / pasteurizado", 2.1], ["0402", "Leite em pó (exceto modificado)", 3.6],
      ["09012", "Café torrado e moído (exceto solúvel, gourmet e em cápsula)", 2.1], ["2501", "Sal refinado comum", 2.1],
      ["1507", "Óleo comestível de soja", 2.1], ["34011", "Sabão em barra", 3.6], ["0405", "Manteiga comum a granel ou em garrafa", 2.1, "GRANEL"],
      ["0406", "Queijo coalho / requeijão tipo queijo-manteiga", 2.1, "COALHO"], ["021020", "Charque", 3.6],
      ["1102", "Farinha e fubá de milho (pré-cozido)", 2.1, "MILHO|FUBA|FLOCAO|FLOCÃO|CUSCUZ|XEREM|CANJIC|MUNGUNZ"], ["1104", "Flocos de milho (flocão, cuscuz)", 2.1, "MILHO"],
      ["0302", "Pescado fresco (exceto os excluídos no art. 40, § 3º, XIV)", 2.1], ["0303", "Pescado congelado (exceto os excluídos)", 2.1], ["0304", "Filés de peixe (exceto os excluídos)", 2.1],
    ].map(([n, d, pct, pad]) => ({
      id: "cesta-" + n, prioridade: 20, ncm: n, match: "inicia", descricao: d + " — cesta básica (optante " + String(pct).replace(".", ",") + "%)",
      descPadrao: pad || null, descMatch: "contem",
      regime: "cesta", encerra: false, mva: null, aliq: 12, cestaPct: pct, fecoep: 0, confirmar: ["0302", "0303", "0304", "0406"].includes(n),
      fundamento: "RICMS/SE art. 40, VIII, b e § 3º (lista da cesta básica); art. 786, I; art. 787 (3,6% / 2,1%); FECOEP excluído (art. 616-C-A)" })),
    // ---- Informática: alíquota interna de 12% (RICMS/SE art. 40, IX — Lei 8.499/2018; lista do Anexo III do Regulamento) ----
    // Conferido no mapa da Central Net fev/2026: tablet 8471, processador 8542 e switch 8517.62 a 12%; cabo e fio 8544 ficam em 19%.
    // Os 23 itens do Anexo III vigente (Dec. 27.483/2010), na ordem do Regulamento. Alguns exigem a descrição porque o NCM
    // sozinho é mais amplo que o benefício (ex.: 3215 alcança tinta gráfica, mas o Anexo III só o refil de jato de tinta).
    ...[
      ['84145910', 'Mini ventiladores para montagem de microcomputadores', null],
      ['8443', 'Impressoras, copiadoras e fax; partes e acessórios', null],
      ['847050', 'Caixas registradoras eletrônicas', null],
      ['8471', 'Computadores, notebooks, tablets, mouses, teclados e unidades de processamento de dados', null],
      ['84729020', 'Máquinas de caixa de banco com autenticador', null],
      ['847330', 'Partes e acessórios de máquinas de processamento de dados (84.71)', null],
      ['847340', 'Partes e acessórios das máquinas da posição 84.72', null],
      ['847350', 'Partes e acessórios comuns às posições 84.69 a 84.72', null],
      ['85044040', 'Fontes de alimentação e conversores para informática', null],
      ['8517623', 'Comutadores (switches) de rede', null],
      ['8517624', 'Roteadores digitais, com ou sem fio', null],
      ['8517625', 'Hubs e modems', null],
      ['852351', 'Dispositivos de armazenamento não volátil (pen drive, cartão de memória, SSD)', null],
      ['85258029', 'Câmeras digitais de uso em informática', null],
      ['852589', 'Câmeras de vídeo e webcams (numeração da NCM 2022 para o antigo 8525.80)', null],
      ['85284', 'Monitores com tubo de raios catódicos', null],
      ['85285', 'Outros monitores', null],
      ['85340000', 'Circuitos impressos', null],
      ['8542', 'Circuitos integrados eletrônicos (processadores, memórias)', null],
      ['9032891', 'Estabilizadores de corrente e cooler para microcomputadores', null],
      ['3215', 'Tinta refil para cartucho de impressora jato de tinta', 'REFIL|CARTUCHO|JATO|IMPRESSORA|EPSON|CANON|BROTHER|LEXMARK|HP '],
      ['96121090', 'Cartuchos de tinta para jato de tinta e fitas para impressoras matriciais', null],
      ['4811', 'Bobinas térmicas para fax e impressoras de automação comercial', 'BOBINA|TERMIC|TÉRMIC'],
      ['482040', 'Formulários contínuos para impressoras matriciais', null],
    ].map(([n, d, pad]) => ({
      id: 'info-' + n, prioridade: 22, ncm: n, match: 'inicia', simplesTambem: true,
      descricao: d + ' — produto de informática do Anexo III: alíquota interna 12%',
      descPadrao: pad || null, descMatch: 'contem',
      // FECOEP: informática NÃO está no art. 40-C (2 pontos) nem nas exclusões dos arts. 616-C-A e
      // 616-C-B, então cai na regra geral do art. 40-D: 1 ponto. Confirmado nas planilhas de FCP da
      // Central Net de fev, mai, jun e ago/2026, em que a base do fundo é a soma da coluna K do mapa
      // inteiro, com as linhas de 12% incluídas.
      regime: null, encerra: false, mva: null, aliq: 12, fecoep: null, confirmar: false,
      fundamento: 'RICMS/SE art. 40, IX (Lei 8.499/2018) c/c Anexo III do Regulamento (Dec. 27.483/2010) — produto ou material de informática, alíquota interna de 12%; FECOEP de 1 ponto pelo art. 40-D' })),
    // ---------------------------------------------------------------------------------------------
    // MATERIAL ESCOLAR SEM FECOEP — RICMS/SE, art. 616-C-A, IV, "c" (Dec. 289/2023): o adicional de
    // 1 ponto não incide nos 17 itens listados abaixo. A lista é TAXATIVA e por DESCRIÇÃO, não por
    // NCM, então cada regra casa o NCM e confere o nome do produto. Só mexe no FECOEP: alíquota,
    // MVA e receita seguem a regra geral. Calibrado com a planilha de FCP da Faro Tem fev/2026, em
    // que a base do fundo exclui exatamente caderno, borracha, giz de cera, massa de modelar, cola,
    // estojo, régua e kit escolar, e mantém bloco de rascunho, bloco adesivo, prancheta e porta-canetas.
    ...[
      ['esc-agenda', '4820', 'AGENDA', 'Agenda escolar', false],
      ['esc-apontador', '8214', 'APONTADOR', 'Apontador de lápis', false],
      ['esc-borracha', '4016', 'BORRACHA', 'Borracha de apagar, inclusive caneta e lápis borracha', false, 'TAPETE|MANGUEIRA|VEDA|CORREIA|\\bLUVA|PNEU|CAMARA DE AR|BORRACHA DE VEDA|PERFIL|BUCHA|COXIM'],
      ['esc-caderno', '482020', null, 'Caderno', false],
      ['esc-caneta', '960810', null, 'Caneta esferográfica', false],
      ['esc-cartolina', '4802', 'CARTOLINA|PAPEL CARTAO|PAPEL CARTÃO', 'Cartolina escolar e papel cartão', false],
      ['esc-cartolina2', '4805', 'CARTOLINA|PAPEL CARTAO|PAPEL CARTÃO', 'Cartolina escolar e papel cartão', false],
      ['esc-cartolina3', '4810', 'CARTOLINA|PAPEL CARTAO|PAPEL CARTÃO', 'Cartolina escolar e papel cartão', false],
      ['esc-classificador', '4820', 'CLASSIFICADOR', 'Classificador', false],
      // A lei fala em "cola escolar, branca e colorida, em bastão ou líquida": cola instantânea,
      // epóxi, de contato, para madeira ou cano não é cola escolar e continua com o adicional.
      ['esc-cola', '350610', 'COLA', 'Cola escolar, branca ou colorida, em bastão ou líquida', false,
        'INSTANTAN|INSTANTÂN|CIANOACRIL|SUPER ?BONDER|EPOXI|EPÓXI|CONTATO|SAPATEIR|MADEIRA|\\bPVC\\b|CANO|SILICONE|TENIS|TÊNIS|EXTRA FORTE|ADESIVO ESTRUTURAL'],
      ['esc-corretivo', '3824', 'CORRETIVO', 'Corretivo', false],
      ['esc-corretivo2', '9612', 'CORRETIVO', 'Corretivo (fita)', true],
      ['esc-estojo', '3926', 'ESTOJO', 'Estojo escolar / estojo para objetos de escrita', false],
      ['esc-estojo2', '4202', 'ESTOJO', 'Estojo escolar / estojo para objetos de escrita', false],
      ['esc-lapis', '9609', 'LAPIS|LÁPIS|GIZ|CRAYON|CERA', 'Lápis, giz de cera e similares', true],
      ['esc-lapiseira', '960840', null, 'Lapiseira', false],
      ['esc-modelar', '3407', 'MODELAR|MASSINHA', 'Massa ou pasta para modelar, própria para recreação de crianças', false],
      ['esc-celofane', '3920', 'CELOFANE', 'Papel celofane', false],
      ['esc-celofane2', '4823', 'CELOFANE', 'Papel celofane', false],
      ['esc-pincel', '960330', null, 'Pincel de escrever e desenhar', false],
      ['esc-regua', '901720', 'REGUA|RÉGUA|KIT ESCOLAR|ESQUADRO|TRANSFERIDOR|COMPASSO', 'Régua (e kit escolar de desenho)', true],
      ['esc-guache', '3213', 'GUACHE', 'Tinta guache', false],
    ].map(([id, ncm, pad, d, conf, excl]) => ({
      id, prioridade: 18, ncm, match: 'inicia', simplesTambem: true,
      descricao: d + ' — material escolar SEM o adicional do FECOEP',
      descPadrao: pad, descMatch: 'contem', descExcluir: excl || null,
      regime: null, encerra: false, mva: null, aliq: null, fecoep: 0, confirmar: conf,
      fundamento: 'RICMS/SE, art. 616-C-A, IV, "c" (Dec. 289/2023) — o adicional de 1 ponto do FECOEP não incide sobre este material escolar' + (conf ? '. Item enquadrado pela prática do escritório: confirme se a descrição da lista alcança este produto' : '') })),
    // Cosméticos e perfumaria: alíquota interna 25% (Lei 3.796/96, art. 18); FECOEP +2 só nos extratos de perfume 3303.00.10 (Dec. 295/2023)
    ...["3304", "3305", "3307"].map(n => ({ id: "cosm-" + n, prioridade: 20, ncm: n, match: "inicia", descricao: "Produtos de beleza/maquiagem/capilares — alíquota 25% + FECOEP 2 pontos", regime: null, mva: null, aliq: 25, fecoep: 2, confirmar: false, fundamento: "RICMS/SE, art. 40, VII-A, alineas e, f e g (25% desde 01/01/2024, Lei 9.176/2023). FECOEP: o art. 40-C so lista o perfume-extrato 3303.00.10 entre os de 2 pontos, mas o escritorio aplica 2 pontos tambem nos cosmeticos — confirmado no mapa e na planilha de FCP da Faro Tem de jul/2026, nota 699 (NCM 3304.10.00, 25% e 2% de FCP). Pela letra do art. 40-D seria 1 ponto" })),
    // Escova dental (HPPC, CEST 20.058.00): antecipação com encerramento — MVA aplicada no mapa da Faro Tem (69,66% na origem 4%)
    { id: "hppc-escova", prioridade: 15, ncm: "96032100", match: "igual", simplesTambem: true, descricao: "Escova de dentes (HPPC, CEST 20.058.00) — ST com encerramento", regime: "antecip_encer", encerra: true, mva: { 4: 69.66, 7: 64.25, 12: 55.44, interna: 43.15 }, aliq: 19, fecoep: null, confirmar: true, fundamento: "RICMS/SE Anexo IX (HPPC) c/c art. 784, II — MVA conforme mapa do escritório (Faro Tem jul/2026); confirmar MVA original" },
    // Ração tipo pet (2309, CEST 22.001.00): ST com encerramento — MVA e FECOEP (2 pontos) da planilha oficial de ST de SE, conferidos no mapa da
    // J C de Lira mar/2026 (Qualy, NF 775607/775608: 77,42% na origem 4% e 62,63% na origem 12%). Vale no Simples. Ração/suplemento para
    // criação (suíno, bovino, aves…) e itens com base reduzida na origem (Conv. 100/97) são tratados antes, no motor, como insumo isento.
    // A ST do CEST 22.001.00 alcança "ração tipo pet", não suplemento/vitamina: por isso a DESCRIÇÃO exclui os itens abaixo mesmo quando
    // o emitente carimba o CEST de ração (Qualy, J C de Lira mai e jun/2026 — Glicopan, Hemolitan, Pet Milk, Probioup).
    { id: "rac-pet", prioridade: 15, ncm: "2309", match: "inicia", simplesTambem: true, descricao: "Ração tipo pet para animais domésticos (CEST 22.001.00) — ST com encerramento, alíquota 19% + FECOEP 2 pontos",
      descExcluir: "SUPLEMENT|VITAMIN|POLIVIT|PROBIO|SIMBIO|PREBIO|AMINO|MINERAL|FORTIFICANT|ENERGETIC|TONICO|GLICOPAN|HEMOLITAN|ORGANOMIX|POTENAY|MONOFOSFATO|OMEGA|CONDROIT|GLICOSAMIN|COLAGENO|LEVEDURA|PALATAN|\\bGOTAS\\b|XAROPE|SUSPENSAO|AMPOLA|COMPRIMID|CAPSULA|\\bPASTA\\b|\\bGEL\\b|EMULSAO|\\bMILK\\b|\\bLEITE\\b|\\d+\\s*ML\\b",
      regime: "antecip_encer", encerra: true, mva: { 4: 77.42, 7: 71.87, 12: 62.63, interna: 46 }, aliq: 19, fecoep: 2, confirmar: false, fundamento: "RICMS/SE art. 681, XIV e Anexo IX, Tabela I, item 43; Protocolo ICMS 26/2004 — MVA e FECOEP da planilha oficial de ST de SE (v0019). A ST alcança ração tipo pet: suplemento, vitamina e similares ficam fora, mesmo com o CEST de ração na nota" },
    // Fraldas, absorventes e tampões (9619, HPPC, CEST 20.048.00 a 20.050.00): ST com encerramento — MVA da planilha oficial de ST de SE (v0019),
    // conferida no mapa da Mais Barato mai/2026 (Bracell, NF 136200: MVA 55,52% na origem 12%) e no espelho da SEFAZ
    { id: "hppc-fraldas", prioridade: 15, ncm: "9619", match: "inicia", simplesTambem: true, descricao: "Fraldas, absorventes e tampões higiênicos (HPPC, CEST 20.048.00 a 20.050.00) — ST com encerramento", regime: "antecip_encer", encerra: true, mva: { 4: 69.66, 7: 64.35, 12: 55.52, interna: 41.38 }, aliq: 19, fecoep: null, confirmar: false, fundamento: "RICMS/SE art. 681, XXVII e art. 684, §§ 4º-D e 4º-E, XXV (Anexo IX, HPPC) c/c art. 784, II — MVA da planilha oficial de ST de SE v0019" },
    // Salgadinhos de trigo (1905.90.90, CEST 17.031.01): pratica do escritorio — antecipacao com encerramento, MVA 35%
    { id: "salg-trigo", prioridade: 15, ncm: "19059090", match: "igual", simplesTambem: true, descPadrao: "SALG", descMatch: "inicia", descricao: "Salgadinho de trigo (CEST 17.031.01) — ST com encerramento, MVA 35%",
      regime: "antecip_encer", encerra: true, mva: 35, aliq: 19, fecoep: null, confirmar: true, fundamento: "RICMS/SE Anexo IX (Alimenticios) — MVA 35% conforme mapa da Mais Barato jul/2026; confirmar" },

    // ---------------------------------------------------------------------------------------------
    // BISCOITOS E BOLACHAS (1905) — prática do escritório (out/2026) + RICMS/SE arts. 720-A a 720-G
    // (Prot. ICMS 53/2017, derivados de farinha de trigo, CEST 17.047.01 a 17.064.00).
    //   • INDUSTRIALIZADO (biscoito, bolacha, cookie, wafer, rosquinha, cracker) é SUBSTITUÍDO: entrada
    //     interestadual de UF NÃO signatária → antecipação COM encerramento (art. 720-C), base = preço +
    //     frete/IPI/encargos + MVA do art. 720-D, II, "b": 45%. Se vier de UF signatária (AL, BA, CE,
    //     PB, PE, PI, RN) o remetente já deve ter retido (art. 720-A, CST 10/60 → não antecipada); se não
    //     reteve, a MVA é a do inciso I, "b": 30%. Alíquota interna 19% (art. 720-F), crédito do destacado
    //     (art. 720-G). Vale também no Simples (art. 784, II). Pão e massa (20%/35%) não entram aqui.
    //   • CASEIRO (polvilho, sequilho, goma, avoador, beiju, "caseiro") é TRIBUTADO pela regra geral:
    //     não é produto industrializado de farinha de trigo, então fica fora da ST. A regra vem antes
    //     (prioridade 14) e com semSt:true, para o aviso da planilha do Portal da ST não aparecer.
    // ---------------------------------------------------------------------------------------------
    { id: "bisc-caseiro", prioridade: 14, ncm: "1905", match: "inicia", simplesTambem: false, semSt: true,
      descPadrao: "POLVILHO|SEQUILHO|CASEIRO|CASEIRA|AVOADOR|GOMA|BEIJU|TAPIOCA|ARTESANAL", descMatch: "contem",
      descricao: "Biscoito caseiro — polvilho, sequilho, goma, avoador, beiju (1905): TRIBUTADO pela regra geral, não é substituído",
      regime: null, mva: null, aliq: null, fecoep: null, confirmar: false,
      fundamento: "Prática do escritório (out/2026): biscoito caseiro não é derivado industrializado de farinha de trigo, então fica fora da ST dos arts. 720-A a 720-G do RICMS/SE (Prot. ICMS 53/2017) e segue a receita normal da empresa (antecipação sem encerramento no regime normal; complementação no Simples)" },
    ...[
      // [ncm, match, descrição, CEST, padrão na descrição (null = qualquer produto do NCM)]
      ["190531", "inicia", "Biscoitos e bolachas com edulcorante (1905.31)", "17.053.00 a 17.053.02", null],
      ["190532", "inicia", "Waffles e wafers (1905.32)", "17.057.00 e 17.058.00", null],
      ["19059020", "igual", "Bolachas (1905.90.20)", "17.056.00 e 17.056.02", null],
      ["19059090", "igual", "Biscoito/bolacha classificado em 1905.90.90 (pelo nome do produto)", "17.056.02", "BISCOITO|BISC.|BISC |BOLACHA|COOKIE|ROSQUINHA|CRACKER|WAFER|RECHEAD|MARIA|MAISENA|MAIZENA"],
    ].map(([n, mt, d, cest, pad]) => ({
      id: "bisc-ind-" + n, prioridade: 15, ncm: n, match: mt, simplesTambem: true, descPadrao: pad, descMatch: pad ? "contem" : undefined,
      descricao: d + " — INDUSTRIALIZADO, substituído: antecipação com encerramento, MVA 45% (UF não signatária) / 30% (signatária)",
      regime: "antecip_encer", encerra: true, mva: 45, mvaUf: { ufs: ["AL", "BA", "CE", "PB", "PE", "PI", "RN"], mva: 30, motivo: "UF signatária do Prot. ICMS 53/2017 (art. 720-D, I, b)" },
      aliq: 19, fecoep: null, cest: cest, confirmar: false,
      fundamento: "RICMS/SE art. 720-C (antecipação com encerramento na entrada de UF não signatária), art. 720-D, II, b (MVA 45%) e I, b (30%, UF signatária: AL, BA, CE, PB, PE, PI e RN), arts. 720-F e 720-G; Prot. ICMS 53/2017; CEST " + cest + ". Prática do escritório (out/2026): só o biscoito industrializado é substituído; o caseiro (polvilho, sequilho) é tributado" })),

    // ---- Supérfluos: três faixas distintas desde 01/01/2024 (Lei 9.176/2023) ----
    // 25% = art. 40, VII-A · 28% = art. 40, VII-B · demais = alíquota modal de 19% (inciso I).
    // O FECOEP é outra conta: 2 pontos só nos produtos do art. 40-C; o resto leva 1 ponto (art. 40-D).
    // Há produto de 28% sem os 2 pontos (cachimbo, aeronave) e produto de 19% com 2 pontos (cigarro,
    // refrigerante, energético), por isso alíquota e adicional vêm separados em cada regra.
    ...[
      // [id, ncm, descrição, alíquota, pontos de FECOEP, padrão de descrição, confirmar]
      ['2203', 'Cerveja e chope', 25, 2, null, false],
      ['2204', 'Vinho', 25, 2, null, false],
      ['2205', 'Vermute', 25, 2, null, false],
      ['2206', 'Sidra e demais fermentados', 25, 2, null, false],
      ['2207', 'Álcool etílico não desnaturado', 25, 2, null, true],
      ['2208', 'Destilados (cachaça, vodca, uísque)', 25, 2, null, false],
      ['33030010', 'Perfume (extrato)', 25, 2, null, false],
      ['33030020', 'Água de colônia', 25, 1, null, true],
      ['950621', 'Prancha a vela', 25, 2, null, false],
      ['95042', 'Jogo eletrônico de vídeo, partes e acessórios', 25, 2, null, false],
      ['950440', 'Cartas para jogar', 25, 2, null, false],
      ['950651', 'Raquete de tênis', 25, 2, null, false],
      ['950661', 'Bola de tênis', 25, 2, null, false],
      ['8801', 'Ultraleve (asa-delta, balão, dirigível) e suas partes', 28, 2, null, false],
      ['8903', 'Embarcação de esporte e recreio', 28, 2, null, false],
      ['9301', 'Armamento militar', 28, 2, null, false],
      ['9302', 'Revólver e pistola', 28, 2, null, false],
      ['9303', 'Arma de fogo por deflagração de pólvora', 28, 2, null, false],
      ['9304', 'Outras armas (ar comprimido, mola, gás)', 28, 2, null, false],
      ['9306', 'Munição', 28, 2, null, false],
      ['7113', 'Artefato de joalharia', 28, 2, null, false],
      ['7114', 'Artefato de ourivesaria', 28, 2, null, false],
      ['7115', 'Outras obras de metal precioso', 28, 1, null, true],
      ['7116', 'Obra de pérola ou pedra preciosa', 28, 2, null, false],
      ['7117', 'Bijuteria e semijoia', 28, 2, null, false],
      ['9614', 'Cachimbo e piteira', 28, 1, null, true],
      ['3601', 'Pólvora propulsiva', 28, 2, null, false],
      ['3602', 'Explosivo preparado', 28, 2, null, false],
      ['3603', 'Estopim, cordel detonante, espoleta, detonador', 28, 2, null, false],
      ['360410', 'Fogos de artifício', 28, 2, null, false],
      ['36049090', 'Bomba, busca-pé, estalo, foguete e semelhantes', 28, 2, null, false],
      ['8802', 'Avião, helicóptero e demais aeronaves de uso não comercial', 28, 1, null, true],
      // 19% com 2 pontos de FECOEP: o produto está no art. 40-C mas fora das faixas de 25% e 28%
      ['2402', 'Cigarro, cigarrilha e charuto', null, 2, null, true],
      ['2403', 'Fumo industrializado', null, 2, null, true],
      ['220210', 'Refrigerante e água gaseificada com açúcar ou aromatizada', null, 2, null, false],
      ['2202', 'Isotônico e energético', null, 2, 'ISOTONIC|ISOTÔNIC|ENERGETIC|ENERGÉTIC|ENERGY', false],
    ].map(([n, d, aliq, fec, pad, conf]) => ({
      id: 'sup-' + n, prioridade: 20, ncm: n, match: 'inicia', descPadrao: pad, descMatch: 'contem',
      descricao: d + ' — ' + (aliq ? 'alíquota interna ' + aliq + '%' : 'alíquota modal') + (fec ? ' + FECOEP ' + fec + (fec > 1 ? ' pontos' : ' ponto') : ''),
      regime: null, encerra: false, mva: null, aliq, fecoep: fec, confirmar: conf,
      fundamento: 'RICMS/SE, art. 40, ' + (aliq === 25 ? 'VII-A (25% desde 01/01/2024)' : aliq === 28 ? 'VII-B (28% desde 01/01/2024)' : 'I (19%)') + '; FECOEP de ' + fec + (fec > 1 ? ' pontos pelo art. 40-C' : ' ponto pelo art. 40-D') + ' (Lei 9.176/2023)' })),
    // Jet ski e esqui aquático dividem a NCM 9506.29.00 com a prancha de surfe, mas ficam em faixas
    // diferentes: a prancha é 25% (art. 40, VII-A, "b") e o jet ski é 28% (VII-B, "b", item 6).
    { id: 'sup-jetski', prioridade: 19, ncm: '950629', match: 'inicia', descPadrao: 'JET SKI|JETSKI|JET-SKI|ESQUI AQUAT|ESQUI AQUÁT', descMatch: 'contem',
      descricao: 'Jet ski e esqui aquático — alíquota interna 28% + FECOEP 2 pontos', regime: null, encerra: false, mva: null, aliq: 28, fecoep: 2, confirmar: false,
      fundamento: 'RICMS/SE, art. 40, VII-B, "b", item 6 (28%); art. 40-C, VI (2 pontos)' },
    { id: 'sup-surfe', prioridade: 20, ncm: '950629', match: 'inicia',
      descricao: 'Prancha de surfe — alíquota interna 25% + FECOEP 2 pontos', regime: null, encerra: false, mva: null, aliq: 25, fecoep: 2, confirmar: false,
      fundamento: 'RICMS/SE, art. 40, VII-A, "b" (25%); art. 40-C, XIV (2 pontos)' },

    // ---- Medicamentos: FECOEP excluído ----
    { id: 'medic-3003', prioridade: 20, ncm: '3003', match: 'inicia', descricao: 'Medicamentos — FECOEP excluído', regime: null, mva: null, aliq: 19, fecoep: 0, confirmar: true, fundamento: 'Dec. 289/2023 (exclusões do FECOEP)' },
    { id: 'medic-3004', prioridade: 20, ncm: '3004', match: 'inicia', descricao: 'Medicamentos — FECOEP excluído', regime: null, mva: null, aliq: 19, fecoep: 0, confirmar: true, fundamento: 'Dec. 289/2023 (exclusões do FECOEP)' },

    // ---- Combustíveis: monofásico ad rem, não usar % ----
    { id: 'comb-2710', prioridade: 5, ncm: '2710', match: 'inicia', descricao: 'Combustíveis — ICMS monofásico ad rem (Convênio CONFAZ), não antecipar por %',
      regime: 'nao_antecipa', mva: null, aliq: null, fecoep: 0, confirmar: true, fundamento: 'LC 192/2022; Convênio ICMS 199/2022' },

  ],

  // Descrição amigável dos grupos de CFOP (para a memória de cálculo)
  descCfop: {
    revenda: 'Compra para comercialização (revenda)',
    ativo: 'Compra para ativo imobilizado → DIFAL',
    usoConsumo: 'Compra para uso/consumo → DIFAL',
    industrializacao: 'Industrialização por encomenda — não antecipa',
    bonificacao: 'Bonificação/brinde — tratar como entrada tributada (confirmar)',
    devolucao: 'Devolução — não antecipa',
    remessaRetorno: 'Remessa/retorno (69xx) — não antecipa',
    stRetida: 'Venda com ST retida na origem (64xx) — não antecipa',
    outro: 'CFOP não mapeado — conferir',
  },
};
