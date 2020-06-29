const request = require('request-promise-native');

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});
const sns = new AWS.SNS({apiVersion: '2010-03-31'});
const s3 = new AWS.S3();
const s3Bucket = process.env.S3_BUCKET;
const s3Key = 'highs.json';
const s3Type = 'application/json';
const symbols = [
    'ACC',
    'CVS',
    'EPD',
    'GKOS',
    'GMAB',
    'IEP',
    'LAZ',
    'LX',
    'MOMO',
    'MRVL',
    'MYOK',
    'NEO',
    'NEP',
    'NVCR',
    'PFPT',
    'PYPL',
    'VRTX',
    'ZTO',
    'GDX',
    'SMFG',
    'VEON',
    'DIS',
    'Z'
];

const getStockPriceQuotes = async () => {
    const url = `https://api.tradeking.com/v1/market/ext/quotes.json?fids=last,hi,lo,name,symbol&symbols=${symbols.join(',')}`;
    const oauth = {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        token: process.env.ACCESS_TOKEN_KEY,
        token_secret: process.env.ACCESS_TOKEN_SECRET
    }
    const requestOptions = { oauth, url, json: true };

    return request(requestOptions).then(processQuotes).catch(logError);
};

const logError = e => console.error(e.message);

const processQuotes = async res => {
    currentHighPrices = await getPrices().then(r => JSON.parse(r.Body.toString())).catch(logError);
    const quotes = res.response.quotes.quote;

    const newHighs = quotes.reduce((highs, q) => {
        console.log('q', q);
        const {hi, lo, symbol} = q;
        if (hi > highs[symbol]) {
            console.log(`in hi for ${symbol}`);
            highs[symbol] = hi;
        } else {
            analyzeLow(symbol, lo);
        }
        return highs;
    }, currentHighPrices);

    await sendNewHighsToS3(newHighs);
}

const getPrices = async () => {
    const params = {
        Bucket: s3Bucket,
        Key: s3Key
    };
    return await s3.getObject(params).promise();
}

const sendNewHighsToS3 = async highs => {
    if (!Object.keys(highs).length) return;
    const destparams = {
        Bucket: s3Bucket,
        Key: s3Key,
        Body: JSON.stringify(highs),
        ContentType: s3Type
    };
    await s3.putObject(destparams).promise();
}

const analyzeLow = async (symbol, low) => {
    const high = currentHighPrices[symbol];
    const loss = ((low-high)/high)*100;
    console.log('loss for ', symbol, ': ', loss);
    if (loss <= -25) sendAlert(symbol);
}

const sendAlert = async symbol => {
    const params = {
        Message: `SELL ALERT! Sell ${symbol}`,
        TopicArn: process.env.TOPIC_ARN
    };
    await sns.publish(params).promise();
}

exports.handler = async () => getStockPriceQuotes();
