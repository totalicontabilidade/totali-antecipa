#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
calc_antecipacao.py — Motor de cálculo do ICMS ANTECIPADO de Sergipe.

Lê o XML de uma NF-e (modelo 55) de ENTRADA INTERESTADUAL destinada a um
contribuinte de Sergipe e calcula, item a item, a antecipação tributária
SEM encerramento (o caso comum), conforme RICMS/SE (Dec. 21.400/2002),
arts. 785/786/788/789, e Lei 3.796/96, arts. 42 e 42-A.

Fórmula (art. 786):
    base_antecipacao = base_origem * (1 + MVA)
    icms_interno     = base_antecipacao * aliq_interna_SE
    antecipado       = icms_interno - credito_origem       (Simples não credita)

É FERRAMENTA DE APOIO. A classificação do produto (NCM -> regime -> MVA ->
alíquota), o Anexo X, base reduzida e FECOEP são decisão do contador.
Confira sempre os parâmetros em references/tabelas.md.

Uso:
    python3 calc_antecipacao.py NOTA.xml [opções]

Opções:
    --perfil apto|inapto   MVA geral 10% (apto) ou 20% (inapto). Padrão: apto.
    --simples              Cliente do Simples Nacional (não credita a origem).
    --aliq-interna 19      Alíquota interna de SE do produto (%). Padrão: 19.
    --mva 42               Força um MVA (%) p/ TODOS os itens (ex.: Anexo X).
    --fecoep 0|1|2         Adicional FECOEP em pontos. Padrão: 0.
    --help                 Mostra esta ajuda.
"""

import sys
import re
import xml.etree.ElementTree as ET

UF_REGIOES_7 = {  # origens cuja alíquota interestadual p/ SE é 7% (Sul/Sudeste exc. ES)
    "RS", "SC", "PR", "SP", "RJ", "MG",
}
# Demais (N/NE/CO/ES) -> 12% ; importado -> 4% (detectado pela origem do CST, orig 1/2/3/8)


def strip_ns(tree):
    """Remove namespaces das tags pra facilitar o parsing."""
    for el in tree.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return tree


def txt(node, path, default=None):
    if node is None:
        return default
    found = node.find(path)
    return found.text if found is not None and found.text is not None else default


def to_float(s, default=0.0):
    try:
        return float(s)
    except (TypeError, ValueError):
        return default


def parse_args(argv):
    opts = {
        "xml": None, "perfil": "apto", "simples": False,
        "aliq_interna": 19.0, "mva": None, "fecoep": 0.0,
    }
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        elif a == "--perfil":
            i += 1; opts["perfil"] = argv[i].strip().lower()
        elif a == "--simples":
            opts["simples"] = True
        elif a == "--aliq-interna":
            i += 1; opts["aliq_interna"] = to_float(argv[i], 19.0)
        elif a == "--mva":
            i += 1; opts["mva"] = to_float(argv[i])
        elif a == "--fecoep":
            i += 1; opts["fecoep"] = to_float(argv[i], 0.0)
        elif not a.startswith("--"):
            opts["xml"] = a
        else:
            print(f"Opção desconhecida: {a}\n"); print(__doc__); sys.exit(2)
        i += 1
    if not opts["xml"]:
        print("ERRO: informe o caminho do XML da NF-e.\n"); print(__doc__); sys.exit(2)
    return opts


# NCMs que sinalizam Anexo X / regime próprio (dispara aviso pra o contador conferir).
def anexo_x_hint(ncm):
    ncm = (ncm or "").replace(".", "")
    if ncm[:2] in ("02", "16") and ncm[:4] in (
        "0201", "0202", "0203", "0204", "0206", "0207", "0209", "0210", "1501", "1502"):
        return "carnes/comestíveis de abate — provável Anexo X (itens 5-10), MVA própria"
    if ncm[:4] in ("6401", "6402", "6403", "6404", "6405"):
        return "calçados — provável Anexo X (calçados), MVA própria"
    if ncm[:4] in ("6901", "6904", "6905", "6907", "6908", "2505", "2507", "2517"):
        return "material cerâmico/construção — provável Anexo X (item 11), MVA própria"
    return None


def st_ja_retida(cst, csosn):
    """CST/CSOSN que indicam ICMS-ST já retido (aí não cabe antecipação de novo)."""
    if cst in ("10", "30", "60", "70", "90"):
        return True
    if csosn in ("201", "202", "203", "500"):
        return True
    return False


def main():
    opts = parse_args(sys.argv[1:])
    try:
        tree = strip_ns(ET.parse(opts["xml"]).getroot())
    except Exception as e:
        print(f"ERRO ao ler o XML: {e}"); sys.exit(1)

    inf = tree.find(".//infNFe")
    if inf is None:
        print("ERRO: não encontrei infNFe — o arquivo é uma NF-e (modelo 55)?"); sys.exit(1)

    ide = inf.find("ide")
    emit = inf.find("emit")
    dest = inf.find("dest")
    uf_emit = txt(emit, "enderEmit/UF", "?")
    uf_dest = txt(dest, "enderDest/UF", "?")
    nnf = txt(ide, "nNF", "?")
    emit_nome = txt(emit, "xNome", "?")
    dest_nome = txt(dest, "xNome", "?")
    dest_ie = txt(dest, "IE")
    ind_final = txt(ide, "indFinal", "0")  # 1 = consumidor final

    warns = []
    header = []
    header.append("=" * 70)
    header.append("  ICMS ANTECIPADO / SE — memória de cálculo (ferramenta de apoio)")
    header.append("=" * 70)
    header.append(f"  NF-e nº {nnf}   {uf_emit} -> {uf_dest}")
    header.append(f"  Emitente:    {emit_nome} ({uf_emit})")
    header.append(f"  Destinatário: {dest_nome} ({uf_dest})")
    print("\n".join(header))

    # --- Triagem: é entrada interestadual pra contribuinte de SE? ---
    if uf_dest != "SE":
        warns.append(f"Destinatário está em {uf_dest}, não em SE. Esta skill é do "
                     f"ICMS antecipado de SERGIPE — cálculo abaixo pode não se aplicar.")
    if uf_emit == uf_dest:
        warns.append("Operação interna (mesma UF): não é caso de antecipação por "
                     "entrada interestadual.")
    if not dest_ie or dest_ie.upper() in ("ISENTO", "", "0"):
        warns.append("Destinatário sem IE — se não for contribuinte, o caso é DIFAL "
                     "(EC 87/2015), não antecipação.")
    if ind_final == "1":
        warns.append("indFinal=1 (consumidor final): se a entrada for p/ uso/consumo "
                     "ou ativo, é DIFAL, não antecipação de revenda.")

    perfil = opts["perfil"]
    mva_geral = 20.0 if perfil == "inapto" else 10.0
    if opts["mva"] is not None:
        mva_usado_padrao = opts["mva"]
        mva_label = f"{opts['mva']:.2f}% (forçado via --mva)"
    else:
        mva_usado_padrao = mva_geral
        mva_label = f"{mva_geral:.0f}% (geral, perfil {perfil}, art. 786)"

    aliq_int = opts["aliq_interna"]
    fecoep_pts = opts["fecoep"]

    print()
    print(f"  Parâmetros: perfil={perfil} | MVA={mva_label} | "
          f"alíq. interna SE={aliq_int:.0f}% | "
          f"crédito origem={'NÃO (Simples)' if opts['simples'] else 'sim'} | "
          f"FECOEP={fecoep_pts:.0f} ponto(s)")
    print("-" * 70)

    total_base_ant = 0.0
    total_credito = 0.0
    total_antecip = 0.0
    total_fecoep = 0.0
    n_itens = 0

    for det in inf.findall("det"):
        prod = det.find("prod")
        imp = det.find("imposto")
        xprod = txt(prod, "xProd", "?")
        ncm = txt(prod, "NCM", "")
        cfop = txt(prod, "CFOP", "")
        vprod = to_float(txt(prod, "vProd", "0"))

        # localizar grupo ICMS (qualquer subtipo) e CSOSN/CST
        icms_grp = det.find(".//ICMS")
        cst = csosn = None
        vbc = pic = vicms = 0.0
        if icms_grp is not None:
            sub = list(icms_grp)
            if sub:
                g = sub[0]
                cst = txt(g, "CST")
                csosn = txt(g, "CSOSN")
                vbc = to_float(txt(g, "vBC", "0"))
                pic = to_float(txt(g, "pICMS", "0"))
                vicms = to_float(txt(g, "vICMS", "0"))

        base_origem = vbc if vbc > 0 else vprod
        credito = 0.0 if opts["simples"] else vicms

        # MVA do item: usa o padrão, mas avisa se for produto de Anexo X
        mva_item = mva_usado_padrao
        hint = anexo_x_hint(ncm)

        base_ant = base_origem * (1 + mva_item / 100.0)
        icms_interno = base_ant * aliq_int / 100.0
        antecip = icms_interno - credito
        fecoep_val = base_ant * fecoep_pts / 100.0 if fecoep_pts > 0 else 0.0

        n_itens += 1
        total_base_ant += base_ant
        total_credito += credito
        total_antecip += antecip
        total_fecoep += fecoep_val

        print(f"\n  Item {n_itens}: {xprod}")
        print(f"    NCM {ncm} | CFOP {cfop} | CST/CSOSN {cst or csosn or '-'}")
        print(f"    base origem R$ {base_origem:,.2f}  (ICMS orig {pic:.0f}% = R$ {vicms:,.2f})")
        print(f"    base c/ MVA {mva_item:.2f}% = R$ {base_ant:,.2f}")
        print(f"    ICMS interno ({aliq_int:.0f}%) = R$ {icms_interno:,.2f}")
        print(f"    (-) crédito origem = R$ {credito:,.2f}")
        print(f"    = ANTECIPAÇÃO do item: R$ {antecip:,.2f}")
        if fecoep_val > 0:
            print(f"    + FECOEP ({fecoep_pts:.0f} pt) = R$ {fecoep_val:,.2f}  (recolher à parte)")
        if hint:
            warns.append(f"Item {n_itens} ({xprod[:30]}): {hint}. "
                         f"Reveja o MVA e se é COM encerramento (use --mva).")
        if st_ja_retida(cst, csosn):
            warns.append(f"Item {n_itens}: CST/CSOSN {cst or csosn} indica ICMS-ST já "
                         f"retido — pode NÃO caber antecipação. Confira.")

    print("\n" + "=" * 70)
    print(f"  TOTAIS ({n_itens} itens)")
    print(f"    Base c/ MVA ..... R$ {total_base_ant:,.2f}")
    print(f"    Crédito origem .. R$ {total_credito:,.2f}")
    print(f"    ICMS ANTECIPADO . R$ {total_antecip:,.2f}")
    if total_fecoep > 0:
        print(f"    FECOEP (à parte)  R$ {total_fecoep:,.2f}")
    print("=" * 70)

    if warns:
        print("\n  ⚠️  PONTOS PRA CONFERIR (não são erro do cálculo, são decisões fiscais):")
        for w in warns:
            print(f"    - {w}")

    print("\n  Fundamento: Lei 3.796/96, arts. 42/42-A; RICMS/SE arts. 785-790.")
    print("  Antecipação SEM encerramento: a saída seguinte do cliente mantém débito")
    print("  normal de ICMS. Confirme alíquota do produto, Anexo X, base reduzida,")
    print("  FECOEP, prazo e código do DAE em references/tabelas.md antes de recolher.")
    print("  Este cálculo é apoio; a palavra final é do contador.\n")


if __name__ == "__main__":
    main()
