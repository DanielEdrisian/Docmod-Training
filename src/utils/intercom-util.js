const fetch = require('node-fetch');
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const dataset_util = require('./dataset-util');

// TODO: Enter intercom api key
const INTERCOM_API_KEY = 'INTERCOM_API_KEY';

async function parseArticle(modelRef, title, body, url, model) {
  const text = title + '\n\n' + body;
  let docId = url.replaceAll('\/', '::');
  await modelRef.collection('pages').doc(docId).set({path: url, text: text, is_custom: false, source: 'intercom_help_center'});
  const res = await dataset_util.doChunks(modelRef, url, text, model.max_chunk_size, 'intercom_help_center');
  console.log(res);
}

exports.getIntercomArticles = async function getIntercomArticles(model, modelRef) {
  const headers = {
    'Authorization': 'Bearer ' + INTERCOM_API_KEY,
    'Content-Type': 'application/json',
  };
  const options = {
    headers,
  };
  // Page through like so https://api.intercom.io/articles?per_page=50&page=2
  let currentPage = 1;
  let totalPages = 1;
  let totalCount = 0;
  let perPage = 6;
  let totalPublished = 0;
  while (currentPage <= totalPages) {
    const articlePromises = [];
    const res = await fetch('https://api.intercom.io/articles?page='+currentPage+'/per_page='+perPage, options);
    const json = await res.json();
    // console.log(json);
    totalPages = json.pages.total_pages;
    totalCount = json.total_count;
    currentPage += 1;
    for (let i = 0; i < json.data.length; i += 1) {
      const article = json.data[i];
      if (article.state != 'published') {
        continue;
      }
      totalPublished += 1;
      articlePromises.push(parseArticle(
        modelRef,
        article.title,
        article.body.replace(/<[^>]*>?/gm, '').replaceAll('\n\n\n', '\n\n'),
        article.url,
        model
      ));
    }
    await Promise.all(articlePromises);
  }
  console.log(totalPublished);
  await modelRef.update({numPages: (model.numPages == null) ? totalPublished : model.numPages + totalPublished});
  return true;
};


exports.hasIntercomHelpCenter = async function hasIntercomHelpCenter(model) {
  const headers = {
    'Authorization': 'Bearer ' + INTERCOM_API_KEY,
    'Content-Type': 'application/json',
  };
  const options = {
    headers,
  };
  // Page through like so https://api.intercom.io/articles?per_page=50&page=2
  let currentPage = 1;
  let totalPages = 1;
  let perPage = 6;
  while (currentPage <= totalPages) {
    const res = await fetch('https://api.intercom.io/articles?page='+currentPage+'/per_page='+perPage, options);
    const json = await res.json();
    totalPages = json.pages.total_pages;
    totalCount = json.total_count;
    currentPage += 1;
    for (let i = 0; i < json.data.length; i += 1) {
      const article = json.data[i];
      if (article.state == 'published') {
        return true;
      }
    }
  }
  return false;
};
