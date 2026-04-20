export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const cpf = req.query.cpf;
  if (!cpf) {
    return res.status(400).json({ error: "CPF obrigatorio" });
  }

  const token = process.env.SEARCH_API_TOKEN;
  
  try {
    const response = await fetch(`https://searchapi.dnnl.live/consulta?token_api=${token}&cpf=${cpf}`);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Erro na consulta de CPF" });
  }
}
