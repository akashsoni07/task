require("dotenv").config();
var nodemailer = require("nodemailer");

exports.mailSender = function(mailOptions) {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USER_NAME,
        pass: process.env.PASS_CODE,
      },
    });

    transporter
      .sendMail(mailOptions)
      .then((info) => {
        if (info) {
          resolve("successfully");
        }
      })
      .catch((err) => {
        if (err) {
          resolve("err");
        }
      });
  });
};
