/* =====================================================================
   Totali Antecipa — leitor de XML da NF-e (modelo 55, leiaute 4.00)
   Converte nfeProc/NFe em um objeto simples usado pelo motor.
   ===================================================================== */

const NFE = (() => {

  function num(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; }

  function q(node, path) {
    // path simples "a/b/c" ignorando namespace
    if (!node) return null;
    let cur = node;
    for (const p of path.split('/')) {
      if (!cur) return null;
      let found = null;
      for (const ch of cur.children) { if (ch.localName === p) { found = ch; break; } }
      cur = found;
    }
    return cur;
  }
  function t(node, path, def = '') { const n = q(node, path); return n && n.textContent != null ? n.textContent.trim() : def; }
  function first(node, name) { // primeiro descendente com localName
    if (!node) return null;
    const all = node.getElementsByTagName('*');
    for (const el of all) if (el.localName === name) return el;
    return null;
  }

  function parse(xmlText, nomeArquivo) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido: ' + (nomeArquivo || ''));
    const infNFe = first(doc, 'infNFe');
    if (!infNFe) throw new Error('Não é uma NF-e (infNFe não encontrado): ' + (nomeArquivo || ''));

    const ide = q(infNFe, 'ide'), emit = q(infNFe, 'emit'), dest = q(infNFe, 'dest'), total = q(infNFe, 'total/ICMSTot');
    const chave = (infNFe.getAttribute('Id') || '').replace(/^NFe/, '');
    const prot = first(doc, 'protNFe');

    const nota = {
      chave,
      arquivo: nomeArquivo || '',
      nNF: t(ide, 'nNF'), serie: t(ide, 'serie'), mod: t(ide, 'mod'),
      dhEmi: t(ide, 'dhEmi') || t(ide, 'dEmi'),
      natOp: t(ide, 'natOp'), tpNF: t(ide, 'tpNF'), idDest: t(ide, 'idDest'),
      finNFe: t(ide, 'finNFe'), indFinal: t(ide, 'indFinal'),
      emit: {
        cnpj: t(emit, 'CNPJ') || t(emit, 'CPF'), nome: t(emit, 'xNome'), fant: t(emit, 'xFant'),
        uf: t(emit, 'enderEmit/UF'), mun: t(emit, 'enderEmit/xMun'), ie: t(emit, 'IE'), crt: t(emit, 'CRT'),
      },
      dest: {
        cnpj: t(dest, 'CNPJ') || t(dest, 'CPF'), nome: t(dest, 'xNome'),
        uf: t(dest, 'enderDest/UF'), mun: t(dest, 'enderDest/xMun'), ie: t(dest, 'IE'), indIEDest: t(dest, 'indIEDest'),
      },
      tot: {
        vProd: num(t(total, 'vProd')), vNF: num(t(total, 'vNF')), vBC: num(t(total, 'vBC')), vICMS: num(t(total, 'vICMS')),
        vBCST: num(t(total, 'vBCST')), vST: num(t(total, 'vST')), vIPI: num(t(total, 'vIPI')), vFrete: num(t(total, 'vFrete')),
        vSeg: num(t(total, 'vSeg')), vDesc: num(t(total, 'vDesc')), vOutro: num(t(total, 'vOutro')), vFCP: num(t(total, 'vFCP')),
        vFCPST: num(t(total, 'vFCPST')), vICMSDeson: num(t(total, 'vICMSDeson')),
      },
      protocolo: prot ? { nProt: t(first(prot, 'infProt'), 'nProt'), cStat: t(first(prot, 'infProt'), 'cStat'), xMotivo: t(first(prot, 'infProt'), 'xMotivo') } : null,
      itens: [],
    };
    nota.dataEmissao = nota.dhEmi ? nota.dhEmi.substring(0, 10) : '';

    for (const det of infNFe.children) {
      if (det.localName !== 'det') continue;
      const prod = q(det, 'prod'), imp = q(det, 'imposto');
      const icmsWrap = q(imp, 'ICMS');
      let grupo = null; if (icmsWrap) for (const ch of icmsWrap.children) { grupo = ch; break; }
      const ipi = first(q(imp, 'IPI'), 'vIPI');
      const item = {
        nItem: parseInt(det.getAttribute('nItem') || '0', 10),
        cProd: t(prod, 'cProd'), xProd: t(prod, 'xProd'), ncm: t(prod, 'NCM').replace(/\D/g, ''), cest: t(prod, 'CEST').replace(/\D/g, ''),
        cfop: t(prod, 'CFOP'), uCom: t(prod, 'uCom'), qCom: num(t(prod, 'qCom')), vUnCom: num(t(prod, 'vUnCom')),
        vProd: num(t(prod, 'vProd')), vFrete: num(t(prod, 'vFrete')), vSeg: num(t(prod, 'vSeg')), vDesc: num(t(prod, 'vDesc')), vOutro: num(t(prod, 'vOutro')),
        indTot: t(prod, 'indTot', '1'),
        icms: {
          grupo: grupo ? grupo.localName : '', orig: t(grupo, 'orig'), cst: t(grupo, 'CST'), csosn: t(grupo, 'CSOSN'),
          modBC: t(grupo, 'modBC'), pRedBC: num(t(grupo, 'pRedBC')), vBC: num(t(grupo, 'vBC')), pICMS: num(t(grupo, 'pICMS')), vICMS: num(t(grupo, 'vICMS')),
          vBCST: num(t(grupo, 'vBCST')), pMVAST: num(t(grupo, 'pMVAST')), pICMSST: num(t(grupo, 'pICMSST')), vICMSST: num(t(grupo, 'vICMSST')),
          vBCSTRet: num(t(grupo, 'vBCSTRet')), vICMSSTRet: num(t(grupo, 'vICMSSTRet')),
          pFCP: num(t(grupo, 'pFCP')), vFCP: num(t(grupo, 'vFCP')), vFCPST: num(t(grupo, 'vFCPST')),
          pCredSN: num(t(grupo, 'pCredSN')), vCredICMSSN: num(t(grupo, 'vCredICMSSN')), vICMSDeson: num(t(grupo, 'vICMSDeson')),
        },
        vIPI: ipi ? num(ipi.textContent) : 0,
      };
      nota.itens.push(item);
    }
    return nota;
  }

  // Alíquota interestadual esperada para a origem informada (quando a nota não destaca ICMS)
  function aliquotaInterestadual(ufEmit, origProduto, tab) {
    const o = String(origProduto || '0');
    if (['1', '2', '3', '8'].includes(o)) return tab.aliquotaImportado;      // importado / conteúdo importação > 40%
    return tab.ufs7.includes(ufEmit) ? 7 : 12;
  }

  return { parse, aliquotaInterestadual, num };
})();
