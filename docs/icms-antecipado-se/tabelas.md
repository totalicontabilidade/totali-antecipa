# ICMS Antecipado / SE — tabelas e parâmetros (ATUALIZAR AQUI)

Este arquivo concentra os **números que mudam**. Sempre que uma alíquota, MVA ou prazo
for alterado, edite **só aqui** (e o `scripts/params.json`, se usar). O SKILL.md e o
`legislacao.md` apontam pra cá de propósito.

> ⚠️ Vários itens abaixo estão marcados **[CONFIRMAR]** porque o site da SEFAZ/SE não
> pôde ser lido na montagem da skill. Antes de cravar valor ou data pro cliente,
> confirme no RICMS/SE consolidado e no Manual do FECOEP da SEFAZ/SE.

## Alíquotas internas de SE (2026)

| Situação | Alíquota | Fonte |
|---|---|---|
| **Modal / padrão** | **19%** (desde 01/04/2023) | Lei 9.176/2023; art. 40 |
| Cesta básica / essenciais (arroz, feijão, leite, café, farinha, sal…) | **12%** [CONFIRMAR por NCM] | art. 40; alguns itens com base reduzida no Anexo II |
| Supérfluos (bebida alcoólica, cigarro/fumo, arma/munição, joia) | 25% a 28% (+2 pts FECOEP → 27%/30%) | art. 40-A; Decreto 295/2023 |
| Combustíveis | monofásico **ad rem** (R$/litro, por Convênio CONFAZ) | não usar % — checar convênio vigente |

Reconfira o modal **todo ano** — é o parâmetro que mais impacta o cálculo.

## Alíquotas interestaduais na origem (entrada em SE)

| Origem do fornecedor | Alíquota |
|---|---|
| Sul e Sudeste (exceto ES) → SE | **7%** |
| Norte, Nordeste, Centro-Oeste e ES → SE | **12%** |
| Mercadoria **importada** / conteúdo importação > 40% (Res. SF 13/2012) | **4%** |

É a alíquota que aparece destacada na NF de entrada e que vira **crédito** a deduzir
(salvo Simples). O script deduz o `vICMS` que estiver na própria nota.

## MVA geral (antecipação sem encerramento) — art. 786

| Perfil do contribuinte | MVA (agregação) |
|---|---|
| **Apto** | **10%** |
| **Inapto** | **20%** |
| Regime especial de fiscalização | fixado por ato do Secretário |

⚠️ **[CONFIRMAR] Divergência real:** a **IN SEFAZ/SE 17/2023** (cobrança no trânsito
do inapto) trabalha com **30%** (sem percentual específico) e **40%** (mercadoria sem
enquadramento). Ou seja: 20% aparece como MVA do art. 786; 30%/40% aparecem na cobrança
em trânsito da IN 17/2023. Confirme qual se aplica ao caso concreto antes de fechar.

**Regime simplificado CACESE/feirante:** **2,1%** direto sobre a base (sem crédito).

## Anexo X do RICMS/SE — MVA específica por produto

Quando o produto está no Anexo X, o MVA abaixo **substitui** o geral de 10%/20%. O MVA
varia conforme a **alíquota interestadual aplicada na origem** (quanto menor a alíquota
de origem, maior o MVA, pra compensar). Valores conforme o Anexo X vigente (Decreto
30.369/2016 e alterações; carnes atualizadas pelo Decreto 717/2024):

| Item | Produto (resumo) | MVA operação interna | MVA aquisição interestadual |
|---|---|---|---|
| 1 | Cesta básica (art. 40, VIII, "b") → atacadista/varejista **optante** do Regime Simplificado | vide art. 786 | vide art. 786 |
| 2 | Cesta básica → atacadista/varejista **não optante** | 30% | 30% |
| 3 | Produtos p/ blocos carnavalescos | 40% | 40% |
| 4 | Açougueiro, ambulante, barraqueiro, bodegueiro, cantina, clube social, feirante, microempresa estadual (se não houver outro %) | 40% | 40% |
| 5 | Carne bovina/ovina/bufalina salgada/seca/desidratada | 10% | 30,37% (orig 4%) · 26,30% (7%) · 19,51% (12%) |
| 6 | Carne bovina/ovina/bufalina e comestíveis, fresca/refrig./congelada | 10% | 30,37% (4%) · 26,30% (7%) · 19,51% (12%) |
| 7 | Carne caprina fresca/refrig./congelada | 10% | 30,37% (4%) · 26,30% (7%) · 19,51% (12%) |
| 8 | Comestíveis do abate de caprinos | 10% | 30,37% (4%) · 26,30% (7%) · 19,51% (12%) |
| 9 | Comestíveis do abate de suínos | 10% | 28,78% (4%) · 24,76% (7%) · 18,05% (12%) |
| 10 | Comestíveis do abate de **aves** | 21,14% | 43,57% (4%) · 39,09% (7%) · 31,61% (12%) |
| 11 | Material cerâmico de construção (areia, argila, bloco, brita, lajota, manilha, pedra, telha, tijolo) | 42% | 68,30% (4%) · 63,04% (7%) · 54,27% (12%) |
| 05 (antigo) | Calçados (NCM 6401-6405) | 40% (SE) | 56,87% (S/SE) · 48,43%→40% conforme região/período |
| 12 | Perfumaria/higiene/cosméticos | **REVOGADO** (Dec. 40.217/2018, desde 01/01/2019) | — |

Observações:
- Itens 1-4 são definidos pelo **tipo de adquirente** (feirante, bloco carnavalesco
  etc.), não pelo NCM.
- Itens 5-11 são por NCM (carnes, cerâmico). Se o cliente compra carne ou material de
  construção cerâmico de fora, provavelmente cai aqui — **verifique**.
- A maioria desses itens é **antecipação com encerramento** (fecha a cadeia). Confirme.
- Sempre que o produto **não** estiver nesta lista, use o MVA **geral** (10%/20%).

## FECOEP / FUNPOBREZA (adicional)

| Nível | Adicional | Base legal |
|---|---|---|
| Geral (operações a consumidor final não listadas no 40-A) | **+1 ponto** | art. 40-B; Decreto 289/2023 |
| Supérfluos do art. 40-A (bebida alcoólica, cigarro, arma, joia…) | **+2 pontos** | art. 40-A; Decreto 295/2023 |

- **Excluídos** [CONFIRMAR lista completa]: cesta básica/gêneros alimentícios,
  medicamento de uso humano, energia residencial até ~150 kWh/mês, transporte
  intermunicipal de passageiros, material escolar especificado. Decreto 1.006/2025
  ainda dispensou FECOEP de insumos de indústria/restaurante do Simples.
- É recolhido em **código próprio, à parte** do ICMS.
- Entra quando a mercadoria se destina a **consumo final** no estado. Não é automático
  em toda antecipação — depende do produto e da destinação. Por isso o script deixa
  `--fecoep 0` como padrão; ligue conscientemente.

## Prazo e código de receita (DAE)

⚠️ **[CONFIRMAR na SEFAZ/SE] — as fontes divergem:**
- Contribuinte **apto**: recolhimento até o **10º dia** da data da etiqueta na NF
  (apuração mensal via **DIA**, art. 790) — uma fonte cita **dia 25 do mês seguinte**.
- Contribuinte **inapto**: no ato, na **1ª repartição fazendária** por onde a
  mercadoria transitar (IN 17/2023, art. 2º).
- **Piso**: exigência no trânsito só quando o imposto ≥ **10 × UFP/SE** (IN 17/2023).
- Códigos de receita citados (agregação): **0107** (20%), **0113** (10% interna),
  **0112** (10% interestadual). Confirme a tabela de códigos vigente do DAE.

## Onde reconfirmar (fontes)

- RICMS/SE Decreto 21.400/2002 e Lei 3.796/1996 — SEFAZ/SE (site oficial).
- IN SEFAZ/SE 17/2023; Decretos 289/2023, 295/2023, 399/2023, 1.006/2025.
- Manual do FECOEP — SEFAZ/SE.
- Anexo X e Anexo II do RICMS/SE consolidado (PDF de anexos).
