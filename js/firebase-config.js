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

  // Envio de e-mail sem plano pago: app da Web do Google Apps Script (server/email-apps-script.gs),
  // projeto "Totali Antecipa e-mail" publicado pela conta contato@totalicontabilidade.com.br em 09/09/2026.
  emailWebhook: 'https://script.google.com/macros/s/AKfycbwGAgAr3YvknnElRshKEBsWmC4M-uJhLM3sEcgWesd5hNUkDbpSBncqYufR-DdAmMHY/exec',
  emailSegredo: 'totali-antecipa-2026',   // tem que ser igual ao SEGREDO do script

  // Busca no Portal Nacional pela nuvem: URL da Cloud Run function "sefaz" (cloud/sefaz). Vazio = só pelo INICIAR.bat.
  sefazBackend: '',
};
