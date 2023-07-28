// dynamoDBUtils.js

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); //load .env

AWS.config.update({
  region: 'us-east-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const docClient = new AWS.DynamoDB.DocumentClient(); // Create DocumentClient

// Function to create a new item in DynamoDB
function createItem(params) {
  return new Promise((resolve, reject) => {
    docClient.put(params, (err, data) => { // Use DocumentClient's put() method
      if (err) {
        console.error('Error writing to DynamoDB:', err);
        reject(err);
      } else {
        console.log('Data written to DynamoDB!', data);
        resolve(data);
      }
    });
  });
}

// Function to read an item from the database
function readItem(params) {
  return new Promise((resolve, reject) => {
    docClient.get(params, (err, data) => { // Use DocumentClient's get() method
      if (err) reject(err);
      else resolve(data.Item);
    });
  });
}

// Function to update an item in the database
function updateItem(params) {
  return new Promise((resolve, reject) => {
    docClient.update(params, (err, data) => { // Use DocumentClient's update() method
      if (err) reject(err);
      else resolve(data.Attributes);
    });
  });
}

// Function to delete an item from the database
function deleteItem(params) {
  return new Promise((resolve, reject) => {
    docClient.delete(params, (err, data) => { // Use DocumentClient's delete() method
      if (err) reject(err);
      else resolve(data);
    });
  });
}

module.exports = {
  createItem,
  readItem,
  updateItem,
  deleteItem,
  generateVerificationToken: () => uuidv4(),
};
