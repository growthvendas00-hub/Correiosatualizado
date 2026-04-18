export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const auth = "Basic " + Buffer.from(
    `${process.env.FREEPAY_PUBLIC_KEY}:${process.env.FREEPAY_SECRET_KEY}`
  ).toString("base64");

  let parsedBody;
  try {
    if (typeof req.body === 'string') {
      parsedBody = JSON.parse(req.body);
    } else {
      parsedBody = req.body;
    }
    
    parsedBody.amount = 6798;
    if (parsedBody.items && parsedBody.items.length > 0) {
      parsedBody.items[0].unit_price = 6798;
    }
  } catch(e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  try {
    const response = await fetch("https://api.freepaybrasil.com/v1/payment-transaction/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": auth,
      },
      body: JSON.stringify(parsedBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Erro na criacao do pix" });
  }
}
