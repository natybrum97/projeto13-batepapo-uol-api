import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
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

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const schemaUsuario = Joi.object({
        name: Joi.string().required()
    })

    const validation = schemaUsuario.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const usuario = await db.collection("participants").findOne({ name: name });
        if (usuario) return res.status(409).send("Esse usuário já existe!");

        await db.collection("participants").insertOne({ name: req.body.name, lastStatus: Date.now() });

        const data = dayjs();

        const horaFormatada = data.format('HH:mm:ss');

        await db.collection("messages").insertOne({ from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: horaFormatada });

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

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const user = req.headers.user;

    const schemaMessage = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message').required()
    })

    const validation = schemaMessage.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    if (!user) {
        return res.status(422).send("Não recebemos o user");
    }

    try {
        const usuario = await db.collection("participants").findOne({ name: user });
        console.log(usuario)
        if (!usuario) return res.status(422).send("Esse usuário não está na lista de participantes! Faça o Login novamente.");

        const data = dayjs();

        const horario = data.format('HH:mm:ss');

        await db.collection("messages").insertOne({ from: user, to: to, text: text, type: type, time: horario });

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

})

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    console.log(limit);
    const user = req.headers.user;

    try {
        let mensagens = await db.collection("messages").find({
            $or: [
                { to: "Todos" },
                { to: user },
                { from: user }
            ]
        }).toArray();

        if (limit !== null && typeof limit === 'number' && limit > 0 && Number.isInteger(limit)) {
            // Verificar se o número de mensagens é maior que o limite
            if (mensagens.length > limit) {
                mensagens = mensagens.slice(-limit);
            }
        } else {
            return res.status(422).send("Limite inválido. Certifique-se de que é um número inteiro positivo.");
        }

        res.send(mensagens);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/status", async (req, res) => {

    const user = req.headers.user;

    if (!user) {
        return res.status(422).send("Não recebemos o user");
    }

    try {
        const usuario = await db.collection("participants").findOne({ name: user });
        console.log(usuario)

        if (!usuario) {
            return res.sendStatus(404);
          }

        //await db.collection("messages").insertOne({ from: user, to: to, text: text, type: type, time: horario });

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }

})

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const user = req.headers.user;
	const { ID_DA_MENSAGEM } = req.params;
    console.log(ID_DA_MENSAGEM);

	try {
		const message = await db.collection("messages").findOne({ _id: new ObjectId(ID_DA_MENSAGEM) });

        if(!message){
            return res.sendStatus(404);
        }

        if(message.from !== user){
            return res.sendStatus(401);
        }

        await db.collection("messages").deleteOne({ _id: new ObjectId(ID_DA_MENSAGEM) })

		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
})


const PORT = 5000;

app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}!`));

