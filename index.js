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

//jwt token verify
const tokenVerify = (req, res, next) => {
    const email = req.query.email
    const authorization = req.headers?.authorization
    if (!email) {
        return
    }
    if (!authorization) {
        return res.status(401).send({ message: "unAuthorized" })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden" })
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
        //check admin or not
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

        //update user data
        app.put('/user/:email', tokenVerify, async (req, res) => {
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

        //get all user data
        app.get('/user', tokenVerify, isAdmin, async (req, res) => {
            const users = await collectionUser.find().toArray()

            res.send(users)
        })

        //get specific user data
        app.get('/user/:email', tokenVerify, async (req, res) => {
            const { email } = req.params
            const user = await collectionUser.findOne({ email })

            if (!user) {
                res.send({ success: false, message: "user Not Found" })
            }
            else {
                res.send({ success: true, user })
            }
        })

        //updating user data
        app.patch('/user/:email', tokenVerify, async (req, res) => {
            const { email } = req.params
            const userInfo = req.body;

            if (!userInfo?.phone && !userInfo?.location && !userInfo?.education && !userInfo?.linkedin) {
                return res.send({ success: false, message: "Nothing to update" })
            }

            const filter = { email }
            const updateDoc = {
                $set: userInfo
            }
            const result = await collectionUser.updateOne(filter, updateDoc)

            res.send(result)

        })

        //update user role to admin
        app.put('/admin/:userId', tokenVerify, isAdmin, async (req, res) => {
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
        //get all product
        app.get('/product', async (req, res) => {
            const limit = req.query.limit;

            const result = await collectionProduct.find({}).sort({ _id: -1 }).toArray()

            if (limit) {
                res.send(result.slice(0, +limit))
            } else {
                res.send(result)
            }


        })

        //get a specific product
        app.get('/product/:partId', async (req, res) => {
            const { partId } = req.params
            const result = await collectionProduct.findOne({ _id: ObjectId(partId) })

            res.send(result)


        })

        //post a product 
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


        //delete product
        app.delete('/product/:productId', tokenVerify, isAdmin, async (req, res) => {
            const { productId } = req.params

            const query = {
                _id: ObjectId(productId)
            }

            const result = await collectionProduct.deleteOne(query)

            res.send(result)
        })

        //***************** Order ***************/

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

        // get only one users order
        app.get('/order', tokenVerify, async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            const result = await collectionOrder.find(query).toArray()

            res.send(result)
        })

        //get specific order
        app.get('/order/:orderId', tokenVerify, async (req, res) => {
            const { orderId } = req.params
            const query = {
                _id: ObjectId(orderId)
            }
            const result = await collectionOrder.findOne(query)

            res.send(result)
        })

        //get all order
        app.get('/allOrder', tokenVerify, isAdmin, async (req, res) => {
            const result = await collectionOrder.find().toArray()

            res.send(result)
        })

        // update order
        app.delete('/order/:orderId', tokenVerify, async (req, res) => {
            const { orderId } = req.params

            const query = {
                _id: ObjectId(orderId)
            }

            const result = await collectionOrder.deleteOne(query)

            res.send(result)
        })

        // update order
        app.put('/order/:orderId', tokenVerify, async (req, res) => {
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
        //review post
        app.post('/review', async (req, res) => {
            const body = req.body;

            if (!body.name || !body.email || !body.rating || !body.description) {
                return res.send({ success: false, message: "Please provide all information" })
            }

            const result = await collectionReview.insertOne(body)

            res.send({ success: true, result })
        })

        //get all review 
        app.get('/review', async (req, res) => {

            const result = await collectionReview.find().sort({ _id: -1 }).toArray()
            res.send(result)
        })

        //************* Payment *************//

        //Payment client secret
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