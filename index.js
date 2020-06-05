const request = require('request-promise-native');

//TODO: replace with s3 data
const currentHighPrices = {
    "DIS": "127.8200",
    "SPG": "125.4500"
}

const symbols = ['SPG', 'DIS'];
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
    console.log('quotes', quotes)
    quotes.reduce((highs, q, i) => {
        const {hi, lo, symbol} = q;
        if (hi > highs[symbol]) {
            highs[symbol] = hi;
        } else {
            // TODO: delete from 'highs' (wait until testing done)
            analyzeLow(symbol, lo);
        }
        return highs;
    }, currentHighPrices)
}

const analyzeLow = (symbol, low) => {
    const high = currentHighPrices[symbol];
    const loss = ((low-high)/high)*100;
    if (loss <= -25) {
        // TODO: send alert
    }
}

getQuotes()
