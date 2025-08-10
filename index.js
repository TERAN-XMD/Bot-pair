const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const qrRouter = require('./qr');
const codeRouter = require('./pair');

app.use('/server', qrRouter);
app.use('/code', codeRouter);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'pair.html'));
});
app.get('/qr', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'qr.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'main.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
