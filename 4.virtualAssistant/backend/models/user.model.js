import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    assistantName:{
        type:String
    },
     assistantImage:{
        type:String
    },
    history:[
        {type:String}
    ],
    health: {
    latestHeartRate: Number,
    latestTemperature: Number,
    updatedAt: Date,
    lastSuggestion: {
        tag: String,
        at: Date,
        message: String,
        usedAI: Boolean
    },
    consecutive: { type: Object, default: {} }
    },
    phone: 
    { type: String, default: null }


},{timestamps:true})

const User=mongoose.model("User",userSchema)
export default User