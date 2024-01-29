# Trail Stopper

A simple NodeJS script that leverages the Fibbhub API to notify the user when any of their specified stocks hit their trailing stop price. It is recommended to run the script everyday that the market is open, preferably around end-of-day.

The script queries quotes from the current day for a specified selection of ticker symbols. The high and the low for the day are compared against the previous high (stored locally in a JSON file) and the trailing stop price, respectively.

## How to use

1. Set up a free API key with Finnhub - https://finnhub.io/register
2. Clone this repo and cd into it
3. Create a `highs.json` file that contains an empty object `{}`
4. Create a `.env` file and add your environment variables (see next section for details)
5. Run `npm i` to install the dependency, `dotenv`
6. Run `npm start` any time you wish to run the script

## Environment variables

### API_KEY

**Required.** Your free API key from Finnhub, available at https://finnhub.io/register

**Example:**

```
API_KEY=abcdefghijk12345
```

### SYMBOLS

**Required.** The ticker(s) you wish to check, comma separated

**Example:**

```
SYMBOLS=AAPL,MSFT
```

### TRAILING_STOP

**Optional.** Integer representing the percentage used to trigger alerts for trailing stop losses.

**Default:** 25

**Example:**

```
TRAILING_STOP=10
```

## Disclaimer

I am not an attorney, accountant or financial advisor, nor am I holding myself out to be, and this app is not a substitute for financial advice from a professional who is aware of the facts and circumstances of your individual situation. Use at your own risk.
