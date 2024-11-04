import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt from "bcrypt"; // Ensure bcrypt is imported

function checkAuthentication(req, res, next) {
    if (isLoggedIn) {
        return next(); // User is logged in, proceed to the next middleware/route
    } else {
        res.redirect('/login'); // User is not logged in, redirect to login page
    }
}

env.config()

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

let isLoggedIn = false;
let user = ""; // Variable to store the logged-in user's name
let erro = "";

const app = express();
const port = 3000;
const saltRounds = 10;

// Connection to DB
db.connect();

// Middlewares 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set engine
app.set('views', './views');
app.set('view engine', 'ejs');

// Login page
app.get('/', (req, res) => {
    res.render('home.ejs', { error: erro, isLoggedIn, user }); // Pass user
    setTimeout(() => {
        erro = ""; // Clear the error after 3 seconds
    }, 3000);
});

app.get('/login', (req, res) => {
    res.render('login.ejs', { error: "", isLoggedIn, user }); // Pass user
});

app.get('/signup', async (req, res) => {
    res.render('signup', { error: "", isLoggedIn, user }); // Pass user
});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const result = await db.query("SELECT * FROM users WHERE usuario = $1", [username]);
        if (result.rows.length > 0) {
            const match = await bcrypt.compare(password, result.rows[0].password);
            if (match) {
                isLoggedIn = true; // Set the login status
                user = result.rows[0].usuario; // Store the logged-in user's name
                return res.redirect('/index'); // Redirect to index after login
            } else {
                return res.render("login.ejs", { error: "Invalid user or password", isLoggedIn, user }); // Pass user
            }
        } else {
            return res.render('login.ejs', { error: "Invalid user or password", isLoggedIn, user }); // Pass user
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/signup', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const checkForUser = await db.query("SELECT * FROM users WHERE usuario = $1", [username]);
        if (checkForUser.rows.length > 0) {
            return res.render('signup.ejs', { error: "User already exists", isLoggedIn, user }); // Pass user
        } else {
            const hash = await bcrypt.hash(password, saltRounds);
            await db.query("INSERT INTO users (usuario, password) VALUES ($1, $2)", [username, hash]);
            return res.render('login.ejs', { error: "", isLoggedIn, user }); // Pass user
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Home page
app.get('/index', checkAuthentication, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM college_courses");
        const courses = result.rows;
        res.render('index', { user, courses, isLoggedIn }); // Pass user
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/registros', checkAuthentication, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM college_courses");
        const courses = result.rows; // Fetch the latest data from the database
        res.render('registros', { data: courses, isLoggedIn, user }); // Pass user
    } catch (err) {
        console.error("Error fetching records", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

// Render form for creating new record
app.get('/cadastro', (req, res) => {
    res.render('form-cadastro', { name: "Éverton Peres", isLoggedIn, user }); // Pass user
});

// Create new record
app.post('/inserir', async (req, res) => {
    let { codigo, nome, carga, professor } = req.body;
    const values = [codigo, nome.toUpperCase(), carga, professor.toUpperCase()];
    
    try {
        await db.query(`INSERT INTO college_courses(codigod, nomed, cargad, professor) VALUES($1, $2, $3, $4) ON CONFLICT(codigod) DO NOTHING`, values);
        res.redirect('/registros');
    } catch (err) {
        console.error("Error executing insert", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

// Render form with data from selected record
app.post('/editar', async (req, res) => {
    let codigod = req.body.codigod;
    try {
        const result = await db.query(`SELECT * FROM college_courses WHERE codigod = $1`, [codigod]);
        const course = result.rows[0];
        res.render('edit', { 
            codigo: course.codigod,
            nome: course.nomed,
            carga: course.cargad,
            professor: course.professor,
            isLoggedIn, // Pass isLoggedIn
            user // Pass user
        });
    } catch (err) {
        console.error("Error fetching course", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

// Update record
app.post('/update', async (req, res) => {
    const { codigo, nome, carga, professor } = req.body;

    if (!codigo || !nome || !carga || !professor) {
        return res.status(400).send("All fields are required.");
    }

    const values = [nome.toUpperCase(), carga, professor.toUpperCase(), Number(codigo)];

    try {
        const result = await db.query(`UPDATE college_courses SET nomed = $1, cargad = $2, professor = $3 WHERE codigod = $4`, values);
        if (result.rowCount === 0) {
            return res.status(404).send("Record not found or no changes made.");
        }
        res.redirect('/registros');
    } catch (err) {
        console.error("Error updating record", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

// Delete record
app.post('/delete', async (req, res) => {
    const cod = Number(req.body.codigod);
    
    try {
        await db.query(`DELETE FROM college_courses WHERE codigod = $1`, [cod]);
        res.redirect('/registros'); // Redirect to see the updated list
    } catch (err) {
        console.error("Error deleting course", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/logout', (req, res) => {
    isLoggedIn = false; // Reset the login status
    user = ""; // Clear the user variable
    res.redirect('/'); // Redirect to the login page
});

// Start server
app.listen(port, (req, res) => {
    console.log(`Server started on port ${port}`);
});
