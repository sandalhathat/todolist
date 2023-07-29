// app.js

const express = require('express');
const app = express();
const AWS = require('aws-sdk');
const port = process.env.PORT || 80;
const argon2 = require('argon2');
const { createItem, readItem, updateItem, deleteItem, docClient, generateVerificationToken } = require('./dynamoDBUtils');
const { google } = require('googleapis');
const fs = require('fs');

const pidFilePath = '/var/pids/web.pid';
fs.writeFileSync(pidFilePath, process.pid.toString(), 'utf-8');
process.on('exit', () => {
    fs.unlinkSync(pidFilePath);
});


// Middleware
app.use(express.json());


// Endpoint for user registration
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    console.log('Received registration request:', req.body); //log testing

    if (!username || !email || !password) {
        console.log('Missing required fields:', { username, email, password });
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    try {
        const hashedPassword = await argon2.hash(password);

        console.log('Hashed password:', hashedPassword); //adding this for tests

        //gen verif token
        const verificationToken = generateVerificationToken();

        //create object w user data to store in dynamodb
        const newUser = {
            username,
            email,
            password: hashedPassword,
            isEmailVerified: false,
            verificationToken,
        };

        // Save the new user in the "userinfo" table
        //before creating a new user in db
        console.log('Creating new user:', newUser);
        //creates new user
        await createItem({ TableName: 'userinfo', Item: newUser });
        //after creating new user
        console.log('User created successfully!');
        console.log(`Verification token for ${email}: ${verificationToken}`);

        // Send the verification email here (Step 3)
        await sendVerificationEmail(email, verificationToken);

        res.json({ message: 'User successfully registered!' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ error: 'Something failed during registration.' });
    }
});


// Endpoint for email verification
app.get('/api/verify/:verificationToken', verifyEmail);


// Endpoint for user login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    console.log('Received login request:', req.body);

    if (!username || !password) {
        console.log('Missing required fields:', { username, password });
        return res.status(400).json({ error: 'Please provide both username and password.' });
    }

    try {
        //find user
        const user = await readItem({ TableName: 'userinfo', Key: { username } });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        //compare passwords
        const isPasswordValid = await argon2.verify(user.password, password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password.' })
        }

        //handle successful login
        res.json({ message: 'Login successful!' });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Something went wrong during login...' });
    }
});


// Endpoint for password reset
app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide your email.' });
    }

    try {
        // Check if the email exists in the "userinfo" table
        const user = await readItem({ TableName: 'userinfo', Key: { username: email } });

        if (!user) {
            return res.status(404).json({ error: 'Email not registered.' });
        }

        // Generate the password reset token here (Step 4)
        const resetToken = generateVerificationToken();

        // Send the password reset email here (Step 4)
        // ... (code for sending the password reset email)

        res.json({ message: 'Password reset token generated. Check your email for instructions.' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ error: 'Something went wrong during password reset.' });
    }
});


async function sendVerificationEmail(email, verificationToken) {
    try {
        //load credentials from client_secret.json
        const credentials = await getCredentialsFromSecret();
        //use credentials to create OAuth2 client and send the verification email

        //create OAuth2 client using creds
        const oAuth2Client = new google.auth.OAuth2(
            credentials.web.client_id,
            credentials.web.client_secret,
            credentials.web.redirect_uris[0]
        );

        //set access token to OAuth2 client
        oAuth2Client.setCredentials({
            access_token: credentials.web.access_token,
            refresh_token: credentials.web.refresh_token,
        });

        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        const mailOptions = {
            from: 'jobs4dan2022@gmail.com',
            to: email,
            subject: 'Email Verification',
            text: `Thanks for registering. Please click on this link to verify email: http://todolist-env-1.eba-rk2kpbwc.us-east-2.elasticbeanstalk.com/api/verify/${verificationToken}`,
            html: `<p>Thank you for registering! Please click on the following link to verify your email:</p>
                  <p><a href="http://todolist-env-1.eba-rk2kpbwc.us-east-2.elasticbeanstalk.com/api/verify/${verificationToken}">Verify Email</a></p>`,
        };

        //send the email using gmail api
        const message = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: makeRawEmail(mailOptions),
            },
        });
        console.log('Verification email sent.', message.data);
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
}


function makeRawEmail(mailOptions) {
    const email_lines = [];

    for (const headers in mailOptions) {
        email_lines.push(`${header}: ${mailOptions[header]}`);
    }
    //adding empty lines for spacing headers from body
    email_lines.push('');
    email_lines.push(mailOptions.text);

    const email = email_lines.join('\r\n');

    //convert email to base64url format (required by gmail api)
    const base64EncodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return base64EncodedEmail;

}


const secretName = 'gmail-api-credentials';
const region = 'us-east-2';
const secretsManager = new AWS.SecretsManager({ region });

async function getCredentialsFromSecret() {
    try {
        const secretData = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
        if ('SecretString' in secretData) {
            const SecretString = secretData.SecretString;
            const credentials = JSON.parse(SecretString);
            return credentials;
        } else {
            throw new Error('Secret data not found.');
        }
    } catch (error) {
        console.error('Error retrieving credentials from AWS Secrets Manager:', error);
        throw error;
    }
}


async function verifyEmail(req, res) {
    const verificationToken = req.params.verificationToken;

    try {
        //Find usr with matching verif token in "userinfo" tbl

        const params = {
            TableName: 'userinfo',
            FilterExpression: 'verificationToken = :token',
            ExpressionAttributeValues: {
                ':token': verificationToken,
            },
        };

        const result = await docClient.scan(params).promise();

        if (result.Items.length === 0) {
            return res.status(404).json({ error: 'Invalid verification token.' });
        }

        //assuming only one item with verif token, update said user
        const user = result.Items[0];
        user.isEmailVerified = true;
        user.verificationToken = null;

        console.log('User to be updated:', user);//added for debug

        //save updated usr in "userinfo" tbl
        // await updateItem({ TableName: 'userinfo', Item: user });
        const updateParams = {
            TableName: 'userinfo',
            Key: { username: user.username },
            UpdateExpression: 'SET isEmailVerified = :val REMOVE verificationToken',
            ExpressionAttributeValues: {
                ':val': true,
            },
            ReturnValues: 'ALL_NEW',
        };

        await updateItem(updateParams);

        res.json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Error during email verification:', error);
        res.status(500).json({ error: 'Something went wrong during email verification' });
    }
}


app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
