const fetch = require('node-fetch');

const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const dataset_util = require('./dataset-util');

async function getPage(baseURL, spaceId, pageId, options, modelRef, pagePath, model) {
  const response = await fetch(baseURL + '/v1/spaces/'+spaceId+'/content/page/'+pageId, options);
  const pageContent = await response.json();

  let text = '';
  if (pageContent.document == null) {
    console.log(pageContent);
  }

  function getContent(object, index) {
    let pre = {
      'heading-1': '\n#',
      'heading-2': '\n#',
      'heading-3': '\n#',
      'list-ordered': '',
      'list-unordered': '',
      'paragraph': '',
      'link': '',
      'text': '',
    }[object.type];
    if (pre == null) {
      pre = '';
    }
    let delim = {
      'heading-1': '\n',
      'heading-2': '\n',
      'heading-3': '\n',
      'list-ordered': '\n',
      'list-unordered': '\n',
      'paragraph': '',
      'link': '',
      'text': ' ',
    }[object.type];
    if (delim == null) {
      pre = '';
    }
    switch (object.object) {
      case 'document':
      case 'block':
      case 'inline':
        let text = '';
        for (let i = 0; i < object.nodes.length; i++) {
          const obj = object.nodes[i];
          if (object.object == 'document') {
            delim = '\n';
          }
          let prefix = '';
          if (obj.type == 'list-item') {
            prefix = String(i + 1) + '. ';
            if (i == 0) {
              prefix = '\n' + prefix;
            }
          }
          text += pre + prefix + getContent(obj, i) + (i < object.nodes.length ? delim : '');
        }
        return text;
        break;
      case 'text':
        let leaves = '';
        for (let i = 0; i < object.leaves.length; i++) {
          const leaf = object.leaves[i];
          const t = leaf.text;
          leaves += t;
        }
        return leaves;
        break;
      default:
        console.log(object);
    }
  }
  text = getContent(pageContent.document, 0);
  
  console.log(pageContent.path + ' parsed');

  return await dataset_util.doChunks(modelRef, pagePath, text, model.max_chunk_size, 'gitbook');
}

// TODO: Replace apiKey with your gitbook api key
exports.downloadGitbook = async function downloadGitbook(model, modelRef, apiKey) {
  
  const baseURL = 'https://api.gitbook.com';
  
  const headers = {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
  };
  const options = {
    headers,
  };

  let response = await fetch(baseURL+'/v1/orgs', options);
  const orgs = await response.json();
  console.log(orgs);
  const orgId = orgs.items[0].id;

  response = await fetch(baseURL+'/v1/orgs/'+orgId+'/spaces', options);
  const space = await response.json();
  const spaceId = space.items[0].id;

  response = await fetch(baseURL+'/v1/spaces/'+spaceId+'/content', options);
  const spaceContent = await response.json();
  const pages = spaceContent.pages;

  const pagePaths = {};
  function getPages(pages) {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.kind == 'sheet') {
        pagePaths[page.path] = page.id;
        if (page.pages != null) {
          getPages(page.pages);
        }
      } else if (page.kind == 'group') {
        getPages(page.pages);
      }
    }
  }
  getPages(pages);
  console.log(pagePaths);
  await modelRef.set({numPages: model.numPages + Object.keys(pagePaths).length}, {merge: true});

  const batchSize = 6;
  for (let i = 0; i < Object.keys(pagePaths).length; i+=batchSize) {
    const promises = [];
    for (let j = 0; j < batchSize; j++) {
      const pageKey = Object.keys(pagePaths)[i+j];
      if (pageKey != null) {
        const pageId = pagePaths[pageKey];
        promises.push(getPage(baseURL, spaceId, pageId, options, modelRef, pageKey, model));
      }
    }
    try {
      await Promise.all(promises);
    } catch (e) {
      console.log(e);
    }
  }

  return Object.keys(pagePaths).length;
};
