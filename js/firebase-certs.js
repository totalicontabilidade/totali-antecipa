/* =====================================================================
   Totali Antecipa — certificados A1 no LOGIN do usuário + serviço na nuvem
   Firestore: usuarios/{uid}/certificados/{cnpj}
              {cnpj, pfxBase64, senhaCifrada?, titular, validade, cnpjCertificado, ultNSU, salvoEm, salvoPor}
   Dois modos de busca no Portal Nacional, com a MESMA API (/api/...):
   - NUVEM (site): FIREBASE_CONFIG.sefazBackend = Cloud Run function (cloud/sefaz).
     Ela exige o token do login, guarda o .pfx e a senha CIFRADA (chave só na
     função) e busca os XMLs de qualquer lugar.
   - LOCAL (INICIAR.bat): servidor PowerShell na máquina; a senha fica no
     Windows (DPAPI). Se o computador não tem o .pfx mas o login tem, o
     sistema usa o arquivo do login e pede só a senha.
   ===================================================================== */
const CERTS = (() => {
  if (!FB.ATIVO) return { ativo: false };
  const cfg = window.FIREBASE_CONFIG || {};
  const col = () => FB.db.collection('usuarios').doc(FB.usuario.uid).collection('certificados');
  let lista = [], carregado = false;
  const ehLocal = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const nuvemUrl = () => String(cfg.sefazBackend || '').replace(/\/$/, '');
  const usandoNuvem = () => { const u = backendUrl(); return !!u && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u); };

  async function carregar() {
    if (!FB.usuario) { lista = []; carregado = false; return lista; }
    try { const q = await col().get(); lista = q.docs.map(d => ({ id: d.id, ...d.data() })); carregado = true; }
    catch (e) { console.warn('certificados do login', e); lista = []; }
    return lista;
  }
  async function guardar(c) {
    await col().doc(c.cnpj).set({ ...c, salvoEm: new Date().toISOString(), salvoPor: FB.usuario.email }, { merge: true });
    carregado = false;
  }
  async function remover(cnpj) { await col().doc(cnpj).delete(); carregado = false; }
  async function doLogin(cnpj) { if (!carregado) await carregar(); return lista.find(c => c.cnpj === cnpj && c.pfxBase64) || null; }

  function html() {
    if (!FB.usuario) return '';
    const linhas = lista.map(c => `<tr><td class="mono">${fmtCnpj(c.cnpj)}</td><td class="small">${esc((c.titular || '').slice(0, 60))}</td><td>${esc(c.validade || '—')}</td><td class="small muted">${c.salvoEm ? new Date(c.salvoEm).toLocaleDateString('pt-BR') : ''}</td><td><button class="btn sm danger" data-rmlogin="${c.cnpj}" title="Apagar do meu login">✕</button></td></tr>`).join('');
    return `<div class="fi-label" style="margin-top:14px">Certificados guardados no meu login (${esc(FB.usuario.email)})</div>` +
      (lista.length ? '<table class="tbl compact"><thead><tr><th>CNPJ</th><th>Titular</th><th>Validade</th><th>Salvo em</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table>' : '<div class="small muted">Nenhum. Envie um certificado com "guardar o arquivo no meu login" marcado e ele passa a valer em qualquer computador onde você entrar (a senha é pedida uma vez por computador).</div>');
  }
  return { ativo: true, carregar, guardar, remover, doLogin, html, ehLocal, nuvemUrl, usandoNuvem, get lista() { return lista; } };
})();

if (CERTS.ativo) {
  // 0) endereço do serviço: local (INICIAR.bat) quando aberto em localhost; nuvem (Cloud Run) no site
  const _backendUrl = backendUrl;
  backendUrl = function () {
    const p = (DB.params.backendUrl || '').replace(/\/$/, ''); if (p) return p;
    if (CERTS.ehLocal()) return _backendUrl();
    return CERTS.nuvemUrl() || _backendUrl();
  };
  // toda chamada à nuvem leva o token do login
  const _api = api;
  api = async function (path, opts) {
    opts = Object.assign({}, opts || {});
    if (CERTS.usandoNuvem() && FB.usuario) {
      const t = await FB.usuario.getIdToken();
      opts.headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + t });
    }
    return _api(path, opts);
  };
  // checagem do serviço: repete quando o login termina (o token só existe depois)
  firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(() => { try { checarSefaz(); } catch (e) { } }, 2500); });

  // 1) antes de buscar XMLs (modo LOCAL): se este computador não tem o certificado mas o login tem, pede só a senha
  const _garantirCertificado = garantirCertificado;
  garantirCertificado = async function () {
    const E = empresaAtual();
    if (SEFAZ.online && !CERTS.usandoNuvem() && E && E.cnpj && !certDaEmpresa() && FB.usuario) {
      const c = await CERTS.doLogin(E.cnpj);
      if (c) { abrirCert('O certificado de ' + fmtCnpj(E.cnpj) + ' está guardado no seu login. Digite a senha e clique em "Informar só a senha" para usá-lo neste computador.'); return false; }
    }
    return _garantirCertificado();
  };

  // 2) modal do certificado
  const _abrirCert = abrirCert;
  abrirCert = async function (msg) {
    _abrirCert(msg);
    const nuvem = CERTS.usandoNuvem();
    if (!SEFAZ.online) $('certStatus').textContent = msg || (nuvem ? 'O serviço na nuvem não respondeu. Tente de novo em instantes ou abra pelo INICIAR.bat.' : 'Aqui o arquivo do certificado fica guardado no seu login. Quando você abrir o sistema pelo INICIAR.bat em qualquer computador, ele é usado de lá; a senha é pedida uma vez por computador.');
    else if (nuvem && !msg) $('certStatus').textContent = 'Envie o certificado A1 (.pfx) da empresa e a senha. Ele fica guardado no seu login, com a senha cifrada, e a busca dos XMLs passa a funcionar aqui no site, de qualquer computador.';
    const cl = $('cLembrar'); if (cl && cl.parentElement) cl.parentElement.style.display = nuvem ? 'none' : '';
    const cg = $('cGuardarLogin'); if (cg && cg.parentElement) cg.parentElement.style.display = nuvem ? 'none' : '';
    const el = $('certLogin'); if (!el) return;
    if (nuvem) { el.innerHTML = '<div class="small muted">Na nuvem, a lista acima já é a do seu login.</div>'; return; }
    el.innerHTML = '<div class="small muted">Carregando certificados do login…</div>';
    await CERTS.carregar(); el.innerHTML = CERTS.html();
    el.querySelectorAll('[data-rmlogin]').forEach(b => b.onclick = async () => {
      if (!confirm('Apagar o certificado ' + fmtCnpj(b.dataset.rmlogin) + ' do seu login? (os computadores que já receberam continuam com ele)')) return;
      try { await CERTS.remover(b.dataset.rmlogin); abrirCert(); } catch (e) { showToast('Não consegui apagar: ' + e.message, 'error'); }
    });
  };

  // 3) "Informar só a senha" (modo LOCAL): se este computador ainda não tem o arquivo, usa o do login
  const _soSenha = $('btnSoSenha').onclick;
  $('btnSoSenha').onclick = async () => {
    const senha = $('cSenha').value; const cnpj = $('cCnpj').value.replace(/\D/g, '');
    if (!senha || !cnpj) return showToast('Informe CNPJ e senha.', 'error');
    if (!SEFAZ.online) return showToast('Serviço desligado — tente de novo ou abra pelo INICIAR.bat.', 'error');
    if (CERTS.usandoNuvem() || SEFAZ.certificados.find(x => x.cnpj === cnpj)) return _soSenha();
    const c = await CERTS.doLogin(cnpj);
    if (!c) return showToast('Este computador não tem o certificado de ' + fmtCnpj(cnpj) + ' e ele não está no seu login. Envie o arquivo .pfx.', 'error');
    try {
      const j = await api('/api/certificado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, pfxBase64: c.pfxBase64, senha, lembrar: $('cLembrar').checked }) });
      if (!j.ok) throw new Error(j.erro || 'senha recusada');
      showToast('Certificado do seu login pronto neste computador — válido até ' + (j.certificado.validade || ''), 'success');
      await checarSefaz(); closeModal('modal-cert'); if (CONF.some(l => l.semXml)) buscarPendentes();
    } catch (e) { showToast('Não foi possível usar o certificado: ' + e.message, 'error'); }
  };

  // 4) enviar certificado: serviço (nuvem ou local) + arquivo no login (modo local, se marcado)
  $('btnSalvarCert').onclick = async () => {
    const f = $('cPfx').files[0]; const senha = $('cSenha').value; let cnpj = $('cCnpj').value.replace(/\D/g, '');
    if (!f) return showToast('Selecione o arquivo .pfx.', 'error');
    const nuvem = CERTS.usandoNuvem();
    const guardarLogin = !nuvem && ($('cGuardarLogin') ? $('cGuardarLogin').checked : true);
    if (SEFAZ.online && !senha) return showToast('Informe a senha do certificado.', 'error');
    if (!SEFAZ.online && nuvem) return showToast('O serviço na nuvem não respondeu. Tente de novo em instantes.', 'error');
    if (!SEFAZ.online && !guardarLogin) return showToast('Serviço local desligado: marque "guardar o arquivo no meu login" ou abra pelo INICIAR.bat.', 'error');
    if (!SEFAZ.online && cnpj.length !== 14) return showToast('Informe o CNPJ da empresa (14 dígitos) para guardar no login.', 'error');
    const b64 = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
    $('btnSalvarCert').disabled = true;
    let info = { titular: '', validade: '', cnpjCertificado: '' };
    try {
      if (SEFAZ.online) {
        const j = await api('/api/certificado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, pfxBase64: b64, senha, lembrar: nuvem ? true : $('cLembrar').checked }) });
        if (!j.ok) throw new Error(j.erro || 'falha');
        cnpj = j.certificado.cnpj || cnpj; info = { titular: j.certificado.titular || '', validade: j.certificado.validade || '', cnpjCertificado: j.certificado.cnpjCertificado || '' };
        const E = empresaAtual(); if (E && !E.cnpj && cnpj) { E.cnpj = cnpj; salvar(); }
        if (E && E.cnpj && info.cnpjCertificado && info.cnpjCertificado !== E.cnpj) showToast('Atenção: o CNPJ do certificado (' + fmtCnpj(info.cnpjCertificado) + ') é diferente do CNPJ da empresa.', 'error');
      }
      if (guardarLogin && FB.usuario) {
        await CERTS.guardar({ cnpj, pfxBase64: b64, ...info });
        showToast('Arquivo do certificado guardado no seu login' + (info.validade ? ' — válido até ' + info.validade : '') + (SEFAZ.online ? ' e neste computador.' : '. A senha será pedida no computador com o INICIAR.bat.'), 'success');
      } else if (SEFAZ.online) showToast('Certificado guardado' + (nuvem ? ' no seu login (nuvem)' : ' neste computador') + ' — válido até ' + info.validade, 'success');
      await checarSefaz(); closeModal('modal-cert');
      if (SEFAZ.online && CONF.some(l => l.semXml)) buscarPendentes();
    } catch (e) { showToast('Não foi possível usar o certificado: ' + e.message, 'error'); }
    $('btnSalvarCert').disabled = false;
  };
}
