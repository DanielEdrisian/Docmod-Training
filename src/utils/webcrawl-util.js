function print(str) {
  console.log(str);
}

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const fetch = require('node-fetch');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const dataset_util = require('./dataset-util');

const { convert } = require('html-to-text');

const Crawler = require("js-crawler");

async function doCrawl(urlSet, modelRef, model) {
  await modelRef.update({numPage: model.numPages + urlSet.length});
  const batchSize = 6;
  for (let i = 0; i < urlSet.length; i+=batchSize) {
    const promises = [];
    for (let j = 0; j < batchSize; j++) {
      if (i + j < urlSet.length) {
        const url = urlSet[i + j];    
        console.log('Begin downloading ' + url);
        // node fetch download page and get body
        const response = await fetch(url);
        const page = convert(await response.text());
        // print(page);
        if (page != null && page.length > 10) {
          promises.push(dataset_util.doChunks(modelRef, url, convert(page), model.max_chunk_size, 'webcrawl'));
        }
        console.log('Finished downloading ' + url);
      }
    }
    await Promise.all(promises);
  }
}

exports.crawlEverything = async function crawlEverything(model, modelRef) {
  return new Promise((resolve, reject) => {
    const urlSet = [];
    // const BASE = model.webcrawl_URL;
    let BASE = model.webcrawl_URL;
    // If last char is slash, remove slash
    if (BASE[BASE.length - 1] === '/') {
      BASE = BASE.substring(0, BASE.length - 1);
    }
    
    new Crawler().configure({
      depth: 4, 
      shouldCrawl: function(url) {
        const shouldCrawl = url.includes(BASE) && !url.includes('https://www.google.com') && !urlSet.includes(url);
        if (shouldCrawl) {
          print(url);
          urlSet.push(url);
        }
        return shouldCrawl;
      }
    })
      .crawl(BASE, function onSuccess(page) {
        console.log('Begin crawling ' + page.url);
      }, async function failure(response) {
        console.log("ERROR occurred:");
        console.log(response.status);
        console.log(response.url);
        console.log(response.referer);
      }, async function onAllFinished(page) {
        console.log('Finished crawling');
        const aa = await doCrawl(urlSet, modelRef, model);
        resolve(aa);
      });
  });
};