# Login e banco de dados no Firebase — passo a passo

O sistema usa o **Firebase** (Google) para duas coisas:

1. **Login com e-mail e senha** (Firebase Authentication).
2. **Banco de dados** (Firestore) com os dados do escritório: empresas, regras, parâmetros,
   apurações (espelho + ajustes) e os XMLs das notas. Tudo compartilhado entre os usuários
   autorizados, de qualquer computador.

Projeto já criado em 09/09/2026: **totali-antecipa** (conta contato@totalicontabilidade.com.br),
Authentication (e-mail/senha) ativado, domínio `totalicontabilidade.github.io` autorizado, Firestore
em São Paulo com as regras de `firestore.rules`, app web registrado (config em `js/firebase-config.js`).

## Como funciona o acesso

- A pessoa clica em **Criar login**, informa nome, e-mail e senha e fica **aguardando autorização**.
- O sistema manda um e-mail para **contato@totalicontabilidade.com.br** com dois botões:
  **✔ Aceitar** e **✖ Recusar**. O botão abre o sistema; se pedir login, entre com um usuário
  administrador e a ação é concluída na hora. A mesma coisa dá para fazer em **Cadastros › Usuários**
  (o menu mostra quantos pedidos estão pendentes).
- Quem é aceito recebe um e-mail "Seu acesso foi liberado" e já pode entrar.

## Quem é administrador

Qualquer login com e-mail **@totalicontabilidade.com.br** vira administrador sozinho, depois de
clicar no **link de verificação** que o Firebase manda para esse e-mail (proteção para ninguém se
passar pelo escritório). Fluxo:

1. **Criar login** com o e-mail da Totali (ex.: contato@… ou eduarda@…).
2. O sistema mostra "Confirme o seu e-mail da Totali" e envia o link. Clique no link (olhe o spam),
   volte e clique em **Já cliquei no link**.
3. Pronto: entra como administrador e vê **Cadastros › Usuários**.

Quem já tinha login do escritório antes dessa regra recebe o link ao entrar; depois de verificar e
entrar de novo, vira administrador. Administradores também podem promover outros em Cadastros › Usuários.

Alternativa manual: Console Firebase › Firestore › coleção `usuarios` › documento do usuário › mude
`aprovado` e `admin` para `true`.

## E-mail automático (grátis, pelo Google Apps Script)

O envio de e-mail não usa o plano pago do Firebase. Ele passa por um pequeno script do Google
(arquivo `server/email-apps-script.gs`) publicado pela própria conta contato@totalicontabilidade.com.br,
que manda o e-mail com o Gmail dessa conta.

1. Entre em https://script.google.com com a conta **contato@totalicontabilidade.com.br**.
2. **Novo projeto** → apague o conteúdo e cole o arquivo `server/email-apps-script.gs`. Dê um nome (Totali Antecipa e-mail).
3. **Implantar › Nova implantação** → tipo **App da Web** → *Executar como:* **Eu** → *Quem pode acessar:*
   **Qualquer pessoa** → Implantar → autorize as permissões (enviar e-mail como você).
4. Copie a **URL do app da Web** (termina em `/exec`) e cole em `emailWebhook` no `js/firebase-config.js`.
   O `emailSegredo` do config precisa ser igual ao `SEGREDO` do script.
5. Suba o `js/firebase-config.js` para o GitHub. A partir daí os avisos chegam por e-mail.

Limite do Gmail comum: cerca de 100 e-mails por dia — mais que suficiente.

Enquanto o webhook não estiver configurado, os avisos ficam guardados na coleção `mail` do Firestore e
os pedidos continuam aparecendo em **Cadastros › Usuários**; só não chega o e-mail. A tela de
"aguardando" tem o link "escrever para a Totali", que abre o e-mail do próprio usuário já preenchido.

(Alternativa paga: extensão **Trigger Email from Firestore**, que lê a mesma coleção `mail`, mas exige o plano Blaze.)

## Certificado A1 guardado no login (v1.5.0)

- Ao enviar um certificado (tela **Certificado A1**), com "guardar o arquivo no meu login" marcado, o arquivo `.pfx`
  vai para `usuarios/{uid}/certificados/{cnpj}` no Firestore. Só o próprio usuário lê (nem administradores).
- A **senha não vai para a nuvem**: o `.pfx` já é protegido pela própria senha, e ela fica só no computador,
  protegida pelo Windows (DPAPI) pelo serviço local.
- Em outro computador, abra pelo INICIAR.bat, entre com o seu login e clique em **Buscar pendentes**: o sistema
  vê que o certificado está no seu login, pede a senha uma vez ("Informar só a senha") e pronto.
- No site (sem serviço local) dá para enviar o arquivo para o login; a senha é pedida depois, no computador.

## Busca no Portal Nacional direto do site (Cloud Run + API Gateway)

O navegador não consegue usar o certificado A1 para falar com a SEFAZ, então a busca roda em um
serviço na nuvem com a **mesma API** do INICIAR.bat (`cloud/sefaz/index.js`):

- **Cloud Run function `sefaz`** (região southamerica-east1, Node 22, projeto totali-antecipa, plano Blaze).
  Exige o token do login em toda chamada (só usuário aprovado), guarda o `.pfx` em
  `usuarios/{uid}/certificados/{cnpj}` com a **senha cifrada** (AES-256-GCM) pela variável de ambiente
  `CERT_KEY`, que só existe na configuração da função. Se a chave mudar, as senhas precisam ser reinformadas.
- **API Gateway `sefaz-gw`** (us-east1) na frente da função, porque a organização do Google Workspace
  proíbe deixar um Cloud Run público. O gateway é público, chama a função com a conta de serviço
  `328310373367-compute@developer.gserviceaccount.com` (precisa do papel *Invocador do Cloud Run* no
  serviço) e repassa o token do usuário em `X-Forwarded-Authorization`. Spec em `cloud/sefaz/gateway.yaml`.
- O site usa o endereço do gateway em `FIREBASE_CONFIG.sefazBackend` (`js/firebase-config.js`); em
  localhost continua usando o serviço local. Parâmetros › "servidor" sobrescreve os dois.

Reimplantar a função (Cloud Shell, pasta `~/sefaz` com `index.js` e `package.json` baixados do GitHub):

```
gcloud run deploy sefaz --source . --function sefaz --base-image nodejs22 --region southamerica-east1 \
  --no-allow-unauthenticated --memory 512Mi --timeout 300 --set-env-vars CERT_KEY=<a chave> --quiet
```

Nova versão do gateway (depois de mudar `gateway.yaml`): `gcloud api-gateway api-configs create v2 ...` e
`gcloud api-gateway gateways update sefaz-gw --api=sefaz-api --api-config=v2 --location=us-east1`.

## O que fica onde

| Firestore                                   | Conteúdo                                                   |
|---------------------------------------------|------------------------------------------------------------|
| `usuarios/{uid}`                            | e-mail, nome, `aprovado`, `admin`, datas                    |
| `mail/{id}`                                 | registro dos e-mails enviados                               |
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

## Se precisar recriar do zero

1. https://console.firebase.google.com › Adicionar projeto (Analytics desligado).
2. Authentication › Começar › E-mail/senha → Ativar; Settings › Domínios autorizados → `totalicontabilidade.github.io`.
3. Firestore Database › Criar (produção, southamerica-east1) › Regras → colar `firestore.rules` → Publicar.
4. Configurações do projeto › Seus apps › Web → copiar `firebaseConfig` para `js/firebase-config.js`.

## Segurança

- Certificado A1 e XMLs continuam **fora** do GitHub. O certificado só existe na máquina que roda o INICIAR.bat.
- O `firebaseConfig` é público por natureza; a proteção está nas regras (`firestore.rules`) e no login.
- Senhas são do Firebase Authentication (a Totali nunca vê a senha). "Esqueci a senha" envia link de redefinição.
