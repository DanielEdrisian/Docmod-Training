function print(str) {
  console.log(str);
}

const fetch = require('node-fetch');

const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const pinecone_util = require('./pinecone-util');
const github_util = require('./github-util');
const gitbook_util = require('./gitbook-util');
const intercom_util = require('./intercom-util');
const webcrawl_util = require('./webcrawl-util');

exports.doChunks = async function doChunks(modelRef, pagePath, text, chunk_size, source, page_ref) {
  let pageRef = page_ref;
  if (source != 'custom') {
    pageRef = modelRef.collection('pages').doc(pagePath.replaceAll('/', '::'));
    await pageRef.set({path: pagePath, content: text, used: true, is_custom: false, source: source});
  }
  const uploadFileRes = await pinecone_util.uploadFile(pagePath, text, modelRef.id, chunk_size);
  if (uploadFileRes == null) {
    print('Failed to upload file: ' + pagePath);
    print('Contents: ' + text);
    return null;
  }

  print(uploadFileRes.chunks);

  for (let chunkId in uploadFileRes.chunks) {
    const chunkText = uploadFileRes.chunks[chunkId].replaceAll('; ', '\n');
    const chunkIdFixed = chunkId.replaceAll('/', '::');
    const chunkRef = modelRef.collection('chunks').doc(chunkIdFixed);
    await chunkRef.set({text: chunkText, pageRef: pageRef, source: source});
  }

  return uploadFileRes;
};

exports.syncModel = async function syncModel(model, modelRef, source) {
  const chunks = await modelRef.collection('chunks').where('source', '==', source).get();
  const chunkIds = [];
  for (let i = 0; i < chunks.docs.length; i++) {
    chunkIds.push(chunks.docs[i].ref.id);
    await chunks.docs[i].ref.delete();
  }
  await pinecone_util.deleteIds(modelRef.id, chunkIds);
  const pages = await modelRef.collection('pages').where('source', '==', source).get();
  for (let i = 0; i < pages.docs.length; i++) {
    await pages.docs[i].ref.delete();
  }
  const pagesCount = pages.docs == null ? 0 : pages.docs.length;
  await modelRef.update({numPages: (model.numPages == null) ? 0 : (model.numPages - pagesCount)});
  
  let pageContentStrings;
  if (source == 'gitbook' && model.gitbookApiKey != null) {
    pageContentStrings = await gitbook_util.downloadGitbook(model, modelRef, model.gitbookApiKey);
  }
  if (source == 'github' && (model.githubApiKey != null && model.githubURL != null)) {
    pageContentStrings = await github_util.downloadGithub(model, modelRef, model.githubURL, model.githubApiKey);
  }
  if (source == 'intercom_help_center' && model.intercomApiKey != null) {
    pageContentStrings = await intercom_util.getIntercomArticles(model, modelRef);
  }
  if (source == 'webcrawl' && model.webcrawl_URL != null) {
    pageContentStrings = await webcrawl_util.crawlEverything(model, modelRef);
  }
  
  if (pageContentStrings != null) {
    return true;
  }
  return false;
};
