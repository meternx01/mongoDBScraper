/*jslint node: true */

// Dependencies
var express = require("express");
var mongojs = require("mongojs");
// Require request and cheerio. This makes the scraping possible
var request = require("request");
var cheerio = require("cheerio");

// Initialize Express
var app = express();

// Database configuration
var databaseUrl = "scraper";
var collections = ["scrapedData"];

// Hook mongojs configuration to the db variable
var db = mongojs(databaseUrl, collections);
db.on("error", function (error) {
	console.log("Database Error:", error);
});

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
	request("https://www.infowars.com/", function (error, response, html) {

		var $ = cheerio.load(html);

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
//		var returnValue = [];
		for (var i = 0; i < results.length; i++) {
//			console.log("sending", results[i]);
			db.scrapedData.insert(results[i], function (err, doc) {
				console.log("SCRAPED", doc.title);
			});
		}
		
	});
	
});

// Listen on port 3000
app.listen(3000, function () {
	console.log("App running on port 3000!");
});
