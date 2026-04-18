export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ message: "ID obrigatorio" });
  }

  const auth = "Basic " + Buffer.from(
    `${process.env.FREEPAY_PUBLIC_KEY}:${process.env.FREEPAY_SECRET_KEY}`
  ).toString("base64");

  try {
    const response = await fetch(`https://api.freepaybrasil.com/v1/payment-transaction/info/${id}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": auth,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao consultar status" });
  }
}
