// Configuração do projeto Firebase da Totali (Console Firebase › Configurações do projeto › Seus apps › Web).
// Esses valores NÃO são segredos: identificam o projeto; quem manda é a regra do Firestore (firestore.rules) e o login.
// Enquanto apiKey estiver vazio, o sistema roda só no navegador (sem login, dados no localStorage).
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC8EUkyNfQ8JXotkuXc-jdfUROQmXv1Dcc',
  authDomain: 'totali-antecipa.firebaseapp.com',
  projectId: 'totali-antecipa',
  storageBucket: 'totali-antecipa.firebasestorage.app',
  messagingSenderId: '328310373367',
  appId: '1:328310373367:web:0e93cb7a22bf21debf4cf2',

  // Envio de e-mail sem plano pago: URL do app da Web do Google Apps Script (server/email-apps-script.gs)
  // publicado pela conta contato@totalicontabilidade.com.br. Vazio = só grava na coleção "mail".
  emailWebhook: '',
  emailSegredo: 'totali-antecipa-2026',   // tem que ser igual ao SEGREDO do script
};
