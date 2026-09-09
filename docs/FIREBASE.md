# Login e banco de dados no Firebase — passo a passo

O sistema usa o **Firebase** (Google) para duas coisas:

1. **Login com e-mail e senha** (Firebase Authentication).
2. **Banco de dados** (Firestore) com os dados do escritório: empresas, regras, parâmetros,
   apurações (espelho + ajustes) e os XMLs das notas. Tudo compartilhado entre os usuários
   autorizados, de qualquer computador.

Fluxo de acesso: a pessoa clica em **Criar login**, informa nome, e-mail e senha e fica
**aguardando autorização**. O sistema grava um e-mail para **contato@totalicontabilidade.com.br**
com um link; alguém da Totali entra como administrador, abre **Cadastros › Usuários** e clica em
**Autorizar**. O usuário recebe um e-mail avisando que foi liberado.

Enquanto `js/firebase-config.js` estiver vazio, o sistema roda como antes (sem login, dados só no
navegador).

## 1. Criar o projeto (uma vez)

1. Entre em https://console.firebase.google.com com a conta Google da Totali.
2. **Adicionar projeto** → nome `totali-antecipa` (Analytics pode ficar desligado).
3. No projeto: **Criação › Authentication › Começar › E-mail/senha → Ativar**.
   - Em **Authentication › Settings › Domínios autorizados**, adicione `totalicontabilidade.github.io`
     (o `localhost` já vem liberado, para o INICIAR.bat).
4. **Criação › Firestore Database › Criar banco de dados** → modo **produção** → local `southamerica-east1 (São Paulo)`.
5. Em **Firestore › Regras**, cole o conteúdo do arquivo `firestore.rules` deste repositório e clique em **Publicar**.
6. **Configurações do projeto (engrenagem) › Seus apps › ícone `</>` (Web)** → apelido `Totali Antecipa` →
   copie o objeto `firebaseConfig` e cole em `js/firebase-config.js` (apiKey, authDomain, projectId,
   storageBucket, messagingSenderId, appId). Esses valores não são secretos.
7. Suba o `js/firebase-config.js` para o GitHub (commit). Em 1–2 minutos o site passa a pedir login.

## 2. Primeiro administrador

1. No site, clique em **Criar login** usando o e-mail **contato@totalicontabilidade.com.br**.
2. O sistema envia um link de verificação para esse e-mail. Clique no link e volte ao site
   (**Já cliquei no link**). Esse e-mail entra como **administrador** automaticamente.
3. A partir daí, quem criar login aparece em **Cadastros › Usuários** para ser autorizado.
   Ali também dá para tornar outra pessoa administradora.

Se preferir outro e-mail como primeiro administrador: crie o login normalmente e, no Console
Firebase › Firestore › coleção `usuarios` › documento do usuário, mude `aprovado` e `admin` para `true`.

## 3. E-mail automático de aviso (extensão Trigger Email)

O sistema grava os avisos na coleção `mail` do Firestore. Para virarem e-mail de verdade,
instale a extensão oficial do Firebase:

1. **Criação › Extensions › Explorar** → **Trigger Email from Firestore** → Instalar.
   - Exige o plano **Blaze** (pague conforme o uso; com esse volume o custo é zero ou centavos).
2. Na configuração da extensão:
   - **SMTP connection URI**: por exemplo, usando o Gmail/Google Workspace do contato:
     `smtps://contato@totalicontabilidade.com.br:SENHA_DE_APP@smtp.gmail.com:465`
     (gere uma **senha de app** em Conta Google › Segurança › Verificação em duas etapas › Senhas de app).
   - **Email documents collection**: `mail`
   - **Default FROM address**: `Totali Antecipa <contato@totalicontabilidade.com.br>`
3. Pronto: cada "Criar login" gera um e-mail para contato@ com o link **Autorizar este usuário**, e cada
   autorização gera um e-mail para o usuário.

Sem a extensão instalada, os pedidos ficam guardados na coleção `mail` e os pendentes continuam
aparecendo em **Cadastros › Usuários** — só não chega o e-mail. A tela de "aguardando" também tem um
link "escrever para a Totali" que abre o e-mail do próprio usuário já preenchido.

## 4. O que fica onde

| Firestore                                   | Conteúdo                                                   |
|---------------------------------------------|------------------------------------------------------------|
| `usuarios/{uid}`                            | e-mail, nome, `aprovado`, `admin`, datas                    |
| `mail/{id}`                                 | e-mails a enviar (extensão Trigger Email)                   |
| `escritorio/empresas`                       | lista de empresas (regime, perfil, CNAEs…)                  |
| `escritorio/regras`                         | regras NCM/MVA do escritório                                |
| `escritorio/params`                         | parâmetros do motor                                         |
| `escritorio/apuracoes/itens/{empresa|mês}`  | espelho do DIA + ajustes por nota                           |
| `…/itens/{empresa|mês}/xmls/{chave}`         | XML de cada nota                                            |

- Quem **não** está autorizado não lê nem grava nada (regras do Firestore).
- Na **primeira entrada** de um usuário autorizado num navegador que já tinha dados (versões anteriores),
  o sistema sobe esses dados para a nuvem automaticamente se ela ainda estiver vazia.
- Os XMLs são baixados só da empresa/mês que está aberta.
- Empresas, regras e parâmetros alterados por outro usuário aparecem na hora (tempo real).
- **Sair** limpa os dados do navegador (segurança em computador compartilhado).

## 5. Segurança

- Certificado A1 e XMLs continuam **fora** do GitHub. O certificado só existe na máquina que roda o INICIAR.bat.
- O `firebaseConfig` é público por natureza; a proteção está nas regras (`firestore.rules`) e no login.
- Senhas são do Firebase Authentication (a Totali nunca vê a senha). "Esqueci a senha" envia link de redefinição.
