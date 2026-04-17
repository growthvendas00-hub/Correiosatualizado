exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const auth = "Basic " + Buffer.from(
    `${process.env.FREEPAY_PUBLIC_KEY}:${process.env.FREEPAY_SECRET_KEY}`
  ).toString("base64");

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
    parsedBody.amount = 6798;
    if (parsedBody.items && parsedBody.items.length > 0) {
      parsedBody.items[0].unit_price = 6798;
    }
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

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

  return {
    statusCode: response.status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
};
