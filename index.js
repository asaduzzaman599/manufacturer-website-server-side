require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const res = require('express/lib/response');
const stripe = require("stripe")(process.env.SECRET_API_KEY);

const app = express()
const port = process.env.PORT || 5000;

//middleware 
app.use(cors())
app.use(express.json())


const tokenVerify = (req, res, next) => {
    const email = req.query.email
    const authorization = req.headers?.authorization
    if (!email) {
        return
    }
    if (!authorization) {
        return res.send({ message: "unAuthorized" })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.send({ message: "unAuthorized" })
        }
        if (email === decoded.email) {
            next()
        }

    });
}


//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8uvbg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });




(async () => {
    try {
        await client.connect()
        console.log('DB Connected')

        //collections
        const db = client.db('vehicle_portion_db');
        const collectionProduct = db.collection('product')
        const collectionUser = db.collection('user')
        const collectionOrder = db.collection('order')
        const collectionReview = db.collection('review')


        //************* Admin ***********//

        const isAdmin = async (req, res, next) => {
            const { email } = req.query

            const query = {
                email: email
            }
            const user = await collectionUser.findOne(query)

            if (user?.role === 'admin') {

                next()
            }

        }

        app.get('/admin', tokenVerify, async (req, res) => {
            const { email } = req.query

            const query = {
                email: email
            }
            const user = await collectionUser.findOne(query)

            if (user?.role === 'admin') {
                res.send({ success: true, admin: true })
            } else {
                res.send({ success: false, admin: false })
            }
        })


        //********** User Api************//

        app.put('/user/:email', async (req, res) => {
            const body = req.body
            const { email } = req.params
            if (!email && !body?.name) {
                return
            }

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

        //********** product Api************//
        app.get('/product', async (req, res) => {
            const limit = req.query.limit;

            const result = await collectionProduct.find({}).sort({ _id: -1 }).toArray()

            if (limit) {
                res.send(result.slice(0, +limit))
            } else {
                res.send(result)
            }


        })


        app.get('/product/:partId', async (req, res) => {
            const { partId } = req.params
            const result = await collectionProduct.findOne({ _id: ObjectId(partId) })

            res.send(result)


        })

        app.post('/product', tokenVerify, isAdmin, async (req, res) => {
            const body = req.body;
            if (!body?.name || !body?.price || !body?.description || !body?.quantity || !body?.minimumOrder || !body?.img) {
                res.send({ success: false, message: 'Please provide all informations' })
            }

            const result = await collectionProduct.insertOne(body);

            if (result?.insertedId) {
                res.send({ success: true, result })
            } else {
                res.send({ success: false, message: 'Something went wrong' })
            }




        })

        app.delete('/product/:productId', tokenVerify, isAdmin, async (req, res) => {
            const { productId } = req.params

            const query = {
                _id: ObjectId(productId)
            }

            const result = await collectionProduct.deleteOne(query)

            res.send(result)
        })

        //purchase order
        app.post('/order', async (req, res) => {

            const body = req.body

            if (!body?.name || !body?.email || !body?.address || !body?.phone || !body?.description || !body?.productId || !body?.product || !body?.orderQuantity || !body?.unitPrice || !body?.totalAmount) {
                return res.send({ success: false, message: "Please Provide all information" })
            }

            const result = await collectionOrder.insertOne(body)

            //updating the product data
            if (result.insertedId) {
                const filter = {
                    _id: ObjectId(body.productId)
                }
                const product = await collectionProduct.findOne(filter)
                const quantity = parseInt(product.quantity) - parseInt(body.orderQuantity);

                const updateDoc = {
                    $set: { quantity }
                }
                const updateResult = await collectionProduct.updateOne(filter, updateDoc)

            }
            res.send({ success: true, result })


        })

        app.get('/order', tokenVerify, async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            const result = await collectionOrder.find(query).toArray()

            res.send(result)
        })

        app.get('/order/:orderId', tokenVerify, async (req, res) => {
            const { orderId } = req.params
            const query = {
                _id: ObjectId(orderId)
            }
            const result = await collectionOrder.findOne(query)

            res.send(result)
        })

        app.get('/allOrder', tokenVerify, isAdmin, async (req, res) => {
            const result = await collectionOrder.find().toArray()

            res.send(result)
        })

        app.delete('/order/:orderId', async (req, res) => {
            const { orderId } = req.params

            const query = {
                _id: ObjectId(orderId)
            }

            const result = await collectionOrder.deleteOne(query)

            res.send(result)
        })

        app.put('/order/:orderId', async (req, res) => {
            const { orderId } = req.params
            const body = req.body

            const filter = {
                _id: ObjectId(orderId)
            }
            const updateDoc = {
                $set: body
            }
            const result = await collectionOrder.updateOne(filter, updateDoc)
            res.send(result)
        })


        //Review

        app.post('/review', async (req, res) => {
            const body = req.body;

            if (!body.name || !body.email || !body.rating || !body.description) {
                return res.send({ success: false, message: "Please provide all information" })
            }

            const result = await collectionReview.insertOne(body)

            res.send({ success: true, result })
        })

        app.get('/review', async (req, res) => {

            const result = await collectionReview.find().sort({ _id: -1 }).toArray()
            res.send(result.slice(0, 6))
        })

        app.post("/create-payment-intent", async (req, res) => {
            const { totalAmount } = req.body;
            const amount = +totalAmount * 100

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

    } finally {

    }
})().catch(console.dir)

app.get('/', (req, res) => {
    res.send(`Server running port : ${port}`)
})


app.listen(port, () => {
    console.log(`Server running port : ${port}`)
})