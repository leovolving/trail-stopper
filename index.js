const request = require("request-promise-native");
const AWS = require("aws-sdk");
const twilio = require("twilio");

AWS.config.update({ region: "us-west-2" });
const s3 = new AWS.S3();

const s3Bucket = process.env.S3_BUCKET;
const s3Key = "highs.json";
const s3Type = "application/json";
const symbols = process.env.STOCKS;

const getS3Highs = async () => {
  const params = {
    Bucket: s3Bucket,
    Key: s3Key,
  };
  return await s3.getObject(params).promise();
};

const sendNewHighsToS3 = async (highs) => {
  if (!Object.keys(highs).length) return;
  const params = {
    Bucket: s3Bucket,
    Key: s3Key,
    Body: JSON.stringify(highs),
    ContentType: s3Type,
  };
  await s3.putObject(params).promise();
};

const isStopLoss = async (symbol, low, highs) => {
  const high = highs[symbol];
  const loss = ((low - high) / high) * 100;
  console.log("loss for ", symbol, ": ", loss);
  return loss <= -25 && loss > -100;
};

const getStockPriceQuotes = async () => {
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

const generateHighsAndLosses = (acc, q) => {
  const { hi, lo, symbol } = q;
  if (!acc.highs[symbol] || hi > acc.highs[symbol]) {
    console.log(`in high for ${symbol}: ${hi}`);
    acc.highs[symbol] = hi;
  } else if (isStopLoss(symbol, lo, acc.highs)) {
    acc.stopLosses.push(symbol);
  }
  return acc;
};

const processQuotes = async (res) => {
  const quotes = res.response.quotes.quote;
  const currentHighs = await getS3Highs();

  const highsAndLosses = quotes.reduce(generateHighsAndLosses, {
    highs: currentHighs,
    stopLosses: [],
  });

  sendNewHighsToS3(highsAndLosses.highs);
  sendAlert(highsAndLosses.stopLosses);
};

const sendAlert = async (symbols) => {
  if (!symbols.length) return;
  const symbolsString = symbols.join(", ");
  console.log(`stop losses for ${symbolsString}`);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    body: `Sell alert! ${symbolsString}`,
    to: process.env.CLIENT_PHONE_NUMBER,
  });
};

exports.handler = async () => getStockPriceQuotes();
getStockPriceQuotes();
