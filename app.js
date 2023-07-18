// app.js 
const AWS = require('aws-sdk');
const express = require('express');
const app = express();
const argon2 = require('argon2');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 3000;


AWS.config.update({
    region: 'us-west-2',
    accessKeyId: process.env.AWS.ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});


//middleware
app.use(express.json()); //parse JSON requests

//----------endpoint for user reg----------
//placeholder endpoint for user reg
// app.post('/api/register',(req,res) => {
//     //handle user reg logic, but for now just respond w msg
//     res.json({ message: 'User registration endpoint' });
// });
///api/register endpoint
// placeholder for storing registered users. later will be changed 
//to using a db instead
const users = [];
app.post('/api/register', async(req, res) => {
    const { username, email, password } = req.body;

    //validation: ensuring all required fields are provided
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    //check if email is already taken (registered)
    if (users.some((user) => user.email === email)) {
        return res.status(409).json({ error: 'Email already in use.' });
    }

    try {
        //hash pw using argon2
        const hashedPassword = await argon2.hash(password);

        //create new user obj and store it. later this will be saved to db instead
        const newUser = {
            username,
            email,
            password: hashedPassword,
        };

        users.push(newUser);

        //implementlater: send verification email to user

        res.json({ message: 'User successfully registered!' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ error: 'Something failed during registration.'})
    }
});

//----------endpoint for email verification----------
//placeholder endpoint for email verification...
// app.get('/api/verify/:verificationToken', (req,res) => {
//     //handle email verif logic here
//     //for now, just a msg
//     const verificationToken = req.params.verificationToken;
//     res.json({ message: `Email verification endpoint. Token: ${verificationToken}`});
// });
//email verification logic
app.get('/api/verify/:verificationToken', (req, res) => {
    const verificationToken = req.params.verificationToken;

    //validation: check if verification token is valid... implementing this later!
    //if token is not valid, return error msg
    //mark users email as verified, later will update this in db
    res.json({ message: 'Email verified successfully!' });

});

//----------endpoint for pw reset----------
// //placeholder endpoint for password reset
// app.post('/api/reset-password', (req,res) => {
//     //pw logic later, now msg
//     res.json({ message: 'Password reset endpoint' });
// });
app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;
  
    // Validation: Ensure the email is provided
    if (!email) {
      return res.status(400).json({ error: 'Please provide your email.' });
    }
  
    // Check if the email is registered (in a real app, query the database)
    const user = users.find((user) => user.email === email);
  
    if (!user) {
      return res.status(404).json({ error: 'Email not registered.' });
    }
  
    try {
      // Generate a reset token (in a real app, store the token and expiration in the database)
      const resetToken = 'some_generated_reset_token';
  
      // You may also send a password reset email to the user here (not implemented in this example)
  
      res.json({ message: 'Password reset token generated. Check your email for instructions.' });
    } catch (error) {
      console.error('Error during password reset:', error);
      res.status(500).json({ error: 'Something went wrong during password reset.' });
    }
  });

//----------endpoint for nodemailer----------
const nodemailer = require('nodemailer');
//configuration for sending emails
const transporter = nodemailer.createTransport({
    service: 'your_email_service_provider',
    auth: {
        user: 'your_email_username',
        pass: 'your_email_password',
    },
});
transporter.sendMail({
    from: 'your_email@example.com',
    to: 'recipient@example.com',
    subject: 'Test email',
    text: 'This is a test email from your app.',
});


//start server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});