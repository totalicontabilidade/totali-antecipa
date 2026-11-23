# Estudo preliminar: ICMS da Bahia no Totali Antecipa

> **A Totali é especialista em ICMS de Sergipe.** Este estudo existe para o escritório atender empresas baianas com o mesmo método de trabalho, mas **não tem a profundidade do material de Sergipe**. O **texto oficial do RICMS/BA** (Decreto 13.780/2012, atualizado até o Decreto 24.829/2026) foi lido no portal da SEFAZ-BA e conferido artigo por artigo. A **Lei 7.014/96**, o **Anexo 1** (lista de ST) e a **alíquota de 20,5%** ainda **não** foram conferidos em fonte oficial: vêm de uma cópia consolidada da lei, de sites comerciais e da planilha do escritório. **Valide antes de recolher.**

Data do estudo: 23/11/2026. Versão do sistema: 1.29.1.

## Como ler os graus de confiança

| Marca | Significa |
|---|---|
| **[Escritório]** | Prática do escritório, vista na planilha de cálculo e no mapa de uma empresa baiana atendida (set/2026). É o que o sistema reproduz. |
| **[RICMS oficial]** | Lido no texto oficial do RICMS/BA no portal da SEFAZ-BA (Decreto 13.780/2012, até o Decreto 24.829/2026). O portal avisa que só o texto do Diário Oficial tem validade legal. |
| **[Lei]** | Lido na cópia consolidada da Lei 7.014/96 do site normasbrasil.com.br, sem conferência no Diário Oficial. |
| **[Comercial]** | Site comercial ou blog (Econet, Simtax, TaxGroup). Pode estar desatualizado. |
| **[Não confirmado]** | Não achei fonte. O sistema não presume. |

## 1. Antecipação parcial (o caso da empresa baiana atendida)

- **Quem paga.** Contribuinte baiano que adquire mercadoria de outra UF para comercialização. **[Lei]** art. 12-A.
- **Base e fórmula.** Alíquota interna sobre a base do art. 23, III (o valor da operação interestadual do documento de aquisição), deduzido o imposto destacado na nota. **[Lei]** art. 12-A e art. 23, III.
- **Não encerra a fase.** O imposto antecipado vira crédito na conta corrente. **[Lei]** art. 12-A, § 1º, e art. 26, § 6º.
- **Fora da regra.** Mercadoria com saída interna isenta, não tributada ou já sujeita a antecipação ou substituição que encerre a tributação. **[Lei]** art. 12-A, § 1º.
- **Exclusões por regulamento.** O Executivo pode excluir mercadorias ou atividades. **[Lei]** art. 12-A, § 2º. A lista do RICMS/BA **[Não confirmado]**.
- **Simples Nacional.** O recolhimento pelo Simples não exclui a antecipação nas aquisições interestaduais. **[RICMS oficial]** art. 321, VII. Quando a mercadoria não é de ST (sem encerramento, a antecipação parcial), cobra-se **a diferença entre a alíquota interna e a interestadual, sendo vedada a agregação de qualquer valor, sem prejuízo das reduções dos arts. 273 e 274**. **[RICMS oficial]** art. 321, VII, "b". E o § 1º manda calcular essa diferença **com as alíquotas aplicáveis aos contribuintes não optantes**, ou seja, a interestadual cheia de origem (12%, 7% ou 4%), e não o pouco que o fornecedor do Simples destaca. O STF validou a cobrança. **[Comercial]** (informativo do STF).
- **ME e EPP: redução de 20%.** Microempresa ou empresa de pequeno porte, **independentemente da receita bruta**, tem redução de 20% do imposto apurado na antecipação parcial, **se recolher no prazo regulamentar**. **[RICMS oficial]** art. 274. Não se acumula com a do art. 273, que está revogado. O mapa da empresa atendida **não** aplica a redução. O sistema traz a opção **desligada**: o cadastro da empresa liga.
- **Acúmulo de crédito.** O contribuinte pode pedir ao inspetor fazendário para reduzir a antecipação parcial quando as saídas seguintes tiverem diferimento ou alíquota menor que a interna e isso acumular crédito. **[RICMS oficial]** art. 276. O sistema não faz.
- **Prazo.** A antecipação parcial é paga **antes da entrada da mercadoria no território baiano**. **[RICMS oficial]** art. 332, III, "b". O contribuinte inscrito que cumpre, ao mesmo tempo, quatro requisitos (mais de 6 meses de atividade e já ter comprado de outra UF, sem débito em dívida ativa, adimplente com o ICMS e com as obrigações acessórias em dia) paga **até o dia 25 do mês seguinte à data de emissão do MDF-e vinculado à nota**. **[RICMS oficial]** art. 332, § 2º. O prazo especial **só vale com MDF-e emitido** (§ 2º-A) e não alcança a importação nem as operações com açúcar, farinha de trigo, trigo, charque, embutidos e produtos do abate de aves e gado.
- **Código do DAE.** 2175. **[Comercial]** (Econet). O regulamento não traz a tabela de códigos.

## 2. Antecipação total (substituição por antecipação)

- A Lei trata da substituição nos arts. 8º e 9º: ocorrida a substituição ou a antecipação, a fase de tributação se encerra para as mercadorias do Anexo 1. **[Lei]**.
- Ficam sujeitas à ST por antecipação, com encerramento, as mercadorias do **Anexo 1** do regulamento. **[RICMS oficial]** art. 289. O Anexo 1 não está no arquivo do regulamento e **não foi carregado**.
- **MVA ajustada.** Nas aquisições interestaduais: `MVA ajustada = [(1 + MVA ST original) × (1 − ALQ inter) ÷ (1 − ALQ intra)] − 1`. A `ALQ intra` é a alíquota interna, ou a carga efetiva quando menor. **[RICMS oficial]** art. 289, § 14. É a mesma conta da planilha do escritório. **[Escritório]**.
- **Remetente optante do Simples.** Usa-se a **MVA ST original**, sem ajuste, ou a MVA das operações internas. **[RICMS oficial]** art. 295, § 3º.
- Nas operações interestaduais a ST segue os convênios e protocolos entre a Bahia e a UF de origem. **[RICMS oficial]** art. 295. O imposto antecipado nesses casos tem o prazo antes da entrada (art. 332, III, "a" e "g").
- O código do DAE da antecipação total aparece na planilha como **1145**. **[Escritório]** e **[Não confirmado]** em fonte oficial.
- A lista de NCM e MVA do **Anexo 1 do RICMS/BA não foi carregada**. Quem precisa de ST cadastra a regra no sistema, por NCM, com UF = BA.
- Calçados (6401 a 6405) e vestuário (capítulos 61 e 62): nenhuma das fontes lidas os coloca na ST. O escritório os trata como antecipação parcial, com MVA zero. **[Escritório]**.

## 3. Alíquotas

| Item | Valor | Confiança |
|---|---|---|
| Alíquota interna geral | **20,5%** | **[Escritório]** (planilha da empresa atendida) e **[Comercial]** (Lei 14.629/2023, desde 07/02/2024) |
| Texto do art. 15, I na cópia consolidada | 18% (Lei 13.461/2015, desde 10/03/2016) | **[Lei]** |
| Interestadual de origem | 12% geral, 7% do Sul e Sudeste (exceto ES), 4% importados | regra nacional, igual à de Sergipe |

**O regulamento não traz a alíquota geral** (a busca por 20,5% no texto oficial não encontrou nada): ela está na Lei 7.014/96. **Divergência a resolver.** A cópia da lei consultada para no 18% e cita como última alteração a Lei 14.415/2021. A alíquota de 20,5% vem de lei posterior, que só os sites comerciais citam. O sistema usa **20,5%**, como o escritório, e deixa o valor editável em Parâmetros.

Alíquotas diferenciadas citadas por sites comerciais **[Comercial]**: 7% para a cesta básica listada, 12% para veículos, 25% mais 2 pontos de fundo para bebidas alcoólicas, joias, perfumes e embarcações, 28% mais 2 pontos para cigarros e fumo, 38% mais 2 pontos para armas e munições, e 20,5% mais 2 pontos para cosméticos, refrigerantes, isotônicos e energéticos. O sistema **não aplica nenhuma delas sozinho**. Quem compra esses produtos informa a alíquota e os pontos por regra de NCM com UF = BA, ou no item.

## 4. Fundo de pobreza (FECEP)

- O art. 16-A da Lei soma 2 pontos às alíquotas de certos produtos, com a arrecadação vinculada ao fundo estadual. A lista inclui, por remissão, álcool hidratado, cosméticos, isotônicos, energéticos, refrigerantes, cervejas e chopes. **[Lei]**.
- Vestuário e calçados não aparecem. **[Não confirmado]** se algum item de armarinho entra.
- O sistema **não presume FECEP** na Bahia. O ponto é informado por regra de NCM, ou no item.

## 5. DIFAL de uso, consumo e ativo

- O valor da diferença de alíquotas nas aquisições para uso, consumo ou ativo imobilizado entra na apuração mensal do contribuinte em conta corrente. **[RICMS oficial]** art. 305, III. Para consumidor final não contribuinte, vale o Convênio ICMS 93/2015. **[RICMS oficial]** art. 449-B. O regulamento **não traz a fórmula** de base do DIFAL entre contribuintes.
- Fato gerador na entrada para uso, consumo ou ativo permanente: art. 4º, XV. A diferença entre as alíquotas interna e interestadual: art. 15, § 7º. A base no destino: art. 17. **[Comercial]** (Rotina Fiscal, com remissão à Lei).
- Microempresa e EPP: o diferencial de alíquota do ativo e do uso e consumo pode ser pago no prazo do § 2º do art. 332 se cumpridos os requisitos. **[RICMS oficial]** art. 332, III, "j".
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
4. **Cálculo.** Revenda interestadual vira antecipação parcial: base = valor + IPI + frete + seguro + outras − desconto, sem MVA, vezes 20,5%, menos o ICMS destacado. Uso, consumo e ativo saem da antecipação e podem ser marcados como DIFAL na coluna Receita. Produto com ST entra por regra do usuário (UF = BA, regime "com encerramento", **MVA ST original** e alíquota): o sistema ajusta a MVA pela fórmula do art. 289, § 14, e usa a original quando o remetente é do Simples (art. 295, § 3º). A **redução de 20% do art. 274** é uma opção do cadastro da empresa, desligada por padrão.
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

1. Texto vigente do art. 15, I da Lei 7.014/96 e a vigência de 20,5% (o regulamento não traz a alíquota).
2. **Anexo 1 do RICMS/BA** (NCM, MVA original, alíquota), para carregar a ST no sistema. Não está no arquivo do regulamento.
3. Texto oficial da Lei 7.014/96 (arts. 12-A, 15, 16-A, 23).
4. Tabela oficial de códigos de receita do DAE: 2175, 1145 e o do DIFAL (o regulamento não traz).
5. Lista de produtos do FECEP (art. 16-A e Lei 7.988/2001).
6. **Base da antecipação do optante do Simples.** O art. 321, VII, "b" veda "a agregação de qualquer valor". O sistema mantém a base com IPI, frete, seguro e outras despesas, como na planilha do escritório. Confirmar se, para o optante, a base é só o valor das mercadorias.
7. **Crédito do optante do Simples.** O art. 321, § 1º manda usar a alíquota interestadual dos não optantes. O sistema usa o ICMS destacado e, quando o remetente é do Simples e não destaca, a interestadual (parâmetro de crédito presumido). O resultado coincide com remetente normal; confirmar os demais casos.
8. Se a empresa atendida é ME ou EPP e se paga dentro do prazo: só então vale ligar a redução de 20%.
9. Se o escritório quer o prazo especial do art. 332, § 2º, e se a empresa cumpre os quatro requisitos.

## 10. Fontes

- [RICMS/BA, texto oficial (Decreto 13.780/2012, até o Decreto 24.829/2026)](https://mbusca.sefaz.ba.gov.br/DITRI/normas_complementares/decretos/decreto_2012_13780_ricms_texto_2021.pdf) — arts. 274, 276, 289, 295, 305, 321, 332 e 449-B.
- [Lei 7.014/1996 (BA), cópia consolidada](https://www.normasbrasil.com.br/norma/lei-7014-1996-ba_119751.html) — arts. 12-A, 15, 16, 16-A, 23, 26 e 8º/9º.
- [Econet: ICMS BA, antecipação parcial](https://blog.econeteditora.com.br/icms-ba-antecipacao-parcial/) — prazo, código 2175, redução de 20%, Simples.
- [Simtax: tabela de ICMS da Bahia 2026](https://simtax.com.br/tabela-de-icms-bahia-2026-aliquotas-e-regras/) — alíquotas.
- [TaxGroup: ICMS BA, tabela atualizada](https://www.taxgroup.com.br/intelligence/icms-ba-tabela-atualizada/) — alíquotas.
- [Rotina Fiscal: DIFAL e ST, Bahia](https://www.rotinafiscal.com.br/tributos-e-declaracoes/estadual/difal-e-st-estados/bahia) — DIFAL (site sem atualização desde 31/12/2024).
- [Bahia Notícias: antecipação parcial dos optantes do Simples](https://www.bahianoticias.com.br/justica/coluna/822-tributo-em-pauta-a-cobranca-de-icms-antecipacao-parcial-dos-contribuintes-do-simples) — Simples e STF.
- [STF: ADI da CNC contra a lei baiana](https://noticias.stf.jus.br/postsnoticias/supremo-indefere-pedido-feito-pela-cnc-contra-lei-que-alterou-icms-na-bahia/) — constitucionalidade da antecipação parcial.
- Planilha de cálculo da antecipação e mapa de apuração de uma empresa baiana atendida, setembro/2026 (pasta do cliente, não versionada).
