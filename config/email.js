const axios = require('axios');
require('dotenv').config();

// Função para enviar e-mail via API HTTP do Sendinblue
async function enviarEmailSendinblue(emailDestinatario, novaSenha) {
    const api_key = process.env.SENDINBLUE_API_KEY;
    
    const url = "https://api.sendinblue.com/v3/smtp/email";
    const headers = {
        "api-key": api_key,
        "Content-Type": "application/json"
    };
    
    const data = {
        "sender": { "email": "suporteumpfinanceiro@gmail.com" },
        "to": [{ "email": emailDestinatario }],
        "subject": "Recuperação de Senha",
        "textContent": `Olá!\n\nSua nova senha é: ${novaSenha}\n\nEste é um e-mail automático. Por favor, não responda a esta mensagem.`
    };
    
    try {
        const resposta = await axios.post(url, data, { headers });
        if (resposta.status === 200 || resposta.status === 201) {
            console.log("E-mail enviado com sucesso!");
            return true;
        } else {
            console.error(`Erro ao enviar o e-mail: ${resposta.status} - ${resposta.data}`);
            return false;
        }
    } catch (error) {
        console.error("Erro na requisição HTTP:", error.response ? error.response.data : error.message);
        return false;
    }
}

module.exports = enviarEmailSendinblue;
