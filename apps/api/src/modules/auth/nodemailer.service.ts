// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: 'healthcare@gmail.com',
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// const verifyConnection = () => {
//   try {
//     await transporter.verify();
//     console.log('Server is ready to take our messages');
//   } catch (err) {
//     console.error('Verification failed:', err);
//   }
// };

// const sendOTP = () => {
//   try {
//     const info = await transporter.sendMail({
//       from: '"Example Team" <team@example.com>', // sender address
//       to: 'alice@example.com, bob@example.com', // list of recipients
//       subject: 'Hello', // subject line
//       text: 'Hello world?', // plain text body
//       html: '<b>Hello world?</b>', // HTML body
//     });

//     console.log('Message sent: %s', info.messageId);
//     // Preview URL is only available when using an Ethereal test account
//     console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
//   } catch (err) {
//     console.error('Error while sending mail:', err);
//   }
// };
