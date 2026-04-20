export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const auth = "Basic " + Buffer.from(
    `${process.env.FREEPAY_PUBLIC_KEY}:${process.env.FREEPAY_SECRET_KEY}`
  ).toString("base64");

  let parsedBody;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
    
    parsedBody.amount = 6798;
    if (parsedBody.items && parsedBody.items.length > 0) {
      parsedBody.items[0].unit_price = 6798;
    }
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
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

    if (data && data.success && data.data && data.data.id && process.env.UTMIFY_API_TOKEN) {
      const utmifyPayload = {
        orderId: String(data.data.id),
        platform: "freepay",
        paymentMethod: "pix",
        status: "waiting_payment",
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        customer: {
          name: parsedBody.customer?.name || "Cliente Nao Informado",
          email: parsedBody.customer?.email || "cliente@naoinformado.com",
          phone: parsedBody.customer?.phone || null,
          document: parsedBody.customer?.document?.number || null,
        },
        products: [
          {
            id: "taxa-liberacao",
            name: "Taxa de Liberacao",
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: 6798
          }
        ],
        trackingParameters: parsedBody.trackingParameters || {
          src: parsedBody.items?.[0]?.external_ref || null, sck: null, utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null
        },
        commission: {
          totalPriceInCents: 6798,
          gatewayFeeInCents: 0,
          userCommissionInCents: 6798,
          currency: "BRL"
        }
      };

      fetch("https://api.utmify.com.br/api/campaigns/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Token": process.env.UTMIFY_API_TOKEN
        },
        body: JSON.stringify(utmifyPayload)
      }).catch(err => console.error("Ignored utmify error:", err));
    }

    return { statusCode: response.status, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erro na criacao do pix" }) };
  }
};
