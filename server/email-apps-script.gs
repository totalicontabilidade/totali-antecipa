/**
 * Totali Antecipa — envio de e-mail pelo Google Apps Script (grátis, sem plano Blaze)
 *
 * Como publicar (uma vez, com a conta contato@totalicontabilidade.com.br):
 *  1. https://script.google.com › Novo projeto › apague o conteúdo e cole este arquivo.
 *  2. Ajuste SEGREDO (tem que ser igual ao emailSegredo do js/firebase-config.js).
 *  3. Implantar › Nova implantação › tipo "App da Web":
 *       Executar como: Eu (contato@totalicontabilidade.com.br)
 *       Quem pode acessar: Qualquer pessoa
 *     Autorize as permissões (enviar e-mail como você).
 *  4. Copie a "URL do app da Web" (termina em /exec) e cole em emailWebhook no js/firebase-config.js.
 *
 * O sistema faz um POST com JSON {segredo, to:[...], subject, text, html}. Quem não souber o SEGREDO
 * recebe "nao autorizado". Limite do Gmail: ~100 e-mails/dia (Workspace: 1.500).
 */
var SEGREDO = 'totali-antecipa-2026';
var REMETENTE = 'Totali Antecipa';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    if (d.segredo !== SEGREDO) return resposta({ ok: false, erro: 'nao autorizado' });
    var para = Array.isArray(d.to) ? d.to.join(',') : String(d.to || '');
    if (!para) return resposta({ ok: false, erro: 'sem destinatario' });
    MailApp.sendEmail({ to: para, subject: d.subject || '(sem assunto)', body: d.text || '', htmlBody: d.html || undefined, name: REMETENTE });
    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

// Abrir a URL no navegador (GET) só confirma que o script está no ar
function doGet() { return resposta({ ok: true, servico: 'Totali Antecipa e-mail', restante_hoje: MailApp.getRemainingDailyQuota() }); }

function resposta(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// Teste manual: Executar › testar (manda um e-mail para a própria conta)
function testar() {
  MailApp.sendEmail({ to: Session.getActiveUser().getEmail(), subject: 'Teste Totali Antecipa', body: 'Se chegou, o envio está funcionando.', name: REMETENTE });
}
