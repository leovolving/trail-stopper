const request = require("request-promise-native");
const fs = require("fs");
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

const getStockPriceQuotes = async () => {
  const symbols = process.env.STOCKS.split(",");

  const allQuotes = symbols.map((symbol) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.API_KEY}`;
    const requestOptions = { url, json: true };
    // TODO: replace request with http
    return request(requestOptions).then((res) => ({ ...res, symbol }));
  });

  return Promise.all(allQuotes).then(processQuotes).catch(logError);
};

const isStopLoss = (symbol, low) => {
  const high = highs[symbol];
  const loss = ((low - high) / high) * 100;
  return loss <= -25 && loss > -100;
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
