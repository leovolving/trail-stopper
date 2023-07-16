const fetch = require("node-fetch");
const AWS = require("aws-sdk");

AWS.config.update({ region: "us-west-2" });
const symbols = process.env.STOCKS;
const highs = {};

const isStopLoss = async (symbol, low) => {
  const high = highs[symbol];
  const loss = ((low - high) / high) * 100;
  console.log("loss for ", symbol, ": ", loss);
  return loss <= -25 && loss > -100;
};

const getStockPriceQuotes = async () => {
  const url = `https://api.tradeking.com/v1/market/ext/quotes.json?fids=last,hi,lo,name,symbol&symbols=${symbols}`;
  // TODO: fix OAuth 1.0 request settings
  const oauth = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN_KEY,
    token_secret: process.env.ACCESS_TOKEN_SECRET,
  };
  const requestOptions = { oauth, method: "GET" };

  return fetch(url, requestOptions).then(processQuotes).catch(logError);
};

const logError = (e) => console.error(e.message);

const generateHighsAndLosses = (acc, q) => {
  console.log("q", q);
  const { hi, lo, symbol } = q;
  if (!acc.highs[symbol] || hi > acc.highs[symbol]) {
    console.log(`in hi for ${symbol}`);
    acc.highs[symbol] = hi;
  } else if (isStopLoss(symbol, lo)) {
    acc.stopLosses.push(symbol);
  }
  return acc;
};

const processQuotes = async (res) => {
  console.log(res.status);
  const json = await res.text();
  console.log(JSON.parse(json));
  const quotes = res.body.quotes.quote;

  const highsAndLosses = quotes.reduce(generateHighsAndLosses, {
    highs,
    stopLosses: [],
  });

  // TODO: post new highs
  sendAlert(highsAndLosses.stopLosses);
};

const sendAlert = async (symbols) => {
  if (!symbols.length) return;
  // TODO: send text via Twilio
};

exports.handler = async () => getStockPriceQuotes();
getStockPriceQuotes();
