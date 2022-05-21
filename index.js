require('dotenv').config()
const express = require('express');
const cors = require('cors');
const res = require('express/lib/response');


const app = express()
const port = process.env.PORT || 5000;

//middleware 
app.use(cors())
app.use(express.json())



app.get('/', (req, res) => {
    res.send(`Server running port : ${port}`)
})

app.listen(port, () => {
    console.log(`Server running port : ${port}`)
})