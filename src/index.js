const express = require("express");
const app = express();
const path = require("path");
const hbs = require("hbs");
const session = require('express-session');
const bcrypt = require('bcrypt');
const { loginCollection, recipeCollection } = require("./mongodb");

const templatePath = path.join(__dirname, '../templates');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session setup
app.use(session({
  secret: 'your_secret_key', // Replace with a strong secret key
  resave: false,
  saveUninitialized: false
}));

// Set up view engine and templates
app.set("view engine", "hbs");
app.set("views", templatePath);

// Middleware to check if the user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

hbs.registerPartials(path.join(__dirname, '../templates/components'));

app.use(async (req, res, next) => {
  try {
      if (req.session.userId) {
          const user = await loginCollection.findById(req.session.userId);
          if (user) {
              res.locals.user = user;
              console.log(`User logged in: ${user.name}`);
          } else {
              res.locals.user = null;
              console.log("User not found");
          }
      } else {
          res.locals.user = null;
          console.log("No user session found");
      }
  } catch (err) {
      console.error("Error fetching user:", err);
      res.locals.user = null;
  }
  next();
});

// Routes
app.get("/", (req, res) => {
  res.render("login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/add_recipe", checkAuthenticated, (req, res) => {
  res.render("add_recipe");
});

app.post("/add_recipe", checkAuthenticated, async (req, res) => {
  try {
      const newRecipe = {
          title: req.body.title,
          picture: req.body.image,
          owner: req.session.userId,
          ingredients: req.body.ingredients.split(',').map(ingredient => ingredient.trim()), // Assuming comma-separated ingredients
          instructions: req.body.instructions
      };

      await recipeCollection.create(newRecipe);
      res.redirect("/my_recipes");
  } catch (err) {
      console.error(err);
      res.send("Error adding recipe");
  }
});

app.post("/signup", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const data = {
      name: req.body.name,
      password: hashedPassword
    };

    const newUser = await loginCollection.create(data);
    req.session.userId = newUser._id; // Store user ID in session
    res.render("home");
  } catch (err) {
    console.error(err);
    res.send("Error during signup");
  }
});

app.post("/login", async (req, res) => {
  try {
    const user = await loginCollection.findOne({ name: req.body.name });

    if (user) {
      const validPassword = await bcrypt.compare(req.body.password, user.password);
      if (validPassword) {
        req.session.userId = user._id; // Store user ID in session
        res.render("home");
      } else {
        res.send("Invalid password");
      }
    } else {
      res.send("Invalid username or password");
    }
  } catch (err) {
    console.error(err);
    res.send("Error during login");
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send("Error during logout");
    }
    res.redirect('/login');
  });
});

// Protected route
app.get("/my_recipes", checkAuthenticated, async (req, res) => {
  try {
    const recipes = await recipeCollection.find({ owner: req.session.userId });
    res.render("my_recipes", { recipes });
  } catch (err) {
    console.error(err);
    res.send("Error retrieving recipes");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});