# Estudo preliminar: ICMS da Bahia no Totali Antecipa

> **A Totali é especialista em ICMS de Sergipe.** Este estudo existe para o escritório atender empresas baianas com o mesmo método de trabalho, mas **não tem a profundidade do material de Sergipe**. Os textos oficiais da SEFAZ-BA e da Assembleia Legislativa não puderam ser abertos na pesquisa (o portal `legislacao.sefaz.ba.gov.br` não resolveu e o `sefaz.ba.gov.br` falhou no certificado). Tudo o que está abaixo vem da planilha e do mapa do escritório, de uma cópia consolidada da Lei 7.014/96 e de sites comerciais. **Valide antes de recolher.**

Data do estudo: 23/11/2026. Versão do sistema: 1.29.0.

## Como ler os graus de confiança

| Marca | Significa |
|---|---|
| **[Escritório]** | Prática do escritório, vista na planilha de cálculo e no mapa de uma empresa baiana atendida (set/2026). É o que o sistema reproduz. |
| **[Lei]** | Lido na cópia consolidada da Lei 7.014/96 do site normasbrasil.com.br, sem conferência no Diário Oficial. |
| **[Comercial]** | Site comercial ou blog (Econet, Simtax, TaxGroup). Pode estar desatualizado. |
| **[Não confirmado]** | Não achei fonte. O sistema não presume. |

## 1. Antecipação parcial (o caso da empresa baiana atendida)

- **Quem paga.** Contribuinte baiano que adquire mercadoria de outra UF para comercialização. **[Lei]** art. 12-A.
- **Base e fórmula.** Alíquota interna sobre a base do art. 23, III (o valor da operação interestadual do documento de aquisição), deduzido o imposto destacado na nota. **[Lei]** art. 12-A e art. 23, III.
- **Não encerra a fase.** O imposto antecipado vira crédito na conta corrente. **[Lei]** art. 12-A, § 1º, e art. 26, § 6º.
- **Fora da regra.** Mercadoria com saída interna isenta, não tributada ou já sujeita a antecipação ou substituição que encerre a tributação. **[Lei]** art. 12-A, § 1º.
- **Exclusões por regulamento.** O Executivo pode excluir mercadorias ou atividades. **[Lei]** art. 12-A, § 2º. A lista do RICMS/BA **[Não confirmado]**.
- **Simples Nacional.** A antecipação vale também para o optante, e o STF validou a cobrança. **[Comercial]** (Econet; coluna do Bahia Notícias; informativo do STF sobre a ADI da CNC).
- **ME e EPP.** Fontes secundárias citam o RICMS/BA, art. 321, VII, "b": diferença entre a alíquota interna e a interestadual, sem agregar valores. Com crédito pelo imposto destacado, o resultado é o mesmo da fórmula acima. **[Comercial]**.
- **Redução de 20%.** ME e EPP que pagam no prazo teriam 20% de redução (art. 274 do RICMS/BA). **[Comercial]**. O mapa da empresa atendida **não** aplica a redução, e o sistema também não.
- **Prazo.** Antes da entrada no Estado ou, para contribuinte credenciado, até o dia 25 do mês seguinte à data do MDF-e vinculado à nota. **[Comercial]** (Econet, 2026). A data de referência é o MDF-e, não a emissão nem a entrada.
- **Código do DAE.** 2175. **[Comercial]** (Econet).

## 2. Antecipação total (substituição por antecipação)

- A Lei trata da substituição nos arts. 8º e 9º: ocorrida a substituição ou a antecipação, a fase de tributação se encerra para as mercadorias do Anexo 1. **[Lei]**.
- A MVA vem do regulamento. O art. 23 da Lei só remete à "margem de valor adicionado". **[Lei]**.
- A planilha do escritório ajusta a MVA pela fórmula `((1 + MVA) × (1 − alíquota interestadual) ÷ (1 − alíquota interna)) − 1` e calcula a base com ela. **[Escritório]**.
- O código do DAE da antecipação total aparece na planilha como **1145**. **[Escritório]** e **[Não confirmado]** em fonte oficial.
- A lista de NCM e MVA do **Anexo 1 do RICMS/BA não foi carregada**. Quem precisa de ST cadastra a regra no sistema, por NCM, com UF = BA.
- Calçados (6401 a 6405) e vestuário (capítulos 61 e 62): nenhuma das fontes lidas os coloca na ST. O escritório os trata como antecipação parcial, com MVA zero. **[Escritório]**.

## 3. Alíquotas

| Item | Valor | Confiança |
|---|---|---|
| Alíquota interna geral | **20,5%** | **[Escritório]** (planilha da empresa atendida) e **[Comercial]** (Lei 14.629/2023, desde 07/02/2024) |
| Texto do art. 15, I na cópia consolidada | 18% (Lei 13.461/2015, desde 10/03/2016) | **[Lei]** |
| Interestadual de origem | 12% geral, 7% do Sul e Sudeste (exceto ES), 4% importados | regra nacional, igual à de Sergipe |

**Divergência a resolver.** A cópia da lei consultada para no 18% e cita como última alteração a Lei 14.415/2021. A alíquota de 20,5% vem de lei posterior, que só os sites comerciais citam. O sistema usa **20,5%**, como o escritório, e deixa o valor editável em Parâmetros.

Alíquotas diferenciadas citadas por sites comerciais **[Comercial]**: 7% para a cesta básica listada, 12% para veículos, 25% mais 2 pontos de fundo para bebidas alcoólicas, joias, perfumes e embarcações, 28% mais 2 pontos para cigarros e fumo, 38% mais 2 pontos para armas e munições, e 20,5% mais 2 pontos para cosméticos, refrigerantes, isotônicos e energéticos. O sistema **não aplica nenhuma delas sozinho**. Quem compra esses produtos informa a alíquota e os pontos por regra de NCM com UF = BA, ou no item.

## 4. Fundo de pobreza (FECEP)

- O art. 16-A da Lei soma 2 pontos às alíquotas de certos produtos, com a arrecadação vinculada ao fundo estadual. A lista inclui, por remissão, álcool hidratado, cosméticos, isotônicos, energéticos, refrigerantes, cervejas e chopes. **[Lei]**.
- Vestuário e calçados não aparecem. **[Não confirmado]** se algum item de armarinho entra.
- O sistema **não presume FECEP** na Bahia. O ponto é informado por regra de NCM, ou no item.

## 5. DIFAL de uso, consumo e ativo

- Fato gerador na entrada para uso, consumo ou ativo permanente: art. 4º, XV. A diferença entre as alíquotas interna e interestadual: art. 15, § 7º. A base no destino: art. 17. **[Comercial]** (Rotina Fiscal, com remissão à Lei).
- A planilha do escritório usa base única: `(valor − ICMS origem) ÷ (1 − alíquota interna) × alíquota interna − ICMS origem`. **[Escritório]**. É a mesma ideia do Convênio ICMS 93/2015. Difere da fórmula de Sergipe (Portaria 367/2016).
- O código do DAE do DIFAL e o prazo **[Não confirmado]**.

## 6. Bahia x Sergipe, lado a lado

| Ponto | Sergipe (especialidade) | Bahia (módulo em validação) |
|---|---|---|
| Documento de partida | Espelho do DIA (SEFAZ-SE) | Relatório de NF-e destinadas (`rpt_cons_dest.csv`) |
| Mapa oficial | Sim, Portaria 103/2006 | **Não**: o escritório usa a grade do mapa de Sergipe |
| Revenda interestadual, regime normal | Antecipação sem encerramento, MVA 10% (30% se suspenso), alíquota 19% | Antecipação parcial, **sem MVA**, alíquota 20,5% |
| Simples Nacional | Complementação de alíquota, sem MVA | Mesma antecipação parcial |
| Crédito | Fórmula do mapa: (valor + frete) × alíquota de origem | ICMS **destacado** na nota (art. 12-A) |
| ST | Anexos IX e X, regras embutidas por NCM | Anexo 1 do RICMS/BA, **não carregado**: regra cadastrada pelo usuário |
| Fundo | FECOEP, 1 ponto geral, 2 pontos por produto, não incide na antecipação sem encerramento | FECEP, só nos produtos do art. 16-A, informado à mão |
| DIFAL | Portaria 367/2016 | Base única, fórmula da planilha do escritório |
| Código do DAE | 0108, 0146, 0153 e outros (Portaria 390/2016) | 2175 (parcial) e 1145 (total), a confirmar |
| Consulta de XML (DF-e) | Autor da consulta com UF 28 | Autor com UF 29 |

## 7. O que o sistema faz hoje na Bahia

1. **Cadastro.** Em Cadastros › Empresas, o campo "UF onde a empresa recolhe" aceita Sergipe ou Bahia. A Bahia esconde perfil na SEFAZ, cesta básica e MVA de 40%, que são regras de Sergipe.
2. **Entrada.** O Passo 1 aceita o `rpt_cons_dest.csv`. O sistema lê as chaves, a competência (mês com mais notas) e as notas canceladas, que saem da apuração. O relatório não traz o valor calculado pela SEFAZ, então a coluna de diferença fica vazia.
3. **XML.** "Buscar pendentes no Portal Nacional" consulta como empresa da Bahia. O servidor local (INICIAR.bat) já faz isso. A função na nuvem do site precisa ser reimplantada para valer.
4. **Cálculo.** Revenda interestadual vira antecipação parcial: base = valor + IPI + frete + seguro + outras − desconto, sem MVA, vezes 20,5%, menos o ICMS destacado. Uso, consumo e ativo saem da antecipação e podem ser marcados como DIFAL na coluna Receita. Produto com ST entra por regra do usuário (UF = BA, regime "com encerramento", MVA e alíquota).
5. **Regras.** As regras embutidas do sistema são de Sergipe e **não valem na Bahia**. Regra do usuário sem UF vale só em Sergipe. Há a opção "Sergipe e Bahia".
6. **Exportação.** Sai no padrão de Sergipe, com o mapa do sistema e as mesmas abas, como as demais empresas. O mapa e o resumo trazem o aviso da Bahia. O nome do arquivo segue `Antecipa_SE_<IE>_<competência>.xlsx`.

## 8. Conciliação com uma empresa baiana real (setembro/2026)

Os 30 XMLs do mês foram calculados pelo sistema e comparados com o mapa que o escritório fechou. O detalhe por nota, com fornecedores e valores, fica em arquivo local, fora do GitHub, porque o repositório é público.

| Resultado | Notas |
|---|---|
| Conferem até 5 centavos | 19 de 27 |
| Diferença de 5 a 12 centavos (arredondamento item a item contra nota inteira) | 7 |
| Diferença maior, por erro de lançamento no mapa | 1 |
| XML sem linha no mapa atualizado | 3 |

- **A diferença maior** veio de uma nota com itens a 4% e a 7% que o mapa lançou inteira a 7%. O crédito ficou acima do ICMS destacado. O sistema usa o destacado item a item.
- **Os três XML fora do mapa** estão no relatório de NF-e do mês. Um deles aparece no mapa original com valor igual ao do sistema. Vale confirmar se os outros dois foram lançados em outro DAE.

## 9. Pendências para validar com a SEFAZ-BA

1. Texto vigente do art. 15, I da Lei 7.014/96 e a vigência de 20,5%.
2. RICMS/BA (Decreto 13.780/2012) consolidado: arts. 274, 321 e 332, e a lista de exclusões da antecipação parcial.
3. Anexo 1 do RICMS/BA (NCM, MVA, alíquota), para carregar a ST no sistema.
4. Tabela oficial de códigos de receita do DAE: 2175, 1145 e o do DIFAL.
5. Lista de produtos do FECEP (art. 16-A e Lei 7.988/2001).
6. Se a redução de 20% para ME e EPP deve entrar no cálculo e em que condições.
7. Prazo e referência do MDF-e para o contribuinte credenciado.
8. Se a empresa é optante do Simples Nacional: o cadastro dela no sistema define só os alertas, não o cálculo.

## 10. Fontes

- [Lei 7.014/1996 (BA), cópia consolidada](https://www.normasbrasil.com.br/norma/lei-7014-1996-ba_119751.html) — arts. 12-A, 15, 16, 16-A, 23, 26 e 8º/9º.
- [Econet: ICMS BA, antecipação parcial](https://blog.econeteditora.com.br/icms-ba-antecipacao-parcial/) — prazo, código 2175, redução de 20%, Simples.
- [Simtax: tabela de ICMS da Bahia 2026](https://simtax.com.br/tabela-de-icms-bahia-2026-aliquotas-e-regras/) — alíquotas.
- [TaxGroup: ICMS BA, tabela atualizada](https://www.taxgroup.com.br/intelligence/icms-ba-tabela-atualizada/) — alíquotas.
- [Rotina Fiscal: DIFAL e ST, Bahia](https://www.rotinafiscal.com.br/tributos-e-declaracoes/estadual/difal-e-st-estados/bahia) — DIFAL (site sem atualização desde 31/12/2024).
- [Bahia Notícias: antecipação parcial dos optantes do Simples](https://www.bahianoticias.com.br/justica/coluna/822-tributo-em-pauta-a-cobranca-de-icms-antecipacao-parcial-dos-contribuintes-do-simples) — Simples e STF.
- [STF: ADI da CNC contra a lei baiana](https://noticias.stf.jus.br/postsnoticias/supremo-indefere-pedido-feito-pela-cnc-contra-lei-que-alterou-icms-na-bahia/) — constitucionalidade da antecipação parcial.
- Planilha de cálculo da antecipação e mapa de apuração de uma empresa baiana atendida, setembro/2026 (pasta do cliente, não versionada).
