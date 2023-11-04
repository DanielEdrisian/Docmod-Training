const admin = require("firebase-admin");
if (admin.apps.length === 0) {
  // TODO: Initialize the firestore for the chunks
  admin.initializeApp();
}
const functions = require("firebase-functions");
const db = admin.firestore();

module.exports = {
  admin,
  db,
  functions
}