export const handler = async (event, context) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: "ID obrigatorio" }) };
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

    if (data && data.success && data.data && data.data.status === 'PAID' && process.env.UTMIFY_API_TOKEN) {
      const utmifyPayload = {
        orderId: String(data.data.id || id),
        platform: "freepay",
        paymentMethod: "pix",
        status: "paid",
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        approvedDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
        customer: {
          name: data.data.customer?.name || "Cliente Nao Informado",
          email: data.data.customer?.email || "cliente@naoinformado.com",
          phone: data.data.customer?.phone || null,
          document: data.data.customer?.document?.number || "11111111111",
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
        trackingParameters: {
          src: data.data.items?.[0]?.external_ref || null, sck: null, utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null
        },
        commission: {
          totalPriceInCents: 6798,
          gatewayFeeInCents: 0,
          userCommissionInCents: 6798,
          currency: "BRL"
        }
      };

      try {
        fetch("https://api.utmify.com.br/api/campaigns/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Token": process.env.UTMIFY_API_TOKEN
          },
          body: JSON.stringify(utmifyPayload)
        }).catch(err => console.error("Ignored utmify error:", err));
      } catch (utmErr) {
        // ignore
      }
    }

    return { statusCode: response.status, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erro ao consultar status" }) };
  }
};
