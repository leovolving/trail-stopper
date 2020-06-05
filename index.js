const AWS = require('aws-sdk');
const request = require('request-promise-native');
AWS.config.update({region: 'us-west-2'});


//TODO: replace with s3 data
const currentHighPrices = {
    "CVS": "0",
    "DRVD": "0",
    "EPD": "0",
    "ET": "0",
    "GKOS": "0",
    "GMAB": "0",
    "IEP": "0",
    "LX": "0",
    "MOMO": "0",
    "MRVL": "0",
    "MYOK": "0",
    "NEO": "0",
    "NVCR": "0",
    "PFPT": "0",
    "PYPL": "0",
    "SPG": "0",
    "VRTX": "0",
    "ZTO": "0",
    "GDX": "0",
    "SMFG": "0",
    "VEON": "0",
    "DIS": "0"
}

const symbols = ['CVS',
'DRVD',
'EPD',
'ET',
'GKOS',
'GMAB',
'IEP',
'LX',
'MOMO',
'MRVL',
'MYOK',
'NEO',
'NVCR',
'PFPT',
'PYPL',
'SPG',
'VRTX',
'ZTO',
'GDX',
'SMFG',
'VEON',
'DIS'];
const url = `https://api.tradeking.com/v1/market/ext/quotes.json?fids=hi,lo,name,symbol&symbols=${symbols.join(',')}`;
const oauth = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    token: process.env.ACCESS_TOKEN_KEY,
    token_secret: process.env.ACCESS_TOKEN_SECRET
}

const requestOptions = { oauth, url, json: true };

const getQuotes = () => request(requestOptions).then(processQuotes);

const processQuotes = res => {
    const quotes = res.response.quotes.quote;
    const newHighs = quotes.reduce((highs, q) => {
        const {hi, lo, symbol} = q;
        if (hi > highs[symbol]) {
            highs[symbol] = hi;
        } else {
            analyzeLow(symbol, lo);
        }
        return highs;
    }, currentHighPrices)
    sendNewHighsToS3(newHighs);
}

const analyzeLow = (symbol, low) => {
    const high = currentHighPrices[symbol];
    const loss = ((low-high)/high)*100;

    if (loss <= -25) sendAlert(symbol);
}

const sendAlert = symbol => {
    const params = {
        Message: `SELL ALERT! Sell ${symbol}`,
        TopicArn: 'arn:aws:sns:us-west-2:120597452984:LeoTexts'
    };
  
    // Create promise and SNS service object
    const snsPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();
    snsPromise.catch(e => console.error(`Error sending message for ${symbol}`, e.message));
}

getQuotes()
