const request = require("request-promise-native");
const fs = require("fs");
const highs = require("./highs.json");

const isStopLoss = (symbol, low) => {
  const high = highs[symbol];
  const loss = ((low - high) / high) * 100;
  return loss <= -25 && loss > -100;
};

const getStockPriceQuotes = async () => {
  const symbols = process.env.STOCKS;
  const url = `https://api.tradeking.com/v1/market/ext/quotes.json?fids=last,hi,lo,name,symbol&symbols=${symbols}`;
  const oauth = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    token: process.env.ACCESS_TOKEN_KEY,
    token_secret: process.env.ACCESS_TOKEN_SECRET,
  };
  const requestOptions = { oauth, url, json: true };

  // TODO: find Oauth 1.0-friendly alternative to request
  return request(requestOptions).then(processQuotes).catch(logError);
};

const logError = (e) => console.error(e.message);

const updateHighs = (newHighs) => {
  fs.writeFile("./highs.json", JSON.stringify(newHighs), "utf8", (err) => {
    if (err) return console.error(err);
  });
};

const generateHighsAndLosses = (acc, q) => {
  const { hi, lo, symbol } = q;
  if (!acc.highs[symbol] || hi > acc.highs[symbol]) {
    console.log(`in high for ${symbol}: ${hi}`);
    acc.highs[symbol] = hi;
  } else if (isStopLoss(symbol, lo)) {
    acc.stopLosses.push(symbol);
  }
  return acc;
};

const processQuotes = async (res) => {
  const quotes = res.response.quotes.quote;

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

getStockPriceQuotes();
