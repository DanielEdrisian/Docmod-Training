function print(str) {
  console.log(str);
}

const fetch = require('node-fetch');

// TODO: Deploy the python pinecone util
const NGROK_URL = 'https://[YOUR_SERVER].herokuapp.com';

exports.deleteIndex = async function deleteIndex(index_name) {
  const pineconeDelete = await fetch(NGROK_URL + '/delete_index', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        index_name: index_name.toLowerCase(),
    }),
  });
  const pineconeDeleteJson = await pineconeDelete.json();
  console.log(pineconeDeleteJson);
  return pineconeDeleteJson;
};

exports.deleteIds = async function deleteIds(index_name, ids) {
  const pineconeDelete = await fetch(NGROK_URL + '/delete_ids', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        index_name: index_name.toLowerCase(),
        ids: ids
    }),
  });
  const pineconeDeleteJson = await pineconeDelete.json();
  console.log(pineconeDeleteJson);
  return pineconeDeleteJson;
};

exports.deletePage = async function deletePage(index_name, page_name) {
  const pineconeDelete = await fetch(NGROK_URL + '/delete_page', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        index_name: index_name.toLowerCase(),
        page_name: page_name
    }),
  });
  const pineconeDeleteJson = await pineconeDelete.json();
  console.log(pineconeDeleteJson);
  return pineconeDeleteJson;
};

exports.uploadFile = async function uploadFile(filename, text, index_name, chunk_size) {
  try {
    const pineconeUpload = await fetch(NGROK_URL + '/process_file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: filename,
        text: text,
        index_name: index_name.toLowerCase(),
        chunk_size: chunk_size
      }),
    });
    const pineconeUploadJson = await pineconeUpload.json();
    // print(pineconeUploadJson);
    return pineconeUploadJson;
  } catch (e) {
    print(e);
    return null;
  }
};

exports.getContext = async function getContext(index_name, query, top_k) {
  const pineconeSemanticSearch = await fetch(NGROK_URL + '/semantic_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: query,
      index_name: index_name.toLowerCase(),
      top_k: top_k
    }),
  });

  let pineconeSemanticSearchJson;
  
  try { 
    pineconeSemanticSearchJson = await pineconeSemanticSearch.json();
  } catch (e) {
    print(e);
  }
  return pineconeSemanticSearchJson;
};
