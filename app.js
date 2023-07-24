// app.js

const express = require('express');
const app = express();
const port = process.env.PORT || 80;
const argon2 = require('argon2');
const { createItem, readItem, updateItem, generateVerificationToken } = require('./dynamoDBUtils');

const fs = require('fs');
const pidFilePath = '/var/pids/web.pid';
fs.writeFileSync(pidFilePath, process.pid.toString(), 'utf-8');
process.on('exit', () => {
    fs.unlinkSync(pidFilePath);
});

app.use(express.json());

//endpoint for user reg
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    try {
        const hashedPassword = await argon2.hash(password);

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

//endpoint for email verification
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

//endpoint for reset pass
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

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
