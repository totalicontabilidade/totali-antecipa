/* =====================================================================
   Totali Antecipa — serviço SEFAZ na nuvem (Cloud Run functions, Node 20)
   Mesma API do servidor local (servir.ps1), para o site buscar os XMLs no
   Portal Nacional da NF-e com o certificado A1 guardado no login:
     GET    /api/status
     POST   /api/certificado          {cnpj, pfxBase64, senha}
     POST   /api/senha                {cnpj, senha}
     DELETE /api/certificado/<cnpj>
     GET    /api/nfe/<chave>?cnpj=    XML completo (consChNFe + ciência 210210)
     GET    /api/distribuicao?cnpj=&lotes=   NF-e novas por NSU
   Segurança:
     - Toda chamada exige o token do Firebase Auth (Authorization: Bearer) de
       usuário APROVADO (usuarios/{uid}.aprovado == true).
     - Certificados ficam em usuarios/{uid}/certificados/{cnpj}: o .pfx e a
       senha cifrada (AES-256-GCM) com a chave CERT_KEY, que só existe na
       configuração desta função. Quem lê o Firestore não consegue usar.
   Publicar: Google Cloud Console › Cloud Run functions › Criar › editor inline
     runtime Node.js 20, entry point "sefaz", região southamerica-east1,
     variáveis: CERT_KEY (32+ caracteres aleatórios). Ver docs/FIREBASE.md.
   ===================================================================== */
'use strict';
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const URL_DIST = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_EVENTO = 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const ORIGENS = ['https://totalicontabilidade.github.io', 'http://localhost:8788', 'http://127.0.0.1:8788'];
const VERSAO = 'nuvem-1.0';

// ---------------------------------------------------------------- utilidades
const dig = s => String(s || '').replace(/\D/g, '');
class ErroApi extends Error { constructor(msg, codigo, status) { super(msg); this.codigo = codigo || 'ERRO'; this.status = status || 200; } }

function chaveCifra() {
  const k = process.env.CERT_KEY || '';
  if (k.length < 16) throw new ErroApi('CERT_KEY não configurada na função (Cloud Run › Variáveis).', 'CONFIG', 500);
  return crypto.createHash('sha256').update(k).digest();
}
function cifrar(txt) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const enc = Buffer.concat([c.update(String(txt), 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}
function decifrar(s) {
  const [iv, tag, enc] = String(s || '').split(':').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', chaveCifra(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// Abre o .pfx (node-forge aceita os PFX antigos com RC2/3DES da ICP-Brasil) e devolve PEMs + dados
function abrirPfx(pfxBase64, senha) {
  let p12;
  try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(pfxBase64)), false, senha || ''); }
  catch (e) { throw new ErroApi('Senha do certificado incorreta ou arquivo .pfx inválido (' + e.message + ').', 'SENHA_INVALIDA'); }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])
    .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
  if (!keyBags.length || !certBags.length) throw new ErroApi('O .pfx não contém chave privada e certificado.', 'PFX');
  const key = keyBags[0].key;
  // certificado do titular = o que casa com a chave privada (não a cadeia)
  let cert = certBags.map(b => b.cert).find(c => c && c.publicKey && c.publicKey.n && key.n && c.publicKey.n.equals(key.n)) || certBags[0].cert;
  const subject = cert.subject.attributes.map(a => (a.shortName || a.name) + '=' + a.value).join(', ');
  let cnpjCert = '';
  const cn = (cert.subject.getField('CN') || {}).value || '';
  const m = cn.match(/(\d{14})/); if (m) cnpjCert = m[1];
  if (!cnpjCert) { try { const alt = cert.getExtension('subjectAltName'); const txt = JSON.stringify(alt || {}); const m2 = txt.match(/(\d{14})/); if (m2) cnpjCert = m2[1]; } catch (e) { } }
  const notAfter = cert.validity.notAfter;
  return { keyPem: forge.pki.privateKeyToPem(key), certPem: forge.pki.certificateToPem(cert), titular: subject, cnpjCertificado: cnpjCert, validade: notAfter.toISOString().slice(0, 10), vencido: notAfter < new Date(), cn };
}

// ---------------------------------------------------------------- Firestore (certificados do login)
const colCerts = uid => db.collection('usuarios').doc(uid).collection('certificados');
async function certificadoDoLogin(uid, cnpj) {
  cnpj = dig(cnpj);
  const d = await colCerts(uid).doc(cnpj).get();
  if (!d.exists || !d.data().pfxBase64) throw new ErroApi(`Certificado do CNPJ ${cnpj} não cadastrado. Envie o .pfx pela tela.`, 'SEM_CERTIFICADO');
  const x = d.data();
  if (!x.senhaCifrada) throw new ErroApi('SENHA_NECESSARIA', 'SENHA_NECESSARIA');
  let senha; try { senha = decifrar(x.senhaCifrada); } catch (e) { throw new ErroApi('SENHA_NECESSARIA', 'SENHA_NECESSARIA'); }
  const c = abrirPfx(x.pfxBase64, senha);
  return { ...c, cnpj, ultNSU: x.ultNSU || '0', ref: colCerts(uid).doc(cnpj) };
}
async function listarCertificados(uid) {
  const q = await colCerts(uid).get(); const lista = [];
  for (const d of q.docs) {
    const x = d.data(); const info = { cnpj: d.id, senhaSalva: !!x.senhaCifrada, senhaEmMemoria: !!x.senhaCifrada, titular: x.titular || '', validade: x.validade || '', vencido: x.validade ? x.validade < new Date().toISOString().slice(0, 10) : false, ultNSU: x.ultNSU || '', nuvem: true };
    if (!x.pfxBase64) info.erro = 'sem arquivo .pfx';
    lista.push(info);
  }
  return lista;
}

// ---------------------------------------------------------------- SOAP com certificado
function soap(url, bodyXml, cert) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${bodyXml}</soap12:Body></soap12:Envelope>`;
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: u.hostname, path: u.pathname, method: 'POST', key: cert.keyPem, cert: cert.certPem, minVersion: 'TLSv1.2', timeout: 60000,
      rejectUnauthorized: process.env.SEFAZ_INSECURE !== '1',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'User-Agent': 'TotaliAntecipa/1.0', 'Content-Length': Buffer.byteLength(envelope) },
    }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 403 || /403 - Forbidden/.test(txt)) return reject(new ErroApi('Portal Nacional recusou o certificado (HTTP 403). Confira se é um e-CNPJ A1 ICP-Brasil válido e do CNPJ destinatário das notas.', 'SEFAZ_403'));
        if (/^\s*<!DOCTYPE html/i.test(txt)) return reject(new ErroApi('Portal Nacional respondeu uma página HTML em vez do SOAP (serviço indisponível ou bloqueio). Tente de novo mais tarde.', 'SEFAZ_HTML'));
        resolve(txt);
      });
    });
    req.on('timeout', () => { req.destroy(new ErroApi('Portal Nacional não respondeu em 60 s.', 'SEFAZ_TIMEOUT')); });
    req.on('error', e => reject(e instanceof ErroApi ? e : new ErroApi('Falha na conexão com o Portal Nacional: ' + e.message, 'SEFAZ_CONEXAO')));
    req.end(envelope);
  });
}
const tag = (xml, nome) => { const m = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>').exec(xml); return m ? m[1].trim() : ''; };
function parseRetDist(resp) {
  const ret = tag(resp, 'retDistDFeInt');
  if (!ret) throw new ErroApi('Resposta inesperada da SEFAZ: ' + resp.slice(0, 400), 'SEFAZ_RESPOSTA');
  const r = { cStat: tag(ret, 'cStat'), xMotivo: tag(ret, 'xMotivo'), ultNSU: tag(ret, 'ultNSU'), maxNSU: tag(ret, 'maxNSU'), docs: [] };
  const re = /<(?:\w+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?docZip>/g; let m;
  while ((m = re.exec(ret))) {
    const attrs = m[1]; const nsu = (/NSU="(\d+)"/.exec(attrs) || [])[1] || ''; const schema = (/schema="([^"]+)"/.exec(attrs) || [])[1] || '';
    const xml = zlib.gunzipSync(Buffer.from(m[2].trim(), 'base64')).toString('utf8');
    let chave = ''; const a = /Id="NFe(\d{44})"/.exec(xml); const b = /<chNFe>(\d{44})<\/chNFe>/.exec(xml); if (a) chave = a[1]; else if (b) chave = b[1];
    r.docs.push({ nsu, schema, chave, xml });
  }
  return r;
}
async function distDFe(cert, cnpj, chave, ultNSU) {
  const cons = chave ? `<consChNFe><chNFe>${chave}</chNFe></consChNFe>` : `<distNSU><ultNSU>${String(ultNSU || '0').padStart(15, '0')}</ultNSU></distNSU>`;
  const dist = `<distDFeInt xmlns="${NS_NFE}" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>28</cUFAutor><CNPJ>${cnpj}</CNPJ>${cons}</distDFeInt>`;
  const body = `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${dist}</nfeDadosMsg></nfeDistDFeInteresse>`;
  return parseRetDist(await soap(URL_DIST, body, cert));
}

// ---------------------------------------------------------------- ciência da operação (evento assinado)
function assinarEvento(xml, id, cert) {
  const sig = new SignedXml({
    privateKey: cert.keyPem, publicCert: cert.certPem,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  });
  sig.addReference({ xpath: "//*[local-name(.)='infEvento']", uri: '#' + id, digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1', transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'] });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='infEvento']", action: 'after' } });
  return sig.getSignedXml();
}
function dataSefaz(d) {
  // yyyy-MM-ddTHH:mm:ss-03:00 (horário de Brasília)
  const br = new Date(d.getTime() - 3 * 3600 * 1000); const p = n => String(n).padStart(2, '0');
  return `${br.getUTCFullYear()}-${p(br.getUTCMonth() + 1)}-${p(br.getUTCDate())}T${p(br.getUTCHours())}:${p(br.getUTCMinutes())}:${p(br.getUTCSeconds())}-03:00`;
}
async function cienciaOperacao(cert, cnpj, chave) {
  const agora = new Date(); const id = `ID210210${chave}01`;
  const evento = `<evento xmlns="${NS_NFE}" versao="1.00"><infEvento Id="${id}"><cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dataSefaz(agora)}</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento>`;
  const assinado = assinarEvento(evento, id, cert).replace(/^<\?xml[^>]*\?>/, '');
  const lote = dataSefaz(agora).replace(/\D/g, '').slice(0, 14);
  const env = `<envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${lote}</idLote>${assinado}</envEvento>`;
  const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${env}</nfeDadosMsg>`;
  const resp = await soap(URL_EVENTO, body, cert);
  const inf = tag(tag(resp, 'retEvento'), 'infEvento');
  if (inf) return { cStat: tag(inf, 'cStat'), xMotivo: tag(inf, 'xMotivo') };
  const lot = tag(resp, 'retEnvEvento');
  if (lot) return { cStat: tag(lot, 'cStat'), xMotivo: tag(lot, 'xMotivo') };
  throw new ErroApi('Resposta inesperada no evento: ' + resp.slice(0, 300), 'SEFAZ_RESPOSTA');
}

// ---------------------------------------------------------------- fluxos
async function nfeCompleta(uid, cnpj, chave) {
  cnpj = dig(cnpj); chave = dig(chave);
  if (chave.length !== 44) throw new ErroApi('Chave de acesso inválida.', 'CHAVE');
  const cert = await certificadoDoLogin(uid, cnpj);
  const r = await distDFe(cert, cnpj, chave);
  const log = [`distDFe consChNFe: ${r.cStat} ${r.xMotivo}`];
  const proc = r.docs.find(d => /^procNFe/.test(d.schema));
  if (proc) return { ok: true, xml: proc.xml, chave, log };
  const res = r.docs.find(d => /^resNFe/.test(d.schema));
  if (res || r.cStat === '138') {
    const ev = await cienciaOperacao(cert, cnpj, chave);
    log.push(`ciência 210210: ${ev.cStat} ${ev.xMotivo}`);
    if (['135', '136', '573'].includes(ev.cStat)) {
      await new Promise(r2 => setTimeout(r2, 2000));
      const r2 = await distDFe(cert, cnpj, chave);
      log.push(`distDFe após ciência: ${r2.cStat} ${r2.xMotivo}`);
      const proc2 = r2.docs.find(d => /^procNFe/.test(d.schema));
      if (proc2) return { ok: true, xml: proc2.xml, chave, log };
      return { ok: false, pendente: true, motivo: 'Ciência registrada; a SEFAZ ainda não liberou o XML completo. Tente de novo em alguns minutos.', log };
    }
    return { ok: false, motivo: `Evento de ciência rejeitado: ${ev.cStat} ${ev.xMotivo}`, log };
  }
  return { ok: false, motivo: `SEFAZ: ${r.cStat} ${r.xMotivo}`, log };
}
async function distribuicao(uid, cnpj, maxLotes) {
  cnpj = dig(cnpj);
  const cert = await certificadoDoLogin(uid, cnpj);
  let ult = cert.ultNSU || '0'; const docs = []; const log = []; let lotes = 0;
  while (lotes < maxLotes) {
    const r = await distDFe(cert, cnpj, '', ult); lotes++;
    log.push(`distNSU ultNSU=${ult} -> ${r.cStat} ${r.xMotivo} (docs ${r.docs.length}, ultNSU ${r.ultNSU}, maxNSU ${r.maxNSU})`);
    for (const d of r.docs) docs.push(d);
    if (r.ultNSU) { ult = r.ultNSU; await cert.ref.set({ ultNSU: ult }, { merge: true }); }
    if (r.cStat !== '138') break;
    if (r.ultNSU === r.maxNSU) break;
  }
  return { ok: true, docs, ultNSU: ult, log };
}

// ---------------------------------------------------------------- autenticação
async function usuarioAprovado(req) {
  const h = req.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  if (!m) throw new ErroApi('Entre no sistema para usar a busca na nuvem.', 'NAO_LOGADO', 401);
  let tok; try { tok = await admin.auth().verifyIdToken(m[1]); } catch (e) { throw new ErroApi('Sessão expirada — entre de novo.', 'NAO_LOGADO', 401); }
  const d = await db.collection('usuarios').doc(tok.uid).get();
  if (!d.exists || d.data().aprovado !== true) throw new ErroApi('Usuário ainda não autorizado.', 'NAO_AUTORIZADO', 403);
  return { uid: tok.uid, email: tok.email || '' };
}

// ---------------------------------------------------------------- HTTP
functions.http('sefaz', async (req, res) => {
  const origem = req.get('Origin') || '';
  res.set('Access-Control-Allow-Origin', ORIGENS.includes(origem) ? origem : ORIGENS[0]);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  const path = req.path.replace(/\/+$/, '');
  try {
    if (path === '/' || path === '') return res.json({ ok: true, servico: 'Totali Antecipa — SEFAZ na nuvem', versao: VERSAO });
    const u = await usuarioAprovado(req);
    if (path === '/api/status' && req.method === 'GET') return res.json({ ok: true, versao: VERSAO, nuvem: true, usuario: u.email, certificados: await listarCertificados(u.uid) });
    if (path === '/api/certificado' && req.method === 'POST') {
      const b = req.body || {}; let cnpj = dig(b.cnpj);
      if (!b.pfxBase64) throw new ErroApi('Arquivo .pfx não informado.', 'PFX');
      const c = abrirPfx(b.pfxBase64, b.senha || '');
      if (!cnpj) cnpj = c.cnpjCertificado;
      if (!cnpj) throw new ErroApi('Não foi possível identificar o CNPJ do certificado. Informe o CNPJ.', 'CNPJ');
      await colCerts(u.uid).doc(cnpj).set({ cnpj, pfxBase64: b.pfxBase64, senhaCifrada: cifrar(b.senha || ''), titular: c.titular, cnpjCertificado: c.cnpjCertificado, validade: c.validade, salvoEm: new Date().toISOString(), salvoPor: u.email, nuvem: true }, { merge: true });
      return res.json({ ok: true, certificado: { cnpj, cnpjCertificado: c.cnpjCertificado, titular: c.titular, validade: c.validade, vencido: c.vencido } });
    }
    if (path === '/api/senha' && req.method === 'POST') {
      const b = req.body || {}; const cnpj = dig(b.cnpj);
      const d = await colCerts(u.uid).doc(cnpj).get();
      if (!d.exists || !d.data().pfxBase64) throw new ErroApi(`Certificado do CNPJ ${cnpj} não cadastrado. Envie o .pfx pela tela.`, 'SEM_CERTIFICADO');
      const c = abrirPfx(d.data().pfxBase64, b.senha || '');
      await d.ref.set({ senhaCifrada: cifrar(b.senha || ''), titular: c.titular, cnpjCertificado: c.cnpjCertificado, validade: c.validade }, { merge: true });
      return res.json({ ok: true, titular: c.titular, validade: c.validade });
    }
    if (/^\/api\/certificado\/\d+$/.test(path) && req.method === 'DELETE') {
      await colCerts(u.uid).doc(dig(path.split('/').pop())).delete();
      return res.json({ ok: true });
    }
    if (/^\/api\/nfe\/\d+$/.test(path) && req.method === 'GET') return res.json(await nfeCompleta(u.uid, req.query.cnpj, path.split('/').pop()));
    if (path === '/api/distribuicao' && req.method === 'GET') return res.json(await distribuicao(u.uid, req.query.cnpj, Math.min(parseInt(req.query.lotes || '10', 10) || 10, 20)));
    return res.status(404).json({ ok: false, erro: 'rota não encontrada' });
  } catch (e) {
    const codigo = e.codigo || (/SENHA_NECESSARIA/.test(e.message) ? 'SENHA_NECESSARIA' : /não cadastrado/.test(e.message) ? 'SEM_CERTIFICADO' : 'ERRO');
    console.error(path, codigo, e.message);
    return res.status(e.status || 200).json({ ok: false, erro: e.message, codigo });
  }
});
