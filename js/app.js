/* =====================================================================
   Totali Antecipa — interface (estado, telas, eventos)
   ===================================================================== */

const STORE_KEY = 'totaliAntecipa.v1';
const fmt = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtR = v => 'R$ ' + fmt(v);
const fmtP = v => (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
const fmtCnpj = c => { c = String(c || '').replace(/\D/g, ''); return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c; };
const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ estado
let DB = carregar();
let RES = [];            // resultados calculados (uma entrada por nota com XML)
let CONF = [];           // linhas de conferência espelho x cálculo
let CONS = null;         // consolidado
let ST = { empresaId: DB.ui?.empresaId || '', comp: DB.ui?.comp || new Date().toISOString().slice(0, 7), view: 'apuracao' };

function carregar() {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY)); if (d && d.empresas) { d.params = d.params || {}; if (!d.params.v2) { d.params.fecoepBase = "auto"; d.params.tabelaSt = "alertar"; d.params.v2 = true; } return d; } } catch (e) { }
  return { empresas: [], regras: [], params: { ...MOTOR.PARAMS_PADRAO, backendUrl: '' }, apuracoes: {}, ui: {} };
}
function salvar() {
  DB.ui = { empresaId: ST.empresaId, comp: ST.comp };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch (e) { showToast('Espaço do navegador cheio — exporte e limpe apurações antigas.', 'error'); }
}
const empresaAtual = () => DB.empresas.find(e => e.id === ST.empresaId) || null;
const apurKey = () => (ST.empresaId || 'sem-empresa') + '|' + ST.comp;
function apur() { const k = apurKey(); if (!DB.apuracoes[k]) DB.apuracoes[k] = { espelho: null, xmls: {}, overrides: {} }; return DB.apuracoes[k]; }

// ------------------------------------------------------------------ UI básicos
function showToast(msg, tipo) { const t = $('toast'); t.textContent = msg; t.className = tipo || ''; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 3800); }
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
function showView(v) {
  ST.view = v;
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === 'view-' + v));
  document.querySelectorAll('.side button[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'mapa') renderMapa(); if (v === 'empresas') renderEmpresas(); if (v === 'regras') renderRegras(); if (v === 'params') renderParams(); if (v === 'materiais') renderMateriais();
}
document.querySelectorAll('.side button[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));

// ------------------------------------------------------------------ cálculo geral
function recalcular() {
  const E = empresaAtual() || { ...MOTOR.EMPRESA_PADRAO, nome: '(sem empresa)' };
  const A = apur();
  const cad = { regras: DB.regras };
  RES = []; CONF = [];
  const espelhoMap = {}; (A.espelho?.linhas || []).forEach(l => espelhoMap[l.chave] = l);
  const chaves = new Set([...Object.keys(A.xmls), ...Object.keys(espelhoMap)]);
  const porChave = {};
  for (const ch of chaves) {
    const esp = espelhoMap[ch];
    let res = null, erro = null;
    if (A.xmls[ch]) {
      try { const nota = NFE.parse(A.xmls[ch], ch + '.xml'); res = MOTOR.calcularNota(nota, E, DB.params, cad, A.overrides); RES.push(res); }
      catch (e) { erro = e.message; }
    }
    const ic = ESPELHO.infoChave(ch) || {};
    const vCalc = res ? (res.ignorada ? 0 : res.totais.devido) : null;
    const vSefaz = esp ? esp.vlIcmsCalc : null;
    const receitaId = res ? (res.naoAntecipada ? 'nao_antecipa' : Object.keys(res.totais.porReceita).join('+')) : '';
    const receitaNome = res ? (res.naoAntecipada ? 'não antecipada' : Object.values(res.totais.porReceita).map(x => x.nome).join(' + ')) : '';
    let status = res ? 'ok' : erro ? 'erro' : 'pendente';
    if (res && res.ignorada) status = res.situacao === "difal_recolhido" ? "difal_recolhido" : res.situacao === "adiada" ? "adiada" : "ignorada";
    const dif = (vCalc != null && vSefaz != null) ? MOTOR.r2(vCalc - vSefaz) : null;
    const linha = {
      chave: ch, nNF: res ? res.nota.nNF : (esp?.nNF || ic.nNF || ''), emitente: res ? res.nota.emit.nome : (esp ? fmtCnpj(esp.emitente) : fmtCnpj(ic.cnpj)),
      uf: res ? res.nota.emit.uf : (ic.uf || ''), dtEmi: res ? res.nota.dataEmissao : (esp?.dtEmissao || ''), vNF: res ? res.nota.tot.vNF : (esp?.vlTotal || 0),
      forma: esp?.forma || '', vSefaz, receita: receitaNome, receitaId, vCalc, fecoep: res && !res.ignorada ? res.totais.fecoep : 0, dif,
      status, erro, res, esp, noEspelho: !!esp, semXml: !A.xmls[ch],
    };
    CONF.push(linha); porChave[ch] = linha;
  }
  CONF.sort((a, b) => (a.dtEmi || '').localeCompare(b.dtEmi || '') || String(a.nNF).localeCompare(String(b.nNF), undefined, { numeric: true }));
  CONS = MOTOR.consolidar(RES);
  renderKpis(); renderNotas(); renderResumo(); if (ST.view === 'mapa') renderMapa();
  $('infoEspelho').textContent = A.espelho ? `${A.espelho.linhas.length} nota(s) no espelho` + (A.espelho.nDia ? ` · DIA ${A.espelho.nDia}` : '') : 'nenhum espelho carregado';
  const pend = CONF.filter(l => l.semXml).length;
  $('infoXml').textContent = `${Object.keys(A.xmls).length} XML(s) carregado(s)` + (pend ? ` · ${pend} pendente(s)` : '');
  $('btnBuscarOnline').disabled = !pend;
}

// ------------------------------------------------------------------ render: apuração
function renderKpis() {
  const E = empresaAtual();
  const difTot = CONF.filter(l => l.dif != null).reduce((s, l) => s + l.dif, 0);
  const sefazTot = CONF.filter(l => l.vSefaz != null).reduce((s, l) => s + l.vSefaz, 0);
  $('kpis').innerHTML = `
    <div class="kpi"><div class="k">ICMS antecipado</div><div class="v">${fmtR(CONS.devido)}</div><div class="s">${RES.filter(r => !r.ignorada && !r.naoAntecipada).length} nota(s) com imposto</div></div>
    <div class="kpi light"><div class="k">FECOEP</div><div class="v">${fmtR(CONS.fecoep)}</div><div class="s">DAE à parte</div></div>
    <div class="kpi gold"><div class="k">Total DAE</div><div class="v">${fmtR(CONS.totalDae)}</div><div class="s">${E ? (E.regime === "simples" ? "Simples Nacional" : "Regime normal · " + E.perfil) + (E.regimeConfirmado ? "" : " (a confirmar)") + (E.regime !== "simples" ? (E.cestaOptante ? " · cesta básica: OPTANTE 3,6%/2,1%" : " · cesta básica: não optante (MVA 30%)") : "") : "selecione a empresa"}</div></div>
    <div class="kpi light"><div class="k">vs. SEFAZ (espelho)</div><div class="v ${Math.abs(difTot) > 0.05 ? (difTot > 0 ? 'neg' : 'pos') : ''}">${sefazTot ? (difTot >= 0 ? '+' : '') + fmtR(difTot) : '—'}</div><div class="s">${sefazTot ? 'SEFAZ calculou ' + fmtR(sefazTot) : 'sem espelho'}</div></div>`;
}

function badgeStatus(l) {
  if (l.status === 'pendente') return '<span class="badge b-warn">XML pendente</span>';
  if (l.status === 'erro') return '<span class="badge b-bad" title="' + esc(l.erro) + '">erro no XML</span>';
  if (l.status === "ignorada") return "<span class=\"badge b-muted\">ignorada</span>";
  if (l.status === "difal_recolhido") return "<span class=\"badge b-info\" title=\"fora da apuração: ICMS já recolhido como DIFAL\">já recolhida no DIFAL</span>";
  if (l.status === "adiada") return "<span class=\"badge b-gold\" title=\"fora desta apuração: nota adiada para o mês seguinte (espelho do DIA)\">adiada p/ mês seguinte</span>";
  const n = l.res.alertas.filter(a => a.nivel === 'alto').length, m = l.res.alertas.filter(a => a.nivel === 'medio').length;
  let b = l.res.naoAntecipada ? '<span class="badge b-muted">não antecipada</span>' : '<span class="badge b-ok">calculada</span>';
  if (n) b += ` <span class="badge b-bad" title="alertas altos">${n} ⚠</span>`; else if (m) b += ` <span class="badge b-warn" title="alertas">${m} ⚠</span>`;
  if (!l.noEspelho) b += ' <span class="badge b-info" title="XML carregado mas não consta no espelho">fora do espelho</span>';
  return b;
}

function renderNotas() {
  const f = ($('filtroNotas').value || '').toLowerCase(), soDif = $('chkSoDif').checked;
  const tb = $('tblNotas').querySelector('tbody'); tb.innerHTML = '';
  let n = 0;
  for (const l of CONF) {
    if (f && !(String(l.nNF).includes(f) || l.emitente.toLowerCase().includes(f) || l.chave.includes(f))) continue;
    if (soDif && !(l.dif != null && Math.abs(l.dif) > 0.05)) continue;
    n++;
    const ovN = apur().overrides[l.chave] || {};
    const recSel = l.res ? `<select class="fi" style="padding:2px 4px;font-size:11px;max-width:150px" data-ov-nota="${l.chave}"><option value="">${esc(l.receita || "—")} (auto)</option><option value="__difal" ${ovN.situacao === "difal_recolhido" ? "selected" : ""}>Já recolhida no DIFAL (tirar da apuração)</option><option value="__adiada" ${ovN.situacao === "adiada" ? "selected" : ""}>Adiada para o mês seguinte (tirar da apuração)</option>${TABELAS_SE.receitas.map(r => `<option value="${r.id}" ${apur().overrides[l.chave]?.receita === r.id ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select>` : '<span class="muted small">' + esc(l.forma || '') + '</span>';
    tb.insertAdjacentHTML('beforeend', `<tr>
      <td title="chave ${l.chave}"><b class="clickable" data-open="${l.chave}">${esc(l.nNF)}</b><div class="small muted">${fmtDate(l.dtEmi)}</div></td>
      <td><span title="${esc(l.emitente)}">${esc(l.emitente.length > 34 ? l.emitente.slice(0, 32) + "…" : l.emitente)}</span> <span class="badge b-muted">${esc(l.uf)}</span>${l.forma ? "<div class=\"small muted\" title=\"forma de recolhimento no espelho da SEFAZ\">SEFAZ: " + esc(l.forma.replace("COMPLEMENTACAO DE ALIQUOTA INTERESTADUAL", "complementação de alíquota").replace("ANTECIPAÇÃO TRIBUTÁRIA COM ENCERRAMENTO DE FASE", "antecip. com encerramento").replace("OPERAÇÃO NÃO ANTECIPADA", "não antecipada")) + "</div>" : ""}</td><td class="num">${fmt(l.vNF)}</td>
      <td>${recSel}</td>
      <td class="num"><b>${l.vCalc != null ? fmt(l.vCalc) : '—'}</b></td><td class="num">${l.res ? fmt(l.fecoep) : '—'}</td>
      <td class="num">${l.vSefaz != null ? fmt(l.vSefaz) : '—'}</td>
      <td class="num ${l.dif != null && Math.abs(l.dif) > 0.05 ? (l.dif > 0 ? 'neg' : 'pos') : ''}">${l.dif != null ? (l.dif > 0 ? '+' : '') + fmt(l.dif) : '—'}</td>
      <td>${badgeStatus(l)}</td>
      <td style="white-space:nowrap">${l.res ? `<button class="btn sm soft" data-open="${l.chave}">Detalhes</button> <button class="btn sm ghost" data-ign="${l.chave}" title="${l.res.ignorada ? 'voltar a considerar' : 'ignorar esta nota'}">${l.res.ignorada ? '↩' : '✕'}</button>` : `<button class="btn sm ghost" data-del="${l.chave}" title="remover do espelho">✕</button>`}</td>
    </tr>`);
  }
  if (!n) tb.innerHTML = '<tr><td colspan="10" class="empty">Nenhuma nota. Carregue o espelho do DIA e os XMLs.</td></tr>';
  $('cntNotas').textContent = CONF.length;
  tb.querySelectorAll('[data-open]').forEach(el => el.onclick = () => abrirNota(el.dataset.open));
  tb.querySelectorAll('[data-ov-nota]').forEach(el => el.onchange = () => { const o = apur().overrides; const k = el.dataset.ovNota; o[k] = { ...(o[k] || {}) }; delete o[k].receita; delete o[k].situacao; if (el.value === "__difal") o[k].situacao = "difal_recolhido"; else if (el.value === "__adiada") o[k].situacao = "adiada"; else if (el.value) o[k].receita = el.value; if (!Object.keys(o[k]).length) delete o[k]; salvar(); recalcular(); });
  tb.querySelectorAll('[data-ign]').forEach(el => el.onclick = () => { const o = apur().overrides; const k = el.dataset.ign; o[k] = { ...(o[k] || {}), ignorar: !(o[k] && o[k].ignorar) }; salvar(); recalcular(); });
  tb.querySelectorAll('[data-del]').forEach(el => el.onclick = () => { const A = apur(); if (A.espelho) A.espelho.linhas = A.espelho.linhas.filter(x => x.chave !== el.dataset.del); delete A.xmls[el.dataset.del]; salvar(); recalcular(); });
}

function renderResumo() {
  const rows = Object.entries(CONS.porReceita);
  if (!rows.length) { $('resumoReceitas').innerHTML = '<div class="empty">Sem valores ainda.</div>'; return; }
  $('resumoReceitas').innerHTML = `<table class="tbl compact"><thead><tr><th>Receita</th><th>Código</th><th class="num">Notas</th><th class="num">Base de cálculo</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Devido</th><th class="num">A recolher</th></tr></thead><tbody>
    ${rows.map(([id, v]) => `<tr><td>${esc(MOTOR.receita(id).titulo)}</td><td><span class="badge b-navy">${v.cod || '—'}</span></td><td class="num">${v.notas}</td><td class="num">${fmt(v.base)}</td><td class="num">${fmt(v.debito)}</td><td class="num">${fmt(v.credito)}</td><td class="num ${v.devido < 0 ? 'neg' : ''}">${fmt(v.devido)}</td><td class="num"><b>${fmt(v.recolher)}</b></td></tr>`).join('')}
    <tr><td>FECOEP / FUNPOBREZA</td><td><span class="badge b-gold">FECOEP</span></td><td class="num"></td><td class="num" colspan="4"></td><td class="num"><b>${fmt(CONS.fecoep)}</b></td></tr>
    <tr class="tot"><td colspan="7">TOTAL A RECOLHER (ICMS + FECOEP)</td><td class="num">${fmtR(CONS.totalDae)}</td></tr></tbody></table>`;
}

// ------------------------------------------------------------------ detalhe da nota
function abrirNota(chave) {
  const l = CONF.find(x => x.chave === chave); if (!l || !l.res) return;
  const r = l.res, n = r.nota, A = apur();
  $('mnTitulo').textContent = `NF-e ${n.nNF} · ${n.emit.nome}`;
  $('mnSub').textContent = `${n.emit.uf} → ${n.dest.uf} · ${fmtCnpj(n.emit.cnpj)} · emitida ${fmtDate(n.dataEmissao)} · chave ${n.chave}` + (n.emit.crt === '1' ? ' · emitente do SIMPLES' : '');
  const alertasNota = r.alertas.filter(a => a.nivel !== 'baixo');
  const recOpts = id => TABELAS_SE.receitas.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  let html = `<div class="row" style="justify-content:space-between;margin-bottom:12px">
    <div class="stat"><span>Valor NF <b>${fmtR(n.tot.vNF)}</b></span><span>Produtos <b>${fmtR(n.tot.vProd)}</b></span><span>Desconto <b>${fmtR(n.tot.vDesc)}</b></span><span>IPI <b>${fmtR(n.tot.vIPI)}</b></span><span>Frete <b>${fmtR(n.tot.vFrete)}</b></span><span>ICMS destacado <b>${fmtR(n.tot.vICMS)}</b></span><span>ST <b>${fmtR(n.tot.vST)}</b></span>${l.esp ? `<span>SEFAZ: <b>${esc(l.esp.forma)}</b> = <b>${fmtR(l.esp.vlIcmsCalc)}</b></span>` : ''}</div>
    <div class="kpi" style="padding:10px 16px"><div class="k">Antecipado + FECOEP</div><div class="v" style="font-size:20px">${fmtR(r.totais.devido)} <span style="font-size:13px;opacity:.7">+ ${fmtR(r.totais.fecoep)}</span></div></div></div>`;
  if (alertasNota.length) html += `<div style="margin-bottom:12px">${alertasNota.map(a => `<div class="alert ${a.nivel}">Item ${a.nItem}: ${esc(a.msg)}</div>`).join('')}</div>`;
  html += `<div class="tblwrap" style="max-height:none"><table class="tbl compact"><thead><tr><th>#</th><th>Produto</th><th>NCM</th><th>CFOP</th><th>CST</th><th class="num">Valor</th><th class="num">IPI</th><th class="num">L orig.</th><th class="num">K</th><th class="num">MVA</th><th class="num">M int.</th><th class="num">P base</th><th class="num">Q déb.</th><th class="num">R créd.</th><th class="num">S antecip.</th><th class="num">FECOEP</th><th>Receita</th></tr></thead><tbody>`;
  for (const it of r.itens) {
    const i = it.item; const k = n.chave + '#' + i.nItem; const ov = A.overrides[k] || {};
    const alt = it.alertas.length ? `<span class="badge ${it.alertas.some(a => a.nivel === 'alto') ? 'b-bad' : it.alertas.some(a => a.nivel === 'medio') ? 'b-warn' : 'b-info'}" title="${esc(it.alertas.map(a => a.msg).join('\n'))}">${it.alertas.length} ⚠</span>` : '';
    html += `<tr class="clickable-row" data-item="${i.nItem}">
      <td>${i.nItem}</td><td><b class="clickable" data-memo="${i.nItem}">${esc(i.xProd)}</b> ${alt}<div class="small muted">${it.regra ? esc(it.regra.descricao) : 'sem regra específica'}</div></td>
      <td class="mono">${i.ncm}</td><td>${i.cfop}</td><td>${i.icms.cst || i.icms.csosn}</td><td class="num">${fmt(it.F)}</td><td class="num">${fmt(it.G)}</td><td class="num">${fmtP(it.L)}</td><td class="num">${fmt(it.K)}</td>
      <td class="num">${fmtP(it.O)}</td><td class="num">${fmtP(it.M)}</td><td class="num">${fmt(it.P)}</td><td class="num">${fmt(it.Q)}</td><td class="num">${fmt(it.R)}</td><td class="num"><b>${fmt(it.S)}</b></td><td class="num">${fmt(it.fecoep)}</td>
      <td><select class="fi" style="padding:2px 4px;font-size:11px" data-ov="${k}" data-f="receita"><option value="">auto</option>${recOpts(ov.receita)}</select></td></tr>
      <tr id="memo-${i.nItem}" style="display:none"><td colspan="17"><div class="grid g2" style="gap:12px">
        <div class="memo">${it.memoria.map((m, idx) => `<div class="p ${idx === it.memoria.length - 2 ? 'res' : ''}"><b>${esc(m.passo)}</b><span>${esc(m.txt)}</span></div>`).join('')}</div>
        <div><h3>Ajustes deste item</h3>
          <div class="grid g3" style="gap:8px">
            <div class="field"><label class="fi-label">Finalidade</label><select class="fi" data-ov="${k}" data-f="finalidade"><option value="">auto (CFOP)</option><option value="revenda" ${ov.finalidade === 'revenda' ? 'selected' : ''}>Revenda</option><option value="usoConsumo" ${ov.finalidade === 'usoConsumo' ? 'selected' : ''}>Uso/consumo</option><option value="ativo" ${ov.finalidade === 'ativo' ? 'selected' : ''}>Ativo imobilizado</option></select></div>
            <div class="field"><label class="fi-label">MVA (%)</label><input class="fi" type="number" step="0.01" data-ov="${k}" data-f="mva" value="${ov.mva ?? ''}" placeholder="auto ${it.O}"></div>
            <div class="field"><label class="fi-label">Alíq. interna (%)</label><input class="fi" type="number" step="0.01" data-ov="${k}" data-f="aliq" value="${ov.aliq ?? ''}" placeholder="auto ${it.M}"></div>
            <div class="field"><label class="fi-label">Alíq. origem (%)</label><input class="fi" type="number" step="0.01" data-ov="${k}" data-f="aliqOrigem" value="${ov.aliqOrigem ?? ''}" placeholder="auto ${it.L}"></div>
            <div class="field"><label class="fi-label">FECOEP (pts)</label><input class="fi" type="number" step="0.5" data-ov="${k}" data-f="fecoep" value="${ov.fecoep ?? ''}" placeholder="auto ${it.fecoepPts}"></div>
            <div class="field"><label class="fi-label">Pauta fiscal (R$ total)</label><input class="fi" type="number" step="0.01" data-ov="${k}" data-f="pauta" value="${ov.pauta ?? ''}" placeholder="—"></div>
          </div>
          ${it.sugestaoFinalidade && it.sugestaoFinalidade.finalidade !== "revenda" && !it.sugestaoFinalidade.aplicada ? `<div class="alert medio">Sugestão pelo CNAE: <b>${it.sugestaoFinalidade.finalidade === "ativo" ? "ATIVO IMOBILIZADO" : "USO/CONSUMO"}</b> (${esc(it.sugestaoFinalidade.motivo)}) <button class="btn sm" data-aplicafin="${k}" data-fin="${it.sugestaoFinalidade.finalidade}">Aplicar</button></div>` : ""}
          ${it.alertas.length ? it.alertas.map(a => `<div class="alert ${a.nivel}">${esc(a.msg)}</div>`).join('') : '<div class="small muted">Sem alertas neste item.</div>'}
          ${it.ncmInfo && it.ncmInfo.descricao ? `<div class="small" style="margin-top:8px"><b>NCM ${i.ncm}</b> — ${esc(it.ncmInfo.descricao)} ${it.ncmInfo.existe ? '<span class="badge b-ok">vigente</span>' : '<span class="badge b-warn">não consta na tabela NCM</span>'}</div>` : ''}
          ${it.stTab ? `<div class="small" style="margin-top:4px"><b>Planilha ST/SE:</b> ${esc(it.stTab.segmento)} · CEST ${esc(it.stTab.cest || '—')} · MVA ${it.stTab.mva}% · alíq. ${it.stTab.aliq_interna}% — ${esc(it.stTab.norma || '')} ${esc(it.stTab.dispositivo || '')}<div class="muted">${esc(it.stTab.trecho || '')}</div></div>` : ''}
          ${(it.beneficios || []).map(b => `<div class="small" style="margin-top:4px"><b>RICMS/SE Anexo ${esc(b.anexo)} (${esc(b.tipo)}):</b> ${esc(b.dispositivo || '')} — <span class="muted">${esc((b.trecho || '').slice(0, 220))}</span></div>`).join('')}
          <div class="small muted" style="margin-top:8px">Fundamento: ${esc(MOTOR.receita(it.receita).base || '—')}</div>
        </div></div></td></tr>`;
  }
  html += `</tbody></table></div>
    <h3 style="margin-top:16px">Linhas do mapa da SEFAZ geradas por esta nota</h3>
    <table class="tbl compact"><thead><tr><th>C Receita</th><th>D Fornecedor</th><th class="num">F Valor</th><th class="num">G IPI</th><th class="num">H Frete</th><th class="num">K Composto</th><th class="num">L</th><th class="num">M</th><th class="num">O MVA</th><th class="num">P Base</th><th class="num">Q Débito</th><th class="num">R Crédito</th><th class="num">S Recolher</th><th class="num">FECOEP</th><th>Itens</th></tr></thead><tbody>
    ${r.linhasMapa.map(g => `<tr><td><span class="badge b-navy">${g.cod || '—'}</span> ${esc(g.receitaNome)}</td><td>${esc(g.fornecedor)}</td><td class="num">${fmt(g.F)}</td><td class="num">${fmt(g.G)}</td><td class="num">${fmt(g.H)}</td><td class="num">${fmt(g.K)}</td><td class="num">${fmtP(g.L)}</td><td class="num">${fmtP(g.M)}</td><td class="num">${fmtP(g.O)}</td><td class="num">${fmt(g.P)}</td><td class="num">${fmt(g.Q)}</td><td class="num">${fmt(g.R)}</td><td class="num"><b>${fmt(g.S)}</b></td><td class="num">${fmt(g.fecoep)}</td><td class="small">${g.itens.join(', ')}</td></tr>`).join('') || '<tr><td colspan="15" class="empty">Nenhuma linha (operação não antecipada).</td></tr>'}
    </tbody></table>
    <div class="small muted" style="margin-top:10px">Clique no nome do produto para ver a memória de cálculo passo a passo e ajustar o item. Ajustes ficam salvos nesta apuração.</div>`;
  $('mnBody').innerHTML = html;
  $("mnBody").querySelectorAll("[data-aplicafin]").forEach(b => b.onclick = () => { const o = A.overrides; const k = b.dataset.aplicafin; o[k] = { ...(o[k] || {}), finalidade: b.dataset.fin }; salvar(); recalcular(); abrirNota(chave); });
  $("mnBody").querySelectorAll("[data-memo]").forEach(el => el.onclick = () => { const tr = $('memo-' + el.dataset.memo); tr.style.display = tr.style.display === 'none' ? '' : 'none'; });
  $('mnBody').querySelectorAll('[data-ov]').forEach(el => el.onchange = () => {
    const o = A.overrides; const k = el.dataset.ov; o[k] = { ...(o[k] || {}) };
    const v = el.value; const f = el.dataset.f;
    if (v === '' || v == null) delete o[k][f]; else o[k][f] = el.type === 'number' ? parseFloat(v) : v;
    if (!Object.keys(o[k]).length) delete o[k];
    salvar(); recalcular(); abrirNota(chave);
  });
  openModal('modal-nota');
}

// ------------------------------------------------------------------ mapa SEFAZ na tela
function renderMapa() {
  const E = empresaAtual() || { nome: '—', ie: '—', cnpj: '—' };
  const ordem = ['cesta_opt36', 'cesta_opt21', 'difal', 'antecip_encer', 'importacoes', 'antecip_interest', 'simfaz', 'cesta_nao_opt', 'st_interna', 'antecip_interna', 'simples'];
  const comp = ST.comp ? ST.comp.split('-').reverse().join('/') : '';
  let h = `<div class="cab"><div>
      <div class="titulo">GOVERNO DE SERGIPE<br>SECRETARIA DE ESTADO DA FAZENDA</div>
      <div style="margin:6px 0">PORTARIA N.º 103/2006-SEFAZ · DE 26 DE JANEIRO DE 2006 · VERSÃO 5</div>
      <div class="titulo" style="margin:10px 0">ANEXO I — MAPA DE APURAÇÃO DO ICMS</div>
      <table class="resumo"><tr><td>MÊS DE REFERÊNCIA</td><td class="n"><b>${comp}</b></td></tr><tr><td>CONTRIBUINTE:</td><td class="n"><b>${esc(E.nome)}</b></td></tr><tr><td>INSCRIÇÃO ESTADUAL N.º:</td><td class="n">${esc(E.ie)}</td></tr><tr><td>CNPJ:</td><td class="n">${esc(fmtCnpj(E.cnpj))}</td></tr></table>
      <table class="resumo" style="margin-top:12px">
        <tr><td>Somatório das Bases de Cálculo</td><td class="n">${fmt(CONS.base)}</td></tr>
        <tr><td>Débito do Imposto</td><td class="n">${fmt(CONS.debito)}</td></tr>
        <tr><td>Crédito do Imposto referente as entradas</td><td class="n">${fmt(CONS.credito)}</td></tr>
        <tr><td>Imposto devido</td><td class="n">${fmt(MOTOR.r2(CONS.debito - CONS.credito))}</td></tr>
        <tr><td>Devolução de mercadoria / desfazimento</td><td class="n">0,00</td></tr>
        <tr><td><b>valor a recolher</b></td><td class="n"><b>${fmt(CONS.devido)}</b></td></tr>
        <tr><td>FECOEP (DAE à parte)</td><td class="n">${fmt(CONS.fecoep)}</td></tr></table>
    </div><div>
      <table class="resumo"><tr><td></td><td><b>Valor devido por Receita</b></td><td class="n"><b>Valor devido</b></td><td class="n"><b>Devolução</b></td><td class="n"><b>A recolher</b></td></tr>
      ${ordem.map(id => { const R = MOTOR.receita(id), v = CONS.porReceita[id]; return `<tr><td>${R.cod}</td><td>${esc(R.nome)}</td><td class="n">${fmt(v ? v.devido : 0)}</td><td class="n">0,00</td><td class="n" style="${v && v.recolher > 0 ? 'background:#FFF2CC;font-weight:700' : ''}">${fmt(v ? v.recolher : 0)}</td></tr>`; }).join('')}
      </table>${CONS.devido === 0 && CONS.debito > 0 ? '<div style="margin-top:8px;color:#900"><b>NÃO TEM VALOR A RECOLHER, POIS O SALDO CREDOR FOI MAIOR QUE O DEVEDOR</b></div>' : ''}
    </div></div>
    <div style="overflow:auto;margin-top:16px"><table class="grade">
      <tr class="letra">${'ABCDEFGHIJKLMNOPQRST'.split('').map(l => `<th>${l}</th>`).join('')}</tr>
      <tr><th>NOTA FISCAL DE ENTRADA</th><th>Devolução/ desfazimento</th><th>Receita a ser antecipada</th><th>IDENTIFICAÇÃO DO FORNECEDOR</th><th>Quant.</th><th>Valor da Nota Fiscal/ Base de cálculo</th><th>IPI</th><th>Frete</th><th>Seguro</th><th>OUTRAS DESPESAS</th><th>Preço Composto</th><th>Alíquota de origem</th><th>Carga tributária de destino</th><th>Valor da pauta</th><th>Margem de Agreg. MVA</th><th>Base de Cálculo</th><th>Débito do Imposto</th><th>Crédito da NF de origem</th><th>ICMS a ser recolhido</th><th>ICMS a ser devolvido</th></tr>
      <tr class="tot"><td colspan="15" style="text-align:right">TOTAIS</td><td class="n">${fmt(CONS.base)}</td><td class="n">${fmt(CONS.debito)}</td><td class="n">${fmt(CONS.credito)}</td><td class="n">${fmt(MOTOR.r2(CONS.debito - CONS.credito))}</td><td class="n">0,00</td></tr>`;
  let linhas = 0;
  for (const r of RES) { if (r.ignorada) continue; for (const g of r.linhasMapa) { linhas++; const acr = MOTOR.receita(g.receita).acrescimos; h += `<tr><td>${esc(g.nNF)}</td><td></td><td>${esc(g.receitaNome)}</td><td>${esc(g.fornecedor)}</td><td class="n">1</td><td class="n">${fmt(g.F)}</td><td class="n">${acr ? fmt(g.G) : ''}</td><td class="n">${acr ? fmt(g.H) : ''}</td><td class="n">${acr ? fmt(g.I) : ''}</td><td class="n">${acr ? fmt(g.J) : ''}</td><td class="n">${fmt(g.K)}</td><td class="n">${fmtP(g.L)}</td><td class="n">${fmtP(g.M)}</td><td class="n">${g.N ? fmt(g.N) : ''}</td><td class="n">${g.O ? fmtP(g.O) : ''}</td><td class="n">${fmt(g.P)}</td><td class="n">${fmt(g.Q)}</td><td class="n">${fmt(g.R)}</td><td class="n"><b>${fmt(g.S)}</b></td><td class="n">0,00</td></tr>`; } }
  if (!linhas) h += '<tr><td colspan="20" style="text-align:center;color:#888;padding:20px">Sem linhas — carregue XMLs na apuração.</td></tr>';
  h += '</table></div>';
  $('mapaSefaz').innerHTML = h;
}

// ------------------------------------------------------------------ empresas
function renderEmpresasSelect() {
  const s = $('selEmpresa');
  s.innerHTML = '<option value="">— selecione a empresa —</option>' + DB.empresas.map(e => `<option value="${e.id}" ${e.id === ST.empresaId ? 'selected' : ''}>${esc(e.nome)} (${e.regime === 'simples' ? 'SN' : e.perfil})</option>`).join('');
}
function renderEmpresas() {
  const tb = $('tblEmpresas').querySelector('tbody');
  tb.innerHTML = DB.empresas.map(e => `<tr><td><b>${esc(e.nome)}</b>${e.obs ? '<div class="small muted">' + esc(e.obs) + '</div>' : ''}</td><td class="mono">${fmtCnpj(e.cnpj)}</td><td class="mono">${esc(e.ie)}</td><td>${e.regime === "simples" ? "<span class=\"badge b-gold\">Simples Nacional</span>" : "<span class=\"badge b-navy\">Regime normal</span>"}<div class="small muted">${e.regimeConfirmado ? "confirmado" : "sugerido"}${esc(regimeFonteTxt(e))}</div></td><td>${esc(e.perfil)}</td><td>${e.cestaOptante ? "optante 3,6%/2,1%" : "—"}<div class="small muted">${(e.cnaes || []).length ? esc(String(e.cnaes[0].codigo || e.cnaes[0])) + " (+" + (e.cnaes.length - 1) + " CNAE)" : "sem CNAE"}</div></td><td style="white-space:nowrap"><button class="btn sm soft" data-ed="${e.id}">Editar</button> <button class="btn sm danger" data-rm="${e.id}">Excluir</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhuma empresa. Cadastre ou carregue um espelho do DIA (a IE e o nome vêm de lá).</td></tr>';
  tb.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editarEmpresa(b.dataset.ed));
  tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (confirm('Excluir a empresa? As apurações dela ficam guardadas até você limpar.')) { DB.empresas = DB.empresas.filter(x => x.id !== b.dataset.rm); if (ST.empresaId === b.dataset.rm) ST.empresaId = ''; salvar(); renderEmpresasSelect(); renderEmpresas(); recalcular(); } });
}
var editarEmpresa = function (id) {
  const e = DB.empresas.find(x => x.id === id) || { id: '', nome: '', cnpj: '', ie: '', regime: 'normal', perfil: 'apto', cestaOptante: false, obs: '' };
  $("eRegimeInfo").style.display = "none"; delete $("eObs").dataset.regimeFonte; $("eId").value = e.id; $("eNome").value = e.nome; $('eCnpj').value = fmtCnpj(e.cnpj); $('eIe').value = e.ie; $('eRegime').value = e.regime; $('ePerfil').value = e.perfil; $('eCesta').checked = !!e.cestaOptante; $('eObs').value = e.obs || '';
  openModal('modal-empresa');
}
$('btnNovaEmpresa').onclick = () => editarEmpresa('');
$('btnSalvarEmpresa').onclick = () => {
  const e = { id: $('eId').value || uid(), nome: $('eNome').value.trim(), cnpj: $('eCnpj').value.replace(/\D/g, ''), ie: $('eIe').value.replace(/\D/g, ''), regime: $('eRegime').value, perfil: $('ePerfil').value, cestaOptante: $('eCesta').checked, obs: $('eObs').value.trim(), regimeConfirmado: true, regimeFonte: $("eObs").dataset.regimeFonte || "informado manualmente", cestaConfirmada: true, cnaes: (DB.empresas.find(x => x.id === $("eId").value) || {}).cnaes || window._cnaesConsulta || [] };
  if (!e.nome) return showToast('Informe a razão social.', 'error');
  const i = DB.empresas.findIndex(x => x.id === e.id); if (i >= 0) DB.empresas[i] = e; else DB.empresas.push(e);
  ST.empresaId = e.id; salvar(); closeModal("modal-empresa"); renderEmpresasSelect(); renderEmpresas(); recalcular(); if (typeof checarSefaz === "function") checarSefaz(); showToast('Empresa salva.', 'success');
};
$('selEmpresa').onchange = () => { ST.empresaId = $('selEmpresa').value; salvar(); recalcular(); };
$('inpComp').onchange = () => { ST.comp = $('inpComp').value; salvar(); recalcular(); };

// ------------------------------------------------------------------ regras NCM
function mvaTxt(m) { if (m == null) return '—'; if (typeof m === 'number') return fmtP(m); return [4, 7, 12, 'interna'].map(k => m[k] != null ? fmtP(m[k]) : '·').join(' / '); }
function renderRegras() {
  const f = ($('filtroRegras').value || '').toLowerCase(), emb = $('chkEmbutidas').checked;
  const lista = [...DB.regras.map(r => ({ ...r, _user: true })), ...(emb ? TABELAS_SE.regrasNcm.map(r => ({ ...r, _user: false })) : [])];
  lista.sort((a, b) => (a.prioridade ?? 100) - (b.prioridade ?? 100) || String(a.ncm).localeCompare(String(b.ncm)));
  const tb = $('tblRegras').querySelector('tbody');
  tb.innerHTML = lista.filter(r => !f || [r.ncm, r.descricao, r.regime, r.fundamento, r.descPadrao].join(' ').toLowerCase().includes(f)).map(r => `<tr>
    <td>${r.prioridade ?? 100}</td><td class="mono"><b>${esc(r.ncm)}</b>${r.cest ? '<div class="small muted">CEST ' + esc(r.cest) + '</div>' : ''}</td><td class="small">${r.match === 'igual' ? 'igual' : 'inicia'}</td>
    <td>${esc(r.descricao)}${r.descPadrao ? `<div class="small muted">produto ${r.descMatch === 'inicia' ? 'inicia com' : 'contém'} "${esc(r.descPadrao)}"</div>` : ''}${r.fundamento ? `<div class="small muted">${esc(r.fundamento)}</div>` : ''}</td>
    <td>${r.regime ? `<span class="badge ${r.regime === 'nao_antecipa' ? 'b-muted' : r.regime === 'cesta' ? 'b-gold' : 'b-info'}">${esc(r.regime)}</span>` : '<span class="small muted">geral</span>'}</td>
    <td class="small mono">${mvaTxt(r.mva)}</td><td>${r.aliq != null ? fmtP(r.aliq) : '<span class="muted">modal</span>'}</td><td>${r.fecoep != null ? r.fecoep + ' pt' : '<span class="muted">padrão</span>'}</td>
    <td>${r._user ? '<span class="badge b-ok">sua</span>' : '<span class="badge b-muted">RICMS/SE</span>'}${r.confirmar ? ' <span class="badge b-warn" title="confirmar no RICMS/SE">⚠</span>' : ''}</td>
    <td style="white-space:nowrap">${r._user ? `<button class="btn sm soft" data-ed="${r.id}">Editar</button> <button class="btn sm danger" data-rm="${r.id}">✕</button>` : `<button class="btn sm ghost" data-cp="${r.id}" title="copiar para editar com prioridade maior">Copiar</button>`}</td></tr>`).join('');
  tb.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editarRegra(DB.regras.find(x => x.id === b.dataset.ed)));
  tb.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { const r = TABELAS_SE.regrasNcm.find(x => x.id === b.dataset.cp); editarRegra({ ...r, id: '', prioridade: Math.max(1, (r.prioridade ?? 100) - 5), confirmar: false }); });
  tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { DB.regras = DB.regras.filter(x => x.id !== b.dataset.rm); salvar(); renderRegras(); recalcular(); });
}
function editarRegra(r) {
  r = r || {};
  $('rId').value = r.id || ''; $('rPrior').value = r.prioridade ?? 50; $('rNcm').value = r.ncm || ''; $('rMatch').value = r.match || 'inicia'; $('rDesc').value = r.descricao || '';
  $('rDescPadrao').value = r.descPadrao || ''; $('rDescMatch').value = r.descMatch || 'contem'; $('rRegime').value = r.regime || ''; $('rAliq').value = r.aliq ?? ''; $('rFecoep').value = r.fecoep ?? ''; $('rCest').value = r.cest || ''; $('rFund').value = r.fundamento || '';
  const m = r.mva; $('rMva4').value = m && typeof m === 'object' ? (m[4] ?? '') : ''; $('rMva7').value = m && typeof m === 'object' ? (m[7] ?? '') : (typeof m === 'number' ? m : ''); $('rMva12').value = m && typeof m === 'object' ? (m[12] ?? '') : ''; $('rMvaInt').value = m && typeof m === 'object' ? (m.interna ?? '') : '';
  openModal('modal-regra');
}
$('btnNovaRegra').onclick = () => editarRegra(null);
$('btnSalvarRegra').onclick = () => {
  const n = v => v === '' ? null : parseFloat(v);
  const m4 = n($('rMva4').value), m7 = n($('rMva7').value), m12 = n($('rMva12').value), mi = n($('rMvaInt').value);
  let mva = null; const vals = [m4, m7, m12, mi].filter(x => x != null);
  if (vals.length === 1) mva = vals[0]; else if (vals.length > 1) { mva = {}; if (m4 != null) mva[4] = m4; if (m7 != null) mva[7] = m7; if (m12 != null) mva[12] = m12; if (mi != null) mva.interna = mi; }
  const r = { id: $('rId').value || uid(), prioridade: parseInt($('rPrior').value || '50', 10), ncm: $('rNcm').value.replace(/\D/g, ''), match: $('rMatch').value, descricao: $('rDesc').value.trim(), descPadrao: $('rDescPadrao').value.trim() || null, descMatch: $('rDescMatch').value, regime: $('rRegime').value || null, aliq: n($('rAliq').value), mva, fecoep: n($('rFecoep').value), cest: $('rCest').value.replace(/\D/g, '') || null, fundamento: $('rFund').value.trim(), encerra: $('rRegime').value === 'antecip_encer' || $('rRegime').value === 'st_interna' };
  if (!r.ncm) return showToast('Informe o NCM.', 'error');
  if (!r.descricao) r.descricao = 'NCM ' + r.ncm;
  const i = DB.regras.findIndex(x => x.id === r.id); if (i >= 0) DB.regras[i] = r; else DB.regras.push(r);
  salvar(); closeModal('modal-regra'); renderRegras(); recalcular(); showToast('Regra salva.', 'success');
};
$('filtroRegras').oninput = renderRegras; $('chkEmbutidas').onchange = renderRegras;
$('testeNcm').oninput = () => { const v = $('testeNcm').value.replace(/\D/g, ''); const r = v.length >= 4 ? MOTOR.buscarRegra(v, '', DB.regras) : null; $('testeNcmRes').innerHTML = v.length < 4 ? '' : r ? `→ <b>${esc(r.descricao)}</b> (MVA ${mvaTxt(r.mva)}, alíq. ${r.aliq ?? 'modal'}%)` : '→ sem regra específica (regra geral)'; };
$('btnExportRegras').onclick = () => {
  const rows = DB.regras.map(r => ({ PRIORIDADE: r.prioridade, NCM: r.ncm, MATCH: r.match, DESCRICAO: r.descricao, PADRAO_DESCRICAO: r.descPadrao || '', TIPO_MATCH_DESCRICAO: r.descMatch || '', REGIME: r.regime || '', MVA_4: typeof r.mva === 'object' && r.mva ? r.mva[4] ?? '' : '', MVA_7: typeof r.mva === 'object' && r.mva ? r.mva[7] ?? '' : (typeof r.mva === 'number' ? r.mva : ''), MVA_12: typeof r.mva === 'object' && r.mva ? r.mva[12] ?? '' : '', MVA_INTERNA: typeof r.mva === 'object' && r.mva ? r.mva.interna ?? '' : '', ALIQUOTA: r.aliq ?? '', FECOEP: r.fecoep ?? '', CEST: r.cest || '', FUNDAMENTO: r.fundamento || '' }));
  if (!rows.length) rows.push({ PRIORIDADE: 50, NCM: '02071400', MATCH: 'inicia', DESCRICAO: 'exemplo — frango', PADRAO_DESCRICAO: '', TIPO_MATCH_DESCRICAO: '', REGIME: 'antecip_encer', MVA_4: 43.57, MVA_7: 39.09, MVA_12: 31.61, MVA_INTERNA: 21.14, ALIQUOTA: 12, FECOEP: 0, CEST: '', FUNDAMENTO: 'RICMS/SE Anexo X item 10' });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Regras'); XLSX.writeFile(wb, 'regras_ncm_SE.xlsx');
};
$('btnImportRegras').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.json'; i.onchange = async () => { const f = i.files[0]; if (!f) return; if (/\.json$/i.test(f.name)) { const d = JSON.parse(await f.text()); if (Array.isArray(d)) { d.forEach(r => { r.id = r.id || uid(); DB.regras.push(r); }); } } else { const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }); let n = 0; for (const x of rows) { const g = k => { const key = Object.keys(x).find(kk => kk.trim().toUpperCase() === k); return key != null ? x[key] : ''; }; const ncm = String(g('NCM')).replace(/\D/g, ''); if (!ncm) continue; const num = v => v === '' || v == null ? null : parseFloat(String(v).replace(',', '.')); let mva = null; const m4 = num(g('MVA_4')), m7 = num(g('MVA_7')), m12 = num(g('MVA_12')), mi = num(g('MVA_INTERNA')), mf = num(g('MVA')); if (mf != null) mva = mf; else { const vs = [m4, m7, m12, mi].filter(v => v != null); if (vs.length === 1) mva = vs[0]; else if (vs.length) { mva = {}; if (m4 != null) mva[4] = m4; if (m7 != null) mva[7] = m7; if (m12 != null) mva[12] = m12; if (mi != null) mva.interna = mi; } } DB.regras.push({ id: uid(), prioridade: parseInt(g('PRIORIDADE') || '50', 10), ncm, match: String(g('MATCH') || (ncm.length === 8 ? 'igual' : 'inicia')).toLowerCase().includes('igual') ? 'igual' : 'inicia', descricao: String(g('DESCRICAO') || g('DESCRICAO_REGRA') || ('NCM ' + ncm)), descPadrao: String(g('PADRAO_DESCRICAO') || '') || null, descMatch: String(g('TIPO_MATCH_DESCRICAO') || '').toLowerCase().includes('inicia') ? 'inicia' : 'contem', regime: String(g('REGIME') || (mva != null ? 'antecip_encer' : '')) || null, mva, aliq: num(g('ALIQUOTA')), fecoep: num(g('FECOEP')), cest: String(g('CEST') || '').replace(/\D/g, '') || null, fundamento: String(g('FUNDAMENTO') || g('PROTOCOLO_ST') || ''), encerra: mva != null }); n++; } showToast(n + ' regra(s) importada(s).', 'success'); } salvar(); renderRegras(); recalcular(); }; i.click(); };

// ------------------------------------------------------------------ parâmetros
function renderParams() {
  const p = { ...MOTOR.PARAMS_PADRAO, ...DB.params };
  $('pAliq').value = p.aliqModal; $('pMvaApto').value = p.mvaApto; $('pMvaInapto').value = p.mvaInapto; $('pCredSimples').checked = !!p.creditoEmitenteSimples; $("pCredModo").value = p.creditoModo || "mapa"; $("pAjustarMva").checked = p.ajustarMva !== false; $("pTabelaSt").value = p.tabelaSt || "alertar"; $("pFinalidadeCnae").value = p.finalidadeCnae || "sugerir";
  $('pFecoepAtivo').checked = !!p.fecoepAtivo; $('pFecoepPts').value = p.fecoepPadrao; $('pFecoepBase').value = p.fecoepBase || 'K'; $('pBackend').value = p.backendUrl || '';
}
$('btnSalvarParams').onclick = () => {
  DB.params = { ...DB.params, aliqModal: parseFloat($('pAliq').value) || 19, mvaApto: parseFloat($('pMvaApto').value) || 10, mvaInapto: parseFloat($('pMvaInapto').value) || 20, creditoEmitenteSimples: $('pCredSimples').checked, creditoModo: $("pCredModo").value, ajustarMva: $("pAjustarMva").checked, tabelaSt: $("pTabelaSt").value, finalidadeCnae: $("pFinalidadeCnae").value, fecoepAtivo: $('pFecoepAtivo').checked, fecoepPadrao: parseFloat($('pFecoepPts').value) || 0, fecoepBase: $('pFecoepBase').value, backendUrl: $('pBackend').value.trim().replace(/\/$/, '') };
  salvar(); recalcular(); showToast('Parâmetros salvos.', 'success');
};
$('btnBackup').onclick = () => { const b = new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'totali-antecipa-backup.json'; a.click(); };
$('btnRestore').onclick = () => $('fileRestore').click();
$('fileRestore').onchange = async () => { const f = $('fileRestore').files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!d.empresas) throw 0; DB = d; salvar(); location.reload(); } catch (e) { showToast('Arquivo inválido.', 'error'); } };

// ------------------------------------------------------------------ entrada: espelho e XML
function bindDrop(dropId, inputId, handler) {
  const d = $(dropId), i = $(inputId);
  d.onclick = () => i.click();
  d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); handler([...e.dataTransfer.files]); };
  i.onchange = () => { handler([...i.files]); i.value = ''; };
}
bindDrop('dropEspelho', 'fileEspelho', async files => {
  const f = files[0]; if (!f) return;
  try {
    const esp = ESPELHO.lerPlanilha(await f.arrayBuffer());
    if (!esp.linhas.length) return showToast(esp.avisos.join(' '), 'error');
    // Empresa: casa pela IE do espelho ou cria
    if (esp.ie) {
      let e = DB.empresas.find(x => x.ie === esp.ie);
      if (!e) { e = { id: uid(), nome: esp.contribuinte || 'Contribuinte ' + esp.ie, cnpj: '', ie: esp.ie, regime: 'normal', perfil: 'apto', cestaOptante: false, obs: 'criada a partir do espelho do DIA — confira regime e CNPJ' }; DB.empresas.push(e); showToast('Empresa criada a partir do espelho: confira o REGIME (Simples/normal) em Cadastros › Empresas.', ''); }
      ST.empresaId = e.id;
    }
    const m = (esp.linhas[0].mesRef || '').match(/^(\d{1,2})\/(\d{4})$/); if (m) ST.comp = m[2] + '-' + m[1].padStart(2, '0');
    renderEmpresasSelect(); $('inpComp').value = ST.comp;
    const A = apur(); A.espelho = esp;
    const adiadas = esp.linhas.filter(l => l.adiadaFlag); for (const l of adiadas) { A.overrides[l.chave] = { ...(A.overrides[l.chave] || {}), situacao: "adiada" }; }
    if (adiadas.length) setTimeout(() => showToast("Espelho marca " + adiadas.length + " nota(s) como ADIADA (" + adiadas.map(l => l.nNF).join(", ") + ") — tiradas desta apuração; volte pela coluna Receita se quiser.", ""), 1200);
    salvar(); recalcular();
    if (typeof sugerirRegimePeloEspelho === "function") sugerirRegimePeloEspelho(esp);
    showToast(`Espelho carregado: ${esp.linhas.length} nota(s).`, 'success');
    // Busca automática dos XMLs que faltam (pede só o certificado, se ainda não tiver)
    if (CONF.some(l => l.semXml)) setTimeout(buscarPendentes, 600);
  } catch (e) { console.error(e); showToast('Não consegui ler o espelho: ' + e.message, 'error'); }
});
$('btnAddChaves').onclick = () => {
  const esp = ESPELHO.lerTexto($('txtChaves').value); if (!esp.linhas.length) return showToast('Nenhuma chave de 44 dígitos encontrada.', 'error');
  const A = apur(); if (!A.espelho) A.espelho = { contribuinte: '', ie: '', nDia: '', linhas: [], avisos: [] };
  let n = 0; for (const l of esp.linhas) if (!A.espelho.linhas.some(x => x.chave === l.chave)) { A.espelho.linhas.push(l); n++; }
  $('txtChaves').value = ''; salvar(); recalcular(); showToast(n + ' chave(s) adicionada(s).', 'success');
};
async function carregarXmls(files) {
  const A = apur(); let ok = 0, ign = 0, err = [], errDet = [];
  const E = empresaAtual();
  const addXml = (txt, nome) => { try { const n = NFE.parse(txt, nome); if (n.mod !== "55") { ign++; errDet.push({ nNF: n.nNF, emitente: n.emit.nome, uf: n.emit.uf, chave: n.chave, motivo: "Não é NF-e modelo 55 (modelo " + n.mod + ") — ignorado" }); return; } A.xmls[n.chave] = txt; ok++; if (E && !E.cnpj && n.dest.ie && n.dest.ie === E.ie) { E.cnpj = n.dest.cnpj; if (!E.nome || /^Contribuinte /.test(E.nome)) E.nome = n.dest.nome; renderEmpresasSelect(); } } catch (e) { err.push(nome); errDet.push({ nNF: nome, emitente: "", chave: (String(nome).match(/d{44}/) || [""])[0], motivo: e.message }); } };
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      if (typeof JSZip === 'undefined') { showToast('ZIP não suportado sem internet (JSZip). Extraia os XML.', 'error'); continue; }
      const z = await JSZip.loadAsync(await f.arrayBuffer());
      for (const [nome, ent] of Object.entries(z.files)) if (/\.xml$/i.test(nome) && !ent.dir) addXml(await ent.async('string'), nome);
    } else addXml(await f.text(), f.name);
  }
  salvar(); recalcular(); if (typeof checarSefaz === "function") checarSefaz(); if (typeof identificarRegime === "function") identificarRegime(); if (typeof sugerirCestaPelosXmls === "function") sugerirCestaPelosXmls();
  showToast(`${ok} XML(s) carregado(s)` + (ign ? `, ${ign} ignorado(s) (não é NF-e mod. 55)` : "") + (err.length ? `, ${err.length} com erro` : ""), err.length ? "error" : "success");
  if (errDet.length) mostrarErros(errDet, `${errDet.length} arquivo(s) não importado(s)`);
}
bindDrop('dropXml', 'fileXml', carregarXmls);

// ------------------------------------------------------------------ SEFAZ: certificado A1 + Distribuição DF-e (servir.ps1)
let SEFAZ = { online: false, certificados: [] };
function backendUrl() { const p = (DB.params.backendUrl || '').replace(/\/$/, ''); if (p) return p; return /^https?:/.test(location.protocol) ? location.origin : ''; }
async function api(path, opts) { const r = await fetch(backendUrl() + path, opts); return r.json(); }
function certDaEmpresa() { const E = empresaAtual(); if (!E || !E.cnpj) return null; return SEFAZ.certificados.find(c => c.cnpj === E.cnpj) || null; }
async function checarSefaz() {
  const E = empresaAtual();
  try { const j = await api('/api/status'); SEFAZ = { online: !!j.ok, certificados: j.certificados || [] }; }
  catch (e) { SEFAZ = { online: false, certificados: [] }; }
  const el = $('infoCert');
  if (!SEFAZ.online) {
    const noSite = !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    el.innerHTML = noSite
      ? '<span class="badge b-info">busca automática só na versão local</span> Aqui no site você arrasta os XMLs no Passo 2 (ou um ZIP). Para baixar direto do Portal Nacional com o certificado A1, abra o sistema no computador do escritório pelo <b>INICIAR.bat</b> (http://localhost:8788): é o mesmo login e os mesmos dados da nuvem, então o que for feito lá aparece aqui.'
      : '<span class="badge b-warn">serviço local desligado</span> feche esta aba e abra o sistema pelo <b>INICIAR.bat</b> (pasta do sistema) — ele abre http://localhost:8788 com a busca no Portal Nacional ativa';
  }
  else {
    const c = certDaEmpresa();
    if (!E) el.innerHTML = '<span class="badge b-info">serviço ativo</span> selecione a empresa';
    else if (!E.cnpj) el.innerHTML = '<span class="badge b-warn">empresa sem CNPJ</span> informe o CNPJ em Cadastros › Empresas';
    else if (!c) el.innerHTML = `<span class="badge b-warn">sem certificado</span> envie o e-CNPJ A1 de ${fmtCnpj(E.cnpj)}`;
    else if (c.vencido) el.innerHTML = `<span class="badge b-bad">certificado vencido em ${c.validade}</span>`;
    else if (!c.senhaSalva && !c.senhaEmMemoria) el.innerHTML = `<span class="badge b-warn">senha necessária</span> certificado válido até ${c.validade}`;
    else el.innerHTML = `<span class="badge b-ok">certificado ok</span> válido até ${c.validade}`;
  }
  return SEFAZ.online;
}
function abrirCert(msg) {
  const E = empresaAtual();
  $('cCnpj').value = E && E.cnpj ? fmtCnpj(E.cnpj) : ''; $('cSenha').value = ''; $('cPfx').value = '';
  $('certStatus').textContent = msg || (SEFAZ.online ? 'Envie o certificado A1 (.pfx) da empresa e a senha. Depois disso a busca dos XMLs é automática.' : 'O serviço local não está ativo. Abra o sistema pelo INICIAR.bat.');
  $('certLista').innerHTML = SEFAZ.certificados.length ? '<table class="tbl compact"><thead><tr><th>CNPJ</th><th>Titular</th><th>Validade</th><th>Senha</th><th></th></tr></thead><tbody>' + SEFAZ.certificados.map(c => `<tr><td class="mono">${fmtCnpj(c.cnpj)}</td><td class="small">${esc((c.titular || c.erro || '').slice(0, 60))}</td><td>${c.vencido ? '<span class="badge b-bad">vencido</span> ' : ''}${esc(c.validade || '')}</td><td>${c.senhaSalva ? 'salva' : c.senhaEmMemoria ? 'nesta sessão' : '<span class="badge b-warn">falta</span>'}</td><td><button class="btn sm danger" data-rmcert="${c.cnpj}">✕</button></td></tr>`).join('') + '</tbody></table>' : '<div class="small muted">Nenhum certificado cadastrado neste computador.</div>';
  $('certLista').querySelectorAll('[data-rmcert]').forEach(b => b.onclick = async () => { if (confirm('Remover o certificado ' + fmtCnpj(b.dataset.rmcert) + ' deste computador?')) { await api('/api/certificado/' + b.dataset.rmcert, { method: 'DELETE' }); await checarSefaz(); abrirCert(); } });
  openModal('modal-cert');
}
$('btnCert').onclick = () => abrirCert();
$('btnSalvarCert').onclick = async () => {
  const f = $('cPfx').files[0]; const senha = $('cSenha').value; const cnpj = $('cCnpj').value.replace(/\D/g, '');
  if (!f) return showToast('Selecione o arquivo .pfx.', 'error'); if (!senha) return showToast('Informe a senha do certificado.', 'error');
  const b64 = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
  $('btnSalvarCert').disabled = true;
  try {
    const j = await api('/api/certificado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, pfxBase64: b64, senha, lembrar: $('cLembrar').checked }) });
    if (!j.ok) throw new Error(j.erro || 'falha');
    const E = empresaAtual(); if (E && !E.cnpj && j.certificado.cnpj) { E.cnpj = j.certificado.cnpj; salvar(); }
    if (E && E.cnpj && j.certificado.cnpjCertificado && j.certificado.cnpjCertificado !== E.cnpj) showToast('Atenção: o CNPJ do certificado (' + fmtCnpj(j.certificado.cnpjCertificado) + ') é diferente do CNPJ da empresa.', 'error');
    else showToast('Certificado salvo — válido até ' + j.certificado.validade, 'success');
    await checarSefaz(); closeModal('modal-cert');
    if (CONF.some(l => l.semXml)) buscarPendentes();
  } catch (e) { showToast('Não foi possível usar o certificado: ' + e.message, 'error'); }
  $('btnSalvarCert').disabled = false;
};
$('btnSoSenha').onclick = async () => {
  const senha = $('cSenha').value; const cnpj = $('cCnpj').value.replace(/\D/g, '');
  if (!senha || !cnpj) return showToast('Informe CNPJ e senha.', 'error');
  const j = await api('/api/senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, senha }) });
  if (!j.ok) return showToast('Senha recusada: ' + (j.erro || ''), 'error');
  showToast('Senha aceita para esta sessão.', 'success'); await checarSefaz(); closeModal('modal-cert'); if (CONF.some(l => l.semXml)) buscarPendentes();
};
async function garantirCertificado() {
  if (!(await checarSefaz())) { showToast('Serviço local desligado — abra pelo INICIAR.bat para buscar no Portal Nacional da NF-e.', 'error'); return false; }
  const E = empresaAtual();
  if (!E) { showToast('Selecione a empresa.', 'error'); return false; }
  if (!E.cnpj) { editarEmpresa(E.id); showToast('Informe o CNPJ da empresa (é o interessado na Distribuição DF-e).', 'error'); return false; }
  const c = certDaEmpresa();
  if (!c) { abrirCert('Para buscar os XMLs automaticamente, envie o certificado A1 (e-CNPJ) de ' + E.nome + '.'); return false; }
  if (c.vencido) { abrirCert('O certificado cadastrado venceu em ' + c.validade + '. Envie o certificado novo.'); return false; }
  if (!c.senhaSalva && !c.senhaEmMemoria) { abrirCert('Informe a senha do certificado de ' + fmtCnpj(E.cnpj) + ' para esta sessão.'); return false; }
  return true;
}
async function buscarPendentes() {
  if (!(await garantirCertificado())) return;
  const E = empresaAtual(); const pend = CONF.filter(l => l.semXml).map(l => l.chave);
  if (!pend.length) return showToast('Nenhuma nota pendente de XML.', '');
  let ok = 0, fail = 0, pendentes = 0; const falhas = []; const detalhes = [];
  const infoDe = ch => { const l = CONF.find(x => x.chave === ch) || {}; const ic = ESPELHO.infoChave(ch) || {}; return { chave: ch, nNF: l.nNF || ic.nNF, emitente: l.emitente || fmtCnpj(ic.cnpj), uf: l.uf || ic.uf }; };
  const btn = $('btnBuscarOnline'); btn.disabled = true;
  for (let i = 0; i < pend.length; i++) {
    const ch = pend[i]; btn.textContent = `☁ buscando ${i + 1}/${pend.length}…`;
    try {
      const j = await api(`/api/nfe/${ch}?cnpj=${E.cnpj}`);
      if (j.ok && j.xml) { apur().xmls[ch] = j.xml; ok++; salvar(); recalcular(); }
      else if (j.codigo === 'SENHA_NECESSARIA' || j.codigo === 'SEM_CERTIFICADO') { btn.disabled = false; btn.textContent = '☁ Buscar pendentes no Portal Nacional'; await checarSefaz(); return garantirCertificado(); }
      else { if (j.pendente) pendentes++; else fail++; falhas.push(ch); detalhes.push({ ...infoDe(ch), motivo: (j.pendente ? "Aguardando liberação após a ciência — tente de novo em alguns minutos. " : "") + (j.motivo || j.erro || "sem resposta") }); console.warn(ch, j); }
    } catch (e) { fail++; detalhes.push({ ...infoDe(ch), motivo: "Falha de comunicação: " + e.message }); }
  }
  btn.disabled = false; btn.textContent = '☁ Buscar pendentes no Portal Nacional'; salvar(); recalcular();
  let msg = `${ok} XML(s) obtido(s) do Portal Nacional da NF-e`; if (pendentes) msg += `, ${pendentes} aguardando liberação após a ciência (tente de novo em alguns minutos)`; if (fail) msg += `, ${fail} com erro`;
  showToast(msg, fail ? 'error' : 'success');
  if (detalhes.length) mostrarErros(detalhes, `${detalhes.length} de ${pend.length} nota(s) não vieram do Portal Nacional`);
}
$('btnBuscarOnline').onclick = buscarPendentes;
$('btnDistribuicao').onclick = async () => {
  if (!(await garantirCertificado())) return;
  const E = empresaAtual(); const btn = $('btnDistribuicao'); btn.disabled = true; btn.textContent = '⬇ baixando…';
  try {
    const j = await api(`/api/distribuicao?cnpj=${E.cnpj}`);
    if (!j.ok) throw new Error(j.erro || j.motivo || 'falha');
    let novas = 0, resumos = 0, outros = 0; const A = apur();
    for (const d of j.docs || []) {
      if (/^procNFe/.test(d.schema) && d.chave) { if (!A.xmls[d.chave]) { A.xmls[d.chave] = d.xml; novas++; } }
      else if (/^resNFe/.test(d.schema)) { resumos++; if (!A.espelho) A.espelho = { contribuinte: '', ie: '', nDia: '', linhas: [], avisos: [] }; if (d.chave && !A.espelho.linhas.some(x => x.chave === d.chave)) A.espelho.linhas.push({ chave: d.chave, nNF: d.chave.substring(25, 34).replace(/^0+/, ''), emitente: d.chave.substring(6, 20), forma: '', vlTotal: 0, vlIcmsCalc: 0, vlRecolher: 0, origem: 'distribuicao' }); }
      else outros++;
    }
    salvar(); recalcular();
    showToast(`Distribuição DF-e: ${novas} NF-e completa(s) nova(s), ${resumos} resumo(s) (use "Buscar pendentes" para manifestar e baixar), ${outros} evento(s). Último NSU ${j.ultNSU}.`, 'success');
    console.info(j.log);
  } catch (e) { showToast('Distribuição DF-e: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '⬇ Baixar todas as NF-e do CNPJ';
};
// Ao trocar de empresa/competência, reavalia o certificado
$('selEmpresa').addEventListener('change', checarSefaz);
setTimeout(checarSefaz, 300);
$('btnLimparApur').onclick = () => { if (confirm('Limpar espelho, XMLs e ajustes desta empresa/competência?')) { delete DB.apuracoes[apurKey()]; salvar(); recalcular(); } };
$('filtroNotas').oninput = renderNotas; $('chkSoDif').onchange = renderNotas;

// ------------------------------------------------------------------ exportação
function exportar() {
  const E = empresaAtual(); if (!E) return showToast('Selecione a empresa.', 'error');
  if (!RES.length) return showToast('Nada para exportar — carregue os XMLs.', 'error');
  const ctx = { empresa: E, competencia: ST.comp, resultados: RES, consolidado: CONS, params: { ...MOTOR.PARAMS_PADRAO, ...DB.params }, linhasConferencia: CONF.map(l => ({ nNF: l.nNF, emitente: l.emitente, uf: l.uf, chave: l.chave, forma: l.forma, vSefaz: l.vSefaz ?? '', receita: l.receita, vCalc: l.vCalc ?? '', fecoep: l.fecoep, dif: l.dif ?? '', status: l.status === "ok" ? (Math.abs(l.dif || 0) > 0.05 ? "diverge da SEFAZ" : "confere") : l.status === "difal_recolhido" ? "já recolhida no DIFAL (fora da apuração)" : l.status === "adiada" ? "adiada para o mês seguinte" : l.status })) };
  const nome = EXPORTAR.gerar(ctx); showToast('Planilha gerada: ' + nome, 'success');
}
$('btnExport').onclick = exportar; $('btnExport2').onclick = exportar; $('btnExportTop').onclick = exportar;

// ------------------------------------------------------------------ ajuda
$('tblReceitas').innerHTML = TABELAS_SE.receitas.filter(r => r.cod).map(r => `<tr><td><span class="badge b-navy">${r.cod}</span></td><td><b>${esc(r.nome)}</b><div class="small muted">${esc(r.titulo)}</div></td><td class="small">${esc(r.formula)}<div class="muted">${esc(r.base)}</div></td></tr>`).join('');
$("verTab").textContent = TABELAS_SE.versao; $("verApp").textContent = APP_VERSAO.nome + " v" + APP_VERSAO.numero + " (" + APP_VERSAO.data + ")"; $("brandTitulo").title = "versão " + APP_VERSAO.numero + " de " + APP_VERSAO.data; document.title += " · v" + APP_VERSAO.numero;

