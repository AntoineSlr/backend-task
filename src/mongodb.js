const mongoose=require("mongoose")
const bcrypt = require('bcrypt');

mongoose.connect("mongodb://localhost:27017/backend")
.then(()=>{
    console.log("mongo connected");
})
.catch(()=>{
    console.log("failed to connect");
})

const LoginSchema=new mongoose.Schema({
    name: {
        type:String,
        required:true
    },
    password: {
        type:String,
        required:true
    }
})

const RecipeSchema = new mongoose.Schema({
    title: {
      type: String,
      required: true
    },
    image: {
      type: String
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoginCollection',
      required: true
    },
    ingredients: [String],
    instructions: String
  });

const loginCollection=new mongoose.model("LoginCollection", LoginSchema)
const recipeCollection=new mongoose.model("RecipeCollection", RecipeSchema);

module.exports = { loginCollection, recipeCollection };