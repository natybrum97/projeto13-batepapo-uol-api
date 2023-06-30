import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from 'dayjs';

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
	await mongoClient.connect();
	console.log("MongoDB conectado!");
} catch (err) {
	(err) => console.log(err.message);
}

const db = mongoClient.db();

app.post("/participants", async(req,res) => {
    const { name } = req.body;

    const schemaUsuario = Joi.object({
        name: Joi.string().required()
	})

    const validation = schemaUsuario.validate(req.body, { abortEarly: false });

	if (validation.error) {
		const errors = validation.error.details.map(detail => detail.message);
		return res.status(422).send(errors);
	}

    try{
        const usuario = await db.collection("participants").findOne({ name: name });
        if (usuario) return res.status(409).send("Esse usuário já existe!");

        await db.collection("participants").insertOne({name: req.body.name, lastStatus: Date.now()});

        const data = dayjs();

        const horaFormatada = data.format('HH:mm:ss');

        await db.collection("messages").insertOne({from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: horaFormatada});

		res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

})

app.get("/participants", async (req, res) => {
	try {
		const participantes = await db.collection("participants").find().toArray();
		res.send(participantes);
	} catch (err) {
		res.status(500).send(err.message)
	}
})

const PORT = 5000;

app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}!`));

