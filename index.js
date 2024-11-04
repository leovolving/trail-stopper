const fs = require("fs");
const https = require("https");

const highs = require("./highs.json");

const generateHighsAndLosses = (acc, q) => {
  const { h, l, symbol } = q;
  if (!acc.highs[symbol] || h > acc.highs[symbol]) {
    console.log(`in high for ${symbol}: ${h}`);
    acc.highs[symbol] = h;
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

const isClosedForHoliday = async () => {
  const url = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.API_KEY}`;
  const { holiday } = await getHttpsRequest(url);
  console.log(holiday);
  return !!holiday && !holiday.tradingHour;
};

const getStockPriceQuotes = async () => {
  if (await isClosedForHoliday()) {
    console.log("Closed for holiday");
    return;
  }

  const symbols = process.env.SYMBOLS.split(",");

  const allQuotes = symbols.map((symbol) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.API_KEY}`;
    return getHttpsRequest(url).then((res) => ({ ...res, symbol }));
  });

  return Promise.all(allQuotes).then(processQuotes).catch(logError);
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
    stopLosses: [],
  });

  updateHighs(highsAndLosses.highs);
  sendAlert(highsAndLosses.stopLosses);
};

const sendAlert = async (symbols) => {
  if (!symbols.length) return;
  const symbolsString = symbols.join(", ");
  console.error(`stop losses for ${symbolsString}`);
};

const updateHighs = (newHighs) => {
  fs.writeFile("./highs.json", JSON.stringify(newHighs), "utf8", (err) => {
    if (err) return console.error(err);
  });
};

getStockPriceQuotes();
