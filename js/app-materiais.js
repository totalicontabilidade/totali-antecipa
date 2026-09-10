/* =====================================================================
   Totali Antecipa — tela "Materiais de apoio", fundamentos e init
   (carregado depois de app.js)
   ===================================================================== */

function renderMateriais() {
  const tb = $('tblMateriais').querySelector('tbody');
  tb.innerHTML = Object.entries(MATERIAIS.DEF).map(([nome, d]) => { const s = MATERIAIS.status[nome] || {}; return `<tr><td><b>${esc(d.rotulo)}</b><div class="small muted mono">${esc(d.arquivo)}</div></td><td class="small">${esc(d.origem)}</td><td class="small">${esc(d.uso)}</td><td class="num">${s.linhas != null ? s.linhas.toLocaleString('pt-BR') : '—'}</td><td>${s.ok ? '<span class="badge b-ok">carregada</span>' : `<span class="badge b-warn" title="${esc(s.erro || '')}">não carregada</span>`}</td><td><button class="btn sm ghost" data-imp="${nome}">Importar</button></td></tr>`; }).join('');
  tb.querySelectorAll('[data-imp]').forEach(b => b.onclick = () => { const i = $('fileMaterial'); i.dataset.nome = b.dataset.imp; i.click(); });
  const segs = MATERIAIS.segmentos();
  $('matSegmentos').innerHTML = segs ? Object.entries(segs).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<span class="chip"><b>${esc(s)}</b> · ${n} NCM</span>`).join('') : '<span class="small muted">planilha ST/SE não carregada</span>';
}
$('fileMaterial').onchange = async () => { const f = $('fileMaterial').files[0]; const nome = $('fileMaterial').dataset.nome; if (!f || !nome) return; try { MATERIAIS.importarArquivo(nome, await f.text()); showToast(MATERIAIS.DEF[nome].rotulo + ' importada: ' + MATERIAIS.status[nome].linhas + ' linhas.', 'success'); renderMateriais(); recalcular(); } catch (e) { showToast('Falha ao importar: ' + e.message, 'error'); } $('fileMaterial').value = ''; };
$('btnRecarregarMat').onclick = async () => { await MATERIAIS.carregarTodos(); renderMateriais(); recalcular(); showToast('Materiais recarregados.', 'success'); };

function fichaHtml(f) {
  const bloco = (t, inner) => `<div style="margin-top:10px"><b>${t}</b>${inner}</div>`;
  let h = `<div class="stat"><span>NCM <b class="mono">${esc(f.ncm)}</b></span>${f.info ? `<span>${f.info.existe ? '<span class="badge b-ok">vigente</span>' : '<span class="badge b-warn">não consta / extinto</span>'}</span>` : '<span class="badge b-muted">tabela NCM não carregada</span>'}</div>`;
  if (f.info && f.info.descricao) h += `<div style="margin-top:6px">${esc(f.info.descricao)}</div>`;
  h += bloco('Portal Nacional da ST — Sergipe (MVA-ST por alíquota de origem)', f.portal ? (f.portal.linhas.length ? `<table class="tbl compact"><thead><tr><th>Anexo/Segmento</th><th>CEST</th><th>NCM</th><th>Descrição</th><th class="num">4%</th><th class="num">7%</th><th class="num">12%</th><th class="num">Interna</th><th>PFC</th><th>Alíq./FECOEP</th><th>Base</th></tr></thead><tbody>${f.portal.linhas.slice(0, 12).map(l => `<tr><td class="small">${esc(l.anexo)} ${esc(l.segmento)}</td><td class="mono">${esc(l.cest)}</td><td class="mono">${esc(l.ncm)}</td><td class="small">${esc((l.descricao || '').slice(0, 70))}</td><td class="num">${l.mva4 != null ? l.mva4 + '%' : (l.mva_ns4 != null ? '<span title="não signatário">' + l.mva_ns4 + '%*</span>' : '—')}</td><td class="num">${l.mva7 != null ? l.mva7 + '%' : '—'}</td><td class="num">${l.mva12 != null ? l.mva12 + '%' : '—'}</td><td class="num">${l.mva_int != null ? l.mva_int + '%' : '—'}</td><td>${l.pfc ? 'R$ ' + esc(l.pfc) : '—'}</td><td class="small">${esc(l.aliq_txt || (l.aliq_interna != null ? l.aliq_interna + '%' : ''))}${l.fecoep === 0 ? ' <span class="badge b-muted">sem FECOEP</span>' : ''}</td><td class="small">${esc(l.protocolo || '')} ${esc(l.legislacao || '')}</td></tr>`).join('')}</tbody></table>${!f.portal.exato ? `<div class="hint">casado pelo prefixo ${esc(f.portal.prefixo)}</div>` : ''}` : '<div class="small muted">não consta do Portal da ST para Sergipe</div>') : '<div class="small muted">tabela do Portal não carregada</div>');
  h += bloco('ST / MVA em Sergipe (planilha do Fiscal Certo)', f.st ? (f.st.linhas.length ? `<table class="tbl compact"><thead><tr><th>NCM</th><th>CEST</th><th class="num">MVA</th><th class="num">Alíq.</th><th>Segmento</th><th>Norma</th></tr></thead><tbody>${f.st.linhas.slice(0, 12).map(l => `<tr><td class="mono">${esc(l.ncm)}</td><td class="mono">${esc(l.cest)}</td><td class="num">${l.mva != null ? l.mva + "%" : "<span class=\"badge b-warn\" title=\"sem MVA na planilha: produto com pauta fiscal (PMPF)\">pauta</span>"}</td><td class="num">${l.aliq_interna != null ? l.aliq_interna + "%" : "—"}</td><td>${esc(l.segmento)}</td><td class="small">${esc(l.norma)} — ${esc(l.dispositivo)}<div class="muted">${esc((l.trecho || '').slice(0, 160))}</div></td></tr>`).join('')}</tbody></table>${!f.st.exato ? `<div class="hint">casado pelo prefixo ${f.st.prefixo}</div>` : ''}` : '<div class="small muted">não consta da planilha oficial de ST de SE → sem antecipação com encerramento por esta fonte (vale a regra geral 10%/20% ou o Anexo X)</div>') : '<div class="small muted">tabela não carregada</div>');
  h += bloco('CEST (Convênio 142/2018)', f.cest.length ? `<div class="chips">${f.cest.slice(0, 10).map(c => `<span class="chip"><b>${esc(c.cest)}</b> ${esc(c.segmento)} · ${esc((c.descricao || '').slice(0, 60))}</span>`).join('')}</div>` : '<div class="small muted">sem CEST para o NCM</div>');
  h += bloco('Benefícios no RICMS/SE (Anexos I, II e IX)', f.beneficios.length ? f.beneficios.slice(0, 8).map(b => `<div class="small"><span class="badge ${b.tipo === 'isencao' ? 'b-ok' : b.tipo === 'reducao' ? 'b-warn' : 'b-info'}">${esc(b.tipo)}</span> Anexo ${esc(b.anexo)} — ${esc(b.dispositivo)}<div class="muted">${esc((b.trecho || '').slice(0, 200))}</div></div>`).join('') : '<div class="small muted">nenhum benefício listado</div>');
  const lst = (arr, fmtf) => arr.length ? arr.slice(0, 6).map(fmtf).join('') : '<div class="small muted">—</div>';
  h += bloco('TIPI (IPI)', lst(f.tipi, l => `<div class="small">NCM ${esc(l.ncm)} → alíquota ${esc(l.aliquota ?? l.aliq ?? '')}%</div>`));
  h += bloco('PIS/COFINS (IN RFB 2.121/2022)', lst(f.piscofins, l => `<div class="small"><b>${esc(l.regime || '')}</b> — ${esc(l.norma || '')} ${esc(l.dispositivo || '')}<div class="muted">${esc((l.trecho || '').slice(0, 160))}</div></div>`));
  h += bloco('IBS/CBS (LC 214/2025)', lst(f.ibscbs, l => `<div class="small"><b>${esc(l.tratamento || '')}</b> ${l.reducao ? 'redução ' + esc(l.reducao) : ''} — ${esc(l.norma || '')} ${esc(l.dispositivo || '')}</div>`));
  h += bloco('IN RFB 2.121/2022 — índice', lst(f.in2121, l => `<div class="small">${esc(l.artigo || '')} (pág. ${esc(l.pagina || '')}) — <span class="muted">${esc((l.trecho || '').slice(0, 160))}</span></div>`));
  if (f.termos.length) h += bloco('Termos do produto (conhecimento do escritório)', f.termos.map(t => `<div class="small">"${esc(t.termo)}" → NCM esperado <b>${esc(t.ncm)}</b> (${esc(t.descricao)}) ${t.preparo === 'S' ? '· preparo próprio' : ''}</div>`).join(''));
  return h;
}
function consultarNcm() { const n = $('matNcm').value.replace(/\D/g, ''); if (n.length < 2) return; $('matFicha').innerHTML = fichaHtml(MATERIAIS.ficha(n, '', $('matProd').value)); }
$('btnMatConsultar').onclick = consultarNcm; $('matNcm').addEventListener('keydown', e => { if (e.key === 'Enter') consultarNcm(); });

// ------------------------------------------------------------------ fundamentos (Ajuda)
if (typeof FUNDAMENTOS !== 'undefined') {
  const card = document.createElement('div'); card.className = 'card'; card.style.gridColumn = '1 / -1';
  card.innerHTML = '<h3>Fundamentos com transcrição (materiais do Fiscal Certo)</h3>' + FUNDAMENTOS.map(f => `<div class="memo" style="margin-bottom:8px"><div class="p"><b>${esc(f.norma)}<div class="small muted">${esc(f.dispositivo)}</div></b><span>“${esc(f.trecho)}”</span></div></div>`).join('') + '<div class="hint">Transcrições embutidas — confira contra a norma oficial na primeira rodada.</div>';
  document.querySelector('#view-ajuda .grid').appendChild(card);
}

// ------------------------------------------------------------------ init
renderEmpresasSelect(); $('inpComp').value = ST.comp; recalcular(); showView('apuracao');
MATERIAIS.carregarTodos().then(st => { const ok = Object.values(st).filter(s => s.ok).length; recalcular(); if (ST.view === 'materiais') renderMateriais(); console.info('materiais carregados:', ok, st); });

// ------------------------------------------------------------------ versão (Ajuda)
if (typeof APP_VERSAO !== 'undefined') {
  const card = document.createElement('div'); card.className = 'card'; card.style.gridColumn = '1 / -1';
  card.innerHTML = `<h3>Versão do sistema</h3><div class="stat"><span><b>${esc(APP_VERSAO.nome)} v${esc(APP_VERSAO.numero)}</b> · ${esc(APP_VERSAO.data)}</span><span>tabelas de Sergipe <b>${esc(TABELAS_SE.versao)}</b></span><span>materiais: ${Object.keys(MATERIAIS.DEF).length} tabelas</span></div>` + APP_VERSAO.historico.map(h => `<div class="small" style="margin-top:6px"><b>v${esc(h.v)}</b> (${esc(h.data)}) — ${esc(h.o)}</div>`).join('');
  document.querySelector('#view-ajuda .grid').appendChild(card);
}

// ------------------------------------------------------------------ aviso de notas com erro (só fecha no OK)
// Portal Nacional da NF-e — consulta manual pela chave de acesso (exige captcha, por isso abre em outra aba)
// A tela de consulta não aceita a chave pela URL (o captcha existe para isso), então o atalho copia a chave e abre a tela: basta colar.
const PORTAL_NFE_URL = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=';
const AJUDA_ERROS_PADRAO = 'Baixe o XML dessas notas manualmente (Portal Nacional, e-mail do fornecedor ou o programa Procura XML) e arraste no Passo 2. As chaves estão abaixo para copiar.';
const AJUDA_ERROS_SEFAZ = `A SEFAZ não entregou o XML dessas notas (rejeição, fora de prazo ou sem resposta). Clique em <b>consultar</b> na nota: a chave é copiada e a <a href="${PORTAL_NFE_URL}" target="_blank" rel="noopener"><b>tela de consulta do Portal Nacional</b></a> abre em outra aba — cole a chave (Ctrl+V), resolva o captcha e baixe o XML. Depois arraste o arquivo no Passo 2. Se o portal não liberar o download, peça o XML ao fornecedor.`;
// modo 'sefaz': aviso com o link do Portal Nacional e um atalho de consulta em cada nota
function mostrarErros(lista, subtitulo, modo) {
  if (!lista || !lista.length) return;
  const sefaz = modo === 'sefaz';
  $('meSub').textContent = subtitulo || (lista.length + ' nota(s)');
  $('meAjuda').innerHTML = sefaz ? AJUDA_ERROS_SEFAZ : AJUDA_ERROS_PADRAO;
  $('meLista').innerHTML = lista.map(e => `<tr><td><b>${esc(e.nNF || '—')}</b></td><td>${esc(e.emitente || '—')}${e.uf ? ' <span class="badge b-muted">' + esc(e.uf) + '</span>' : ''}</td><td class="mono" style="font-size:11px">${esc(e.chave || '—')}${sefaz && e.chave ? ` <a href="${PORTAL_NFE_URL}" target="_blank" rel="noopener" class="small" data-chave="${esc(e.chave)}" title="Copia a chave e abre o Portal Nacional em outra aba">consultar ↗</a>` : ''}</td><td class="small">${esc(e.motivo || '')}</td></tr>`).join('');
  $('meLista').querySelectorAll('a[data-chave]').forEach(a => a.addEventListener('click', () => { try { navigator.clipboard.writeText(a.dataset.chave); showToast('Chave copiada — cole no campo da consulta (Ctrl+V) e resolva o captcha.', 'success'); } catch (e) { } }));
  $('meChaves').value = lista.map(e => e.chave).filter(Boolean).join('\n');
  openModal('modal-erros');
}
$('btnErrosOk').onclick = () => closeModal('modal-erros');
$('btnCopiarChaves').onclick = () => { $('meChaves').select(); try { navigator.clipboard.writeText($('meChaves').value); showToast('Chaves copiadas.', 'success'); } catch (e) { document.execCommand('copy'); } };

// ------------------------------------------------------------------ documentos de apoio (skill icms-antecipado-se + Fiscal Certo)
const DOCS_APOIO = [
  { t: 'Núcleo ICMS Antecipado/SE — como decidir e calcular (skill da Totali)', a: 'docs/icms-antecipado-se/SKILL.md', md: true },
  { t: 'Tabelas e parâmetros de SE — alíquotas, MVA, Anexo X, FECOEP, prazos (ATUALIZAR AQUI)', a: 'docs/icms-antecipado-se/tabelas.md', md: true },
  { t: 'Legislação, fórmulas e fronteiras (antecipação × DIFAL × ST)', a: 'docs/icms-antecipado-se/legislacao.md', md: true },
  { t: 'Motor de referência em Python (calc_antecipacao.py)', a: 'docs/icms-antecipado-se/calc_antecipacao.py', md: false },
  { t: "Relatório do Fiscal Certo (exemplo de apontamentos com fundamentos)", a: "docs/Fiscal_Certo.pdf", md: false },
  { t: "RICMS/SE — Regulamento do ICMS vigente (Decreto 21.400/2002), PDF oficial da SEFAZ/SE (baixado em 09/09/2026)", a: "docs/ricms-se/RICMS_SE_vigente_sem_historico.pdf", md: false },
  { t: "RICMS/SE — Anexos do Regulamento (Anexo I isenções, II base reduzida, IX ST, X antecipação), PDF oficial", a: "docs/ricms-se/Anexos_RICMS_SE_com_historico.pdf", md: false },
  { t: "RICMS/SE — texto extraído para busca (arts. 784 a 796, 674-A, 616-C-A…)", a: "docs/ricms-se/RICMS_SE_texto.txt", md: false, busca: "ricms" },
  { t: "Anexos do RICMS/SE — texto extraído para busca (Anexo X etc.)", a: "docs/ricms-se/Anexos_RICMS_SE_texto.txt", md: false, busca: "anexos" },
];
function mdParaHtml(md) {
  const e = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out = []; let inTable = false, inList = false, inCode = false;
  for (const raw of md.split(/\r?\n/)) {
    const l = raw;
    if (/^```/.test(l)) { inCode = !inCode; out.push(inCode ? '<pre class="mono" style="background:#f3f3f3;padding:8px;border-radius:6px;white-space:pre-wrap">' : '</pre>'); continue; }
    if (inCode) { out.push(esc(l)); continue; }
    if (/^\|/.test(l)) { if (/^\|\s*-/.test(l)) continue; const cells = l.split('|').slice(1, -1); if (!inTable) { out.push('<table class="tbl compact"><tbody>'); inTable = true; out.push('<tr>' + cells.map(c => '<th>' + e(c.trim()) + '</th>').join('') + '</tr>'); } else out.push('<tr>' + cells.map(c => '<td>' + e(c.trim()) + '</td>').join('') + '</tr>'); continue; }
    if (inTable) { out.push('</tbody></table>'); inTable = false; }
    if (/^\s*[-*]\s+/.test(l)) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + e(l.replace(/^\s*[-*]\s+/, '')) + '</li>'); continue; }
    if (inList) { out.push('</ul>'); inList = false; }
    const h = l.match(/^(#{1,4})\s+(.*)/); if (h) { out.push(`<h${h[1].length + 1}>${e(h[2])}</h${h[1].length + 1}>`); continue; }
    if (/^>\s?/.test(l)) { out.push('<div class="alert baixo">' + e(l.replace(/^>\s?/, '')) + '</div>'); continue; }
    if (l.trim() === '') { out.push('<div style="height:6px"></div>'); continue; }
    out.push('<p style="margin:2px 0">' + e(l) + '</p>');
  }
  if (inList) out.push('</ul>'); if (inTable) out.push('</tbody></table>');
  return out.join('\n');
}
async function abrirDoc(d) {
  if (!d.md) { window.open(d.a, '_blank'); return; }
  try { const txt = await (await fetch(d.a)).text(); $('mnTitulo').textContent = d.t; $('mnSub').textContent = d.a; $('mnBody').innerHTML = '<div style="max-width:980px">' + mdParaHtml(txt) + '</div>'; openModal('modal-nota'); }
  catch (e) { showToast('Não consegui abrir o documento (abra pelo INICIAR.bat): ' + e.message, 'error'); }
}
(function () {
  const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '16px';
  card.innerHTML = '<h3>Documentos de apoio</h3><div class="small muted" style="margin-bottom:8px">Base de conhecimento do ICMS antecipado de Sergipe (skill icms-antecipado-se da Totali) e o relatório do Fiscal Certo. Ficam na pasta docs/.</div>' + DOCS_APOIO.map((d, i) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><a href="#" data-doc="${i}"><b>${esc(d.t)}</b></a> <span class="small muted mono">${esc(d.a)}</span></div>`).join('');
  document.getElementById('view-materiais').appendChild(card);
  card.querySelectorAll('[data-doc]').forEach(a => a.onclick = ev => { ev.preventDefault(); abrirDoc(DOCS_APOIO[+a.dataset.doc]); });
})();

// ------------------------------------------------------------------ busca no texto oficial do RICMS/SE
const _txtCache = {};
async function buscarRicms() {
  const q = $('ricmsBusca').value.trim(); const fonte = $('ricmsFonte').value; const out = $('ricmsRes');
  if (q.length < 3) return;
  const arq = fonte === 'anexos' ? 'docs/ricms-se/Anexos_RICMS_SE_texto.txt' : 'docs/ricms-se/RICMS_SE_texto.txt';
  out.innerHTML = '<div class="small muted">carregando o texto…</div>';
  try {
    if (!_txtCache[arq]) _txtCache[arq] = (await (await fetch(arq)).text()).split(/\r?\n/);
    const linhas = _txtCache[arq];
    // "Art. 785" → começa no artigo e mostra até o próximo "Art."; senão, busca livre com contexto
    const mArt = q.match(/^art\.?\s*(\d+)\s*(-?\s*[A-Z])?$/i);
    let html = '';
    if (mArt) {
      const alvo = ('Art. ' + mArt[1] + (mArt[2] ? '-' + mArt[2].replace(/[^A-Z]/gi, '').toUpperCase() : '') + '.').toLowerCase();
      const ini = linhas.findIndex(l => l.trim().toLowerCase().startsWith(alvo) || l.trim().toLowerCase().startsWith(alvo.replace('.', '')));
      if (ini < 0) html = '<div class="alert medio">Não achei "' + esc(q) + '" no início de linha. Tente a busca livre (ex.: "antecipação sem encerramento").</div>';
      else { let fim = ini + 1; while (fim < linhas.length && fim - ini < 400 && !/^Art\.\s*\d/.test(linhas[fim].trim())) fim++; html = '<div class="memo"><pre style="white-space:pre-wrap;font-family:inherit;margin:0">' + esc(linhas.slice(ini, fim).join('\n').replace(/\n{2,}/g, '\n')) + '</pre></div>'; }
    } else {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); const hits = [];
      for (let i = 0; i < linhas.length && hits.length < 40; i++) if (re.test(linhas[i])) hits.push(i);
      html = hits.length ? hits.map(i => `<div class="memo" style="margin-bottom:6px"><div class="small muted">linha ${i + 1}</div><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(linhas.slice(Math.max(0, i - 3), i + 6).join('\n'))}</pre></div>`).join('') + (hits.length >= 40 ? '<div class="hint">mostrando as 40 primeiras ocorrências</div>' : '') : '<div class="small muted">nada encontrado</div>';
    }
    out.innerHTML = html;
  } catch (e) { out.innerHTML = '<div class="alert alto">Não consegui ler o texto (abra pelo INICIAR.bat): ' + esc(e.message) + '</div>'; }
}
(function () {
  const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '16px';
  card.innerHTML = '<h3>Buscar no RICMS/SE (texto oficial)</h3><div class="row"><select class="fi" id="ricmsFonte" style="width:220px"><option value="ricms">Regulamento (artigos)</option><option value="anexos">Anexos (I, II, IX, X…)</option></select><input class="fi" id="ricmsBusca" placeholder="ex.: Art. 785, Art. 674-A, cesta básica, Anexo X" style="flex:1"><button class="btn sm" id="btnRicmsBusca">Buscar</button></div><div class="hint">Digite "Art. 787" para ver o artigo inteiro, ou uma expressão para busca livre. Texto extraído do PDF oficial da SEFAZ/SE em 09/09/2026.</div><div id="ricmsRes" style="margin-top:10px"></div>';
  const v = document.getElementById('view-materiais'); v.insertBefore(card, v.children[1]);
  $('btnRicmsBusca').onclick = buscarRicms; $('ricmsBusca').addEventListener('keydown', e => { if (e.key === 'Enter') buscarRicms(); });
})();
