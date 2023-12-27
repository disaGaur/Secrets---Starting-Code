import dotenv from "dotenv";
import md5 from "md5";
import express from "express";
import {
    fileURLToPath
} from "url";
import {
    dirname
} from "path";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import encrypt from "mongoose-encryption";
import bcrypt from "bcrypt";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth20";
import findOrCreate from "mongoose-findorcreate";

dotenv.config();
GoogleStrategy.Strategy;

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);
const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Creation of Session
app.use(session({
    secret: "This is our small secret.",
    resave: false,
    saveUninitialzed: false
}));

// Intializing passport
app.use(passport.initialize());
app.use(passport.session());

const url = "mongodb://127.0.0.1:27017/usersDB";
mongoose.connect(url);
const secretSchema = new mongoose.Schema({
    secret : String
});
const usersSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: {
        type : secretSchema
    }

});
// usersSchema.plugin(encrypt, {
//     secret: process.env.SECRET,
//     encryptedFields: ['password']
// });

// Adding passport secruity as a plugin to our database.
usersSchema.plugin(passportLocalMongoose);

usersSchema.plugin(findOrCreate);

const User = mongoose.model("User", usersSchema);
const Secret = mongoose.model("Secret" , secretSchema);
passport.use(User.createStrategy());

// Serializing users and deserializing users
passport.serializeUser(function(user, done) {
    done(null, user);
  });
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  //Google Strategy Function
  passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    scope: ["profile"]
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
  }
));

app.route("/")
    .get((req, res) => {
        res.render("home");
    })

app.route("/login")
    .get((req, res) => {
        res.render("login");
    })
// .post((req, res) => {
//     let email = req.body.username;
//     let passwd = req.body.password;
//     User.find({
//         email: email
//     }).then((data) => {
//         if (data) {
//            bcrypt.compare(passwd, data[0].password, (err, result)=>{
//                 if(result){
//                     res.render("secrets");
//                 }
//                 else{
//                     res.send("Invalid Password");
//                 }
//            })
//         } else
//             res.redirect("/login"); //user not found
//     }).catch((err) => res.send(err));
// });
.post((req, res)=>{
    const user = new User({
        email: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            })
        }
    })
})
app.route("/register")
    .get((req, res) => {
        res.render("register");
    })
    // .post((req, res) => {
    //     let username = req.body.username;
    //     // let passwd = md5(req.body.password);
    //     let passwd = req.body.password;
    //     const saltRounds = 10;
    //     bcrypt.hash(passwd, saltRounds, (err, hash)=>{
    //         User.findOne({
    //             email: username
    //         }).then((data => {
    //             if (data)
    //                 res.redirect("/login");
    //             else {
    //                 const newuser = new User({
    //                     email: username,
    //                     password: hash
    //                 });
    //                 newuser.save();
    //                 res.render("secrets");
    //             }
    //         }));
    //     });


    // });

    .post((req, res) => {
        let username = req.body.username;
        let password = req.body.password;
        User.register({username: username}, password, (err, user)=> {
            if(err){
                console.log(err);
                res.redirect("/register");
            }
            else{
                passport.authenticate("local")(req, res, function(){
                    res.redirect("/secrets");
                })
            }

        });
    });

app.route("/logout")
    .get((req, res)=>{
        req.logout(()=>{
            res.redirect("/");
        });
    });

app.get('/auth/google', passport.authenticate('google'));


app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login', failureMessage: true }),
  function(req, res) {
    res.redirect('/secrets');
  });

app.route("/secrets")
    .get((req, res) => {
        if (req.isAuthenticated())
            {
                User.find({"secret": {$ne: null}}).then((users)=>{
                    res.render("secrets", {userWithSecrets: users.secrets});
                })
            }
        else
            res.redirect("/login");
    })

    app.get("/submit", (req, res)=>{
        if(req.isAuthenticated()){
            res.render("submit");
        }
        else{
            res.redirect("/login");
        }
    });
    app.post("/submit", (req, res)=>{
        let submittedSecret = req.body.secret;
        User.findById(req.user._id).then((user)=>{
            user.secret = new Secret({
                secret : submittedSecret
            }) ;
            user.secret.save();
            user.save();
        });
        res.redirect("/secrets");

    })
app.listen(3000, () => {
    console.log("Server started on port 3000")
});