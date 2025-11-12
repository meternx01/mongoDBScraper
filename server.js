/*jslint node: true */

// Dependencies
var express = require("express");
var mongoose = require("mongoose");
// Require axios and cheerio. This makes the scraping possible
var axios = require('axios');
var cheerio = require("cheerio");

// Initialize Express
var app = express();

// Mongoose connection
var MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scraper';
mongoose.connect(MONGO_URI, {autoIndex: false}).catch(function (err) {
  console.error('Mongoose connection error:', err && err.message);
});
mongoose.connection.on('error', function (err) { console.error('Mongoose error:', err); });

// Define a simple schema/model
var ScrapedSchema = new mongoose.Schema({
  title: { type: String, index: true },
  link: String,
  createdAt: { type: Date, default: Date.now }
});
// Avoid model overwrite on hot reload
var Scraped = mongoose.models.Scraped || mongoose.model('Scraped', ScrapedSchema);

// Main route (simple Hello World Message)
app.get("/", function (req, res) {
	res.send("Hello world");
});

// Route 1
// =======
// This route will retrieve all of the data
// from the scrapedData collection as a json (this will be populated
// by the data you scrape using the next route)
app.get("/scrape", function (req, res) {
	// use axios instead of request
	axios.get('https://www.infowars.com/')
		.then(function (response) {
			var $ = cheerio.load(response.data);

			var results = [];

			$("div.article-content > h3").each(function (i, element) {
				var link = $(element).children().attr("href");
				var title = $(element).children().text();

				results.push({
					title: title,
					link: link
				});
			});

			console.log(results.length);
			if (!results.length) {
        return res.status(200).json({ inserted: 0, message: 'No articles matched selector' });
      }

      // Bulk insert (ignore duplicate titles by using unordered insertMany and filtering errors)
      Scraped.insertMany(results, { ordered: false })
        .then(function (docs) {
          console.log('Inserted', docs.length, 'docs');
          res.status(201).json({ inserted: docs.length });
        })
        .catch(function (err) {
          // Duplicate key errors ignored; respond with partial success if any
          console.error('Insert error:', err && err.message);
          res.status(500).json({ error: 'Insert failed', details: err && err.message });
        });
		})
		.catch(function (err) {
			console.error('Error fetching page:', err && err.message);
			res.status(502).json({ error: 'Fetch failed', details: err && err.message });
		});

});

// Listen on port 3000
app.listen(3000, function () {
	console.log("App running on port 3000!");
});
