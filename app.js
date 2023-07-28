// app.js

const express = require('express');
const app = express();
const port = process.env.PORT || 80;
const argon2 = require('argon2');
const { createItem, readItem, updateItem, generateVerificationToken } = require('./dynamoDBUtils');
const { isValidEmail, sanitizeEmail, formatEmailKey } = require('./emailUtils');

const fs = require('fs');

const pidFilePath = '/var/pids/web.pid';
fs.writeFileSync(pidFilePath, process.pid.toString(), 'utf-8');
process.on('exit', () => {
    fs.unlinkSync(pidFilePath);
});

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
        // ... (code for sending the verification email)

        res.json({ message: 'User successfully registered!' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ error: 'Something failed during registration.' });
    }
});

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




// Endpoint for email verification
app.get('/api/verify/:verificationToken', async (req, res) => {
    const verificationToken = req.params.verificationToken;

    try {
        // Find the user with the matching verification token in the "userinfo" table
        const user = await readItem({ TableName: 'userinfo', Key: { username: verificationToken } });

        if (!user) {
            return res.status(404).json({ error: 'Invalid verification token.' });
        }

        user.isEmailVerified = true;
        user.verificationToken = null;

        // Save the updated user in the "userinfo" table
        await updateItem({ TableName: 'userinfo', Item: user });

        res.json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Error during email verification:', error);
        res.status(500).json({ error: 'Something went wrong during email verification' });
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

function sendVerificationEmail(email, verificationToken) {
    //add code here to send verif email to user email
    //can use libs like nodemailer to send...
    //create nodemailer transporter using email srvc prov
    const transporter = nodemailer.createTransport({
        host: 'your_smtp_host',
        port: 587,
        secure: false,
        auth: {
            user: 'your_email@example.com',
            pass: 'your_email_password',
        },
    });

    // Email content
    const mailOptions = {
        from: 'your_email@example.com', // Replace with your email address
        to: email,
        subject: 'Email Verification',
        text: `Thank you for registering! Please click on the following link to verify your email: http://your_domain/api/verify/${verificationToken}`,
        // You can also include an HTML version of the email if you prefer.
        html: `<p>Thank you for registering! Please click on the following link to verify your email:</p>
              <p><a href="http://your_domain/api/verify/${verificationToken}">Verify Email</a></p>`,
    };

    // console.log(`Verification email sent to ${email}. Token: ${verificationToken}`);
    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending verification email:', error);
        } else {
            console.log('Verification email sent:', info.response);
        }
    });
}

async function verifyEmail(req, res) {
    const verificationToken = req.params.verificationToken;

    try {
        //Find usr with matching verif token in "userinfo" tbl
        // const user = await readItem({ TableName: 'userinfo', Key: { username: verificationToken } });

        const params = {
            TableName: 'userinfo',
            FilterExpression: 'verificationToken = :token',
            ExpressionAttributeValues: {
                ':token': verificationToken,
            },
        };

        const result = await docClient.scan(params).promise();

        if (result.Items.length === 0) {
            return res.status(404).json({ error: 'Invalid verification token.'});
        }


        // if (!user) {
        //     return res.stats(404).json({ error: 'Invalid verification token.' });
        // }

        //assuming only one item with verif token, update said user
        const user = result.Items[0];
        user.isEmailVerified = true;
        user.verificationToken = null;

        //save updated usr in "userinfo" tbl
        await updateItem({ TableName: 'userinfo', Item: user });

        res.json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Error during email verification:', error);
        res.status(500).json({ error: 'Something went wrong during email verification' });
    }
}

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
