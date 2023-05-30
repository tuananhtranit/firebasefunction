const { onRequest } = require('firebase-functions/v2/https');
const functions = require('firebase-functions');
const express = require('express');
const app = express();
const admin = require('firebase-admin');

 

// Set the proxy server address and port
// process.env.https_proxy = 'http://rut4hc:Ajg*atAPgsR3AIKa@rb-proxy-de.bosch.com:8080/';
// process.env.http_proxy = 'http://rut4hc:Ajg%2AatAPgsR3AIKa@rb-proxy-de.bosch.com:8080/';

var serviceAccount = require("../serviceAccountKey.json");

// console.log(serviceAccount);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
  // credential: admin.credential.applicationDefault()
  // databaseURL: 'http://localhost:8085'
});

 

const db = admin.firestore();
// console.log('Database: ',db)
const collectionRef = db.collection('News');
const messageRef = db.collection('messages');
// console.log('ColectionRef', collectionRef)

const News = {
    getById: async (id) => {
      try {
        console.log('Enter getById function');
        console.log('ID:', id);
        console.log('Collection Ref:', collectionRef.path);
        const doc = await collectionRef.doc(id).get();
    
        if (doc.exists) {
          console.log('Retrieved document:', doc.data());
          return doc.data();
        } else {
          console.log('Document not found');
          throw new Error('News not found');
        }
      } catch (error) {
        console.error('Error retrieving document:', error);
        throw error;
      }
    },

    create: async (data) => {
      try {
        const docRef = await collectionRef.add(data);
        const doc = await docRef.get();
        return doc.data();
      } catch (error) {
        console.error('Error creating news:', error);
        throw error;
      }
    },
  
    update: async (id, data) => {
      try {
        await collectionRef.doc(id).update(data);
        const updatedDoc = await collectionRef.doc(id).get();
        return updatedDoc.data();
      } catch (error) {
        console.error('Error updating news:', error);
        throw error;
      }
    },
  
    delete: async (id) => {
      try {
        const doc = await collectionRef.doc(id).get();
        if (!doc.exists) {
          throw new Error('News not found');
        }
        await collectionRef.doc(id).delete();
        return { message: 'News deleted successfully' };
      } catch (error) {
        console.error('Error deleting news:', error);
        throw error;
      }
    },

    list: async ({ pageSize = 10, pageNum = 1, startAfter = null, sortBy = 'title', sortOrder = 'asc' }) => {
      try {
        console.log('Page size: ', pageSize);
        console.log('Page num', pageNum);
        const skip = (pageNum - 1) * pageSize;
    
        let query = collectionRef.orderBy(sortBy, sortOrder).limit(parseInt(pageSize)).offset(parseInt(skip));
    
        if (startAfter) {
          const startAfterDoc = await collectionRef.doc(startAfter).get();
          query = query.startAfter(startAfterDoc);
        }
    
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
      } catch(error) {
        console.error('Error getAll:', error);
        throw error;
      }
    }

  };

 

// build multiple CRUD interfaces:
app.get('/:id', async (req, res) => {
  const news = await News.getById(req.params.id);
  res.json(news);
});
app.post('/', async (req, res) => {
  const createdNews = await News.create(req.body);
  res.json(createdNews);
});

app.put('/:id', async (req, res) => {
  const updatedNews = await News.update(req.params.id, req.body);
  res.json(updatedNews);
});

app.delete('/:id', async (req, res) => {
  const deleteResponse = await News.delete(req.params.id);
  res.json(deleteResponse);
});
app.get('/', async (req, res) => {
  const { pageSize, pageNum, startAfter, sortBy, sortOrder } = req.query;
  const newList = await News.list({ pageSize, pageNum, startAfter, sortBy, sortOrder });
  res.json(newList);
});

 
exports.news = onRequest(app);

exports.scheduledFunctionCrontab = functions.pubsub.schedule("* * * * *", async (event) => {
  console.log('This function will run every minute!');
});


exports.sendNotification = functions.firestore
  .document('messages/{documentId}')
  .onCreate(async (snapshot, context) => {
    // Get the FCM tokens from Firestore
    console.log('Doc Id created: ', snapshot.id);
    const messagesCollection = snapshot.data();
    // console.log(messagesCollection); -> json/object
    // Create the notification payload
    const payload = {
      token: messagesCollection.fcmToken,
      notification: {
        title: messagesCollection.title,
        body: messagesCollection.body,
      },
    };

    try {
      await admin.messaging().send(payload);
      const data = snapshot.data();
      data.isNotify = true;
      await messageRef.doc(snapshot.id).update(data);
      console.log('Notifications sent successfully!');
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  });
