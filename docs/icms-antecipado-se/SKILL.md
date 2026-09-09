---
name: icms-antecipado-se
description: >-
  Núcleo de consulta, decisão e CÁLCULO do ICMS ANTECIPADO (antecipação
  tributária) do Estado de Sergipe, da Totali Contabilidade, com base na Lei
  estadual 3.796/1996 (arts. 42 e 42-A) e no RICMS/SE (Decreto 21.400/2002,
  arts. 785 a 790 + Anexo X). Use SEMPRE que alguém mencionar ICMS antecipado,
  antecipação tributária, antecipação parcial, antecipação com ou sem
  encerramento, cobrança na entrada interestadual, MVA de Sergipe, Anexo X do
  RICMS/SE, DIA, CACESE, FECOEP/FUNPOBREZA sobre entradas, "quanto pago de
  antecipação dessa nota", "essa NF-e tem antecipação em SE", ou mandar um
  XML/DANFE de NF-e de entrada interestadual de cliente de Sergipe pedindo o
  cálculo. Também decide a fronteira ANTECIPAÇÃO x DIFAL (EC 87/2015) e x ST.
  Roda um motor Python que lê o XML e calcula item a item. Responde em
  português, citando o artigo. NÃO dá aconselhamento definitivo — sinaliza o
  que validar.
---

# ICMS Antecipado — consulta, decisão e cálculo (Sergipe)

Este é o núcleo do ICMS antecipado da Totali. Serve pra resolver, com base na lei,
as perguntas que aparecem toda semana quando chega uma nota de entrada de fora do
estado pra um cliente de Sergipe:

1. **Tem antecipação nessa entrada?** A mercadoria que entrou de outro estado gera
   ICMS antecipado pro cliente de SE, ou não?
2. **Qual regime?** Antecipação **sem encerramento** (parcial, o normal) ou **com
   encerramento** (fecha a cadeia, tipo ST)? Ou é caso de **Anexo X** (MVA própria)?
3. **Quanto pagar?** Base, MVA, alíquota interna, crédito da origem, FECOEP.
4. **É antecipação mesmo ou é DIFAL?** Duas coisas diferentes — não confundir.

A regra de ouro é a mesma das outras skills fiscais: **toda resposta cita o artigo**
e usa linguagem simples, porque o cliente costuma ser pequeno empresário leigo. A
antecipação mistura a **Lei 3.796/1996** (arts. 42 e 42-A — a hipótese) com o
**RICMS/SE Decreto 21.400/2002** (arts. 785 a 790 — como calcula e paga) e o
**Anexo X** (MVA por produto).

## Antes de tudo: qual é a destinação da mercadoria?

Essa é a **primeira pergunta**, porque muda o instituto inteiro. Pergunte uma coisa
de cada vez se não estiver claro na nota.

- **Entrou pra REVENDA** (mercadoria de comerciante atacadista/varejista) →
  **ANTECIPAÇÃO** (arts. 42 Lei 3.796/96 / 785 RICMS). É o caso deste núcleo.
- **Entrou pra USO/CONSUMO ou ATIVO IMOBILIZADO** do adquirente contribuinte →
  **DIFAL** (diferencial de alíquota, EC 87/2015 / LC 190/2022 / RICMS art. 480-L
  e segs.), **não** antecipação. Fórmula e recolhimento diferentes.
- **Venda pra consumidor final NÃO contribuinte** em SE (ex.: e-commerce de fora
  pra pessoa física sergipana) → **DIFAL da EC 87/2015**, responsabilidade do
  remetente. Também não é este núcleo.

Nunca aplique antecipação **e** DIFAL sobre a mesma entrada pra mesma finalidade.
A tabela comparativa está em `references/legislacao.md`.

## Os dois regimes de antecipação

**Sem encerramento (parcial) — o caso comum.** Equilibra a carga da compra de fora
com a que teria numa compra dentro de SE. A saída seguinte do cliente **continua com
débito normal** de ICMS (não encerra a cadeia). Base = valor que serviu de base na
origem, **acrescida de MVA**; aplica a alíquota interna de SE; deduz o ICMS destacado
na nota de origem (crédito). Arts. 785, 786, 788 e 789 do RICMS/SE.

**Com encerramento.** Recolhe na entrada todo o ICMS até o consumidor final; a saída
sai **sem novo débito** (funciona como ST "pra frente"). Usa MVA específica (Anexo X
ou artigo próprio do produto). Mesmos arts. 785/786/788/789, com o encerramento.

**Anexo X (MVA própria).** Lista de produtos com percentual de agregação próprio que
**substitui** o MVA geral de 10%/20%: carnes, calçados, material cerâmico de
construção, cesta básica em situação específica, compras de açougueiro/ambulante/
feirante/microempresa etc. A tabela está em `references/tabelas.md`.

## Como calcular — use o motor

Para calcular a partir de uma NF-e, **use o script** em vez de fazer conta na mão —
ele lê o XML, identifica o que é entrada interestadual pra SE e calcula item a item,
já mostrando a fórmula e as premissas:

```bash
python3 scripts/calc_antecipacao.py CAMINHO_DO_XML.xml
```

Flags úteis (o script explica todas com `--help`):
- `--perfil apto|inapto` — MVA geral 10% (apto) ou 20% (inapto). Padrão: apto.
- `--simples` — cliente optante do Simples (não credita a origem; vira custo).
- `--aliq-interna 19` — alíquota interna de SE do produto (padrão 19%; cesta ~12%).
- `--fecoep 1` — adicional FECOEP em pontos (0, 1 ou 2). Padrão 0; confirme o produto.
- `--mva 42` — força um MVA específico (ex.: um item do Anexo X) no lugar do geral.

O script **imprime a memória de cálculo** e marca com ⚠️ o que precisa de conferência
humana (produto do Anexo X, base reduzida, FECOEP, alíquota do produto). Ele é uma
**ferramenta de apoio, não a palavra final** — a classificação do produto (NCM →
regime → MVA → alíquota) é decisão do contador.

Quando não houver XML e for só uma pergunta conceitual, responda direto pelo núcleo,
sem rodar o script.

## Como raciocinar (passo a passo)

**Passo 1 — É entrada interestadual pra contribuinte de SE?** Confira na nota: UF do
emitente ≠ SE e UF do destinatário = SE, destinatário **contribuinte** (tem IE). Se
não for, provavelmente não é antecipação (pode ser DIFAL — ver acima).

**Passo 2 — Destinação: revenda?** Só revenda entra na antecipação. Uso/consumo e
ativo = DIFAL.

**Passo 3 — O produto está no Anexo X ou tem regime próprio?** Se estiver (carne,
cerâmico, calçado etc.), use o MVA do Anexo X e verifique se é **com encerramento**.
Se não estiver, é a antecipação **geral** com MVA 10% (apto) / 20% (inapto).

**Passo 4 — Calcule.** `base_origem × (1+MVA) × aliq_interna − ICMS_origem`. Some o
FECOEP se o produto estiver sujeito. Para produto com **base reduzida** (Anexo II do
RICMS), o valor é a **diferença de carga** entre SE e a origem — sinalize, não chute.

**Passo 5 — Prazo e código.** Confirme o prazo de recolhimento e o código do DAE
vigentes (ver `references/tabelas.md`; há divergência entre fontes — **confirme na
SEFAZ/SE** antes de afirmar data).

## Formato da resposta

Consulta rápida no chat: responda curto, nesta ordem — **incide? → regime (sem/com
encerramento) → base e MVA → alíquota e crédito → valor → FECOEP → prazo/ressalva**,
com o artigo entre parênteses. Quando rodar o motor, cole a memória de cálculo dele e
traduza o número final em uma frase simples pro cliente.

Exemplo de resposta curta:

> Essa nota é entrada interestadual da Bahia (12%) pra revenda no seu cliente de
> Aracaju, então **tem antecipação sem encerramento** (art. 785 RICMS/SE). Sobre a
> base da nota agrega-se o MVA de **10%** (contribuinte apto, art. 786), aplica a
> **alíquota interna de 19%** e desconta o ICMS de 12% que veio destacado. Deu **R$
> X** a recolher. A saída do cliente continua com débito normal. Confirme só se algum
> item tem base reduzida ou FECOEP.

## Parecer/relatório pro cliente

Quando pedirem um documento, monte simples e fundamentado (consulta → enquadramento →
regime → memória de cálculo → valor → prazo → ressalvas). Para gerar `.docx`/`.pdf` no
padrão da Totali, use a skill `documentacao-entrega` (que chama `docx`/`pdf`). Este
núcleo cuida do **conteúdo**; a formatação fica com a skill de documento.

## Cuidados (importante)

- **Não é parecer definitivo.** Você orienta e calcula; a classificação fiscal do
  produto e o valor final o Raoni valida. Antecipação em SE tem muita regra específica
  por produto.
- **Parâmetros que mudam e devem ser confirmados** (estão isolados em
  `references/tabelas.md` justamente pra facilitar a atualização):
  - **Alíquota interna modal** de SE (hoje **19%** desde 01/04/2023, Lei 9.176/2023) —
    reconfira todo ano; há sempre risco de alteração.
  - **MVA do contribuinte inapto**: as fontes divergem entre **20%** (art. 786) e
    **30%/40%** (IN SEFAZ 17/2023, cobrança no trânsito). Confirme o caso.
  - **FECOEP** (Lei 4.731/2002; arts. 40-A/40-B RICMS): **+1 ponto** geral e **+2
    pontos** pra supérfluos; há produtos **excluídos** (cesta básica, remédio). Não é
    automático — depende do produto e da destinação a consumo final.
  - **Prazo e código de receita** do recolhimento (10º dia da etiqueta x dia 25 do mês
    seguinte via DIA — divergência nas fontes). **Confirme na SEFAZ/SE.**
  - **Lista e MVA do Anexo X** e **bases reduzidas do Anexo II** por NCM.
- **Não invente dispositivo, data nem percentual.** Se não confirmou, diga que precisa
  confirmar — é melhor do que cravar um número errado que vira imposto pago a mais ou a
  menos.
- **Reforma tributária (IBS/CBS, LC 214/2025).** ICMS está em transição de extinção.
  Durante a transição a antecipação segue valendo, mas avise que regras/alíquotas podem
  mudar no período e confirme o ano vigente.
- **Só Sergipe.** Tudo aqui é do RICMS/SE. Outro estado tem regra própria.
