const router = require("express").Router();
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { mailSender } = require("../utils/mailSender");
const { googleAuthClient } = require("google-auth-library");
const fetch = require("node-fetch")
require("dotenv").config();

const client = new googleAuthClient("");

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone_number, dob } = req.body;
    if (!name || !email || !password || !phone_number || !dob) {
      return res.status(400).json({
        message: "Please add all the details",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be 6 characters long",
      });
    }
    const user = await User.findOne({ email });
    if (user)
      return res.status(400).json({ message: "This email already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone_number,
      dob,
      grade: req.body.grade,
      class: req.body.class,
    });

    await newUser.save();
    res.status(201).json({ message: "User signup successfully" });
  } catch (error) {
    res.status(400).json({ error });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, phone_number, password } = req.body;
    if (!email || !password || !phone_number) {
      return res.status(400).json({ message: "Please add all the details" });
    }
    const user = await User.findOne({ email, phone_number });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or phone number" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY);
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        dob: user.dob,
        class: user.class,
        grade: user.grade,
      },
    });
  } catch (error) {
    res.status(400).json({ error });
  }
});

router.post("/forgotpassword", (req, res) => {
  crypto.randomBytes(32, (error, buffer) => {
    if (error) {
      return res.status(400).json({ error });
    }
    const token = buffer.toString("hex");
    User.findOne({
      email: req.body.email,
    }).then((user) => {
      if (!user) {
        return res.status(400).json({ message: "Invalid email" });
      }
      (user.resetToken = token), (user.expireToken = Date.now() + 900000);
      user.save().then(async () => {
        const uri = `${process.env.BASE_URI}/#/resetpassword?token=${token}`;
        const mailOptions = {
          from: "clumpcoder@clumpcoder.com",
          to: `${req.body.email}`,
          subject: "Password reset",
          html: `<p>You requested for password reset</p>
                <a href="${uri}">Click on this link </a>
                ${uri}`,
        };
        let resolve = await mailSender(mailOptions);
        if (resolve === "successfully") {
          res.status(200).json({
            message: "Mail Sent Successfully",
          });
        }
      });
    });
  });
});

router.post("/resetpassword", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({
      message: "Please add all the details",
    });
  }
  User.findOne({
    resetToken: token,
    expireToken: {
      $gte: Date.now(),
    },
  })
    .then((user) => {
      if (!user) {
        res.status(400).json({
          message: "Please try again, Session has expired",
        });
      }
      bcrypt.hash(newPassword, 12).then((hashedPassword) => {
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.expireToken = undefined;
        user
          .save()
          .then(() => {
            return res.status(201).json({
              message: "Password updated successfully",
            });
          })
          .catch(() => {
            return res.status(400).json({
              message: "Failed to change password",
            });
          });
      });
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
});

router.post("/googlelogin", (req, res) => {
  const { token } = req.body;
  client.verifyIdToken({ token, audience: "" }).then((response) => {
    const { email, name } = response.payload;
    User.findOne({ email }).exec((err, user) => {
      if (err) {
        return res.status(400).json({ message: "Something went wrong" });
      } else {
        if (user) {
          const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY);
          res.status(201).json({
            token,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
            },
          });
        } else {
          let password = email + process.env.SECRET_KEY;
          let newUser = new User({ name, email, password });
          newUser.save((err, data) => {
            if (err) {
              return res.status(400).json({ message: "Something went wrong" });
            }
            if (data) {
              const token = jwt.sign({ _id: data._id }, process.env.SECRET_KEY);
              res.status(201).json({
                token,
                user: {
                  _id: newUser._id,
                  name: newUser.name,
                  email: newUser.email,
                },
              });
            }
          });
        }
      }
    });
  });
});

router.post("/facebooklogin",(req,res)=>{
  const{userId,accessToken} = req.body
  let urlGraphFacebook = `https://graph.facebook.com/v2.11/${userId}/?fields=id,name,email&access_token=${accessToken}`
  fetch(urlGraphFacebook,{
    method:'GET'
  })
  .then(response=>response.json())
  .then(response=>{
    const {email,name} = response
    User.findOne({email}).exec((err,user)=>{
      if (err) {
        return res.status(400).json({ message: "Something went wrong" });
      } else {
        if (user) {
          const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY);
          res.status(201).json({
            token,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
            },
          });
        } else {
          let password = email + process.env.SECRET_KEY;
          let newUser = new User({ name, email, password });
          newUser.save((err, data) => {
            if (err) {
              return res.status(400).json({ message: "Something went wrong" });
            }
            if (data) {
              const token = jwt.sign({ _id: data._id }, process.env.SECRET_KEY);
              res.status(201).json({
                token,
                user: {
                  _id: newUser._id,
                  name: newUser.name,
                  email: newUser.email,
                },
              });
            }
          });
        }
      } 
    })
  })

})

module.exports = router;
