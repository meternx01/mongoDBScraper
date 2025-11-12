/*jslint node: true */

// Dependencies
var express = require("express");
var mongoose = require("mongoose");
// Require axios and cheerio. This makes the scraping possible
var axios = require('axios');
var cheerio = require("cheerio");

// Initialize Express
var app = express();

// Mongoose connection (fail-fast)
var MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scraper';
mongoose.set('bufferCommands', false);
mongoose.connection.on('error', function (err) { console.error('Mongoose error:', err); });

mongoose.connect(MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 })
	.then(function () {
		app.listen(3000, function () {
			console.log("App running on port 3000!");
		});
	})
	.catch(function (err) {
		console.error('Mongoose connection error:', err && err.message);
		process.exit(1);
	});

// Define a simple schema/model
var ScrapedSchema = new mongoose.Schema({
	title: { type: String, required: true, trim: true, index: true },
	link: { type: String, required: true, unique: true },
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
				var title = ($(element).children().text() || "").trim();

				results.push({
					title: title,
					link: link
				});
			});

			// drop items without a valid link or title
			results = results.filter(function (r) {
				return r.link && /^https?:\/\//i.test(r.link) && r.title && r.title.length > 0;
			});
			console.log(results.length);
			if (!results.length) {
				return res.status(200).json({ inserted: 0, matched: 0, modified: 0, message: 'No valid articles after validation' });
			}

			// Upsert by link to avoid duplicate key errors and support partial success cleanly
			var ops = results.map(function (doc) {
				return {
					updateOne: {
						filter: { link: doc.link },
						update: { $setOnInsert: doc },
						upsert: true
					}
				};
			});

			Scraped.bulkWrite(ops, { ordered: false })
				.then(function (bw) {
					// Normalize counts across MongoDB driver versions
					var upserted = typeof bw.upsertedCount === 'number' ? bw.upsertedCount
							: (bw.result && bw.result.upserted ? bw.result.upserted.length : 0);
					var matched = typeof bw.matchedCount === 'number' ? bw.matchedCount : (bw.result && bw.result.nMatched) || 0;
					var modified = typeof bw.modifiedCount === 'number' ? bw.modifiedCount : (bw.result && bw.result.nModified) || 0;
					res.status(201).json({ inserted: upserted, matched: matched, modified: modified });
				})
				.catch(function (err) {
					console.error('Bulk write error:', err && err.message);
					res.status(500).json({ error: 'Bulk write failed', details: err && err.message });
				});
		})
		.catch(function (err) {
			console.error('Error fetching page:', err && err.message);
			res.status(502).json({ error: 'Fetch failed', details: err && err.message });
		});

});
