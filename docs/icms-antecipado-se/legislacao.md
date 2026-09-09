# ICMS Antecipado / SE — legislação, fórmulas e fronteiras

Fonte de verdade da base legal e das fórmulas. Leia quando precisar fundamentar uma
resposta ou entender o mecanismo. Números que mudam (alíquotas, MVA, FECOEP, prazos)
ficam em `tabelas.md`.

## Base legal (o esqueleto)

- **Lei 3.796/1996 (Lei do ICMS/SE)**
  - **Art. 42** — hipótese da antecipação nas entradas interestaduais destinadas a
    atacadista/varejista (revenda).
  - **Art. 42-A** — antecipação para **optante do Simples Nacional**, inclusive sobre
    bens de uso/consumo e ativo (incluído pela Lei 8.739/2020).
  - **Art. 40** — alíquotas internas.
  - **Arts. 40-A e 40-B** — adicional FECOEP.
- **RICMS/SE — Decreto 21.400/2002**
  - **Art. 785** — define a antecipação (com e sem encerramento) nas entradas
    interestaduais. (inciso II revogado pelo Decreto 1.006/2025.)
  - **Art. 786** — **base de cálculo** e os percentuais de agregação (MVA).
  - **Arts. 788 e 789** — apuração do imposto.
  - **Art. 790** — apuração **mensal** via **DIA (Demonstrativo do ICMS Antecipado)**
    (redação do Decreto 1.006/2025).
  - **Anexo X** — produtos com MVA específica (ver `tabelas.md`).
- **FECOEP** — Lei 4.731/2002; Decreto 289/2023; Leis 9.177/2023 e 9.348/2023.
- **Instrução Normativa SEFAZ/SE 17/2023** — recolhimento antecipado no trânsito
  (contribuinte inapto), piso de exigência e regras de Simples.

> Observação de método: o texto integral do RICMS/SE está no site da SEFAZ/SE, que
> costuma estar inacessível a ferramentas externas. Ao atualizar esta skill, baixe o
> RICMS consolidado e o Manual do FECOEP direto da SEFAZ/SE e reconfira os arts. 785,
> 786 e o Anexo X — foi o ponto de maior incerteza na montagem.

## Regime 1 — Antecipação SEM encerramento (parcial)

O caso mais comum: comerciante de SE compra pra revenda de fornecedor de outro estado.
A ideia é igualar a carga à de uma compra interna. **A saída seguinte do cliente
continua com débito normal** — não encerra a cadeia.

Fórmula (art. 786):

```
base_antecipacao = base_origem × (1 + MVA)
icms_interno     = base_antecipacao × aliq_interna_SE
antecipado       = icms_interno − icms_destacado_origem     (crédito da origem)
```

- `base_origem` = valor que serviu de base ao ICMS na origem (na prática, o valor da
  operação / vProd + acréscimos tributáveis).
- `MVA` geral = **10%** (contribuinte **apto**) ou **20%** (**inapto**) — art. 786.
  ⚠️ Ver divergência com a IN 17/2023 em `tabelas.md`.
- `aliq_interna_SE` = alíquota interna do produto em SE (modal 19%; cesta ~12%).
- `icms_destacado_origem` = ICMS que veio destacado na NF (só credita se o adquirente
  for do regime normal; **Simples não credita** — vira custo).

Quando o produto tem **base reduzida** (Anexo II do RICMS), a antecipação corresponde
à **diferença de carga tributária** entre SE e a origem, não à conta cheia acima —
sinalize e calcule com a carga efetiva reduzida.

**Regime simplificado (CACESE / feirantes e afins):** imposto = **2,1%** aplicado
diretamente sobre a base, sem o mecanismo de crédito. Confirme o enquadramento.

## Regime 2 — Antecipação COM encerramento

Recolhe na entrada todo o ICMS até o consumidor final; **a saída sai sem novo débito**
(substituição tributária "pra frente"). Usa a MVA específica do produto (Anexo X ou
artigo próprio, ex.: art. 709-A pra trigo/farinha).

```
base_ST    = (valor_aquisicao + IPI + frete + despesas) × (1 + MVA_produto)
icms_ST    = base_ST × aliq_interna_SE − icms_destacado_origem
# não há débito na saída interna subsequente
```

Como saber se encerra ou não: depende de o produto estar na lista de encerramento /
ST. Na dúvida, trate como **sem encerramento** (mais conservador pro fluxo, débito
normal na saída) e sinalize pra conferência.

## Fronteira: ANTECIPAÇÃO x DIFAL x ST

| Critério | Antecipação (arts. 785-790) | DIFAL EC 87/2015 (art. 480-L) | ST (Anexo IX) |
|---|---|---|---|
| Destinatário | Contribuinte que compra **pra revenda** | **Consumidor final** (contribuinte p/ uso/consumo/ativo, ou não contribuinte) | Cadeia de revenda de produto listado |
| O que faz | Antecipa o ICMS das etapas internas seguintes | Reparte ICMS entre origem e destino no consumo | Substituto recolhe por toda a cadeia |
| Encerra a cadeia? | Sem encerramento: não / Com encerramento: sim | Não é etapa de cadeia | Sim |
| Cálculo | `base×(1+MVA)×aliq_int − ICMS_orig` | `base×aliq_int − base×aliq_inter` | MVA do Anexo IX, recolhido pelo remetente |

Regra prática: **decida a destinação primeiro**. Revenda → antecipação. Uso/consumo/
ativo ou venda a consumidor final → DIFAL. Produto com ST já retida na origem → não
tem antecipação de novo (verifique o CST/CSOSN e o campo de ICMS-ST da nota).

## Simples Nacional

- A antecipação **incide** sobre o optante do Simples (art. 42-A da Lei 3.796/96) e é
  recolhida **por fora do DAS** — ICMS à parte.
- O Simples **não se credita** do ICMS da origem: o imposto da nota de entrada vira
  custo, e a antecipação é calculada sem o desconto do crédito (ou com a lógica de
  diferença de alíquota, conforme o caso). Confirme o percentual/MVA aplicável ao
  optante — as fontes secundárias não fecham 100% esse ponto.
- Não confundir com a **dispensa de DIFAL** de certas situações do Simples (IN 17/2023,
  art. 5º): isso é DIFAL, não a antecipação do art. 42-A, que segue exigível.
