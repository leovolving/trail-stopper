const request = require('request-promise-native');

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});
const sns = new AWS.SNS({apiVersion: '2010-03-31'});

let config;

const analyzeLow = async (symbol, low) => {
    const high = config.properties.highs[symbol];
    const loss = ((low-high)/high)*100;
    console.log('loss for ', symbol, ': ', loss);
    if (loss <= -25 && loss > -100) sendAlert(symbol);
}

const getAuth = async (callback) => {
    const authOptions = {
        url: `https://${process.env.AUTH0_DOMAIN}.us.auth0.com/oauth/token`,
        method: 'POST',
        json: true,
        body: {
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            audience: `https://${process.env.AUTH0_DOMAIN}.us.auth0.com/api/v2/`,
            grant_type: 'client_credentials'
        },
        headers: { 'Content-Type': 'application/json' },
    }

    return request(authOptions)
        .then(callback)
        .catch(logError);
}

const getConfig = async (auth) => {
    const token = auth.access_token;
    const options = {
        url: process.env.API_DOMAIN + '/config',
        json: true,
        headers: {
            Authorization: `Bearer ${token}`,
            'x-user-id': process.env.AUTH0_USER
        }
    }

    return request(options)
        .then(async res => {
            config = res;
            return getStockPriceQuotes();
        })
        .catch(logError)
}

const getStockPriceQuotes = async () => {
    const url = `https://api.tradeking.com/v1/market/ext/quotes.json?fids=last,hi,lo,name,symbol&symbols=${config.properties.stocks}`;
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
    const quotes = res.response.quotes.quote;
    const currentHighPrices = config.properties.highs;

    const newHighs = quotes.reduce((highs, q) => {
        console.log('q', q);
        const {hi, lo, symbol} = q;
        if (!highs[symbol] || hi > highs[symbol]) {
            console.log(`in hi for ${symbol}`);
            highs[symbol] = hi;
        } else {
            analyzeLow(symbol, lo);
        }
        return highs;
    }, currentHighPrices);

    await sendNewHighs(newHighs);
}

const sendAlert = async symbol => {
    const params = {
        Message: `SELL ALERT! Sell ${symbol}`,
        TopicArn: process.env.TOPIC_ARN
    };
    await sns.publish(params).promise();
}

const sendNewHighs = async (highs) => getAuth()
    .then(auth => {
        if (!Object.keys(highs).length) return;
        
        const token = auth.access_token;
        const requestOptions = {
            url: process.env.API_DOMAIN + '/config', 
            json: true,
            method: 'PUT',
            body: {highs},
            headers: {
                Authorization: `Bearer ${token}`,
                'x-user-id': process.env.AUTH0_USER
            }
        }
        return request(requestOptions);
    });

exports.handler = async () => getAuth(getConfig);
