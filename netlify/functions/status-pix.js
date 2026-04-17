exports.handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: "ID obrigatorio" }) };
  }

  const auth = "Basic " + Buffer.from(
    `${process.env.FREEPAY_PUBLIC_KEY}:${process.env.FREEPAY_SECRET_KEY}`
  ).toString("base64");

  const response = await fetch(`https://api.freepaybrasil.com/v1/payment-transaction/info/${id}`, {
    headers: {
      "Accept": "application/json",
      "Authorization": auth,
    },
  });

  const data = await response.json();

  return {
    statusCode: response.status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
};
