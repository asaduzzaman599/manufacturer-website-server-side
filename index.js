require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');


const app = express()
const port = process.env.PORT || 5000;

//middleware 
app.use(cors())
app.use(express.json())

//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8uvbg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



(async () => {
    try {
        await client.connect()
        console.log('DB Connected')

        //collections
        const collectionProduct = client.db('vehicle_portion_db').collection('product')
        const collectionUser = client.db('vehicle_portion_db').collection('user')



        //User Api
        app.put('/user/:email', async (req, res) => {
            const body = req.body
            const { email } = req.params
            if (!email && !body?.name) {
                return
            }
            console.log(body)

            const filter = {
                email: email
            }
            const updateDoc = {
                $set: body
            }
            const option = {
                upsert: true
            }
            const result = await collectionUser.updateOne(filter, updateDoc, option)

            console.log(result)
            //jwt token issue
            const token = jwt.sign({
                email
            }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })

            res.send({ success: true, accessToken: token })

        })

        app.get('/user', async (req, res) => {
            const users = await collectionUser.find().toArray()

            res.send(users)
        })

        app.put('/admin/:userId', async (req, res) => {
            const { userId } = req.params
            const filter = {
                _id: ObjectId(userId)
            }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }

            const result = await collectionUser.updateOne(filter, updateDoc)
            res.send(result)
        })

        //product rest api

        app.get('/product', async (req, res) => {

            const result = await collectionProduct.find({}).toArray()


            res.send(result)


        })


        app.get('/product/:partId', async (req, res) => {
            const { partId } = req.params
            const result = await collectionProduct.findOne({ _id: ObjectId(partId) })

            res.send(result)


        })

        app.post('/product', async (req, res) => {
            const body = req.body;
            console.log(body)
            if (!body?.name || !body?.price || !body?.description || !body?.quantity || !body?.minimumOrder || !body?.img) {
                res.send({ success: false, message: 'Please provide all informations' })
            }

            const result = await collectionProduct.insertOne(body);

            if (result?.insertedId) {
                res.send({ success: true, result })
            } else {
                res.send({ success: false, message: 'Something went wrong' })
            }


            res.send(result)


        })


    } finally {

    }
})().catch(console.dir)

app.get('/', (req, res) => {
    res.send(`Server running port : ${port}`)
})


app.listen(port, () => {
    console.log(`Server running port : ${port}`)
})