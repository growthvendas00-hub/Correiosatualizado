exports.handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const cpf = event.queryStringParameters?.cpf;
  if (!cpf) {
    return { statusCode: 400, body: JSON.stringify({ error: "CPF obrigatorio" }) };
  }

  const token = process.env.SEARCH_API_TOKEN;
  
  try {
    const response = await fetch(`https://searchapi.dnnl.live/consulta?token_api=${token}&cpf=${cpf}`);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro na consulta de CPF" })
    };
  }
};
