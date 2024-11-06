const fs = require("fs");
const https = require("https");

const highs = require("./highs.json");

const generateHighsAndLosses = (acc, q) => {
  const { h, l, symbol } = q;
  if (!acc.highs[symbol] || h > acc.highs[symbol]) {
    console.log(`in high for ${symbol}: ${h}`);
    acc.highs[symbol] = h;
    acc.newHighs.push(symbol);
  } else if (isStopLoss(symbol, l)) {
    acc.stopLosses.push(symbol);
  }
  return acc;
};

const getHttpsRequest = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (resp) => {
        let data = "";

        // A chunk of data has been received.
        resp.on("data", (chunk) => {
          data += chunk;
        });

        // The whole response has been received.
        resp.on("end", () => {
          resolve(JSON.parse(data));
        });
      })
      .on("error", (err) => {
        reject(err.message);
      });
  });
};

const getStockPriceQuotes = async () => {
  if (await isClosedForHoliday()) {
    console.log("Closed for holiday");
    return;
  }

  const symbols = process.env.SYMBOLS.split(",");

  const allQuotes = symbols.map((symbol) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`;
    return getHttpsRequest(url).then((res) => ({ ...res, symbol }));
  });

  return Promise.all(allQuotes).then(processQuotes).catch(logError);
};

const getSymbolsString = (symbols) => {
  return symbols.length > 0 ? symbols.join(", ") : "none";
};

const isClosedForHoliday = async () => {
  const url = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.FINNHUB_API_KEY}`;
  const { holiday } = await getHttpsRequest(url);
  console.log(holiday);
  return !!holiday && !holiday.tradingHour;
};

const isStopLoss = (symbol, low) => {
  const high = highs[symbol];
  const loss = ((low - high) / high) * 100;
  const stop = process.env.TRAILING_STOP || 25;
  return loss <= -stop && loss > -100;
};

const logError = (e) => console.error(e.message);

const processQuotes = async (quotes) => {
  const highsAndLosses = quotes.reduce(generateHighsAndLosses, {
    highs,
    newHighs: [],
    stopLosses: [],
  });

  updateHighs(highsAndLosses.highs);
  sendAlert(highsAndLosses.stopLosses);

  const newHighsString = getSymbolsString(highsAndLosses.newHighs);
  const stopLossesString = getSymbolsString(highsAndLosses.stopLosses);
  const summaryMessage = `Trail Stopper\nNew highs: ${newHighsString};\nStop losses: ${stopLossesString}`;

  if (!!(process.env.TEXTBELT_PHONE && process.env.TEXTBELT_KEY)) {
    await sendTextMessage(summaryMessage);
  }
};

const sendAlert = async (symbols) => {
  if (!symbols.length) return;
  const symbolsString = getSymbolsString(symbols);
  console.error(`stop losses for ${symbolsString}`);
};

const sendTextMessage = async (message) => {
  const options = {
    hostname: "textbelt.com",
    path: "/text",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const textMessage = () =>
    new Promise((resolve, reject) => {
      const req = https.request(options, (resp) => {
        let data = "";
        resp.on("data", (chunk) => {
          data += chunk;
        });
        resp.on("end", () => {
          resolve(JSON.parse(data));
        });
      });

      req.on("error", (err) => {
        reject(err.message);
      });

      const data = JSON.stringify({
        message,
        phone: process.env.TEXTBELT_PHONE,
        key: process.env.TEXTBELT_KEY,
      });
      req.write(data);
      req.end();
    });

  return textMessage().then(verifyTextsRemaining).catch(console.error);
};

const updateHighs = (allHighsUpdated) => {
  const allHighsUpdatedString = JSON.stringify(allHighsUpdated);
  fs.writeFile("./highs.json", allHighsUpdatedString, "utf8", (err) => {
    if (err) return console.error(err);
  });
};

const verifyTextsRemaining = async (res) => {
  if (!res.success) {
    console.error(res.error);
    return sendTextMessage(
      "Textbelt failed to send a text. This is likely because there are only 10 texts remaining. Visit the Textbelt website to resolve"
    );
  }

  console.log("texts remaining: ", res.quotaRemaining);
  if (res.quotaRemaining === 11) {
    await sendTextMessage(
      "10 text messages remaining. Renew at https://textbelt.com/purchase/ with key stored in 1Password Secure Note"
    );
  }
};

getStockPriceQuotes();
