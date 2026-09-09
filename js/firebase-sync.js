/* =====================================================================
   Totali Antecipa — login e banco de dados no Firebase
   - Login por e-mail e senha (Firebase Authentication)
   - Dados do escritório no Firestore, compartilhados entre os usuários
     autorizados: empresas, regras, parâmetros, apurações e XMLs
   - Novo usuário: "Criar login" → fica AGUARDANDO AUTORIZAÇÃO; o sistema
     manda um e-mail para contato@totalicontabilidade.com.br com os botões
     ACEITAR / RECUSAR (Apps Script da Totali ou extensão Trigger Email) e
     um administrador libera pelo botão ou em Cadastros › Usuários.
   - E-mails @totalicontabilidade.com.br viram administradores sozinhos
     depois de verificar o e-mail.
   - Sem FIREBASE_CONFIG preenchido o sistema roda só no navegador.

   Estrutura no Firestore
     usuarios/{uid}                     {email, nome, aprovado, admin, criadoEm, aprovadoEm, aprovadoPor}
     mail/{auto}                        e-mails (extensão Trigger Email, se instalada)
     escritorio/empresas                {lista:[...]}
     escritorio/regras                  {lista:[...]}
     escritorio/params                  {...}
     escritorio/apuracoes/itens/{key}   {empresaId, comp, espelho, overrides, atualizadoEm, atualizadoPor}
     escritorio/apuracoes/itens/{key}/xmls/{chave}  {xml}
   ===================================================================== */
const FB = (() => {
  const cfg = window.FIREBASE_CONFIG || {};
  const ATIVO = !!(cfg.apiKey && cfg.projectId && typeof firebase !== 'undefined');
  const ADMIN_EMAIL = 'contato@totalicontabilidade.com.br';
  const DOMINIO_TOTALI = '@totalicontabilidade.com.br';          // e-mails do escritório viram administradores (depois de verificar o e-mail)
  const ehTotali = email => String(email || '').toLowerCase().endsWith(DOMINIO_TOTALI);
  const APP_NOME = 'Totali Antecipa';
  let auth = null, db = null, user = null, perfil = null, pronto = false;
  const snap = { empresas: '', regras: '', params: '', apur: {}, xmls: {} };   // último estado gravado na nuvem (JSON)
  const xmlsCarregados = new Set();
  let timer = null, gravando = false, deNovo = false;
  const paraJson = o => JSON.stringify(o ?? null);
  const agora = () => new Date().toISOString();
  const limpar = o => JSON.parse(JSON.stringify(o ?? null));   // tira undefined (o Firestore não aceita)

  // ------------------------------------------------------------- referências
  const docEsc = nome => db.collection('escritorio').doc(nome);
  const colApur = () => db.collection('escritorio').doc('apuracoes').collection('itens');
  const docApur = key => colApur().doc(key);
  const colXmls = key => docApur(key).collection('xmls');
  const docUser = uid => db.collection('usuarios').doc(uid);

  // ------------------------------------------------------------- tela de entrada
  function gateHtml() {
    return `
<style>
  #fbGate { position: fixed; inset: 0; z-index: 9000; background: radial-gradient(1200px 600px at 20% -10%, #24406A 0%, var(--navy-3) 60%); display: flex; align-items: center; justify-content: center; padding: 20px; }
  #fbGate .fb-card { width: min(440px, 100%); background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; }
  #fbGate .fb-hdr { background: var(--navy); padding: 22px 24px 18px; color: #fff; display: flex; align-items: center; gap: 14px; }
  #fbGate .fb-hdr img { height: 34px; } #fbGate .fb-hdr b { font-family: Manrope; font-size: 17px; display: block; } #fbGate .fb-hdr small { opacity: .75; font-size: 12px; }
  #fbGate .fb-body { padding: 20px 24px 22px; }
  #fbGate .tabs { margin-bottom: 14px; }
  #fbGate .fb-msg { font-size: 12.5px; margin-top: 10px; }
  #fbGate .fb-foot { padding: 10px 24px 14px; font-size: 11.5px; color: var(--muted); border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  #fbGate a { cursor: pointer; }
  #fbGate .btn { width: 100%; justify-content: center; }
  .fb-user { font-size: 12px; color: rgba(255,255,255,.85); display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .fb-user .dot { width: 8px; height: 8px; border-radius: 50%; background: #9CA3AF; display: inline-block; }
  .fb-user .dot.ok { background: #34D399; } .fb-user .dot.busy { background: var(--amarelo); } .fb-user .dot.err { background: #F87171; }
  .fb-user button { background: transparent; border: 1px solid rgba(255,255,255,.35); color: #fff; border-radius: 7px; padding: 4px 9px; font-size: 11.5px; cursor: pointer; }
  .side button .pend { background: var(--amarelo); color: var(--navy); border-radius: 10px; padding: 0 7px; font-size: 11px; font-weight: 800; margin-left: 6px; }
</style>
<div id="fbGate">
  <div class="fb-card">
    <div class="fb-hdr"><img src="assets/totali-logo-branca.png" alt="Totali"><div><b>${APP_NOME}</b><small>ICMS Antecipado · Sergipe · acesso restrito</small></div></div>
    <div class="fb-body" id="fbBody"><div class="muted">Conectando…</div></div>
    <div class="fb-foot"><span>Totali Contabilidade</span><span id="fbVer"></span></div>
  </div>
</div>`;
  }
  function gate(on) { const g = $('fbGate'); if (g) g.style.display = on ? 'flex' : 'none'; }
  function corpo(html) { $('fbBody').innerHTML = html; }
  function msg(texto, tipo) { const m = $('fbMsg'); if (!m) return; m.className = 'alert fb-msg ' + (tipo || 'baixo'); m.textContent = texto; m.style.display = texto ? 'block' : 'none'; }
  const erroTxt = e => ({
    'auth/invalid-email': 'E-mail inválido.', 'auth/user-not-found': 'Não existe login com esse e-mail.', 'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/invalid-login-credentials': 'E-mail ou senha incorretos.', 'auth/email-already-in-use': 'Já existe um login com esse e-mail — use "Entrar" ou "Esqueci a senha".',
    'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/network-request-failed': 'Sem conexão com a internet.',
    'permission-denied': 'Sem permissão no banco (usuário não autorizado ou regras do Firestore não publicadas).',
  }[e && e.code] || (e && e.message) || String(e));

  function telaLogin(aba) {
    aba = aba || 'entrar';
    corpo(`
      <div class="tabs"><button type="button" class="${aba === 'entrar' ? 'on' : ''}" id="fbTabEntrar">Entrar</button><button type="button" class="${aba === 'criar' ? 'on' : ''}" id="fbTabCriar">Criar login</button></div>
      <form id="fbForm" autocomplete="on">
        ${aba === 'criar' ? '<div class="field"><label class="fi-label" for="fbNome">Seu nome</label><input class="fi" id="fbNome" autocomplete="name" required placeholder="Nome e sobrenome"></div>' : ''}
        <div class="field"><label class="fi-label" for="fbEmail">E-mail</label><input class="fi" id="fbEmail" type="email" autocomplete="username" required placeholder="voce@empresa.com.br"></div>
        <div class="field"><label class="fi-label" for="fbSenha">Senha</label><input class="fi" id="fbSenha" type="password" autocomplete="${aba === 'criar' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${aba === 'criar' ? 'mínimo 6 caracteres' : ''}"></div>
        ${aba === 'criar' ? '<div class="hint" style="margin:-6px 0 12px">Depois de criar o login, a Totali recebe um aviso em <b>' + ADMIN_EMAIL + '</b> com os botões Aceitar / Recusar e libera o seu acesso. Você será avisado por e-mail.</div>' : ''}
        <button class="btn gold" type="submit" id="fbOk">${aba === 'criar' ? 'Criar login' : 'Entrar'}</button>
        <div class="alert fb-msg" id="fbMsg" style="display:none"></div>
      </form>
      ${aba === 'entrar' ? '<div class="hint" style="margin-top:12px;text-align:center"><a id="fbEsqueci">Esqueci a senha</a></div>' : ''}`);
    $('fbTabEntrar').onclick = () => telaLogin('entrar'); $('fbTabCriar').onclick = () => telaLogin('criar');
    $('fbForm').onsubmit = async ev => {
      ev.preventDefault(); const b = $('fbOk'); b.disabled = true; msg('');
      const email = $('fbEmail').value.trim().toLowerCase(), senha = $('fbSenha').value;
      try {
        if (aba === 'criar') {
          const nome = $('fbNome').value.trim(); if (!nome) throw new Error('Informe o seu nome.');
          const cred = await auth.createUserWithEmailAndPassword(email, senha);
          await cred.user.updateProfile({ displayName: nome });
          await criarPerfil(cred.user, nome);
        } else {
          await auth.signInWithEmailAndPassword(email, senha);
        }
      } catch (e) { msg(erroTxt(e), 'alto'); b.disabled = false; }
    };
    const esq = $('fbEsqueci'); if (esq) esq.onclick = async () => {
      const email = $('fbEmail').value.trim().toLowerCase(); if (!email) return msg('Digite o e-mail e clique de novo em "Esqueci a senha".', 'medio');
      try { await auth.sendPasswordResetEmail(email); msg('Enviamos um link para redefinir a senha em ' + email + '.', 'baixo'); } catch (e) { msg(erroTxt(e), 'alto'); }
    };
    setTimeout(() => { const f = $(aba === 'criar' ? 'fbNome' : 'fbEmail'); if (f) f.focus(); }, 50);
  }

  function telaPendente(p) {
    corpo(`
      <h3 style="margin-bottom:6px">Cadastro recebido ✅</h3>
      <p style="margin:0 0 10px">Olá, <b>${esc(p.nome || user.email)}</b>. Seu login foi criado, mas o acesso ao sistema ainda precisa ser <b>autorizado pela Totali</b>.</p>
      <div class="alert baixo">Avisamos <b>${ADMIN_EMAIL}</b> ${p.avisoEm ? 'em ' + new Date(p.avisoEm).toLocaleString('pt-BR') : 'agora'}. Assim que alguém do escritório clicar em <b>Aceitar</b>, você recebe um e-mail e é só entrar de novo.</div>
      <div class="row" style="margin-top:14px">
        <button class="btn ghost" id="fbReenviar" style="flex:1">Reenviar aviso</button>
        <button class="btn soft" id="fbRecarregar" style="flex:1">Já fui autorizado</button>
      </div>
      <div class="hint" style="margin-top:10px;text-align:center"><a id="fbSair">Sair</a> · <a href="mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Autorização de acesso — ' + APP_NOME)}&body=${encodeURIComponent('Olá, criei meu login no ' + APP_NOME + ' com o e-mail ' + user.email + ' e aguardo autorização.')}">escrever para a Totali</a></div>
      <div class="alert fb-msg" id="fbMsg" style="display:none"></div>`);
    $('fbReenviar').onclick = async () => { try { await avisarNovoUsuario(perfil, true); msg('Aviso reenviado para ' + ADMIN_EMAIL + '.', 'baixo'); } catch (e) { msg(erroTxt(e), 'alto'); } };
    $('fbRecarregar').onclick = () => entrar(user);
    $('fbSair').onclick = () => auth.signOut();
  }

  function telaVerificarEmail() {
    corpo(`
      <h3 style="margin-bottom:6px">Confirme o seu e-mail da Totali</h3>
      <p style="margin:0 0 10px">O e-mail <b>${esc(user.email)}</b> é do escritório, então ele entra como <b>administrador</b>. Por segurança, clique no link de verificação que enviamos para ele e depois volte aqui.</p>
      <div class="row"><button class="btn ghost" id="fbReenviarVer" style="flex:1">Reenviar link</button><button class="btn gold" id="fbJaVerifiquei" style="flex:1">Já cliquei no link</button></div>
      <div class="hint" style="margin-top:10px;text-align:center"><a id="fbSair">Sair</a></div>
      <div class="alert fb-msg" id="fbMsg" style="display:none"></div>`);
    $('fbReenviarVer').onclick = async () => { try { await user.sendEmailVerification(); msg('Link reenviado. Olhe também a caixa de spam.', 'baixo'); } catch (e) { msg(erroTxt(e), 'alto'); } };
    $('fbJaVerifiquei').onclick = async () => { await user.reload(); user = auth.currentUser; entrar(user); };
    $('fbSair').onclick = () => auth.signOut();
  }

  // ------------------------------------------------------------- usuários
  async function criarPerfil(u, nome) {
    const ehAdmin = ehTotali(u.email);
    if (ehAdmin && !u.emailVerified) { try { await u.sendEmailVerification(); } catch (e) { console.warn(e); } return; } // perfil é criado depois da verificação
    const p = { email: (u.email || '').toLowerCase(), nome: nome || u.displayName || '', aprovado: ehAdmin, admin: ehAdmin, criadoEm: agora() };
    await docUser(u.uid).set(p);
    if (!ehAdmin) await avisarNovoUsuario({ ...p, uid: u.uid }, false);
  }
  function linkApp() { return location.origin + location.pathname; }

  // Envio de e-mail: (1) Apps Script da Totali (grátis, sem plano Blaze) se FIREBASE_CONFIG.emailWebhook estiver preenchido;
  // (2) sempre grava na coleção "mail" (extensão Trigger Email, se instalada; também serve de registro).
  async function enviarEmail(m) {
    const doc = { to: m.to, message: { subject: m.subject, text: m.text, html: m.html }, tipo: m.tipo || '', uid: m.uid || '', criadoEm: agora(), via: cfg.emailWebhook ? 'apps-script' : 'mail' };
    if (cfg.emailWebhook) {
      try {
        await fetch(cfg.emailWebhook, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ segredo: cfg.emailSegredo || '', to: m.to, subject: m.subject, text: m.text, html: m.html }) });
      } catch (e) { console.warn('webhook de e-mail', e); doc.via = 'mail (webhook falhou: ' + e.message + ')'; }
    }
    await db.collection('mail').add(doc);
  }
  const botao = (href, texto, cor) => `<a href="${href}" style="display:inline-block;padding:12px 26px;margin:6px 8px 6px 0;background:${cor};color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-family:Arial,sans-serif;font-size:15px">${texto}</a>`;
  async function avisarNovoUsuario(p, reenvio) {
    const base = linkApp() + '?autorizar=' + user.uid;
    const linkOk = base + '&acao=aceitar', linkNo = base + '&acao=recusar';
    await enviarEmail({
      to: [ADMIN_EMAIL], tipo: 'novo_usuario', uid: user.uid,
      subject: (reenvio ? '[Lembrete] ' : '') + 'Novo usuário aguardando autorização — ' + APP_NOME + ': ' + (p.nome || p.email),
      text: `${p.nome || ''} (${p.email}) criou um login no ${APP_NOME} e aguarda autorização.\n\nACEITAR: ${linkOk}\nRECUSAR: ${linkNo}\n\n(Você precisa estar entrado no sistema com um usuário administrador. Também dá para liberar em Cadastros › Usuários.)\n\nEnviado automaticamente pelo ${APP_NOME}.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1A1816;max-width:560px">
        <div style="background:#182C43;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:bold">${APP_NOME} · Totali Contabilidade</div>
        <div style="border:1px solid #E5E7EB;border-top:0;padding:18px;border-radius:0 0 10px 10px">
          <p style="margin:0 0 12px"><b>${esc(p.nome || '')}</b> (${esc(p.email)}) criou um login no ${APP_NOME} e está aguardando autorização.</p>
          <p style="margin:0 0 6px">${botao(linkOk, '✔ Aceitar', '#1E8E5A')}${botao(linkNo, '✖ Recusar', '#C0392B')}</p>
          <p style="margin:12px 0 0;font-size:12.5px;color:#6B7280">O botão abre o sistema; se pedir login, entre com o seu usuário administrador e a ação é concluída. Também dá para liberar em <b>Cadastros › Usuários</b>.</p>
        </div>
        <p style="color:#888;font-size:12px">Enviado automaticamente pelo ${APP_NOME} em ${new Date().toLocaleString('pt-BR')}.</p></div>`,
    });
    await docUser(user.uid).set({ avisoEm: agora() }, { merge: true });
    if (perfil) perfil.avisoEm = agora();
  }
  async function avisarLiberado(p) {
    try {
      await enviarEmail({ to: [p.email], tipo: 'liberado', uid: p.uid, subject: 'Seu acesso ao ' + APP_NOME + ' foi liberado', text: `Olá ${p.nome || ''},\n\nseu acesso ao ${APP_NOME} (Totali Contabilidade) foi autorizado. Entre em ${linkApp()} com o seu e-mail e senha.\n\nTotali Contabilidade`, html: `<div style="font-family:Arial,sans-serif;font-size:15px"><p>Olá ${esc(p.nome || '')},</p><p>seu acesso ao <b>${APP_NOME}</b> (Totali Contabilidade) foi autorizado.</p><p>${botao(linkApp(), 'Entrar no sistema', '#182C43')}</p><p>Totali Contabilidade</p></div>` });
    } catch (e) { console.warn('e-mail de liberação', e); }
  }
  async function listarUsuarios() { const q = await db.collection('usuarios').orderBy('criadoEm', 'desc').get(); return q.docs.map(d => ({ uid: d.id, ...d.data() })); }
  async function autorizar(uid, ok) {
    await docUser(uid).set(ok ? { aprovado: true, aprovadoEm: agora(), aprovadoPor: user.email } : { aprovado: false, bloqueadoEm: agora(), bloqueadoPor: user.email }, { merge: true });
    if (ok) { const d = await docUser(uid).get(); avisarLiberado({ uid, ...d.data() }); }
    atualizarPendentes();
  }
  async function tornarAdmin(uid, ok) { await docUser(uid).set({ admin: !!ok, ...(ok ? { aprovado: true } : {}) }, { merge: true }); }
  async function atualizarPendentes() {
    const b = $('btnViewUsuarios'); if (!b || !perfil || !perfil.admin) return;
    try { const q = await db.collection('usuarios').where('aprovado', '==', false).get(); const n = q.size; const s = b.querySelector('.pend'); if (s) s.remove(); if (n) b.insertAdjacentHTML('beforeend', '<span class="pend">' + n + '</span>'); } catch (e) { console.warn(e); }
  }

  // Link do e-mail (?autorizar=UID&acao=aceitar|recusar) — só administradores
  async function tratarLinkAutorizacao(uid, acao) {
    try {
      const d = await docUser(uid).get();
      if (!d.exists) { showToast('Este pedido não existe mais (já foi recusado ou apagado).', 'error'); showView('usuarios'); return; }
      const p = d.data(); const quem = (p.nome || '') + ' (' + p.email + ')';
      if (acao === 'aceitar') {
        if (p.aprovado) showToast(quem + ' já estava autorizado.', '');
        else if (confirm('Aceitar o acesso de ' + quem + ' ao ' + APP_NOME + '?')) { await autorizar(uid, true); showToast('Acesso de ' + quem + ' liberado — ele(a) recebe um e-mail avisando.', 'success'); }
      } else if (acao === 'recusar') {
        if (confirm('Recusar o pedido de ' + quem + '? O login continua existindo no Firebase, mas sem acesso ao sistema.')) { await docUser(uid).delete(); showToast('Pedido de ' + quem + ' recusado.', ''); atualizarPendentes(); }
      }
      showView('usuarios'); renderUsuarios(uid);
    } catch (e) { showToast(erroTxt(e), 'error'); }
  }

  // Tela Cadastros › Usuários (só administradores)
  async function renderUsuarios(destaque) {
    const el = $('usuariosLista'); if (!el) return;
    el.innerHTML = '<div class="muted">Carregando…</div>';
    try {
      const lista = await listarUsuarios();
      const pend = lista.filter(u => !u.aprovado), ativos = lista.filter(u => u.aprovado);
      const linha = u => `<tr ${u.uid === destaque ? 'style="background:var(--areia)"' : ''}><td><b>${esc(u.nome || '—')}</b>${u.admin ? ' <span class="badge b-gold">admin</span>' : ''}</td><td class="mono">${esc(u.email)}</td><td class="small">${u.criadoEm ? new Date(u.criadoEm).toLocaleString('pt-BR') : ''}</td><td>${u.aprovado ? '<span class="badge b-ok">autorizado</span><div class="small muted">' + esc(u.aprovadoPor || '') + '</div>' : '<span class="badge b-warn">aguardando</span>'}</td><td style="white-space:nowrap">${u.aprovado ? (u.uid !== user.uid ? `<button class="btn sm danger" data-bloq="${u.uid}">Bloquear</button> <button class="btn sm soft" data-adm="${u.uid}" data-v="${u.admin ? 0 : 1}">${u.admin ? 'Tirar admin' : 'Tornar admin'}</button>` : '<span class="small muted">você</span>') : `<button class="btn sm gold" data-aut="${u.uid}">✔ Aceitar</button> <button class="btn sm danger" data-rmu="${u.uid}">✖ Recusar</button>`}</td></tr>`;
      el.innerHTML = `<div class="alert ${pend.length ? 'medio' : 'baixo'}" style="margin-bottom:10px">${pend.length ? pend.length + ' usuário(s) aguardando autorização.' : 'Nenhum pedido pendente.'} Os avisos chegam em <b>${ADMIN_EMAIL}</b> com os botões Aceitar / Recusar${cfg.emailWebhook ? '' : ' <span class="muted">(envio automático de e-mail ainda não configurado — veja docs/FIREBASE.md)</span>'}.</div>
        <div class="tblwrap"><table class="tbl compact"><thead><tr><th>Nome</th><th>E-mail</th><th>Criado em</th><th>Situação</th><th></th></tr></thead><tbody>${pend.concat(ativos).map(linha).join('') || '<tr><td colspan="5" class="empty">Nenhum usuário.</td></tr>'}</tbody></table></div>`;
      el.querySelectorAll('[data-aut]').forEach(b => b.onclick = async () => { b.disabled = true; try { await autorizar(b.dataset.aut, true); showToast('Usuário autorizado — ele recebe um e-mail avisando.', 'success'); } catch (e) { showToast(erroTxt(e), 'error'); } renderUsuarios(); });
      el.querySelectorAll('[data-bloq]').forEach(b => b.onclick = async () => { if (!confirm('Bloquear o acesso deste usuário?')) return; try { await autorizar(b.dataset.bloq, false); } catch (e) { showToast(erroTxt(e), 'error'); } renderUsuarios(); });
      el.querySelectorAll('[data-rmu]').forEach(b => b.onclick = async () => { if (!confirm('Recusar e apagar este pedido? (o login continua existindo no Firebase, mas sem acesso)')) return; try { await docUser(b.dataset.rmu).delete(); atualizarPendentes(); } catch (e) { showToast(erroTxt(e), 'error'); } renderUsuarios(); });
      el.querySelectorAll('[data-adm]').forEach(b => b.onclick = async () => { try { await tornarAdmin(b.dataset.adm, b.dataset.v === '1'); } catch (e) { showToast(erroTxt(e), 'error'); } renderUsuarios(); });
    } catch (e) { el.innerHTML = '<div class="alert alto">' + esc(erroTxt(e)) + '</div>'; }
  }

  // ------------------------------------------------------------- dados: nuvem → app
  const KEY_RE = /^(.*)\|(\d{4}-\d{2})$/;
  async function carregarTudo() {
    status('busy', 'carregando dados da nuvem…');
    const [dE, dR, dP, qA] = await Promise.all([docEsc('empresas').get(), docEsc('regras').get(), docEsc('params').get(), colApur().get()]);
    const nuvemVazia = !dE.exists && !dR.exists && !dP.exists && qA.empty;
    const localTemDados = DB.empresas.length || DB.regras.length || Object.keys(DB.apuracoes || {}).length;
    if (nuvemVazia && localTemDados) {
      // primeira vez: sobe o que está neste navegador
      status('busy', 'enviando os dados deste navegador para a nuvem…');
      await enviarTudo();
      showToast('Dados deste navegador enviados para o banco da Totali.', 'success');
    } else {
      if (dE.exists) DB.empresas = dE.data().lista || [];
      if (dR.exists) DB.regras = dR.data().lista || [];
      if (dP.exists) { const p = { ...dP.data() }; delete p.atualizadoEm; delete p.atualizadoPor; DB.params = { ...DB.params, ...p }; }
      const ap = {};
      qA.docs.forEach(d => { const x = d.data(); ap[d.id] = { espelho: x.espelho || null, overrides: x.overrides || {}, xmls: {} }; });
      // apurações que só existem neste navegador sobem também (não se perde nada)
      for (const k of Object.keys(DB.apuracoes || {})) if (!ap[k] && ((DB.apuracoes[k].espelho) || Object.keys(DB.apuracoes[k].xmls || {}).length)) { ap[k] = DB.apuracoes[k]; }
      DB.apuracoes = ap;
      snap.empresas = paraJson(DB.empresas); snap.regras = paraJson(DB.regras); snap.params = paraJson(DB.params);
      qA.docs.forEach(d => { const x = d.data(); snap.apur[d.id] = paraJson({ espelho: x.espelho || null, overrides: x.overrides || {} }); });
      xmlsCarregados.clear();
      // xmls das apurações vindas só do navegador: marcadas como já carregadas (vão subir no próximo salvar)
      for (const k of Object.keys(ap)) if (!snap.apur[k]) { xmlsCarregados.add(k); snap.xmls[k] = {}; }
    }
    if (!ST.empresaId && DB.empresas.length === 1) ST.empresaId = DB.empresas[0].id;
    ouvirCadastros();
    status('ok', 'sincronizado');
  }
  async function garantirXmls(key) {
    if (!ATIVO || !pronto || xmlsCarregados.has(key)) return false;
    xmlsCarregados.add(key);
    const A = DB.apuracoes[key]; if (!A) return false;
    if (!snap.apur[key]) { snap.xmls[key] = {}; return false; }         // apuração nova (ainda não existe na nuvem)
    status('busy', 'baixando XMLs…');
    try {
      const q = await colXmls(key).get();
      const xm = {}; q.docs.forEach(d => { xm[d.id] = d.data().xml; });
      A.xmls = { ...xm, ...(A.xmls || {}) };
      snap.xmls[key] = {}; Object.keys(xm).forEach(ch => snap.xmls[key][ch] = true);
      status('ok', 'sincronizado'); return true;
    } catch (e) { xmlsCarregados.delete(key); status('err', erroTxt(e)); console.error(e); return false; }
  }
  let unsub = [];
  function ouvirCadastros() {
    unsub.forEach(f => f()); unsub = [];
    const liga = (nome, aplicar) => unsub.push(docEsc(nome).onSnapshot(d => {
      if (!d.exists || d.metadata.hasPendingWrites) return;
      const j = paraJson(aplicar.ler(d.data())); if (j === snap[nome]) return;
      snap[nome] = j; aplicar.usar(JSON.parse(j)); aplicar.render();
      showToast('Cadastro de ' + nome + ' atualizado por outro usuário.', '');
    }, e => console.warn('snapshot ' + nome, e)));
    liga('empresas', { ler: x => x.lista || [], usar: v => DB.empresas = v, render: () => { renderEmpresasSelect(); if (ST.view === 'empresas') renderEmpresas(); recalcular(); } });
    liga('regras', { ler: x => x.lista || [], usar: v => DB.regras = v, render: () => { if (ST.view === 'regras') renderRegras(); recalcular(); } });
    liga('params', { ler: x => { const p = { ...x }; delete p.atualizadoEm; delete p.atualizadoPor; return { ...DB.params, ...p }; }, usar: v => DB.params = v, render: () => { if (ST.view === 'params') renderParams(); recalcular(); } });
  }

  // ------------------------------------------------------------- dados: app → nuvem
  function agendar() { if (!ATIVO || !pronto) return; deNovo = true; clearTimeout(timer); timer = setTimeout(gravar, 700); }
  async function gravar() {
    if (gravando) return; gravando = true; deNovo = false;
    try {
      const carimbo = { atualizadoEm: agora(), atualizadoPor: user.email };
      const js = { empresas: paraJson(DB.empresas), regras: paraJson(DB.regras), params: paraJson(DB.params) };
      const ops = [];
      if (js.empresas !== snap.empresas) ops.push(['set', docEsc('empresas'), { lista: limpar(DB.empresas), ...carimbo }, () => snap.empresas = js.empresas]);
      if (js.regras !== snap.regras) ops.push(['set', docEsc('regras'), { lista: limpar(DB.regras), ...carimbo }, () => snap.regras = js.regras]);
      if (js.params !== snap.params) ops.push(['set', docEsc('params'), { ...limpar(DB.params), ...carimbo }, () => snap.params = js.params]);
      // apurações (espelho + ajustes) e XMLs por nota
      for (const k of Object.keys(DB.apuracoes)) {
        const A = DB.apuracoes[k]; const m = KEY_RE.exec(k) || [];
        const meta = paraJson({ espelho: A.espelho || null, overrides: A.overrides || {} });
        if (meta !== snap.apur[k]) ops.push(['set', docApur(k), { empresaId: m[1] || '', comp: m[2] || '', espelho: limpar(A.espelho || null), overrides: limpar(A.overrides || {}), ...carimbo }, () => snap.apur[k] = meta]);
        if (!xmlsCarregados.has(k)) continue;                     // ainda não baixamos os xmls dessa apuração: não mexe
        const sx = snap.xmls[k] || (snap.xmls[k] = {});
        for (const ch of Object.keys(A.xmls || {})) if (!sx[ch]) ops.push(['set', colXmls(k).doc(ch), { xml: A.xmls[ch], ...carimbo }, () => sx[ch] = true]);
        for (const ch of Object.keys(sx)) if (!(A.xmls || {})[ch]) ops.push(['del', colXmls(k).doc(ch), null, () => delete sx[ch]]);
      }
      for (const k of Object.keys(snap.apur)) if (!DB.apuracoes[k]) {   // apuração apagada (Limpar)
        for (const ch of Object.keys(snap.xmls[k] || {})) ops.push(['del', colXmls(k).doc(ch), null, () => { }]);
        ops.push(['del', docApur(k), null, () => { delete snap.apur[k]; delete snap.xmls[k]; xmlsCarregados.delete(k); }]);
      }
      if (ops.length) {
        status('busy', 'gravando…');
        for (let i = 0; i < ops.length; i += 400) {
          const b = db.batch(); const lote = ops.slice(i, i + 400);
          lote.forEach(o => o[0] === 'del' ? b.delete(o[1]) : b.set(o[1], o[2]));
          await b.commit(); lote.forEach(o => o[3]());
        }
        status('ok', 'sincronizado');
      }
    } catch (e) { status('err', 'erro ao gravar: ' + erroTxt(e)); console.error(e); showToast('Não consegui gravar na nuvem: ' + erroTxt(e), 'error'); }
    gravando = false; if (deNovo) agendar();
  }
  async function enviarTudo() {
    snap.empresas = snap.regras = snap.params = ''; snap.apur = {}; snap.xmls = {};
    Object.keys(DB.apuracoes).forEach(k => { xmlsCarregados.add(k); snap.xmls[k] = {}; });
    await gravar();
  }

  // ------------------------------------------------------------- topo (usuário + status)
  function status(cls, txt) { const d = $('fbDot'), t = $('fbStatus'); if (d) d.className = 'dot ' + cls; if (t) t.title = txt; if (t && cls !== 'busy') t.textContent = user ? (user.displayName || user.email) : ''; if (t && cls === 'busy') t.textContent = txt; }
  function montarTopo() {
    const ctx = document.querySelector('.topbar .ctx'); if (!ctx || $('fbUser')) return;
    const d = document.createElement('div'); d.className = 'fb-user'; d.id = 'fbUser';
    d.innerHTML = '<span class="dot" id="fbDot"></span><span id="fbStatus"></span><button id="fbSairTop" title="Sair do sistema">Sair</button>';
    ctx.appendChild(d);
    $('fbSairTop').onclick = () => { if (confirm('Sair do sistema?')) auth.signOut(); };
  }

  // ------------------------------------------------------------- fluxo de entrada
  async function entrar(u) {
    user = u;
    try {
      const d = await docUser(u.uid).get();
      if (!d.exists) {
        if (ehTotali(u.email) && !u.emailVerified) { telaVerificarEmail(); return; }
        await criarPerfil(u, u.displayName || ''); return entrar(u);
      }
      perfil = { uid: u.uid, ...d.data() };
      // e-mail do escritório que ainda não é administrador: promove sozinho depois de verificar o e-mail
      if (ehTotali(u.email) && !perfil.admin) {
        if (u.emailVerified) { await docUser(u.uid).set({ admin: true, aprovado: true, adminDesde: agora() }, { merge: true }); perfil.admin = true; perfil.aprovado = true; showToast('Seu e-mail da Totali foi verificado: você agora é administrador(a).', 'success'); }
        else if (!perfil.aprovado) { telaVerificarEmail(); return; }
        else if (!sessionStorage.getItem('fbVerEnviado')) { try { await u.sendEmailVerification(); sessionStorage.setItem('fbVerEnviado', '1'); } catch (e) { } setTimeout(() => showToast('Enviamos um link de verificação para ' + u.email + '. Depois de clicar nele e entrar de novo, você vira administrador(a) e passa a aceitar os pedidos de acesso.', ''), 1500); }
      }
      if (!perfil.aprovado) { telaPendente(perfil); return; }
      corpo('<div class="muted">Carregando os dados do escritório…</div>');
      pronto = true; montarTopo();
      await carregarTudo();
      const btnU = $('btnViewUsuarios'); if (btnU) btnU.style.display = perfil.admin ? '' : 'none';
      gate(false);
      renderEmpresasSelect(); if ($('inpComp')) $('inpComp').value = ST.comp;
      salvar(); recalcular(); if (ST.view !== 'apuracao') showView(ST.view);
      atualizarPendentes();
      const qs = new URLSearchParams(location.search); const aut = qs.get('autorizar'), acao = qs.get('acao');
      if (aut) {
        history.replaceState(null, '', location.pathname);
        if (perfil.admin) await tratarLinkAutorizacao(aut, acao);
        else showToast('Este link de autorização só funciona com um usuário administrador.', 'error');
      }
      showToast('Bem-vindo(a), ' + (perfil.nome || u.email) + '.', 'success');
    } catch (e) { console.error(e); corpo('<div class="alert alto">' + esc(erroTxt(e)) + '</div><div class="hint" style="margin-top:10px;text-align:center"><a id="fbSair">Sair</a> · <a id="fbTentar">Tentar de novo</a></div>'); $('fbSair').onclick = () => auth.signOut(); $('fbTentar').onclick = () => entrar(u); }
  }
  function sair() {
    const tinhaUsuario = !!user;   // na abertura (ninguém logado) não apaga nada: os dados locais sobem na primeira entrada
    pronto = false; user = null; perfil = null; unsub.forEach(f => f()); unsub = [];
    snap.empresas = snap.regras = snap.params = ''; snap.apur = {}; snap.xmls = {}; xmlsCarregados.clear();
    if (tinhaUsuario) { DB = { empresas: [], regras: [], params: { ...MOTOR.PARAMS_PADRAO, backendUrl: '' }, apuracoes: {}, ui: {} }; try { localStorage.removeItem(STORE_KEY); } catch (e) { } }
    const fu = $('fbUser'); if (fu) fu.remove();
    gate(true); telaLogin(new URLSearchParams(location.search).get('autorizar') ? 'entrar' : 'entrar');
  }

  function iniciar() {
    if (!ATIVO) return;
    document.body.insertAdjacentHTML('beforeend', gateHtml());
    $('fbVer').textContent = APP_VERSAO.nome + ' v' + APP_VERSAO.numero;
    firebase.initializeApp(cfg); auth = firebase.auth(); db = firebase.firestore();
    auth.useDeviceLanguage();
    auth.onAuthStateChanged(u => { if (u) entrar(u); else sair(); });
    // ganchos no app: gravar na nuvem a cada salvar(); baixar XMLs ao trocar empresa/mês; tela de usuários
    const _salvar = salvar; salvar = function () { _salvar(); agendar(); };
    const _recalcular = recalcular; recalcular = function () { const k = apurKey(); if (pronto && !xmlsCarregados.has(k)) { garantirXmls(k).then(ok => { if (ok) _recalcular(); }); } return _recalcular(); };
    const _showView = showView; showView = function (v) { _showView(v); if (v === 'usuarios') renderUsuarios(); };
    const bu = $('btnViewUsuarios'); if (bu) bu.onclick = () => showView('usuarios');
  }
  return { ATIVO, ADMIN_EMAIL, iniciar, renderUsuarios, get usuario() { return user; }, get perfil() { return perfil; } };
})();
FB.iniciar();
