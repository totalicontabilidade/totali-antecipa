/* =====================================================================
   Totali Antecipa — CNAE × finalidade da entrada
   ---------------------------------------------------------------------
   Com os CNAEs da empresa (Receita Federal) o sistema SUPÕE, item a item,
   se a compra é para REVENDA, USO/CONSUMO ou ATIVO IMOBILIZADO:
     1. NCM em lista típica de imobilizado/uso-consumo → sugere essa finalidade,
        salvo se o NCM for do ramo da empresa (aí é revenda).
     2. NCM fora das famílias que a empresa vende (pelo CNAE) → sugere uso/consumo
        (confiança menor).
   É sugestão: só vira cálculo se o usuário aplicar (ou no modo "aplicar" dos
   Parâmetros). O CFOP explícito (6556/6551) continua mandando.
   ===================================================================== */

const CNAE_FAMILIAS = [
  // [prefixo CNAE (sem pontos), descrição, capítulos/prefixos NCM que a empresa revende]
  ['4711', 'Hipermercados e supermercados', ['01','02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23','24','25','27','30','33','34','35','38','39','40','42','44','48','49','61','62','63','64','65','66','67','69','70','73','76','82','83','84','85','87','90','91','94','95','96']],
  ['4712', 'Minimercados, mercearias e armazéns', ['01','02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23','24','33','34','38','39','48','96']],
  ['4721', 'Padarias, confeitarias, laticínios e doces', ['04','07','08','09','10','11','15','16','17','18','19','20','21','22']],
  ['4722', 'Açougues e peixarias', ['02','03','05','15','16','20','21']],
  ['4723', 'Bebidas', ['20','21','22']],
  ['4724', 'Hortifrutigranjeiros', ['06','07','08','04','10','12']],
  ['4729', 'Alimentos em geral', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23']],
  ['4731', 'Combustíveis para veículos', ['27','34','38','40']],
  ['4732', 'Lubrificantes', ['27','34','38']],
  ['4741', 'Tintas e materiais para pintura', ['32','34','38','39','44','59','68','96']],
  ['4742', 'Material elétrico', ['39','73','74','76','83','84','85','90','94']],
  ['4743', 'Vidros', ['70']],
  ['4744', 'Ferragens, madeira e materiais de construção', ['25','27','28','32','34','38','39','40','44','48','56','59','68','69','70','72','73','74','76','78','79','82','83','84','85','90','94','96']],
  ['4751', 'Informática', ['84','85','90','94']],
  ['4752', 'Telefonia e comunicação', ['85']],
  ['4753', 'Eletrodomésticos e áudio/vídeo', ['84','85','90','94']],
  ['4754', 'Móveis, colchões e iluminação', ['94','83','70','44']],
  ['4755', 'Tecidos e armarinho', ['50','51','52','53','54','55','56','58','59','60','96']],
  ['4756', 'Instrumentos musicais', ['92']],
  ['4757', 'Peças para eletrodomésticos', ['84','85']],
  ['4759', 'Artigos de uso doméstico', ['39','44','48','69','70','73','76','82','83','84','85','94','96']],
  ['4761', 'Livros, jornais e papelaria', ['48','49','39','96','32']],
  ['4762', 'Discos e filmes', ['85']],
  ['4763', 'Brinquedos, esporte e artigos recreativos', ['95','87','61','62','64','42','39']],
  ['4771', 'Farmácias e drogarias', ['30','33','34','38','39','40','48','90','96','21','22','04','17','19']],
  ['4772', 'Cosméticos e perfumaria', ['33','34','96','39']],
  ['4773', 'Artigos médicos e ortopédicos', ['30','90','39','40']],
  ['4774', 'Óticas', ['90']],
  ['4781', 'Vestuário', ['61','62','63','64','65','42']],
  ['4782', 'Calçados', ['64','42']],
  ['4783', 'Joalheria e relojoaria', ['71','91']],
  ['4784', 'Gás liquefeito (GLP)', ['27','73']],
  ['4785', 'Antiguidades e usados', []],
  ['4789', 'Outros produtos novos', []],
  ['4530', 'Autopeças e acessórios', ['27','34','38','39','40','68','70','73','83','84','85','87','90','94']],
  ['4541', 'Motocicletas e peças', ['87','40','84','85']],
  ['4511', 'Automóveis', ['87']],
  ['4611', 'Representantes/agentes (sem estoque)', []],
  ['4631', 'Atacado de leite e laticínios', ['04']],
  ['4632', 'Atacado de cereais e leguminosas', ['10','07','11']],
  ['4633', 'Atacado de hortifrúti', ['06','07','08','04']],
  ['4634', 'Atacado de carnes e pescados', ['02','03','16']],
  ['4635', 'Atacado de bebidas', ['20','21','22']],
  ['4636', 'Atacado de fumo', ['24']],
  ['4637', 'Atacado de alimentos', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23']],
  ['4639', 'Atacado de alimentos em geral', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23']],
  ['4641', 'Atacado de tecidos e armarinho', ['50','51','52','53','54','55','56','58','59','60']],
  ['4642', 'Atacado de vestuário', ['61','62','63','65']],
  ['4643', 'Atacado de calçados', ['64','42']],
  ['4644', 'Atacado de medicamentos', ['30']],
  ['4645', 'Atacado de instrumentos médicos', ['90','30','39','40']],
  ['4646', 'Atacado de cosméticos e higiene', ['33','34','96']],
  ['4647', 'Atacado de papelaria e livros', ['48','49']],
  ['4649', 'Atacado de utilidades domésticas', ['39','44','69','70','73','76','82','84','85','94','96']],
  ['4651', 'Atacado de informática', ['84','85']],
  ['4652', 'Atacado de telefonia', ['85']],
  ['4661', 'Atacado de máquinas agrícolas', ['84','87']],
  ['4662', 'Atacado de máquinas para indústria', ['84','85','90']],
  ['4663', 'Atacado de máquinas para construção', ['84']],
  ['4664', 'Atacado de máquinas odonto/médicas', ['90']],
  ['4665', 'Atacado de máquinas para comércio', ['84','85']],
  ['4669', 'Atacado de outras máquinas', ['84','85','90']],
  ['4671', 'Atacado de madeira', ['44']],
  ['4672', 'Atacado de ferragens', ['72','73','82','83','84']],
  ['4673', 'Atacado de material elétrico', ['85','39','73','74','76','94']],
  ['4674', 'Atacado de cimento', ['25','68']],
  ['4679', 'Atacado de materiais de construção', ['25','28','32','38','39','44','68','69','70','72','73','74','76','82','83','84','85','94']],
  ['4681', 'Atacado de combustíveis', ['27']],
  ['4682', 'Atacado de GLP', ['27']],
  ['4683', 'Atacado de defensivos e adubos', ['31','38']],
  ['4684', 'Atacado de produtos químicos', ['28','29','32','34','38','39']],
  ['4685', 'Atacado de resíduos', []],
  ['4686', 'Atacado de papel e embalagens', ['48','39']],
  ['4687', 'Atacado de resíduos e sucatas', ['72','74','76']],
  ['4689', 'Atacado de outros produtos', []],
  ['4691', 'Atacado de mercadorias em geral (alimentos)', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22','23','33','34','38','39','48','96']],
  ['4692', 'Atacado de mercadorias em geral', []],
  ['4693', 'Atacado de mercadorias em geral (sem alimentos)', []],
  ['5611', 'Restaurantes e similares', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22']],
  ['5612', 'Serviços ambulantes de alimentação', ['02','04','07','10','11','15','16','17','18','19','20','21','22']],
  ['5620', 'Fornecimento de alimentos preparados', ['02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21','22']],
  ['6110', 'Telecomunicações por fio', ['85']],
  ['6120', 'Telecomunicações sem fio', ['85']],
  ['6190', 'Outras telecomunicações (provedor)', ['85']],
  ['4713', 'Lojas de departamentos / variedades', []],
];

// NCM (prefixos) que, em regra, são ATIVO IMOBILIZADO num comércio (salvo se for o ramo da empresa)
const NCM_IMOBILIZADO = ['8418', '8415', '8414', '8419', '8422', '8423', '8428', '8438', '8443', '8450', '8451', '8452', '8467', '8470', '8471', '8472', '8473', '8476', '8479', '8501', '8504', '8508', '8509', '8516', '8517', '8518', '8521', '8525', '8528', '8531', '8536', '8537', '8543', '9006', '9403', '9401', '9405', '8716', '8703', '8704', '8711', '8427', '8424', '8433', '8432', '8437', '8474', '8477', '8481', '7308', '7309', '7310', '9018', '9022', '9027', '9028', '9031', '9032'];

// NCM (prefixos) que, em regra, são USO/CONSUMO num comércio (embalagens, expediente, limpeza, manutenção)
const NCM_USO_CONSUMO = ['4819', '4821', '4823', '4820', '4802', '4811', '4818', '3923', '3919', '3920', '3926', '4911', '4909', '4910', '3401', '3402', '3405', '3808', '2710', '3403', '3814', '4016', '6305', '6307', '9608', '9609', '9612', '8309', '7317', '7318', '7326', '8205', '8536', '8544', '8539', '9603', '9604', '8309', '3917', '4818', '3924', '6911', '7013', '8211', '8215', '3406', '3606', '9018'];

// Descrição amigável dos grupos de CNAE
function cnaeFamilia(cnae) {
  const c = String(cnae || '').replace(/\D/g, '');
  for (const f of CNAE_FAMILIAS) if (c.startsWith(f[0])) return { cnae: c, prefixo: f[0], nome: f[1], capitulos: f[2] };
  return { cnae: c, prefixo: c.slice(0, 4), nome: 'CNAE ' + c, capitulos: [] };
}
