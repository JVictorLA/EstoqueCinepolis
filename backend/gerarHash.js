const bcrypt = require("bcrypt");

async function gerarHash() {
    const senha = process.env.PASSWORD_TO_HASH || process.argv[2];
    if (!senha) {
        throw new Error("Informe a senha em PASSWORD_TO_HASH ou como primeiro argumento.");
    }
    const hash = await bcrypt.hash(senha, 10);

    console.log("HASH GERADA:");
    console.log(hash);
}

gerarHash();
