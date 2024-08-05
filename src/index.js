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
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: false
}));

app.set("view engine", "hbs");
app.set("views", templatePath);

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

app.get(["/",'/home'], async (req, res) => {
  try {
    const allRecipes = await recipeCollection.find({});
    res.render("home", { recipes: allRecipes });
  } catch (err) {
    console.error(err);
    res.send("Error retrieving recipes");
  }
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

app.get("/recipe/:id", checkAuthenticated, async (req, res) => {
  try {
      const recipe = await recipeCollection.findById(req.params.id).populate('owner');;
      const isOwner = recipe.owner.equals(req.session.userId);
      if (recipe) {
          res.render("recipe_detail", { recipe, isOwner });
      } else {
          res.status(404).send("Recipe not found");
      }
  } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
  }
});

app.get("/my_recipes", checkAuthenticated, async (req, res) => {
  try {
    const recipes = await recipeCollection.find({ owner: req.session.userId });
    res.render("my_recipes", { recipes });
  } catch (err) {
    console.error(err);
    res.send("Error retrieving recipes");
  }
});

app.get("/edit/:id", checkAuthenticated, async (req, res) => {
  try {
      const recipeId = req.params.id;
      const recipe = await recipeCollection.findById(recipeId);

      if (!recipe) {
          return res.status(404).send("Recipe not found");
      }

      if (!recipe.owner.equals(req.session.userId)) {
          return res.status(403).send("You do not have permission to edit this recipe");
      }

      res.render("edit_recipe", { recipe });
  } catch (err) {
      console.error(err);
      res.status(500).send("Error retrieving recipe details");
  }
});

app.post("/add_recipe", checkAuthenticated, async (req, res) => {
  try {
      const newRecipe = {
          title: req.body.title,
          image: req.body.image,
          owner: req.session.userId,
          ingredients: req.body.ingredients.split(',').map(ingredient => ingredient.trim()),
          instructions: req.body.instructions
      };

      await recipeCollection.create(newRecipe);
      res.redirect("/my_recipes");
  } catch (err) {
      console.error(err);
      res.send("Error adding recipe");
  }
});

app.post("/delete_recipe/:id", checkAuthenticated, async (req, res) => {
  try {
      const recipeId = req.params.id;
      const recipe = await recipeCollection.findById(recipeId);

      if (!recipe) {
          return res.status(404).send("Recipe not found");
      }

      if (!recipe.owner.equals(req.session.userId)) {
          return res.status(403).send("You do not have permission to delete this recipe");
      }

      await recipeCollection.findByIdAndDelete(recipeId);

      res.redirect("/my_recipes");
  } catch (err) {
      console.error(err);
      res.status(500).send("Error deleting recipe");
  }
});

app.post("/edit/:id", checkAuthenticated, async (req, res) => {
  try {
      const recipeId = req.params.id;
      const { title, image, ingredients, instructions } = req.body;

      const recipe = await recipeCollection.findById(recipeId);

      if (!recipe) {
          return res.status(404).send("Recipe not found");
      }

      if (!recipe.owner.equals(req.session.userId)) {
          return res.status(403).send("You do not have permission to edit this recipe");
      }

      recipe.title = title;
      recipe.image = image;
      recipe.ingredients = ingredients.split(',');
      recipe.instructions = instructions;

      await recipe.save();

      res.redirect(`/recipe/${recipeId}`);
  } catch (err) {
      console.error(err);
      res.status(500).send("Error updating recipe");
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
    req.session.userId = newUser._id;
    res.redirect('/home');
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
        req.session.userId = user._id;
        res.redirect('/home');
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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});