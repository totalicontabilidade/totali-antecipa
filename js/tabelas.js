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
    // ---- Anexo X — carnes (Decreto 717/2024) ----
    { id: 'ax-carne-bov', prioridade: 10, ncm: '0201', match: 'inicia', descricao: 'Carne bovina fresca/refrigerada — Anexo X item 6',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 6 (Dec. 717/2024); cesta básica art. 40' },
    { id: 'ax-carne-bov2', prioridade: 10, ncm: '0202', match: 'inicia', descricao: 'Carne bovina congelada — Anexo X item 6',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 6' },
    { id: "ax-suino", prioridade: 10, ncm: "0203", match: "inicia", descricao: "Carne suína — Anexo X item 9 (Dec. 756/2024)",
      regime: "antecip_encer", encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: "RICMS/SE Anexo X, item 9 (CEST 17.087.01; Decreto 756/2024)" },
    { id: 'ax-ovina', prioridade: 10, ncm: '0204', match: 'inicia', descricao: 'Carne ovina/caprina — Anexo X itens 6-8',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, itens 6 a 8' },
    { id: 'ax-miudos', prioridade: 10, ncm: '0206', match: 'inicia', descricao: 'Miudezas comestíveis — Anexo X',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, itens 6 a 9' },
    { id: 'ax-aves', prioridade: 10, ncm: '0207', match: 'inicia', descricao: 'Carne de aves (frango) — Anexo X item 10',
      regime: 'antecip_encer', encerra: true, mva: { 4: 43.57, 7: 39.09, 12: 31.61, interna: 21.14 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 10' },
    { id: "ax-toucinho", prioridade: 10, ncm: "0209", match: "inicia", descricao: "Toucinho/gordura suína — Anexo X item 9 (Dec. 756/2024)",
      regime: "antecip_encer", encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 9' },
    { id: 'ax-charque', prioridade: 30, ncm: '0210', match: 'inicia', descricao: 'Carne salgada/seca (charque) — Anexo X item 5',
      regime: 'antecip_encer', encerra: true, mva: { 4: 30.37, 7: 26.30, 12: 19.51, interna: 10 }, aliq: 12, fecoep: 0, confirmar: false,
      fundamento: 'RICMS/SE Anexo X, item 5' },

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
    // Cosméticos e perfumaria: alíquota interna 25% (Lei 3.796/96, art. 18); FECOEP +2 só nos extratos de perfume 3303.00.10 (Dec. 295/2023)
    { id: "cosm-3303", prioridade: 20, ncm: "3303", match: "inicia", descricao: "Perfumes e águas-de-colônia — alíquota 25%", regime: null, mva: null, aliq: 25, fecoep: 2, confirmar: true, fundamento: "Lei 3.796/96 art. 18 (25%); Dec. 295/2023 (+2 pts nos extratos 3303.00.10)" },
    ...["3304", "3305", "3307"].map(n => ({ id: "cosm-" + n, prioridade: 20, ncm: n, match: "inicia", descricao: "Produtos de beleza/maquiagem/capilares — alíquota 25% + FECOEP 2 pontos", regime: null, mva: null, aliq: 25, fecoep: 2, confirmar: false, fundamento: "Lei 3.796/96 art. 18 (produtos de beleza 25%); Lei 4.731/2002 (supérfluos +2 pts) — validado no mapa e na planilha de FCP da Faro Tem jul/2026" })),
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

    // ---- Supérfluos (25% + 2 pontos FECOEP) ----
    ...[
      ['2203', 'Cerveja e chope'], ['2204', 'Vinho'], ['2205', 'Vermute'], ['2206', 'Sidra/bebidas fermentadas'],
      ['2207', 'Álcool etílico (bebida)'], ['2208', 'Destilados (cachaça, vodka, uísque)'],
      ['2402', 'Cigarros/charutos'], ['2403', 'Fumo'], ['9301', 'Armas'], ['9302', 'Revólveres e pistolas'],
      ['9303', 'Armas de fogo'], ['9304', 'Outras armas'], ['9306', 'Munições'], ['7113', 'Joias'], ['7114', 'Ourivesaria'],
      ['7116', 'Obras de pérolas/pedras'], ['3303', 'Perfumes'], ['8903', 'Embarcações de esporte/recreio'],
    ].map(([n, d]) => ({
      id: 'sup-' + n, prioridade: 20, ncm: n, match: 'inicia', descricao: d + ' — supérfluo (alíquota 25% + FECOEP 2 pts)',
      regime: null, encerra: false, mva: null, aliq: 25, fecoep: 2, confirmar: true,
      fundamento: 'Lei 3.796/96 arts. 40 e 40-A; Decreto 295/2023' })),

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
