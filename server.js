const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const moment = require("moment");

const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(
    process.env.MLAB_URI || "mongodb://localhost:27017/exercise-track-db"
);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
});

//Schemas
var users_schema = new mongoose.Schema({
    username: {
        type: String,
    },
    _id: {
        type: String,
    },
});

var exercises_schema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    duration: {
        type: Number,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
    },
});

//Models
var users_model = mongoose.model("users", users_schema);

var exercises_model = mongoose.model("exercises", exercises_schema);

app.post("/api/exercise/new-user", async(req, res) => {
    var newUserName = req.body.username;
    try {
        if (newUserName) {
            const user = await users_model.findOne({
                username: newUserName,
            });

            if (user) {
                res.send("username already taken");
            } else {
                var ID = function() {
                    // Math.random should be unique because of its seeding algorithm.
                    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
                    // after the decimal.
                    return Math.random().toString(36).substr(2, 9);
                };
                const new_id = await ID();

                // a document instance
                const newUser = new users_model({
                    username: newUserName,
                    _id: new_id,
                });

                // save model to database
                await newUser.save(function(err) {
                    if (err) return res.json({ error: err });
                    res.json({ username: newUserName, _id: new_id });
                });
            }
        } else {
            res.send("Path `username` is required.");
        }
    } catch (err) {
        res.send(err);
    }
});

app.post("/api/exercise/add", async(req, res) => {
    try {
        const userId = req.body.userId;
        const description = req.body.description;
        const duration = req.body.duration;
        const date = req.body.date === "" ? new Date() : new Date(req.body.date);

        const user = await users_model.findOne({
            _id: userId,
        });
        if (user) {
            if (description && duration) {
                const newExercise = new exercises_model({
                    username: user.username,
                    description: description,
                    duration: duration,
                    user_id: userId,
                    date: date,
                });

                // save model to database
                await newExercise.save(function(err) {
                    if (err) return res.json({ error: err });
                    res.json({
                        username: user.username,
                        description: description,
                        duration: parseInt(duration),
                        _id: userId,
                        date: moment(date).format("ddd MMM DD YYYY"),
                    });
                });
            } else {
                if (!description) {
                    res.send("Path `description` is required.");
                } else {
                    res.send("Path `duration` is required.");
                }
            }
        } else {
            res.send("unknown _id");
        }
    } catch (err) {
        res.send(err);
    }
});

app.get("/api/exercise/users", async(req, res) => {
    try {
        res.send(await users_model.find({}));
    } catch (err) {
        res.send(err);
    }
});

app.get("/api/exercise/log", async(req, res) => {
    try {
        const userId = req.query.userId;
        const from = req.query.from;
        const to = req.query.to;
        const limit = req.query.limit;

        var result = {};

        const userExist = await users_model.findOne({ _id: userId });

        if (userExist) {
            result["_id"] = userId;
            result["username"] = userExist.username;
            var exercises = [];

            if (from && !to) {
                result["from"] = moment(from).format("ddd MMM DD YYYY");
                exercises = await exercises_model
                    .find({}, "description duration date")
                    .where("user_id", userId)
                    .where("date")
                    .gte(new Date(from))
                    .limit(parseInt(limit));
            } else if (!from && to) {
                result["to"] = moment(to).format("ddd MMM DD YYYY");
                exercises = await exercises_model
                    .find({}, "description duration date")
                    .where("user_id", userId)
                    .where("date")
                    .lte(new Date(to))
                    .limit(parseInt(limit));
            } else if (from && to) {
                result["from"] = moment(from).format("ddd MMM DD YYYY");
                result["to"] = moment(to).format("ddd MMM DD YYYY");
                exercises = await exercises_model
                    .find({}, "description duration date")
                    .where("user_id", userId)
                    .where("date")
                    .gte(new Date(from))
                    .lte(new Date(to))
                    .limit(parseInt(limit));
            } else {
                exercises = await exercises_model
                    .find({}, "description duration date")
                    .where("user_id", userId)
                    .limit(parseInt(limit));
            }
            result["count"] = exercises.length;
            result["log"] = [];
            if (exercises.length > 0) {
                for (var i in exercises) {
                    result.log.push({
                        description: exercises[i].description,
                        duration: exercises[i].duration,
                        date: moment(exercises[i].date).format("ddd MMM DD YYYY"),
                    });
                }
            }

            res.send(result);
        } else {
            res.send("unknown userId");
        }
    } catch (err) {
        res.send(err);
    }
});

// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage;

    if (err.errors) {
        // mongoose validation error
        errCode = 400; // bad request
        const keys = Object.keys(err.errors);
        // report the first validation error
        errMessage = err.errors[keys[0]].message;
    } else {
        // generic or custom error
        errCode = err.status || 500;
        errMessage = err.message || "Internal Server Error";
    }
    res.status(errCode).type("txt").send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log("Your app is listening on port " + listener.address().port);
});