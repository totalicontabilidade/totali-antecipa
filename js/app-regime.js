/* =====================================================================
   Totali Antecipa — identificação do regime (Simples × normal)
   1) Receita Federal via BrasilAPI (campo opcao_pelo_simples), com
      fallback minhareceita.org — mesma fonte usada no Fiscal Certo.
   2) Espelho do DIA: a "Forma Recolhimento" da SEFAZ denuncia o regime
      (COMPLEMENTAÇÃO DE ALÍQUOTA INTERESTADUAL = Simples, receita 2607).
   O regime só fica "confirmado" quando o usuário salva na tela.
   ===================================================================== */

async function consultarCnpj(cnpj) {
  cnpj = String(cnpj || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw new Error('CNPJ inválido');
  const fontes = [
    { url: 'https://brasilapi.com.br/api/cnpj/v1/' + cnpj, nome: 'Receita Federal (BrasilAPI)' },
    { url: 'https://minhareceita.org/' + cnpj, nome: 'Receita Federal (minhareceita.org)' },
  ];
  let erro = '';
  for (const f of fontes) {
    try {
      const r = await fetch(f.url, { headers: { Accept: 'application/json' } });
      if (!r.ok) { erro = f.nome + ': HTTP ' + r.status; continue; }
      const j = await r.json();
      return {
        fonte: f.nome, razao: j.razao_social || '', fantasia: j.nome_fantasia || '', uf: j.uf || '', municipio: j.municipio || '',
        simples: j.opcao_pelo_simples === true ? true : j.opcao_pelo_simples === false ? false : null,
        mei: j.opcao_pelo_mei === true, porte: j.porte || '', cnae: j.cnae_fiscal || '', cnaeDesc: j.cnae_fiscal_descricao || '',
        situacao: j.descricao_situacao_cadastral || j.situacao_cadastral || '', dataSimples: j.data_opcao_pelo_simples || '',
        cnaes: [{ codigo: String(j.cnae_fiscal || ''), descricao: j.cnae_fiscal_descricao || '', principal: true }]
          .concat((j.cnaes_secundarios || []).filter(c => c && c.codigo).map(c => ({ codigo: String(c.codigo), descricao: c.descricao || '', principal: false })))
          .filter(c => c.codigo && c.codigo !== '0'),
      };
    } catch (e) { erro = f.nome + ': ' + e.message; }
  }
  throw new Error(erro || 'sem resposta');
}

function regimeFonteTxt(e) { return e.regimeFonte ? ' · ' + e.regimeFonte : ''; }

// Identifica o regime da empresa atual pela Receita (se ainda não confirmado pelo usuário)
async function identificarRegime(forcar) {
  const E = empresaAtual(); if (!E || !E.cnpj) return;
  if (E.regimeConfirmado && !forcar) return;
  try {
    const d = await consultarCnpj(E.cnpj);
    if (d.simples == null) { showToast('Receita não informou a opção pelo Simples para ' + fmtCnpj(E.cnpj) + '. Confirme o regime em Cadastros › Empresas.', ''); return; }
    const novo = d.simples ? 'simples' : 'normal';
    const mudou = novo !== E.regime;
    E.regime = novo; E.regimeFonte = d.fonte + " em " + new Date().toLocaleDateString("pt-BR") + (d.mei ? " (MEI)" : ""); if (d.cnaes && d.cnaes.length) E.cnaes = d.cnaes;
    if (d.razao && (!E.nome || /^Contribuinte /.test(E.nome))) E.nome = d.razao;
    if (d.uf && d.uf !== 'SE') showToast('Atenção: a Receita mostra a empresa em ' + d.uf + ', não em Sergipe.', 'error');
    salvar(); renderEmpresasSelect(); recalcular(); if (ST.view === 'empresas') renderEmpresas();
    showToast((d.simples ? 'Simples Nacional' : 'Regime normal') + ' identificado pela Receita Federal para ' + (d.razao || fmtCnpj(E.cnpj)) + (mudou ? ' — cálculo refeito.' : '.'), 'success');
  } catch (e) { console.warn('consulta CNPJ', e); }
}

// Sugere o regime pela forma de recolhimento do espelho da SEFAZ
function sugerirRegimePeloEspelho(esp) {
  const E = empresaAtual(); if (!E || E.regimeConfirmado || !esp || !esp.linhas) return;
  let simples = 0, normal = 0;
  for (const l of esp.linhas) {
    const f = String(l.forma || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (f.includes('COMPLEMENTACAO DE ALIQUOTA')) simples++;
    else if (f.includes('SEM ENCERRAMENTO') || f.includes('OPERACAO INTERESTADUAL') || f.includes('ANTECIPACAO PARCIAL')) normal++;
  }
  // Cesta básica optante: a SEFAZ calcula 3,6% ou 2,1% direto sobre o valor da nota
  if (!E.cestaConfirmada) {
    const opt = esp.linhas.filter(l => l.vlTotal > 0 && (l.partes || [l]).some(p => { const r = (p.vlRecolher || 0) / l.vlTotal; return Math.abs(r - 0.036) < 0.0006 || Math.abs(r - 0.021) < 0.0006; })).length;
    if (opt && !E.cestaOptante) { E.cestaOptante = true; E.cestaFonte = 'espelho do DIA (' + opt + ' nota(s) a 3,6%/2,1%)'; salvar(); showToast('Espelho indica que a empresa é OPTANTE do regime simplificado da cesta básica (3,6%/2,1%) — marcado automaticamente; confira em Empresas.', ''); }
  }
  if (!simples && !normal) return;
  const novo = simples >= normal ? 'simples' : 'normal';
  if (E.regimeFonte && /Receita Federal/.test(E.regimeFonte)) return; // a Receita manda mais que a heurística
  E.regime = novo; E.regimeFonte = 'espelho do DIA (' + (simples ? simples + ' nota(s) "complementação de alíquota"' : '') + (simples && normal ? ', ' : '') + (normal ? normal + ' nota(s) sem encerramento' : '') + ')';
  salvar(); renderEmpresasSelect();
  showToast('Regime sugerido pelo espelho da SEFAZ: ' + (novo === 'simples' ? 'Simples Nacional' : 'regime normal') + '. Confirme em Cadastros › Empresas.', '');
}

// Botão no modal da empresa
$('btnConsultarCnpj').onclick = async () => {
  const cnpj = $('eCnpj').value.replace(/\D/g, ''); const info = $('eRegimeInfo');
  if (cnpj.length !== 14) return showToast('Informe o CNPJ com 14 dígitos.', 'error');
  info.style.display = 'block'; info.className = 'alert baixo'; info.textContent = 'Consultando a Receita Federal…';
  try {
    const d = await consultarCnpj(cnpj);
    if (!$('eNome').value.trim() || /^Contribuinte /.test($('eNome').value)) $('eNome').value = d.razao;
    if (d.simples != null) $('eRegime').value = d.simples ? 'simples' : 'normal';
    info.className = 'alert ' + (d.simples == null ? 'medio' : 'baixo');
    info.innerHTML = `<b>${esc(d.razao)}</b>${d.fantasia ? ' (' + esc(d.fantasia) + ')' : ''} · ${esc(d.municipio)}/${esc(d.uf)} · ${esc(d.porte)}${d.mei ? ' · MEI' : ''}<br>` +
      (d.simples == null ? 'A Receita não informou a opção pelo Simples — escolha o regime manualmente.' : `<b>${d.simples ? 'OPTANTE do Simples Nacional' : 'NÃO optante do Simples (regime normal)'}</b>${d.dataSimples ? ' desde ' + d.dataSimples.split('-').reverse().join('/') : ''}`) +
      ` · situação: ${esc(String(d.situacao))} · CNAE ${esc(String(d.cnae))} — fonte: ${esc(d.fonte)}`;
    $("eObs").dataset.regimeFonte = d.fonte + " em " + new Date().toLocaleDateString("pt-BR");
    window._cnaesConsulta = d.cnaes || []; renderCnaes(d.cnaes || []);
  } catch (e) { info.className = 'alert alto'; info.textContent = 'Não consegui consultar: ' + e.message + '. Escolha o regime manualmente.'; }
};

// Cesta básica optante confirmada pelos XMLs: compara a parte "com encerramento" do espelho com o cálculo a 3,6%/2,1%
function sugerirCestaPelosXmls() {
  const E = empresaAtual(); if (!E || E.cestaConfirmada || E.cestaOptante || E.regime === 'simples') return;
  let votos = 0, contra = 0;
  for (const r of RES) {
    const l = CONF.find(x => x.chave === r.nota.chave); const partes = (l && l.esp && l.esp.partes) || [];
    const enc = partes.find(p => /COM ENCERRAMENTO/i.test((p.forma || '').normalize('NFD').replace(/[̀-ͯ]/g, '')));
    if (!enc) continue;
    const cesta = r.itens.filter(i => i.regra && i.regra.regime === 'cesta'); if (!cesta.length) continue;
    const opt = cesta.reduce((s, i) => s + i.F * ((i.regra.cestaPct != null ? i.regra.cestaPct : 2.1) / 100), 0);
    if (Math.abs(opt - enc.vlRecolher) < 0.06) votos++; else contra++;
  }
  if (votos && votos >= contra) {
    E.cestaOptante = true; E.cestaFonte = 'espelho × XML (' + votos + ' nota(s) batem a 3,6%/2,1%)'; salvar(); recalcular();
    showToast('A SEFAZ cobrou a cesta básica a 3,6%/2,1% no espelho: empresa marcada como OPTANTE do regime simplificado. Confira em Empresas.', '');
  }
}

// Lista de CNAEs no modal da empresa (com a família que o sistema usa para supor a finalidade)
function renderCnaes(cnaes) {
  const el = $('eCnaes'); if (!el) return;
  if (!cnaes || !cnaes.length) { el.innerHTML = '<span class="muted">Clique em "Receita" para puxar a atividade principal e as secundárias.</span>'; return; }
  el.innerHTML = '<div class="chips">' + cnaes.map(c => { const f = cnaeFamilia(c.codigo); return `<span class="chip" title="${esc(c.descricao || '')}">${c.principal ? '<b>principal</b> · ' : ''}${esc(c.codigo)} — ${esc((c.descricao || f.nome).slice(0, 60))}${f.capitulos.length ? ' <span class="muted">(revende cap. NCM ' + f.capitulos.slice(0, 8).join(', ') + (f.capitulos.length > 8 ? '…' : '') + ')</span>' : ''}</span>`; }).join('') + '</div>';
}
// Ao abrir o modal de uma empresa já consultada, mostra os CNAEs guardados
const _editarEmpresaOrig = editarEmpresa;
editarEmpresa = function (id) { _editarEmpresaOrig(id); const e = DB.empresas.find(x => x.id === id); window._cnaesConsulta = null; renderCnaes(e && e.cnaes); };
