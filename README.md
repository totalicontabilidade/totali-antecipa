# Totali Antecipa — ICMS Antecipado de Sergipe

Sistema web da Totali Contabilidade para calcular o ICMS antecipado (antecipação tributária e ST) das entradas interestaduais de clientes de Sergipe, a partir do **espelho do DIA** e dos **XMLs das NF-e**, reproduzindo o **Mapa de Apuração do ICMS da SEFAZ/SE** (Portaria 103/2006) com memória de cálculo item a item.

Versão: ver `js/versao.js` (aparece no rodapé, na Ajuda e nas planilhas exportadas).

## Como abrir

1. Clique duas vezes em **INICIAR.bat** (mantenha a janela aberta).
2. O navegador abre em `http://localhost:8788`.

Abrir o `index.html` direto pelo arquivo também funciona para calcular com XMLs já baixados, mas **sem** a busca automática no Portal Nacional e sem os materiais de apoio (que são lidos por http).

Não precisa instalar nada: o servidor local é um script do Windows PowerShell 5.1 (`servir.ps1`).

## Fluxo

1. **Empresa e competência** — o espelho do DIA já traz IE e nome; o CNPJ vem do primeiro XML (ou do certificado). O regime (Simples × normal) é identificado pela Receita Federal (BrasilAPI) e sugerido pela forma de recolhimento do espelho; confirme em *Cadastros › Empresas*.
2. **Espelho do DIA** — arraste o `Extrato_Espelho_DIA_*.xls` (ou cole chaves de acesso).
3. **XMLs** — arraste os XML/ZIP ou use **Buscar pendentes no Portal Nacional** (pede só o certificado A1 da empresa na primeira vez).
4. **Resultado** — nota a nota: receita do mapa, ICMS calculado, FECOEP, valor da SEFAZ (espelho) e diferença. Clique na nota para a memória de cálculo por item e ajustes (receita, MVA, alíquota, pauta, finalidade).
5. **Mapa SEFAZ** — réplica do Anexo I na tela (imprimível).
6. **Exportar Excel** — abas *Mapa SEFAZ*, *Itens* (padrão do sistema de referência), *FECOEP*, *Resumo DAE* e *Espelho x Cálculo*.

## Busca automática dos XMLs (Portal Nacional da NF-e)

A consulta manual do portal `nfe.fazenda.gov.br` exige captcha, então o sistema usa o serviço oficial do mesmo portal para download com certificado: **NFeDistribuicaoDFe** (Ambiente Nacional), em `server/sefaz-dfe.ps1`.

- Envie o **e-CNPJ A1 (.pfx)** da empresa destinatária e a senha em *Certificado A1*. O arquivo fica em `server/certs/`; a senha, se marcada "lembrar", fica protegida pelo DPAPI do Windows (só a sua conta lê).
- Consulta por chave (`consChNFe`). Se a SEFAZ só liberar o resumo, o sistema registra a **Ciência da Operação** (evento 210210, assinado com o certificado) e consulta de novo.
- **Baixar todas as NF-e do CNPJ** usa a distribuição por NSU (lotes de 50; o último NSU fica em `server/certs/<cnpj>.nsu`). A SEFAZ bloqueia consultas repetidas sem documentos novos (cStat 656): espere 1 hora antes de repetir.
- O certificado precisa ser do **CNPJ destinatário** das notas (ou sua matriz). A SEFAZ não entrega XML a terceiros.

## Motor de cálculo (Sergipe)

Colunas do mapa da SEFAZ: `K = F (+G+H+I+J)`, `P = máx(K × (1+MVA), pauta)`, `Q = P × M`, `R = (F+H) × L`, `S = Q − R`. FECOEP em DAE à parte.

Receitas: 2607 Simples Nacional (complementação de alíquota, sem MVA), 2631 antecipação interestadual sem encerramento (MVA 10%/20%), 2674 com encerramento (MVA do produto), 2445 DIFAL, 2356 ST interna, cesta básica optante/não optante, importações, Simfaz.

Fontes de regra por NCM, nesta ordem: regras do usuário → regras embutidas (Anexo X, cesta, supérfluos, medicamentos, combustíveis) → **planilha oficial de ST de Sergipe** (`materiais/st-sergipe.csv`, com MVA ajustada pela alíquota interestadual, Convênio 142/2018) → regra geral.

Tudo que muda de número está em `js/tabelas.js` (marcado `confirmar` quando precisa de validação no RICMS/SE) e em *Parâmetros*.

## Materiais de apoio (mesmos do Fiscal Certo)

Pasta `materiais/`: ST/MVA de Sergipe, CEST (Conv. 142/2018), benefícios do RICMS/SE (Anexos I, II, IX), tabela NCM Siscomex, TIPI, PIS/COFINS (IN 2.121), IBS/CBS (LC 214/2025), índice da IN 2.121 e termos × NCM. Consulta por NCM na tela *Materiais de apoio*. Para atualizar, substitua o CSV/JSON mantendo as colunas.

## Estrutura

```
index.html            interface (identidade Totali)
INICIAR.bat / servir.ps1   servidor local + API (/api/status, /api/certificado, /api/nfe/<chave>, /api/distribuicao)
server/sefaz-dfe.ps1  Distribuição DF-e, assinatura XML, ciência da operação
js/versao.js          versão do sistema
js/tabelas.js         base de conhecimento de SE (receitas, CFOP, NCM, FECOEP, fundamentos)
js/materiais.js       carga e consulta dos materiais de apoio
js/nfe.js             leitor de XML da NF-e
js/espelho.js         leitor do espelho do DIA
js/motor.js           motor de cálculo (memória de cálculo por item)
js/exportar.js        Excel (xlsx-js-style)
js/app.js, app-regime.js, app-materiais.js   telas
materiais/            tabelas oficiais (CSV/JSON)
exemplos/             espelho e XMLs de julho/2026 do Tiago Pimentel (teste)
docs/                 relatório do Fiscal Certo usado como referência
```

Dados do usuário (empresas, regras, apurações, ajustes) ficam no navegador (localStorage). Faça backup em *Parâmetros › Backup*.

## Validação

Com o espelho e os 22 XMLs de julho/2026 do Tiago Pimentel (Simples), o sistema bate com o valor calculado pela SEFAZ nota a nota (diferença de centavos por arredondamento), exceto a NF 2364, em que a SEFAZ cobrou "com encerramento" e o escritório lançou como Simples — a tela mostra a divergência para decisão.

Ferramenta de apoio: a classificação do produto e o valor final são decisão do contador.

## Validação 2 — Mais Barato Supermercado (regime normal, cesta básica optante), julho/2026

Com o espelho e os 23 XMLs em `exemplos/mais-barato`, o sistema fecha **R$ 3.441,65** de ICMS e **R$ 29,07** de FECOEP, iguais ao mapa e à planilha de FCP do escritório. Regras aprendidas nesse mapa:

- Cesta básica optante: **3,6%** para produto com carga de 12% (leite, charque) e **2,1%** para carga de 7% (farinha/flocão de milho, café), sem crédito. Não optante: MVA 30% × carga.
- Regime normal: FECOEP só nas receitas **com encerramento** (1% da base com MVA). Simples: 1% do valor da nota em todas.
- Uso/consumo e ativo (CFOP 6556/6949/6551) não entram no DIA (DIFAL à parte), como a SEFAZ marca no espelho.
- Planilha oficial de ST/SE fica em modo **aviso**: a regra geral é 10%, salvo regra própria (ex.: salgadinho de trigo 1905.90.90 com MVA 35%).
- Espelho com a mesma chave em duas linhas (parte com e parte sem encerramento) é somado; nota marcada "Adiada" sai da apuração automaticamente.

## Base legal conferida na fonte oficial (09/09/2026)

Os PDFs oficiais do RICMS/SE (regulamento e anexos) foram baixados do portal `legislacaoonline.sefaz.se.gov.br` e estão em `docs/ricms-se/`, com o texto extraído para busca dentro do sistema (Materiais de apoio › Buscar no RICMS/SE). O que foi confirmado e aplicado:

- **Art. 785/786/788**: antecipação sem encerramento com MVA de 10% (apto) ou **30% (contribuinte suspenso)**; crédito do ICMS destacado; base reduzida = diferença de carga (art. 789).
- **Art. 40, § 3º + art. 787**: lista oficial da cesta básica; optante do Regime Simplificado paga 3,6% (sabão em barra, leite em pó, charque) ou 2,1% (demais), sem crédito; não optante MVA 30%.
- **Anexo X** (Decretos 717/2024 e 756/2024): carnes 30,37/26,30/19,51%, aves 43,57/39,09/31,61%, cerâmicos 68,30/63,04/54,27%.
- **Art. 674-A**: complementação de alíquota do Simples inclui IPI/frete na base e alcança uso/consumo e ativo; FECOEP na mesma data.
- **Arts. 616-C-A / 616-C-B / 616-F / 616-G**: FECOEP não incide na antecipação sem encerramento nem no ativo; planilha do fundo só nas receitas com encerramento (normal) e nas do Simples.
- **Portaria 390/2016**: códigos atuais do DAE (0108, 0146, 0153, 0110/0111, 0102, 0140; FECOEP 0145, 0119, 0143, 0150, 0142).
- **Portaria 600/2023 + agenda tributária**: antecipação e complementação vencem no dia 25 do mês seguinte; DIA disponível a partir do dia 2 (Portaria 251/2015).
- **Art. 784, II**: produto de ST sem retenção pelo remetente de UF não signatária é antecipação com encerramento pela MVA do Anexo IX — é o que faz a SEFAZ cobrar "com encerramento" em alguns itens; o sistema mantém a planilha ST em modo aviso (prática do escritório) e permite aplicar em Parâmetros.

## CNAE e finalidade da compra

No cadastro da empresa, o botão "Receita" puxa a atividade principal e as secundárias (mesmos dados do cartão CNPJ). Com isso o sistema supõe, item a item, se a entrada é revenda, uso/consumo ou ativo imobilizado (NCM típico + descrição + ramo). Em Parâmetros: só sugerir (padrão), aplicar automaticamente ou desligar. O CFOP explícito sempre prevalece.

## Validação 4 — Faro Tem Distribuidora (Simples, presentes/utilidades), julho/2026

Sistema: ICMS 5.490,02 e FECOEP 549,75; mapa do escritório: 5.482,84 e 549,63. Regras aprendidas: cosméticos 3304 a 25% com FECOEP de 2 pontos; no Simples a complementação alcança até itens com ST retida (CST 10), como a SEFAZ cobra; escova de dentes 9603.21 (HPPC) vai para "com encerramento" mesmo no Simples (art. 784, II) com a MVA do mapa. Diferença restante: na escova o escritório creditou 12% onde a nota destaca 4% (o sistema fica com o valor da SEFAZ, 27,68), e um ajuste de centavos na NF 151112.

## Portal Nacional da ST (Sergipe)

`materiais/portal-st-se-v0019.xlsx` é a planilha oficial do Portal Nacional da ST para SE (efeitos 01/07/2023). O script `server/importar-portal-st.ps1` converte todas as abas em `materiais/st-se-portal.csv` (uma linha por NCM/CEST) com MVA-ST por alíquota de origem (4/7/12%) e interna, MVA de não signatário e importação (alimentícios), PFC/PMPF (águas e bebidas), alíquota interna e pontos de FECOEP. Quando sair versão nova, salve o xlsx em `materiais/` e rode o script.

## Publicar como site (GitHub Pages)

O repositório git já está iniciado com `.gitignore` que exclui `exemplos/` (XMLs de clientes), `server/certs/` e o relatório do Fiscal Certo. Para publicar:

```bash
git remote add origin https://github.com/raonibarbosaa/NOME-DO-REPO.git
git push -u origin main
```

Depois, em Settings › Pages, escolha a branch `main` (pasta raiz). No site publicado funcionam o cálculo, o espelho, o upload de XML, os materiais e a exportação; a busca automática no Portal Nacional continua só na versão local (INICIAR.bat), porque depende do certificado A1 guardado na máquina.
