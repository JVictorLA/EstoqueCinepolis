const bcrypt = require("bcrypt");

async function gerarHash() {
    const senha = "123456";
    const hash = await bcrypt.hash(senha, 10);

    console.log("HASH GERADA:");
    console.log(hash);
}

gerarHash();