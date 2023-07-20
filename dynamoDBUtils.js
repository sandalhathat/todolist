//dynamoDBUtils.js

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); //load .env

AWS.config.update({
    // region: 'us-west-2',
    region: 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB();

//function to create new item in dynamodb
function createItem(params) {
    return new Promise((resolve, reject) => {
        dynamodb.putItem(params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

// func to read item from db
function readItem(params) {
    return new Promise((resolve, reject) => {
        dynamodb.getItem(params, (err, data) => {
            if (err) reject(err);
            else resolve(data.Item);
        });
    });
}

// func to update item in db
function updateItem(params) {
    return new Promise((resolve, reject) => {
        dynamodb.updateItem(params, (err, data) => {
            if (err) reject(err);
            else resolve(data.Attributes);
        });
    });
}

//func to delete
function deleteItem(params) {
    return new Promise((resolve, reject) => {
        dynamodb.deleteItem(params, (err, data) => {
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