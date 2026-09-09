/* =====================================================================
   Totali Antecipa — certificados A1 guardados no LOGIN do usuário
   Firestore: usuarios/{uid}/certificados/{cnpj}
              {cnpj, pfxBase64, titular, validade, cnpjCertificado, salvoEm, salvoPor}
   - Guarda só o ARQUIVO .pfx (que já vem protegido pela própria senha).
     A senha NÃO vai para a nuvem: é digitada uma vez em cada computador e
     fica protegida pelo Windows (DPAPI) no serviço local.
   - Só o próprio usuário lê/grava (regras do Firestore); nem administradores.
   - No computador com o INICIAR.bat: quando falta o certificado da empresa,
     o sistema pega o arquivo do login e pede só a senha ("Informar só a senha").
   ===================================================================== */
const CERTS = (() => {
  if (!FB.ATIVO) return { ativo: false };
  const col = () => FB.db.collection('usuarios').doc(FB.usuario.uid).collection('certificados');
  let lista = [], carregado = false;

  async function carregar() {
    if (!FB.usuario) { lista = []; carregado = false; return lista; }
    try { const q = await col().get(); lista = q.docs.map(d => ({ id: d.id, ...d.data() })); carregado = true; }
    catch (e) { console.warn('certificados do login', e); lista = []; }
    return lista;
  }
  async function guardar(c) {
    await col().doc(c.cnpj).set({ ...c, salvoEm: new Date().toISOString(), salvoPor: FB.usuario.email });
    carregado = false;
  }
  async function remover(cnpj) { await col().doc(cnpj).delete(); carregado = false; }
  async function doLogin(cnpj) { if (!carregado) await carregar(); return lista.find(c => c.cnpj === cnpj && c.pfxBase64) || null; }

  function html() {
    if (!FB.usuario) return '';
    const linhas = lista.map(c => `<tr><td class="mono">${fmtCnpj(c.cnpj)}</td><td class="small">${esc((c.titular || '').slice(0, 60))}</td><td>${esc(c.validade || '—')}</td><td class="small muted">${c.salvoEm ? new Date(c.salvoEm).toLocaleDateString('pt-BR') : ''}</td><td><button class="btn sm danger" data-rmlogin="${c.cnpj}" title="Apagar do meu login">✕</button></td></tr>`).join('');
    return `<div class="fi-label" style="margin-top:14px">Certificados guardados no meu login (${esc(FB.usuario.email)})</div>` +
      (lista.length ? '<table class="tbl compact"><thead><tr><th>CNPJ</th><th>Titular</th><th>Validade</th><th>Salvo em</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table>' : '<div class="small muted">Nenhum. Envie um certificado com "guardar no meu login" marcado e ele passa a valer em qualquer computador onde você entrar (a senha é pedida uma vez por computador).</div>');
  }
  return { ativo: true, carregar, guardar, remover, doLogin, html, get lista() { return lista; } };
})();

if (CERTS.ativo) {
  // 1) antes de buscar XMLs: se este computador não tem o certificado mas o login tem, pede só a senha
  const _garantirCertificado = garantirCertificado;
  garantirCertificado = async function () {
    const E = empresaAtual();
    if (SEFAZ.online && E && E.cnpj && !certDaEmpresa() && FB.usuario) {
      const c = await CERTS.doLogin(E.cnpj);
      if (c) { abrirCert('O certificado de ' + fmtCnpj(E.cnpj) + ' está guardado no seu login. Digite a senha e clique em "Informar só a senha" para usá-lo neste computador.'); return false; }
    }
    return _garantirCertificado();
  };

  // 2) modal do certificado: lista do login + texto certo quando está no site
  const _abrirCert = abrirCert;
  abrirCert = async function (msg) {
    _abrirCert(msg);
    if (!SEFAZ.online) $('certStatus').textContent = msg || 'Aqui no site o arquivo do certificado fica guardado no seu login. Quando você abrir o sistema pelo INICIAR.bat em qualquer computador, ele é usado de lá; a senha é pedida uma vez por computador.';
    const el = $('certLogin'); if (!el) return;
    el.innerHTML = '<div class="small muted">Carregando certificados do login…</div>';
    await CERTS.carregar(); el.innerHTML = CERTS.html();
    el.querySelectorAll('[data-rmlogin]').forEach(b => b.onclick = async () => {
      if (!confirm('Apagar o certificado ' + fmtCnpj(b.dataset.rmlogin) + ' do seu login? (os computadores que já receberam continuam com ele)')) return;
      try { await CERTS.remover(b.dataset.rmlogin); abrirCert(); } catch (e) { showToast('Não consegui apagar: ' + e.message, 'error'); }
    });
  };

  // 3) "Informar só a senha": se este computador ainda não tem o arquivo, usa o do login
  const _soSenha = $('btnSoSenha').onclick;
  $('btnSoSenha').onclick = async () => {
    const senha = $('cSenha').value; const cnpj = $('cCnpj').value.replace(/\D/g, '');
    if (!senha || !cnpj) return showToast('Informe CNPJ e senha.', 'error');
    if (!SEFAZ.online) return showToast('Serviço local desligado — a senha só é usada no computador com o INICIAR.bat.', 'error');
    if (SEFAZ.certificados.find(x => x.cnpj === cnpj)) return _soSenha();
    const c = await CERTS.doLogin(cnpj);
    if (!c) return showToast('Este computador não tem o certificado de ' + fmtCnpj(cnpj) + ' e ele não está no seu login. Envie o arquivo .pfx.', 'error');
    try {
      const j = await api('/api/certificado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, pfxBase64: c.pfxBase64, senha, lembrar: $('cLembrar').checked }) });
      if (!j.ok) throw new Error(j.erro || 'senha recusada');
      showToast('Certificado do seu login pronto neste computador — válido até ' + (j.certificado.validade || ''), 'success');
      await checarSefaz(); closeModal('modal-cert'); if (CONF.some(l => l.semXml)) buscarPendentes();
    } catch (e) { showToast('Não foi possível usar o certificado: ' + e.message, 'error'); }
  };

  // 4) enviar certificado: serviço local (se ativo) + arquivo no login (se marcado)
  $('btnSalvarCert').onclick = async () => {
    const f = $('cPfx').files[0]; const senha = $('cSenha').value; let cnpj = $('cCnpj').value.replace(/\D/g, '');
    if (!f) return showToast('Selecione o arquivo .pfx.', 'error');
    const guardarLogin = $('cGuardarLogin') ? $('cGuardarLogin').checked : true;
    if (SEFAZ.online && !senha) return showToast('Informe a senha do certificado.', 'error');
    if (!SEFAZ.online && !guardarLogin) return showToast('Serviço local desligado: marque "guardar no meu login" ou abra pelo INICIAR.bat.', 'error');
    if (!SEFAZ.online && cnpj.length !== 14) return showToast('Informe o CNPJ da empresa (14 dígitos) para guardar no login.', 'error');
    const b64 = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
    $('btnSalvarCert').disabled = true;
    let info = { titular: '', validade: '', cnpjCertificado: '' };
    try {
      if (SEFAZ.online) {
        const j = await api('/api/certificado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj, pfxBase64: b64, senha, lembrar: $('cLembrar').checked }) });
        if (!j.ok) throw new Error(j.erro || 'falha');
        cnpj = j.certificado.cnpj || cnpj; info = { titular: j.certificado.titular || '', validade: j.certificado.validade || '', cnpjCertificado: j.certificado.cnpjCertificado || '' };
        const E = empresaAtual(); if (E && !E.cnpj && cnpj) { E.cnpj = cnpj; salvar(); }
        if (E && E.cnpj && info.cnpjCertificado && info.cnpjCertificado !== E.cnpj) showToast('Atenção: o CNPJ do certificado (' + fmtCnpj(info.cnpjCertificado) + ') é diferente do CNPJ da empresa.', 'error');
      }
      if (guardarLogin && FB.usuario) {
        await CERTS.guardar({ cnpj, pfxBase64: b64, ...info });
        showToast('Arquivo do certificado guardado no seu login' + (info.validade ? ' — válido até ' + info.validade : '') + (SEFAZ.online ? ' e neste computador.' : '. A senha será pedida no computador com o INICIAR.bat.'), 'success');
      } else if (SEFAZ.online) showToast('Certificado salvo neste computador — válido até ' + info.validade, 'success');
      await checarSefaz(); closeModal('modal-cert');
      if (SEFAZ.online && CONF.some(l => l.semXml)) buscarPendentes();
    } catch (e) { showToast('Não foi possível usar o certificado: ' + e.message, 'error'); }
    $('btnSalvarCert').disabled = false;
  };
}
