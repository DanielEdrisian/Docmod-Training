const admin = require('firebase-admin');
const functions = require('firebase-functions');
const fetch = require('node-fetch');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const pinecone_util = require('./utils/pinecone-util');
const intercom_util = require('./utils/intercom-util');
const dataset_util = require('./utils/dataset-util');

exports.pageAdded = functions.firestore
  .document('models/{modelId}/pages/{pageId}')
  .onCreate(async (snap, context) => {
    try {
      const pageRef = snap.ref;
      const page = snap.data();
      if (!page.is_custom) {
        return;
      }
      const modelRef = pageRef.parent.parent;
      const model = (await modelRef.get()).data();
      await dataset_util.doChunks(modelRef, page.path, page.content, model.max_chunk_size, 'custom', pageRef);
    } catch (e) {
    }
  });


exports.pageChanged = functions.firestore
  .document('models/{modelId}/pages/{pageId}')
  .onWrite(async (snap, context) => {
    try {
      const before = snap.before.data();
      const after = snap.after.data();
      const pageRef = snap.after.ref;
      const modelRef = pageRef.parent.parent;
      if (before == null || after == null) {
        return;
      }
      const model = (await modelRef.get()).data();
      if (before.isUsed != after.isUsed) {
        if (!after.isUsed) {
          await pinecone_util.deletePage(modelRef.id, pageRef.id);
        } else {
          await dataset_util.doChunks(modelRef, after.path, after.content, model.max_chunk_size, 'custom');
        }
      }
    } catch (e) {
    }
  });

exports.pageDeleted = functions.firestore
  .document('models/{modelId}/pages/{pageId}')
  .onDelete(async (snap, context) => {
    try {
      const pageRef = snap.ref;
      const modelRef = pageRef.parent.parent;
      const chunks = await modelRef.collection('chunks').where('pageRef', '==', pageRef).get();
      const chunkIds = [];
      for (let i = 0; i < chunks.docs.length; i++) {
        const chunk = chunks.docs[i];
        chunkIds.push(chunk.id);
      }
      await pinecone_util.deleteIds(modelRef.id, chunkIds);
    } catch (e) {
    }
  });

exports.modelDeleted = functions.firestore
  .document('models/{modelId}')
  .onDelete(async (snap, context) => {
    try {
      const modelRef = snap.ref;
      const res = await pinecone_util.deleteIndex(modelRef.id);
      if (!res.success) {
        await db.collection('cleanups').doc().set({ index_name: modelRef.id });
      }
    } catch (e) {
      console.log(e);
    }
  });

exports.modelCreated = functions.firestore
  .document('models/{modelId}')
  .onCreate(async (snap, context) => {
    try {
      const modelRef = snap.ref;
      modelRef.set({ status: 'Initialized' }, { merge: true });
    } catch (e) {
      console.log(e);
    }
  });

exports.modelChanged = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .firestore
  .document('models/{modelId}')
  .onWrite(async (change, context) => {
    try {
      const modelRef = change.after.ref;
      const before = change.before.data();
      const after = change.after.data();

      if (before == null) {
        return;
      }

      if (before.startIndexing == false && after.startIndexing == true) {
        console.log("Start Indexing");
        
        await modelRef.set({ status: 'Indexing' }, { merge: true });
        if (after.indexing_source == null || after.indexing_source == '') {
          throw Error('indexing_source is null, but indexing is started.');
        }
        await dataset_util.syncModel(after, change.after.ref, after.indexing_source);
        await modelRef.update({ status: 'Ready', startIndexing: false });
      }

      if (after.intercomApiKey != null && before.intercomApiKey != after.intercomApiKey) {
        const hasHelpCenter = await intercom_util.hasIntercomHelpCenter(after);
        await modelRef.update({ has_help_center_articles: hasHelpCenter });
      }
    } catch (e) {
      console.log(e);
    }
  });

