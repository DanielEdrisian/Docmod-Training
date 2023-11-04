const github_downloader = require('github-directory-downloader');
const fs = require('fs').promises;
const dataset_util = require('./dataset-util');

exports.downloadGithub = async function downloadGithub(model, modelRef, github_url, github_token) {
  const downloader = await github_downloader(
    github_url,
    '/tmp/download_temp',
    {token: github_token}
  );

  const files = downloader.files;
  await modelRef.set({numPages: model.numPages + Object.keys(files).length}, {merge: true});

  // For each file in the files map (key is name, value is path), retrieve the content
  const file_contents = {};
  for (const file_name in files) {
    const file_path = files[file_name];
    // If file ends with .md, read the file
    let txt = await fs.readFile(file_path, 'utf8');
    txt = txt.replace(/(<([^>]+)>)/gi, '');
    file_contents[file_name] = txt; 
  }
  
  const batchSize = 6;
  for (let i = 0; i < Object.keys(file_contents).length; i+=batchSize) {
    const promises = [];
    for (let j = 0; j < batchSize; j++) {
      const pageKey = Object.keys(file_contents)[i+j];
      if (pageKey != null) {
        const txt = file_contents[pageKey];
        promises.push(dataset_util.doChunks(modelRef, pageKey, txt, model.max_chunk_size, 'github'));
      }
    }
    try {
      await Promise.all(promises);
    } catch (e) {
      console.log(e);
    }
  }

  console.log(file_contents);

  return Object.keys(file_contents).length;
};
